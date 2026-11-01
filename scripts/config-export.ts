// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run config:export [file.zip] [--only parts] [--except parts]` — the archive of the
// configuration parts of CONFIG_DIR in the one archive format (the files under `config/`, a
// manifest), the same as Amministrazione → Configurazione → "Esporta configurazione" (steps 11.3,
// 11.12); `--only` / `--except` choose the parts, for example
// `--only config:cardTemplates,config:reports` or `--except settings`.
import { resolve } from "node:path";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { partsIn } from "#lib/server/services/config-parts.js";
import {
	configArchiveName,
	createExportStream,
	writeStreamTo,
} from "#lib/server/services/export-archive.js";
import { partsFromArgs, positional } from "./parts-args.js";

const args = process.argv.slice(2);
const now = new Date();
const config = getConfig();
const file = resolve(positional(args)[0] ?? configArchiveName(now, config.library.timezone));
const parts = partsFromArgs(args, partsIn(env().CONFIG_DIR));
if (parts.length === 0) {
	console.error("nothing to export: no part matches --only / --except");
	process.exit(2);
}
const { stream } = await createExportStream(getDb(), env().DATA_DIR, env().CONFIG_DIR, {
	timezone: config.library.timezone,
	library: config.library.name,
	now,
	parts,
});
const bytes = await writeStreamTo(stream, file);
console.log(`${file}: ${parts.length} parts, ${(bytes / 1_000_000).toFixed(1)} MB`);
console.log(`parts: ${parts.join(", ")}`);
