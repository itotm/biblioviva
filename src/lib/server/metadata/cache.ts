// SPDX-License-Identifier: GPL-3.0-or-later
// `metadata_cache`: one row per provider and normalised query, kept for `metadata.cacheDays`.
// Only successful answers are cached (an error must be retried on the next lookup).
import { and, eq, lt, or, sql } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { metadataCache } from "#lib/server/db/schema.js";
import type { MetadataQuery, ProviderAnswer, ProviderId } from "./types.js";

const norm = (s: string | undefined): string => (s ?? "").normalize("NFKC").toLowerCase().trim();

/**
 * Bumped when the mapping changes so stale answers are ignored (v2: control characters stripped;
 * v3: SBN searched by ISBN-13 and ISBN-10, so the empty answers of v2 are asked again).
 */
const VERSION = "v4";

export function cacheKey(provider: ProviderId, query: MetadataQuery): string {
	if (query.kind === "isbn") {
		return `${VERSION}:${provider}:isbn:${query.isbn}`;
	}
	return `${VERSION}:${provider}:search:t=${norm(query.title)}|a=${norm(query.author)}|w=${norm(query.words)}`;
}

export function readCache(
	db: DbOrTx,
	provider: ProviderId,
	query: MetadataQuery,
	ttlDays: number,
	now: Date = new Date(),
): ProviderAnswer | null {
	const row = db
		.select({ payload: metadataCache.payload, fetchedAt: metadataCache.fetchedAt })
		.from(metadataCache)
		.where(eq(metadataCache.key, cacheKey(provider, query)))
		.get();
	if (!row) {
		return null;
	}
	const age = now.getTime() - new Date(row.fetchedAt).getTime();
	if (age > ttlDays * 86_400_000) {
		return null;
	}
	return row.payload as ProviderAnswer;
}

export function writeCache(
	db: DbOrTx,
	provider: ProviderId,
	query: MetadataQuery,
	answer: ProviderAnswer,
	now: Date = new Date(),
): void {
	const key = cacheKey(provider, query);
	db.insert(metadataCache)
		.values({ key, provider, payload: answer, fetchedAt: now.toISOString() })
		.onConflictDoUpdate({
			target: metadataCache.key,
			set: { payload: answer, fetchedAt: now.toISOString() },
		})
		.run();
}

/** Drops the entries older than the TTL (called by the maintenance job) and returns how many. */
export function purgeExpiredCache(db: DbOrTx, ttlDays: number, now: Date = new Date()): number {
	const limit = new Date(now.getTime() - ttlDays * 86_400_000).toISOString();
	// lookups only (the "no cover" answers are `cover:…` keys with their own week): the expired ones,
	// and those of an older cache version, which are never read again
	return db
		.delete(metadataCache)
		.where(
			and(
				sql`${metadataCache.key} not like 'cover:%'`,
				or(
					lt(metadataCache.fetchedAt, limit),
					sql`${metadataCache.key} not like ${`${VERSION}:%`}`,
				),
			),
		)
		.run().changes;
}

/** Empties the cache, or only one provider's entries. */
export function clearCache(db: DbOrTx, provider?: ProviderId): number {
	const where = provider ? and(eq(metadataCache.provider, provider)) : sql`1 = 1`;
	return db.delete(metadataCache).where(where).run().changes;
}
