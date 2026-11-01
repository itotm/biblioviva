// SPDX-License-Identifier: GPL-3.0-or-later
// Generates docs/config-reference.md from config/config.example.json (keys, example values and
// the `_comment*` notes), so the reference never drifts from the example.
import { writeFileSync } from "node:fs";
import { exampleRaw } from "#lib/server/config/load.js";

// the shipped folder merged (config.example.json + classification.json + labels/stocks/*.json)
const example = exampleRaw();

const rows: string[] = [];

function describe(value: unknown): string {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return "array (empty)";
		}
		const first: unknown = value[0];
		if (first && typeof first === "object") {
			return `array of ${value.length} object(s), e.g. \`${JSON.stringify(first).slice(0, 80)}\``;
		}
		return `array, e.g. \`${JSON.stringify(value).slice(0, 80)}\``;
	}
	if (value === null) {
		return "`null`";
	}
	if (typeof value === "object") {
		return "object";
	}
	return `\`${JSON.stringify(value)}\``;
}

function comments(obj: Record<string, unknown>): string {
	return Object.entries(obj)
		.filter(([k]) => k.startsWith("_comment"))
		.map(([, v]) => String(v))
		.join(" ")
		.replace(/\|/g, "\\|");
}

function walk(obj: Record<string, unknown>, prefix: string): void {
	for (const [key, value] of Object.entries(obj)) {
		if (key.startsWith("_comment")) {
			continue;
		}
		const path = prefix ? `${prefix}.${key}` : key;
		const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
		const note = isObject ? comments(value as Record<string, unknown>) : "";
		rows.push(`| \`${path}\` | ${describe(value)} | ${note} |`);
		if (isObject) {
			walk(value as Record<string, unknown>, path);
		}
	}
}

for (const [section, value] of Object.entries(example)) {
	// a note of the whole folder (`_commentFolder`) is not a section
	if (section.startsWith("_comment") || value === null || typeof value !== "object") {
		continue;
	}
	rows.push(`| **\`${section}\`** | section | ${comments(value as Record<string, unknown>)} |`);
	walk(value as Record<string, unknown>, section);
}

const doc = `# Configuration reference

Generated from the shipped folder [\`config/\`](../config/) (\`config.example.json\` + \`classification.json\` +
\`labels/stocks/*.json\`, merged) by \`bun run scripts/config-reference.ts\`; do not edit by hand. The schema
(\`src/lib/server/config/schema.ts\`) validates every key at startup and \`bun run config:check\` checks a
folder without starting the server, as "Import configuration" does with an archive (the schema, the templates,
the pictograms, the reports, the language packs). Keys starting with \`_comment\` are ignored. Secrets never
live here (environment variables, see \`src/env.ts\`).

## The configuration folder

\`CONFIG_DIR\` (the \`/config\` volume) is a folder, not one file (PLAN.md §3.6, Q78). Everything below is
merged at startup and on every reload into the single document described by the table; the merge is
deterministic and \`bun run config:check --explain <key.path>\` prints which file defines a key.

| Path | Contents | Merge rule |
|---|---|---|
| \`config.json\` | the core sections (written by the first-run wizard) | base document |
| \`<section>.json\` (e.g. \`classification.json\`, \`circulation.json\`) | one top-level section | deep-merged over the same section of \`config.json\`; the fragment wins (a warning says so when both define it) |
| \`calendar.<year>.json\` | \`holidays\` and \`closedRanges\` of one year | appended to \`calendar\` |
| \`labels/stocks/<id>.json\` | one adhesive stock (\`id\` defaults to the file stem) | appended to \`labels.stocks\`, replacing a stock with the same \`id\` |
| \`{cards,labels,slips}/templates/<name>/\` | one print template per folder | discovered by name, never merged into JSON |
| \`reports/<name>.json\` | the school's own report definitions; a file with the \`id\` of a built-in replaces it (the built-ins are read from the application, ADR-014) | discovered by \`id\` |
| \`classification/images/\` | pictograms, uploaded from Administration → Configuration → Classification or copied by hand | discovered by code |
| \`branding/logo.png\` | the library's logo (step 4.10), uploaded from Administration → Appearance and language | shown at the top left of the app when present |
| \`history/<change>/\` | the previous version of every file a change from the admin UI touched, with \`change.json\` (step 11.1); the last 50 changes are kept | never loaded; used to restore a previous version |

The editors of Administration → Configuration (Phase 11) write each section back to the file it
comes from, atomically, after validating the whole folder with the same schema; the classification
(\`classification.json\` and its pictograms) is the first one (step 11.1). Editing the files by hand
keeps working.

To add a stock or a template, copy a file or a folder and edit it. The defaults are copied into
\`CONFIG_DIR\` at the first start when missing; \`config.json\` alone is never enough on its own because the
\`classification\` section lives in its fragment.

## Keys

| Key | Example / type | Notes |
|---|---|---|
${rows.join("\n")}
`;

writeFileSync("docs/config-reference.md", doc);
console.log(`docs/config-reference.md written (${rows.length} keys)`);
