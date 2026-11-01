// SPDX-License-Identifier: GPL-3.0-or-later
// The configuration parts of an archive (PLAN.md §3.6, steps 11.3, 11.12), for "Importa
// configurazione" and for the restore of a backup alike (`full-restore.ts` stages the archive):
// the folder the live one becomes when the chosen parts are taken from the archive (`mergeParts`)
// is built aside, checked exactly like the live folder (schema, fragments, stocks, templates,
// pictograms, reports, language packs, what the catalogue and the patrons still use) and compared
// with it; only a candidate without errors is written, as one configuration change (the replaced
// files go in the history, so the history's "Ripristina" can undo it). The parts not chosen stay
// exactly as they are; the database is never touched here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { travels } from "#lib/server/config/folder.js";
import { loadConfig } from "#lib/server/config/load.js";
import type { ConfigIssue } from "#lib/server/config/validate.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { listFilesRecursive } from "#lib/server/runtime/fs.js";
import type { PartId } from "#lib/shared/archive-parts.js";
import { checkFolder } from "./config-check.js";
import { commitConfigChange, type ConfigCommit } from "./config-commit.js";
import type { ConfigChange, FileWrite } from "./config-edit.js";
import type { ReferenceProblem } from "./config-references.js";
import { mergeParts } from "./config-parts.js";

/** The files of a configuration folder that travel in an archive (known kinds, no history). */
export function archiveFiles(configDir: string): string[] {
	return listFilesRecursive(configDir).filter(travels);
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(Buffer.from(b));

/** What the configuration would become, compared with the live one. */
export interface CandidateCheck {
	files: { added: string[]; changed: string[]; removed: string[]; unchanged: number };
	/** Sections whose values change. */
	sections: string[];
	/** Configuration problems (schema, consistency, templates, pictograms, reports, packs). */
	issues: ConfigIssue[];
	/** What the new configuration would take away while the catalogue or the patrons use it. */
	inUse: ReferenceProblem[];
	/** No error: the candidate can be written. */
	ready: boolean;
}

/**
 * The folder the live one becomes when `parts` are taken from `from`, built in `out` and checked
 * like the live folder, with its differences.
 */
export async function checkMergedConfig(
	db: DbOrTx,
	configDir: string,
	from: string,
	parts: readonly PartId[],
	out: string,
): Promise<CandidateCheck> {
	mergeParts(configDir, from, parts, out);
	return compareStaged(db, configDir, out);
}

/** The writes that turn the live folder into a checked candidate. */
function candidateWrites(candidate: string, check: CandidateCheck): FileWrite[] {
	return [
		...[...check.files.added, ...check.files.changed].map((path) => ({
			path,
			content: new Uint8Array(readFileSync(join(candidate, path))),
		})),
		...check.files.removed.map((path) => ({ path, content: null })),
	];
}

async function compareStaged(
	db: DbOrTx,
	configDir: string,
	staged: string,
): Promise<CandidateCheck> {
	const live = loadConfig(configDir);
	const incoming = archiveFiles(staged);
	const current = archiveFiles(configDir);
	const added: string[] = [];
	const changed: string[] = [];
	let unchanged = 0;
	for (const file of incoming) {
		if (!current.includes(file)) {
			added.push(file);
		} else if (
			!sameBytes(readFileSync(join(staged, file)), readFileSync(join(configDir, file)))
		) {
			changed.push(file);
		} else {
			unchanged++;
		}
	}
	const removed = current.filter((f) => !incoming.includes(f));
	const { loaded, issues, inUse, ok } = await checkFolder(staged, { db, live: live.config });
	const sections = loaded
		? Object.keys(live.config).filter(
				(s) =>
					JSON.stringify((live.config as Record<string, unknown>)[s]) !==
					JSON.stringify((loaded.config as Record<string, unknown>)[s]),
			)
		: [];
	return {
		files: { added, changed, removed, unchanged },
		sections,
		issues,
		inUse,
		ready: ok,
	};
}

/** Some configuration changes in the candidate (files added, changed or removed). */
export const changesSomething = (check: CandidateCheck): boolean =>
	check.files.added.length + check.files.changed.length + check.files.removed.length > 0;

/**
 * Writes a checked candidate as one configuration change with every guard of
 * `commitConfigChange` (what is in use is checked again, the history keeps the replaced files).
 */
export function applyCandidate(
	db: DbOrTx,
	configDir: string,
	candidate: string,
	check: CandidateCheck,
	commit: Omit<ConfigCommit, "writes">,
): ConfigChange {
	return commitConfigChange(db, configDir, {
		...commit,
		writes: candidateWrites(candidate, check),
	}).change;
}
