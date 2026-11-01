// SPDX-License-Identifier: GPL-3.0-or-later
// Cover chain (PLAN.md §3.9, step 3.7b, Q27): the enabled `covers.providers` in order, the first image at
// least `covers.minWidth` wide wins; every failure (network, HTML error page, placeholder GIF)
// falls through silently. A provider's "nothing found" is remembered in `metadata_cache` for
// seven days so repeated clicks do not hammer the services.
import { and, eq, like, lt } from "drizzle-orm";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Db } from "#lib/server/db/client.js";
import { metadataCache } from "#lib/server/db/schema.js";
import { env, type Env } from "#lib/server/env.js";
import { debugLog } from "#lib/server/log/debug.js";
import { userAgent } from "#lib/server/metadata/index.js";
import type { AuditActor } from "#lib/server/services/audit.js";
import { BiblioNotFoundError } from "#lib/server/services/catalog.js";
import { type CoverSource, encodeCover, saveCover } from "#lib/server/services/covers.js";
import { isDemoPublic } from "#lib/server/demo/public.js";
import { biblio } from "#lib/server/db/schema.js";
import { amazonCovers } from "./amazon.js";
import { googleBooksCovers } from "./googlebooks.js";
import { mockCovers } from "./mock.js";
import { openLibraryCovers } from "./openlibrary.js";
import type { CoverContext, CoverProvider, CoverProviderId } from "./types.js";

export type { CoverContext, CoverProvider, CoverProviderId } from "./types.js";

export const COVER_PROVIDERS: Record<CoverProviderId, CoverProvider> = {
	googlebooks: googleBooksCovers,
	amazon: amazonCovers,
	openlibrary: openLibraryCovers,
	mock: mockCovers,
};

const NEGATIVE_TTL_MS = 7 * 86_400_000;

/** The providers to try, in order; `METADATA_PROVIDER=mock` replaces them all. */
export function enabledCoverProviders(
	config: AppConfig,
	environment: Env = env(),
): CoverProvider[] {
	if (environment.METADATA_PROVIDER === "mock") {
		return [mockCovers];
	}
	return config.covers.providers.filter((p) => p.enabled).map((p) => COVER_PROVIDERS[p.id]);
}

export function coverContext(config: AppConfig, over: Partial<CoverContext> = {}): CoverContext {
	return {
		fetch: over.fetch ?? globalThis.fetch,
		userAgent: over.userAgent ?? userAgent(config),
		timeoutMs: over.timeoutMs ?? config.covers.timeoutMs,
		country: over.country ?? config.covers.country,
		googleBooksApiKey: over.googleBooksApiKey ?? env().GOOGLE_BOOKS_API_KEY ?? null,
	};
}

const negativeKey = (provider: CoverProviderId, isbn: string): string =>
	`cover:${provider}:${isbn}`;

function isNegativeCached(db: Db, provider: CoverProviderId, isbn: string, now: Date): boolean {
	const row = db
		.select({ fetchedAt: metadataCache.fetchedAt })
		.from(metadataCache)
		.where(eq(metadataCache.key, negativeKey(provider, isbn)))
		.get();
	return row !== undefined && now.getTime() - new Date(row.fetchedAt).getTime() < NEGATIVE_TTL_MS;
}

/** The "no cover" answers older than their week: never read again (9.13, round 16). */
export function purgeCoverNegatives(db: Db, now: Date = new Date()): number {
	const limit = new Date(now.getTime() - NEGATIVE_TTL_MS).toISOString();
	return db
		.delete(metadataCache)
		.where(and(like(metadataCache.key, "cover:%"), lt(metadataCache.fetchedAt, limit)))
		.run().changes;
}

function rememberNegative(db: Db, provider: CoverProviderId, isbn: string, now: Date): void {
	db.insert(metadataCache)
		.values({
			key: negativeKey(provider, isbn),
			provider,
			payload: { found: false },
			fetchedAt: now.toISOString(),
		})
		.onConflictDoUpdate({
			target: metadataCache.key,
			set: { payload: { found: false }, fetchedAt: now.toISOString() },
		})
		.run();
}

/** Width of the image, or null when the bytes are not an image Bun can read. */
async function imageWidth(bytes: Uint8Array): Promise<number | null> {
	try {
		const meta = await new Bun.Image(bytes, { maxPixels: 40_000_000 }).metadata();
		return meta.width;
	} catch {
		return null;
	}
}

export interface CoverHit {
	bytes: Uint8Array;
	provider: CoverProviderId;
	name: string;
	width: number;
}

export interface ChainDeps {
	config: AppConfig;
	providers?: CoverProvider[];
	context?: Partial<CoverContext>;
	now?: () => Date;
	/** Called when a provider fails (logging); failures never stop the chain. */
	onError?: (provider: CoverProviderId, error: unknown) => void;
}

/** The `onError` of the remote functions: a provider's failure on the server's console. */
export function coverLog(provider: CoverProviderId, e: unknown): void {
	console.warn(`[covers] ${provider}: ${e instanceof Error ? e.message : String(e)}`);
}

/** Tries the providers in order and returns the first usable image, or null. */
export async function findCover(db: Db, isbn13: string, deps: ChainDeps): Promise<CoverHit | null> {
	const providers =
		deps.providers ?? enabledCoverProviders(deps.config, deps.context ? undefined : env());
	const ctx = coverContext(deps.config, deps.context);
	const now = deps.now ?? (() => new Date());
	for (const provider of providers) {
		if (isNegativeCached(db, provider.id, isbn13, now())) {
			debugLog("covers", "skipped", { isbn: isbn13, provider: provider.id, cached: "none" });
			continue;
		}
		const started = performance.now();
		let bytes: Uint8Array | null;
		try {
			bytes = await provider.fetch(isbn13, ctx);
		} catch (e) {
			deps.onError?.(provider.id, e);
			debugLog("covers", "failed", { isbn: isbn13, provider: provider.id, error: String(e) });
			continue;
		}
		const width = bytes ? await imageWidth(bytes) : null;
		debugLog("covers", "lookup", {
			isbn: isbn13,
			provider: provider.id,
			bytes: bytes?.byteLength ?? 0,
			width,
			ms: Math.round(performance.now() - started),
		});
		if (bytes && width !== null && width >= deps.config.covers.minWidth) {
			return { bytes, provider: provider.id, name: provider.name, width };
		}
		rememberNegative(db, provider.id, isbn13, now());
	}
	return null;
}

export type DownloadCoverResult =
	| { ok: true; provider: CoverProviderId; name: string }
	| { ok: false; reason: "no_isbn" | "not_found" };

/** "Scarica copertina": finds a cover for the record's ISBN and stores it like a photo. */
export async function downloadCover(
	db: Db,
	dataDir: string,
	biblioId: number,
	actor: AuditActor,
	deps: ChainDeps,
): Promise<DownloadCoverResult> {
	const row = db.select({ isbn: biblio.isbn }).from(biblio).where(eq(biblio.id, biblioId)).get();
	if (!row) {
		throw new BiblioNotFoundError(biblioId);
	}
	if (!row.isbn) {
		return { ok: false, reason: "no_isbn" };
	}
	const hit = await findCover(db, row.isbn, deps);
	if (!hit) {
		return { ok: false, reason: "not_found" };
	}
	await saveCover(
		db,
		dataDir,
		biblioId,
		hit.bytes,
		deps.config.covers,
		actor,
		hit.provider,
		"fetched",
	);
	return { ok: true, provider: hit.provider, name: hit.name };
}

/**
 * The cover chosen in "Nuovo libro", stored with the new record: the bytes the browser sends
 * (a photo, or the provider's cover it was shown). In the public demo the server never keeps
 * the browser's bytes: a provider's cover is fetched again by the server (the mock provider),
 * a photo becomes the demo's placeholder in `saveCover` (Q121).
 */
export async function storeChosenCover(
	db: Db,
	dataDir: string,
	biblioId: number,
	input: { bytes: Uint8Array; source: CoverSource },
	actor: AuditActor,
	deps: ChainDeps,
): Promise<{ ok: boolean }> {
	if (isDemoPublic() && input.source !== "photo") {
		return { ok: (await downloadCover(db, dataDir, biblioId, actor, deps)).ok };
	}
	await saveCover(db, dataDir, biblioId, input.bytes, deps.config.covers, actor, input.source);
	return { ok: true };
}

export interface CoverPreview {
	provider: CoverProviderId;
	name: string;
	/** The cover as it will be stored (format and width of `covers`), for the form to show. */
	bytes: Uint8Array;
	mime: string;
}

/**
 * The cover of an ISBN before its record exists (9.13, round 11): "Nuovo libro" shows it next to
 * the form, and it is stored only when the record is saved.
 */
export async function previewCover(
	db: Db,
	isbn13: string,
	deps: ChainDeps,
): Promise<CoverPreview | null> {
	const hit = await findCover(db, isbn13, deps);
	if (!hit) {
		return null;
	}
	const settings = deps.config.covers;
	return {
		provider: hit.provider,
		name: hit.name,
		bytes: await encodeCover(hit.bytes, settings, "main"),
		mime: settings.format === "jpeg" ? "image/jpeg" : "image/webp",
	};
}
