// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run config:import <file.zip> [--only parts] [--except parts] [--yes]` — checks the
// configuration parts of any BiblioViva archive (a backup, "Esporta tutto", "Esporta
// configurazione") against CONFIG_DIR and, with `--yes` and no errors, imports them as one change
// of the history (steps 11.3, 11.12), like Amministrazione → Configurazione → "Importa
// configurazione"; `--only` / `--except` take only some of the archive's configuration parts, the
// others stay as they are. A running server picks the new files up with "Ricarica" (or SIGHUP, or
// a restart); the database is never changed.
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { serverContext } from "#lib/server/context.js";
import { ArchiveReadError } from "#lib/server/services/export-archive.js";
import {
	applyConfigArchive,
	checkConfigArchive,
	discardConfigArchive,
	recheckConfigArchive,
} from "#lib/server/services/full-restore.js";
import { partsFromArgs, positional } from "./parts-args.js";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const file = positional(args)[0];
if (!file || !existsSync(file)) {
	console.error(
		"usage: bun run config:import <biblioviva-….zip> [--only parts] [--except parts] [--yes]",
	);
	process.exit(2);
}
const ctx = serverContext();
const path = resolve(file);
let check;
try {
	check = await checkConfigArchive(ctx, path, { name: basename(path) });
} catch (e) {
	if (e instanceof ArchiveReadError) {
		console.error(`not imported: ${e.message}`);
		process.exit(1);
	}
	throw e;
}
const parts = partsFromArgs(args, check.available);
check = await recheckConfigArchive(ctx, check.token, parts);
console.log(`configuration parts in the archive: ${check.available.join(", ")}`);
console.log(`parts taken: ${check.selected.length > 0 ? check.selected.join(", ") : "none"}`);
const { files, sections, issues, inUse, source } = check;
console.log(
	`archive${source.library ? ` of "${source.library}"` : ""}, ${source.createdAt}, version ${source.version}`,
);
console.log(
	`files: ${files.added.length} new, ${files.changed.length} changed, ${files.removed.length} removed, ${files.unchanged} unchanged`,
);
console.log(`sections changing: ${sections.length > 0 ? sections.join(", ") : "none"}`);
for (const i of issues) {
	console.log(`${i.level.padEnd(7)}  ${i.file ? `${i.file} · ` : ""}${i.path}: ${i.message}`);
}
for (const p of inUse) {
	console.log(`in use   ${p.kind} ${p.code}: ${p.count}`);
}
if (!check.ready) {
	discardConfigArchive(ctx.dataDir, check.token);
	console.error("not imported: fix the errors above first");
	process.exit(1);
}
if (!yes) {
	discardConfigArchive(ctx.dataDir, check.token);
	console.log("the archive can be imported: run again with --yes");
	process.exit(0);
}
const change = await applyConfigArchive(ctx, check.token, null, { parts });
console.log(
	`imported as change ${change.id}; press "Ricarica" in Amministrazione → Configurazione (or restart) if the server is running`,
);
