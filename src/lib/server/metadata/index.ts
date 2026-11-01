// SPDX-License-Identifier: GPL-3.0-or-later
// Metadata lookup (PLAN.md §3.9, step 3.5): the enabled providers (`metadata.providers`, display
// order) are queried **in parallel**, never as a fallback chain; every candidate comes back with its
// `source` so the operator picks one (owner decision). A failing provider is reported next
// to the others' results instead of hiding them. Answers are cached per provider and query.
import { byCompleteness } from "./score.js";
import { debugLog } from "#lib/server/log/debug.js";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { env, type Env } from "#lib/server/env.js";
import { APP_VERSION } from "#lib/shared/version.js";
import { readCache, writeCache } from "./cache.js";
import { googleBooksProvider } from "./googlebooks.js";
import { mockProvider } from "./mock.js";
import { openLibraryProvider } from "./openlibrary.js";
import { sbnJsonProvider } from "./sbn-json.js";
import { sbnProvider } from "./sbn.js";
import {
	MetadataError,
	type BiblioDraft,
	type LookupResult,
	type MetadataProvider,
	type MetadataQuery,
	type ProviderContext,
	type ProviderId,
	type ProviderOutcome,
} from "./types.js";

export * from "./types.js";
export { cacheKey, clearCache, purgeExpiredCache } from "./cache.js";
export { MOCK_FAILING_ISBN, MOCK_NO_HITS_ISBN, MOCK_RECORDS } from "./mock.js";

export const PROVIDERS: Record<ProviderId, MetadataProvider> = {
	sbn: sbnProvider,
	"sbn-json": sbnJsonProvider,
	openlibrary: openLibraryProvider,
	googlebooks: googleBooksProvider,
	mock: mockProvider,
};

/** The providers to query, in display order; `METADATA_PROVIDER=mock` replaces them all. */
export function enabledProviders(config: AppConfig, environment: Env = env()): MetadataProvider[] {
	if (environment.METADATA_PROVIDER === "mock") {
		return [mockProvider];
	}
	const seen = new Set<ProviderId>();
	const list: MetadataProvider[] = [];
	for (const id of config.metadata.providers) {
		if (!seen.has(id)) {
			seen.add(id);
			list.push(PROVIDERS[id]);
		}
	}
	return list;
}

export function userAgent(config: AppConfig): string {
	const contact = config.library.contactEmail ? ` (${config.library.contactEmail})` : "";
	return `BiblioViva/${APP_VERSION}${contact}`;
}

export function providerContext(
	config: AppConfig,
	over: Partial<ProviderContext> = {},
): ProviderContext {
	const environment = over.env ?? env();
	const tmpDir = over.tmpDir ?? join(environment.DATA_DIR, "tmp");
	if (!existsSync(tmpDir)) {
		mkdirSync(tmpDir, { recursive: true });
	}
	return {
		config,
		env: environment,
		fetch: over.fetch ?? globalThis.fetch,
		userAgent: over.userAgent ?? userAgent(config),
		tmpDir,
	};
}

/** Normalises a query (trimmed strings, ISBN-13 digits) and rejects an empty search. */
export function normalizeQuery(query: MetadataQuery): MetadataQuery {
	if (query.kind === "isbn") {
		return { kind: "isbn", isbn: query.isbn.replace(/[^0-9X]/gi, "").toUpperCase() };
	}
	const trim = (s?: string): string | undefined => {
		const t = s?.replace(/\s+/g, " ").trim();
		return t ? t : undefined;
	};
	const q: MetadataQuery = {
		kind: "search",
		title: trim(query.title),
		author: trim(query.author),
		words: trim(query.words),
	};
	if (!q.title && !q.author && !q.words) {
		throw new Error("empty search");
	}
	return q;
}

/** Control characters (SBN sorting markers) never reach the operator, whatever the provider or cache. */
export function sanitizeDraft(draft: BiblioDraft): BiblioDraft {
	// eslint-disable-next-line no-control-regex -- the markers are control characters by design
	const strip = (s: string): string => s.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
	const text = (v: string | null): string | null => (v === null ? null : strip(v));
	return {
		...draft,
		title: strip(draft.title),
		subtitle: text(draft.subtitle),
		// drafts cached before the original title existed have no such field
		originalTitle: text(draft.originalTitle ?? null),
		responsibility: text(draft.responsibility),
		author: strip(draft.author),
		publisher: strip(draft.publisher),
		publicationPlace: text(draft.publicationPlace),
		physicalDescription: text(draft.physicalDescription),
		// drafts cached before the series existed have no such fields
		series: text(draft.series ?? null),
		seriesNumber: text(draft.seriesNumber ?? null),
		subjects: draft.subjects.map(strip),
	};
}

/** Two candidates are the same only when every field but the source is identical. */
export function fingerprint(draft: BiblioDraft): string {
	const { source: _s, sourceId: _i, ...rest } = draft;
	return JSON.stringify(rest, Object.keys(rest).sort());
}

export function dedupe(candidates: readonly BiblioDraft[]): BiblioDraft[] {
	const seen = new Set<string>();
	const out: BiblioDraft[] = [];
	for (const c of candidates) {
		const fp = fingerprint(c);
		if (!seen.has(fp)) {
			seen.add(fp);
			out.push(c);
		}
	}
	return out;
}

export interface LookupDeps {
	config: AppConfig;
	providers?: MetadataProvider[];
	context?: Partial<ProviderContext>;
	now?: () => Date;
}

async function runProvider(
	db: DbOrTx,
	provider: MetadataProvider,
	query: MetadataQuery,
	ctx: ProviderContext,
	ttlDays: number,
	now: () => Date,
): Promise<ProviderOutcome> {
	const started = performance.now();
	const base = { provider: provider.id, name: provider.name };
	const cached = readCache(db, provider.id, query, ttlDays, now());
	if (cached) {
		return {
			...base,
			hits: cached.hits,
			candidates: cached.drafts,
			cached: true,
			elapsedMs: 0,
			error: null,
		};
	}
	try {
		const answer = await provider.lookup(query, ctx);
		writeCache(db, provider.id, query, answer, now());
		return {
			...base,
			hits: answer.hits,
			candidates: answer.drafts,
			cached: false,
			elapsedMs: Math.round(performance.now() - started),
			error: null,
		};
	} catch (e) {
		const error =
			e instanceof MetadataError
				? { code: e.code, message: e.message }
				: {
						code: "protocol" as const,
						message: e instanceof Error ? e.message : String(e),
					};
		return {
			...base,
			hits: null,
			candidates: [],
			cached: false,
			elapsedMs: Math.round(performance.now() - started),
			error,
		};
	}
}

/**
 * Queries every enabled provider in parallel and merges the candidates, the most complete first
 * (step 9.14: an ISBN lookup opens the form with the first one).
 */
export async function lookupMetadata(
	db: DbOrTx,
	input: MetadataQuery,
	deps: LookupDeps,
): Promise<LookupResult> {
	const query = normalizeQuery(input);
	const providers = deps.providers ?? enabledProviders(deps.config, deps.context?.env);
	const ctx = providerContext(deps.config, deps.context);
	const now = deps.now ?? (() => new Date());
	const ttlDays = deps.config.metadata.cacheDays;
	const settled = await Promise.allSettled(
		providers.map((p) => runProvider(db, p, query, ctx, ttlDays, now)),
	);
	const outcomes = settled.map((s, i) =>
		s.status === "fulfilled"
			? s.value
			: {
					provider: providers[i]?.id ?? "mock",
					name: providers[i]?.name ?? "",
					hits: null,
					candidates: [],
					cached: false,
					elapsedMs: 0,
					error: { code: "protocol" as const, message: String(s.reason) },
				},
	);
	const cleaned = outcomes.map((o) => ({ ...o, candidates: o.candidates.map(sanitizeDraft) }));
	for (const o of cleaned) {
		debugLog("metadata", "lookup", {
			query,
			provider: o.provider,
			hits: o.hits,
			candidates: o.candidates.length,
			cached: o.cached,
			ms: o.elapsedMs,
			error: o.error ? `${o.error.code}: ${o.error.message}` : undefined,
		});
	}
	return {
		query,
		providers: cleaned,
		candidates: byCompleteness(
			dedupe(cleaned.flatMap((o) => o.candidates)),
			deps.config.catalog,
		),
	};
}
