// SPDX-License-Identifier: GPL-3.0-or-later
// Common shape of the metadata providers (PLAN.md §3.9, step 3.5). Every provider answers the same
// two questions (by ISBN, by title/author) with `BiblioDraft` candidates; the aggregator in
// `index.ts` runs the enabled providers in parallel and hands every candidate to the operator.
import type { BiblioDraft } from "#lib/server/marc/unimarc-map.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Env } from "#lib/server/env.js";

export type { BiblioDraft } from "#lib/server/marc/unimarc-map.js";

export type ProviderId = "sbn" | "openlibrary" | "googlebooks" | "sbn-json" | "mock";

export type MetadataQuery =
	| { kind: "isbn"; isbn: string }
	| { kind: "search"; title?: string; author?: string; words?: string };

export type MetadataErrorCode =
	/** Target not reachable (network, DNS, connection refused). */
	| "unreachable"
	| "timeout"
	/** Unexpected answer (not JSON, no search response, malformed records). */
	| "protocol"
	/** HTTP error status other than rate limiting. */
	| "http"
	| "rate_limited"
	/** The provider needs a setting that is missing (e.g. a Google Books API key). */
	| "not_configured"
	/** yaz-client could not be started. */
	| "spawn";

export class MetadataError extends Error {
	constructor(
		readonly code: MetadataErrorCode,
		message: string,
		readonly detail = "",
	) {
		super(message);
		this.name = "MetadataError";
	}
}

/** What one provider returns for one query (before caching). */
export interface ProviderAnswer {
	/** Total hits reported by the provider, when known (may exceed `drafts.length`). */
	hits: number | null;
	drafts: BiblioDraft[];
}

export interface ProviderContext {
	config: AppConfig;
	env: Env;
	/** Injected in tests; `globalThis.fetch` otherwise. */
	fetch: typeof fetch;
	/** `User-Agent` sent to HTTP providers. */
	userAgent: string;
	/** Temp folder for yaz-client (`DATA_DIR/tmp`). */
	tmpDir: string;
}

export interface MetadataProvider {
	id: ProviderId;
	/** Display name shown next to each candidate. */
	name: string;
	lookup(query: MetadataQuery, ctx: ProviderContext): Promise<ProviderAnswer>;
}

/** Outcome of one provider in a parallel lookup (success or failure, never both hidden). */
export interface ProviderOutcome {
	provider: ProviderId;
	name: string;
	hits: number | null;
	candidates: BiblioDraft[];
	cached: boolean;
	elapsedMs: number;
	error: { code: MetadataErrorCode; message: string } | null;
}

export interface LookupResult {
	query: MetadataQuery;
	providers: ProviderOutcome[];
	/** All candidates, the most complete first, de-duplicated only when identical. */
	candidates: BiblioDraft[];
}
