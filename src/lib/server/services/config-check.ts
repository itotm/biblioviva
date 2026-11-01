// SPDX-License-Identifier: GPL-3.0-or-later
// The one check of a configuration folder (PLAN.md §3.6, steps 11.2, 11.3): what the server would
// load — the schema and its cross-checks over config.json and the fragments —, the templates
// (each folder readable, every one the settings name present), the pictograms of the
// classification, the reports, the language packs, and with a database what the catalogue and the
// patrons still use. Run by the import of an archive and the full restore (on the folder the live
// one would become), by `bun run config:check` and by the overview of Configurazione (on disk).
import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
	ConfigError,
	loadConfig,
	readJsonFile,
	validateFolderWith,
	type LoadedConfig,
} from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ConfigIssue } from "#lib/server/config/validate.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { builtInDictionaries } from "#lib/server/i18n/registry.js";
import { describeProblem, discoverPacks, type Dictionaries } from "#lib/server/i18n/packs.js";
import { loadReports } from "#lib/server/reports/loader.js";
import { DEFAULT_LOCALE } from "#lib/i18n/index.js";
import { referenceProblems, type ReferenceProblem } from "./config-references.js";
import { templatesOverview } from "./print-preview.js";
import { missingTemplates } from "./template-refs.js";

export interface FolderCheck {
	/** The configuration as the folder defines it, or null when it does not load. */
	loaded: LoadedConfig | null;
	/** Errors and warnings, each with its file relative to the folder. */
	issues: ConfigIssue[];
	/** What the folder takes away while the catalogue or the patrons use it (with `db` and `live`). */
	inUse: ReferenceProblem[];
	/** No error and nothing in use taken away. */
	ok: boolean;
}

export interface FolderCheckOptions {
	/** The base document when it is not `<dir>/config.json` (`config:check path/to/file.json`). */
	base?: string;
	/** With `live`, the configuration in force: what the folder would take away is checked too. */
	db?: DbOrTx;
	live?: AppConfig;
	/**
	 * Language packs that are not valid as warnings: the server skips such a pack and starts
	 * (`config:check` reports what would stop the server); an archive import refuses it.
	 */
	packsAsWarnings?: boolean;
}

/**
 * The English dictionaries the language packs are compared with, or null where they cannot be
 * read (the bundled command-line helpers: packs are then checked when the server loads them).
 */
async function englishDictionaries(): Promise<Dictionaries | null> {
	try {
		return await builtInDictionaries(DEFAULT_LOCALE);
	} catch {
		return null;
	}
}

/** Everything the server checks of a configuration folder; nothing is written. */
export async function checkFolder(
	dir: string,
	options: FolderCheckOptions = {},
): Promise<FolderCheck> {
	const issues: ConfigIssue[] = [];
	const error = (file: string, message: string, path = "(file)"): void => {
		issues.push({ level: "error", path, message, file });
	};
	let loaded: LoadedConfig | null = null;
	try {
		loaded = options.base
			? validateFolderWith(dir, readJsonFile(options.base), options.base)
			: loadConfig(dir);
		issues.push(...loaded.warnings);
	} catch (e) {
		if (!(e instanceof ConfigError)) {
			throw e;
		}
		issues.push(...e.issues);
	}
	if (loaded) {
		const config = loaded.config;
		const overview = templatesOverview(config, dir);
		for (const t of [...overview.cards, ...overview.labels, ...overview.slips]) {
			if (t.source === "config" && t.error) {
				error(`${t.kind}/templates/${t.name}/`, t.error);
			}
		}
		for (const r of missingTemplates(config, dir)) {
			error("config.json", `template "${r.name}" not found in ${r.kind}/templates`, r.key);
		}
		const images = join(dir, "classification", "images");
		const nodes = [
			...config.classification.genres,
			...config.classification.nonfiction.flatMap((n) => [n, ...n.children]),
		];
		for (const node of nodes) {
			if (node.image && !existsSync(join(images, node.image))) {
				issues.push({
					level: "warning",
					path: `classification.${node.code}.image`,
					message: `pictogram "${node.image}" not found: the placeholder is printed`,
					file: "classification/images/",
				});
			}
		}
	}
	for (const p of loadReports(dir).problems) {
		if (p.source === "config") {
			error(`reports/${p.file}`, p.message);
		}
	}
	const english = await englishDictionaries();
	if (!english && existsSync(join(dir, "i18n"))) {
		issues.push({
			level: "warning",
			path: "i18n",
			message: "language packs not checked here: the server checks them when it loads them",
			file: "i18n/",
		});
	}
	for (const pack of english ? discoverPacks(dir, english) : []) {
		for (const p of pack.problems) {
			issues.push({
				level: options.packsAsWarnings ? "warning" : p.severity,
				path: `i18n.${pack.code}`,
				message: describeProblem(pack.code, p),
				file: `i18n/${pack.code}/${p.file}`,
			});
		}
	}
	const inUse =
		loaded && options.db && options.live
			? referenceProblems(options.db, options.live, loaded.config)
			: [];
	const inside = (file: string): boolean =>
		file.startsWith(`${dir}${sep}`) || file.startsWith(`${dir}/`);
	return {
		loaded,
		issues: issues.map((i) =>
			i.file && inside(i.file)
				? { ...i, file: relative(dir, i.file).split(sep).join("/") }
				: i,
		),
		inUse,
		ok: loaded !== null && !issues.some((i) => i.level === "error") && inUse.length === 0,
	};
}
