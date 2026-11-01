// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run z3950:test <isbn | "title words">` — one live query against the default Z39.50 target,
// printing the hits and the mapped drafts (step 3.4). Uses YAZ_CLIENT (ADR-001) and the local
// configuration; the temp files are kept under DATA_DIR/tmp for inspection.
import { join } from "node:path";
import { getConfig } from "#lib/server/config/index.js";
import { env } from "#lib/server/env.js";
import { parseIso2709 } from "#lib/server/marc/iso2709.js";
import { mapUnimarc } from "#lib/server/marc/unimarc-map.js";
import { runYaz, Z3950Error } from "#lib/server/z3950/driver.js";
import { z3950Target } from "#lib/server/z3950/targets.js";
import { toIsbn13 } from "#lib/shared/isbn.js";

const arg = process.argv.slice(2).join(" ").trim();
if (!arg) {
	console.error('usage: bun run z3950:test <isbn | "title words">');
	process.exit(2);
}
const config = getConfig();
const isbn = toIsbn13(arg);
const query = isbn ? { kind: "isbn" as const, isbn } : { kind: "search" as const, title: arg };
const target = z3950Target(config);
console.log(
	`target ${target.name} (${target.host}:${target.port}/${target.database}), query`,
	query,
);
try {
	const result = await runYaz(target, query, {
		command: env().YAZ_CLIENT,
		tmpDir: join(env().DATA_DIR, "tmp"),
		timeoutMs: config.z3950.timeoutMs,
		max: isbn ? config.z3950.maxRecordsIsbn : config.z3950.maxRecordsSearch,
		keepFiles: true,
	});
	console.log(`hits: ${result.hits} in ${result.elapsedMs} ms`);
	for (const record of parseIso2709(result.records)) {
		console.log(JSON.stringify(mapUnimarc(record, config.catalog), null, 2));
	}
} catch (e) {
	if (e instanceof Z3950Error) {
		console.error(`${e.code}: ${e.message}\n${e.stderr}`);
		process.exit(1);
	}
	throw e;
}
