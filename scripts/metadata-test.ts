// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run metadata:test <isbn | "title words"> [provider,...]` — one lookup through the metadata
// aggregator (step 3.5): the enabled providers (or the ones listed) queried in parallel, with the
// per-provider outcome and every candidate. Uses the local configuration, database cache and
// YAZ_CLIENT; `METADATA_PROVIDER=mock` answers offline.
import { getConfig } from "#lib/server/config/index.js";
import { closeDb, getDb } from "#lib/server/db/index.js";
import { lookupMetadata, PROVIDERS, type ProviderId } from "#lib/server/metadata/index.js";
import { toIsbn13 } from "#lib/shared/isbn.js";

const [term, providerList] = process.argv.slice(2);
if (!term) {
	console.error('usage: bun run metadata:test <isbn | "title words"> [sbn,openlibrary,...]');
	process.exit(2);
}
const config = getConfig();
const isbn = toIsbn13(term);
const query = isbn ? { kind: "isbn" as const, isbn } : { kind: "search" as const, title: term };
const providers = providerList
	?.split(",")
	.map((id) => PROVIDERS[id.trim() as ProviderId])
	.filter(Boolean);
console.log(
	"query",
	query,
	"providers",
	(providers ?? []).map((p) => p.id).join(",") || "(config)",
);
const result = await lookupMetadata(getDb(), query, { config, providers });
for (const p of result.providers) {
	const status = p.error ? `${p.error.code}: ${p.error.message}` : `${String(p.hits)} hits`;
	console.log(
		`- ${p.name}: ${status} (${p.candidates.length} candidates, ${p.elapsedMs} ms${p.cached ? ", cached" : ""})`,
	);
}
console.log(JSON.stringify(result.candidates, null, 2));
closeDb();
