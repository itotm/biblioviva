// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run backup:restore <file.zip|file.db> [--only parts] [--except parts] [--yes]` — restores
// any BiblioViva archive ("Esporta tutto", a backup of chosen parts, "Esporta configurazione") or
// a nightly database copy (step 11.12): the file is staged and checked first (what each part holds
// now and in the file, references, configuration problems); with `--yes` and a clean check the
// chosen parts replace the live ones (all the parts of the file by default), the others stay as
// they are. Same checks as Amministrazione → Backup → "Ripristina…". Prefer running it with the
// app stopped.
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { serverContext } from "#lib/server/context.js";
import { ArchiveReadError } from "#lib/server/services/export-archive.js";
import {
	applyRestore,
	checkRestore,
	discardRestore,
	stageRestore,
} from "#lib/server/services/full-restore.js";
import { partsFromArgs, positional } from "./parts-args.js";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const file = positional(args)[0];
if (!file || !existsSync(file)) {
	console.error(
		"usage: bun run backup:restore <biblioviva-….zip | biblioviva-….db> [--only parts] [--except parts] [--yes]",
	);
	process.exit(2);
}
const ctx = serverContext();
const path = resolve(file);
let token: string;
try {
	token = await stageRestore(ctx.dataDir, path, basename(path));
} catch (e) {
	if (e instanceof ArchiveReadError) {
		console.error(`not restored: ${e.message}`);
		process.exit(1);
	}
	throw e;
}
const first = await checkRestore(ctx, token);
const parts = partsFromArgs(args, first.available);
const check = await checkRestore(ctx, token, parts);

console.log(`file: ${path}`);
if (check.source.createdAt) {
	console.log(
		`created: ${check.source.createdAt}${check.source.version ? `, version ${check.source.version}` : ""}`,
	);
}
console.log(`parts in the file: ${check.available.join(", ")}`);
console.log(`parts restored: ${check.selected.length > 0 ? check.selected.join(", ") : "none"}`);
for (const [part, n] of Object.entries(check.data.counts)) {
	console.log(`  ${part}: ${n?.live ?? 0} now, ${n?.archive ?? 0} in the file`);
}
if (check.data.photos + check.data.covers > 0) {
	console.log(`  images: ${check.data.photos} photos, ${check.data.covers} covers`);
}
for (const g of check.data.gaps) {
	console.log(`missing  ${g.rows} rows of ${g.part} point at ${g.needs} that would not be there`);
}
if (check.data.schema.length > 0) {
	console.log(`other version: tables ${check.data.schema.join(", ")} differ`);
}
if (check.config) {
	const f = check.config.files;
	console.log(
		`configuration: ${f.added.length} new, ${f.changed.length} changed, ${f.removed.length} removed files`,
	);
	for (const i of check.config.issues) {
		console.log(`${i.level.padEnd(7)}  ${i.file ? `${i.file} · ` : ""}${i.path}: ${i.message}`);
	}
}
if (!check.ready) {
	discardRestore(ctx.dataDir, token);
	console.error("not restored: fix the choice or the problems above first");
	process.exit(1);
}
if (!yes) {
	discardRestore(ctx.dataDir, token);
	console.log("the file can be restored: run again with --yes");
	process.exit(0);
}
const { change } = await applyRestore(ctx, token, check.selected, null);
console.log(`restored${change ? `; configuration change ${change.id}` : ""}`);
