// SPDX-License-Identifier: GPL-3.0-or-later
// The Configurazione area (PLAN.md step 11.2): every section of the configuration with the file it
// comes from and its warnings, the settings form generated from the schema, the section as JSON,
// the history of changes. Every write is one configuration change (`commitConfigChange`: atomic,
// whole folder validated, previous files in the history, configuration reloaded) guarded against
// taking away what the catalogue or the patrons use, and audited as `config.<section>`.
import type { ResolvedPathname } from "$app/types";
import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
	coverageOf,
	editorHref,
	KEY_COVERAGE,
	SECTION_BLOCKS,
	type Coverage,
} from "#lib/admin/config-coverage.js";
import { loadConfig, readJsonFile, type LoadedConfig } from "#lib/server/config/load.js";
import { schemaLeaves, schemaSections, type FieldSpec } from "#lib/server/config/introspect.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ConfigIssue } from "#lib/server/config/validate.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import type { AuditActor } from "./audit.js";
import { checkFolder } from "./config-check.js";
import { commitConfigChange } from "./config-commit.js";
import {
	checkDraftFiles,
	draftWrites,
	keyDrafts,
	listConfigChanges,
	revertAction,
	revertWrites,
	sectionFile,
	sectionWrite,
	type ConfigChange,
	type FileWrite,
} from "./config-edit.js";
import { templatesOverview } from "./print-preview.js";

type Json = Record<string, unknown>;

/**
 * The page of a section that a dedicated editor handles whole (the coverage map names the section
 * itself: the classification), instead of the generated settings page; null for the others.
 */
function ownEditorOf(section: string): ResolvedPathname | null {
	const coverage = KEY_COVERAGE[section];
	return coverage && "editor" in coverage ? editorHref(coverage.editor, section) : null;
}

export class UnknownSectionError extends Error {
	constructor(readonly section: string) {
		super(`unknown configuration section: ${section}`);
		this.name = "UnknownSectionError";
	}
}

export class NotASettingError extends Error {
	constructor(readonly path: string) {
		super(`not a key of the settings form: ${path}`);
		this.name = "NotASettingError";
	}
}

export class RevertRefusedError extends Error {
	constructor(readonly id: string) {
		super(`change ${id} created config.json: it cannot be reverted`);
		this.name = "RevertRefusedError";
	}
}

const rel = (configDir: string, path: string): string =>
	isInside(configDir, path) ? relative(configDir, path).split(sep).join("/") : path;
const isInside = (dir: string, path: string): boolean => {
	const r = relative(dir, path);
	return r !== "" && !r.startsWith("..") && !r.startsWith(sep);
};

function relIssues(configDir: string, issues: readonly ConfigIssue[]): ConfigIssue[] {
	return issues.map((i) => (i.file ? { ...i, file: rel(configDir, i.file) } : i));
}

const inSection = (path: string, section: string): boolean =>
	path === section || path.startsWith(`${section}.`);

/** Files that define parts of a section, the one it is written to first. */
function sectionFiles(
	configDir: string,
	loaded: LoadedConfig,
	section: string,
): { file: string; alsoFrom: string[] } {
	const file = sectionFile(configDir, section);
	const all = new Set<string>();
	for (const [path, origin] of loaded.origins) {
		if (inSection(path, section)) {
			all.add(rel(configDir, origin));
		}
	}
	all.delete(file);
	return { file, alsoFrom: [...all].sort() };
}

// --- Overview ---------------------------------------------------------------------------------

export interface SectionSummary {
	section: string;
	/** The file the section is written to: its fragment, or config.json. */
	file: string;
	/** Other files that define parts of it (`calendar.<year>.json`, `labels/stocks/…`). */
	alsoFrom: string[];
	warnings: number;
	/** The page that edits it. */
	href: ResolvedPathname;
	/** Keys whose dedicated editor is still to come (coverage map). */
	pending: number;
}

export interface ConfigOverview {
	source: LoadedConfig["source"];
	files: string[];
	warnings: ConfigIssue[];
	/** The folder as it is on disk now: valid (and whether it differs from the running one), or not. */
	disk: { ok: true; changed: boolean } | { ok: false; issues: ConfigIssue[] };
	sections: SectionSummary[];
}

const pendingKeys = (section: string): number =>
	new Set(
		schemaLeaves()
			.filter((l) => inSection(l.path, section))
			.map((l) => coverageOf(l.path))
			.filter((c) => c !== null && "pending" in c.coverage)
			.map((c) => c?.key),
	).size;

export async function configOverview(
	running: LoadedConfig,
	configDir: string,
): Promise<ConfigOverview> {
	// the folder on disk, checked like an archive before it is imported
	const check = await checkFolder(configDir);
	const disk: ConfigOverview["disk"] =
		check.ok && check.loaded
			? {
					ok: true,
					changed: JSON.stringify(check.loaded.config) !== JSON.stringify(running.config),
				}
			: {
					ok: false,
					issues: relIssues(
						configDir,
						check.issues.filter((i) => i.level === "error"),
					),
				};
	const warnings = relIssues(configDir, running.warnings);
	return {
		source: running.source,
		files: running.files.map((f) => rel(configDir, f)),
		warnings,
		disk,
		sections: schemaSections().map((section) => ({
			section,
			...sectionFiles(configDir, running, section),
			warnings: warnings.filter((w) => inSection(w.path, section)).length,
			href: ownEditorOf(section) ?? `/admin/config/${section}`,
			pending: pendingKeys(section),
		})),
	};
}

// --- One section ------------------------------------------------------------------------------

export interface SettingsField extends FieldSpec {
	/** Choices read from the folder (templates, stocks): value → name shown. */
	optionLabels?: Record<string, string>;
	/** The value in force (the default when no file sets it). */
	value: unknown;
	/** A file sets the key (else the default applies). */
	defined: boolean;
	/** The file that sets it. */
	file: string | null;
}

export interface ElsewhereKey {
	/** The key (a list, a map or a group) handled elsewhere. */
	key: string;
	coverage: Coverage;
	href: ResolvedPathname | null;
}

export interface SectionView {
	section: string;
	file: string;
	alsoFrom: string[];
	fields: SettingsField[];
	elsewhere: ElsewhereKey[];
	/** The section as its file writes it (comment keys left out). */
	raw: Json;
	warnings: ConfigIssue[];
}

function valueAt(root: unknown, path: string): unknown {
	let node = root;
	for (const part of path.split(".")) {
		if (typeof node !== "object" || node === null) {
			return undefined;
		}
		node = (node as Json)[part];
	}
	return node;
}

/** The keys of a section the settings form edits (simple, not handled by another editor). */
export function settingsFields(section: string): FieldSpec[] {
	return schemaLeaves().flatMap((l) =>
		l.field && inSection(l.path, section) && coverageOf(l.path) === null ? [l.field] : [],
	);
}

/** The section as written in the file it is written to. */
function rawSection(configDir: string, section: string): Json {
	const file = sectionFile(configDir, section);
	const path = join(configDir, file);
	if (!existsSync(path)) {
		return {};
	}
	const doc = readJsonFile(path);
	const raw = (file === "config.json" ? doc[section] : doc) ?? {};
	return Object.fromEntries(Object.entries(raw as Json).filter(([k]) => !k.startsWith("_")));
}

/**
 * Keys naming a template or a stock, offered as a choice among what the folder holds (step 11.6):
 * key → value → name shown. A value that no longer exists stays offered, so the form shows it.
 */
function folderChoices(
	config: AppConfig,
	configDir: string,
): Record<string, Record<string, string>> {
	const overview = templatesOverview(config, configDir);
	const names = (
		list: { name: string; description: string; error: string | null }[],
	): Record<string, string> =>
		Object.fromEntries(
			list
				.filter((t) => t.error === null)
				.map((t) => [t.name, t.description ? `${t.name} — ${t.description}` : t.name]),
		);
	const stocks = Object.fromEntries(config.labels.stocks.map((s) => [s.id, s.name]));
	const out: Record<string, Record<string, string>> = {
		"z3950.defaultTarget": Object.fromEntries(
			config.z3950.targets.map((t) => [t.id, `${t.id} — ${t.name}`]),
		),
		"cards.defaultTemplate": names(overview.cards),
		"circulation.overdueNotice.template": names(overview.slips),
	};
	for (const kind of ["pair", "barcode", "spine"] as const) {
		out[`labels.${kind}.template`] = names(overview.labels.filter((t) => t.labelKind === kind));
		out[`labels.${kind}.stock`] = stocks;
	}
	return out;
}

export function sectionView(loaded: LoadedConfig, configDir: string, section: string): SectionView {
	if (!schemaSections().includes(section)) {
		throw new UnknownSectionError(section);
	}
	let choices: Record<string, Record<string, string>> | undefined;
	const elsewhere = new Map<string, ElsewhereKey>();
	for (const leaf of schemaLeaves()) {
		const covered = inSection(leaf.path, section) ? coverageOf(leaf.path) : null;
		const onThisPage =
			covered !== null &&
			"editor" in covered.coverage &&
			(SECTION_BLOCKS[section] ?? []).includes(covered.coverage.editor);
		if (covered && !onThisPage && !elsewhere.has(covered.key)) {
			const editor = "editor" in covered.coverage ? covered.coverage.editor : null;
			elsewhere.set(covered.key, {
				key: covered.key,
				coverage: covered.coverage,
				href: editor ? editorHref(editor, section) : null,
			});
		}
	}
	return {
		section,
		...sectionFiles(configDir, loaded, section),
		fields: settingsFields(section).map((f) => {
			const origin = loaded.origins.get(f.path);
			const value = valueAt(loaded.config, f.path) ?? null;
			const folder = (choices ??= folderChoices(loaded.config, configDir))[f.path];
			const optionLabels =
				folder && typeof value === "string" && !(value in folder)
					? { ...folder, [value]: value }
					: folder;
			return {
				...f,
				...(optionLabels
					? { kind: "choice" as const, options: Object.keys(optionLabels), optionLabels }
					: {}),
				value,
				defined: origin !== undefined,
				file: origin === undefined ? null : rel(configDir, origin),
			};
		}),
		elsewhere: [...elsewhere.values()],
		raw: rawSection(configDir, section),
		warnings: relIssues(
			configDir,
			loaded.warnings.filter((w) => inSection(w.path, section)),
		),
	};
}

// --- Writes -----------------------------------------------------------------------------------

export interface SettingsPatch {
	/** Key → new value (`null` for "automatic" / "none" where allowed). */
	set: Readonly<Record<string, unknown>>;
	/** Keys to take out of the file, so that their default applies again. */
	reset: readonly string[];
}

/**
 * Saves keys of the settings form, each in the file that defines it (its section's fragment or
 * config.json). Throws `ConfigError` (invalid result), `ConfigInUseError` (it would take away
 * something in use) or `NotASettingError`; nothing is written then.
 */
export function saveSettings(
	db: DbOrTx,
	configDir: string,
	section: string,
	patch: SettingsPatch,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	const allowed = new Set(
		settingsFields(section)
			.filter((f) => f.kind !== "fixed")
			.map((f) => f.path),
	);
	const keys = [...Object.keys(patch.set), ...patch.reset];
	for (const key of keys) {
		if (!allowed.has(key)) {
			throw new NotASettingError(key);
		}
	}
	const drafts = keyDrafts(configDir, loadConfig(configDir), {
		...patch.set,
		...Object.fromEntries(patch.reset.map((k) => [k, undefined])),
	});
	return commitConfigChange(db, configDir, {
		action: `config.${section}`,
		writes: draftWrites(drafts),
		audit: { actor, details: { keys } },
		now,
	}).change;
}

/**
 * Saves keys edited by a block of a section page (a dedicated editor, not the generated form):
 * each in the file that defines it, one change, the reference guard, audited as
 * `config.<section>`. The caller checks that the keys are its own.
 */
export function saveConfigKeys(
	db: DbOrTx,
	configDir: string,
	section: string,
	set: Readonly<Record<string, unknown>>,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	for (const key of Object.keys(set)) {
		if (!key.startsWith(`${section}.`)) {
			throw new NotASettingError(key);
		}
	}
	return commitConfigChange(db, configDir, {
		action: `config.${section}`,
		writes: draftWrites(keyDrafts(configDir, loadConfig(configDir), set)),
		audit: { actor, details: { keys: Object.keys(set) } },
		now,
	}).change;
}

/**
 * One setting (`section.key`, a plain value) saved only when it changes (the Appearance page:
 * the area style, the library's name). Null when nothing changes.
 */
export function saveSettingIfChanged(
	db: DbOrTx,
	configDir: string,
	key: string,
	value: string | number | boolean,
	actor: AuditActor,
	now = new Date(),
): ConfigChange | null {
	let current: unknown = loadConfig(configDir).config;
	for (const part of key.split(".")) {
		current = (current as Record<string, unknown> | undefined)?.[part];
	}
	if (current === value) {
		return null;
	}
	return saveConfigKeys(db, configDir, key.split(".")[0] ?? "", { [key]: value }, actor, now);
}

/**
 * The colour set or the installation language (Appearance page), in the file that defines it
 * (`ui.json` when that fragment holds the section), with the guards of every change, audited as
 * `config.theme` / `config.locale` with the value before and after. Null when nothing changes.
 */
export function saveUiChoice(
	db: DbOrTx,
	configDir: string,
	key: "theme" | "locale",
	value: string,
	actor: AuditActor,
	now = new Date(),
): ConfigChange | null {
	const loaded = loadConfig(configDir);
	const before = loaded.config.ui[key];
	if (before === value) {
		return null;
	}
	return commitConfigChange(db, configDir, {
		action: `config.${key}`,
		writes: draftWrites(keyDrafts(configDir, loaded, { [`ui.${key}`]: value })),
		audit: { actor, details: { keys: [`ui.${key}`], from: before, to: value } },
		now,
	}).change;
}

/**
 * Like `saveConfigKeys`, with data that moves in the same change: `move` runs in one database
 * transaction with the reference guard (which then sees the moved rows), and what it returns goes
 * into the audit row. A refused configuration rolls the moves back and puts the files back.
 */
export function saveConfigKeysMoving(
	db: DbOrTx,
	configDir: string,
	section: string,
	set: Readonly<Record<string, unknown>>,
	move: (tx: DbOrTx) => Json,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	for (const key of Object.keys(set)) {
		if (!key.startsWith(`${section}.`)) {
			throw new NotASettingError(key);
		}
	}
	return commitConfigChange(db, configDir, {
		action: `config.${section}`,
		writes: draftWrites(keyDrafts(configDir, loadConfig(configDir), set)),
		move,
		audit: { actor, details: { keys: Object.keys(set) } },
		now,
	}).change;
}

/** Like `saveConfigKeys` with ready-made writes (editors that own several files). */
export function saveConfigWrites(
	db: DbOrTx,
	configDir: string,
	section: string,
	writes: readonly FileWrite[],
	actor: AuditActor | null,
	details: Json,
	now = new Date(),
): ConfigChange {
	return commitConfigChange(db, configDir, {
		action: `config.${section}`,
		writes,
		audit: { actor, details },
		now,
	}).change;
}

function sectionDrafts(configDir: string, section: string, value: Json): Record<string, Json> {
	const file = sectionFile(configDir, section);
	const write = sectionWrite(configDir, section, value);
	return { [file]: JSON.parse(String(write.content)) as Json };
}

/** The problems of a section written as JSON, before saving it (nothing is written). */
export function checkSectionJson(configDir: string, section: string, value: Json): ConfigIssue[] {
	if (!schemaSections().includes(section)) {
		throw new UnknownSectionError(section);
	}
	return relIssues(
		configDir,
		checkDraftFiles(configDir, sectionDrafts(configDir, section, value)).issues,
	);
}

/** Replaces a section with the JSON given, in the file it is written to. */
export function saveSectionJson(
	db: DbOrTx,
	configDir: string,
	section: string,
	value: Json,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	if (!schemaSections().includes(section) || ownEditorOf(section) !== null) {
		throw new UnknownSectionError(section);
	}
	return commitConfigChange(db, configDir, {
		action: `config.${section}`,
		writes: [sectionWrite(configDir, section, value)],
		audit: { actor, details: { json: true } },
		now,
	}).change;
}

// --- History ----------------------------------------------------------------------------------

export function configHistory(configDir: string): ConfigChange[] {
	return listConfigChanges(configDir);
}

/**
 * Puts back the files as they were before a change, checked like any other change. The change
 * that created config.json cannot be reverted (the library would fall back to the example).
 */
export function revertChange(
	db: DbOrTx,
	configDir: string,
	id: string,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	const change = listConfigChanges(configDir).find((c) => c.id === id);
	if (change?.files.some((f) => f.path === "config.json" && !f.existed)) {
		throw new RevertRefusedError(id);
	}
	return commitConfigChange(db, configDir, {
		action: revertAction(id),
		writes: revertWrites(configDir, id),
		audit: { actor, action: "config.revert", details: { of: id } },
		now,
	}).change;
}
