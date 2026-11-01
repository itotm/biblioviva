// SPDX-License-Identifier: GPL-3.0-or-later
// Writing the configuration back (steps 2.3b, 11.1). Every change goes through
// `applyConfigChange`: the previous version of each file it touches is kept in
// `CONFIG_DIR/history/<id>/` with a `change.json` describing it, the new files are written
// atomically (temp file + rename), the whole folder is validated with the same schema the loader
// uses — when the result would be invalid the previous files come back and nothing changes —,
// old history is pruned and the configuration reloaded. A change can be reverted
// (`revertWrites`, "Ripristina versione precedente"), which is itself a change. Sections are
// written to the file they come from (§3.6): their `<section>.json` fragment when it exists,
// `config.json` otherwise. Hand edits of the files keep working.
import { NotFoundError } from "#lib/server/errors.js";
import { assertNotDemo } from "#lib/server/demo/public.js";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { ConfigError, ensureConfigDirDefaults, reloadConfig } from "#lib/server/config/index.js";
import { assembleConfig, HISTORY_DIR, originOf, SECTION_NAMES } from "#lib/server/config/folder.js";
import { writeAtomic } from "#lib/server/runtime/fs.js";
import {
	EXAMPLE_CONFIG_PATH,
	loadConfig,
	parseAssembled,
	readJsonFile,
	validateFolderWith,
	type LoadedConfig,
} from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ConfigIssue } from "#lib/server/config/validate.js";

type Json = Record<string, unknown>;

/** Changes kept in the history; older ones are removed after each change. */
export const HISTORY_KEEP = 50;

/** One file to write (`content`) or delete (`null`), relative to CONFIG_DIR with `/`. */
export interface FileWrite {
	path: string;
	content: string | Uint8Array | null;
}

export interface ConfigChange {
	id: string;
	at: string;
	/** What was done, e.g. `config.classification` or `revert 20260925-101500-000`. */
	action: string;
	/** `existed`: the file was there before; `removed`: the change deleted it. */
	files: { path: string; existed: boolean; removed?: boolean }[];
}

export class ConfigPathError extends Error {
	constructor(readonly path: string) {
		super(`configuration path not allowed: ${path}`);
		this.name = "ConfigPathError";
	}
}

/** A revert that would undo something changed again after the change (the keys or files). */
export class ConfigRevertConflictError extends Error {
	constructor(readonly conflicts: string[]) {
		super(`changed again since: ${conflicts.join(", ")}`);
		this.name = "ConfigRevertConflictError";
	}
}

export class ConfigChangeNotFoundError extends NotFoundError {
	constructor(readonly id: string) {
		super("configuration change", `configuration change not found: ${id}`);
		this.name = "ConfigChangeNotFoundError";
	}
}

/** A path inside CONFIG_DIR, never inside the history, never escaping the folder. */
function checkedPath(path: string): string {
	const clean = normalize(path).split(sep).join("/");
	if (
		!clean ||
		isAbsolute(path) ||
		clean.startsWith("../") ||
		clean === ".." ||
		clean.split("/").includes("..") ||
		clean === HISTORY_DIR ||
		clean.startsWith(`${HISTORY_DIR}/`)
	) {
		throw new ConfigPathError(path);
	}
	return clean;
}

/** Removes the folders left empty above a deleted file (a template folder removed file by file). */
function removeEmptyParents(configDir: string, file: string): void {
	const root = resolve(configDir);
	for (let dir = dirname(resolve(file)); dir.startsWith(`${root}${sep}`); dir = dirname(dir)) {
		if (!existsSync(dir) || readdirSync(dir).length > 0) {
			return;
		}
		rmdirSync(dir);
	}
}

/** The folder as the loader will see it: config.json, or the shipped example as the base. */
function validateFolder(configDir: string): LoadedConfig {
	const base = join(configDir, "config.json");
	return existsSync(base)
		? loadConfig(configDir)
		: validateFolderWith(configDir, readJsonFile(EXAMPLE_CONFIG_PATH), EXAMPLE_CONFIG_PATH);
}

function newChangeId(configDir: string, now: Date): string {
	const p = (n: number, l = 2): string => String(n).padStart(l, "0");
	const base = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}-${p(now.getUTCMilliseconds(), 3)}`;
	let id = base;
	for (let i = 2; existsSync(join(configDir, HISTORY_DIR, id)); i++) {
		id = `${base}-${i}`;
	}
	return id;
}

/** Changes newest first. */
export function listConfigChanges(configDir: string): ConfigChange[] {
	const root = join(configDir, HISTORY_DIR);
	if (!existsSync(root)) {
		return [];
	}
	return readdirSync(root)
		.filter((id) => existsSync(join(root, id, "change.json")))
		.sort()
		.reverse()
		.map(
			(id) => JSON.parse(readFileSync(join(root, id, "change.json"), "utf8")) as ConfigChange,
		);
}

function pruneHistory(configDir: string, keep = HISTORY_KEEP): void {
	const root = join(configDir, HISTORY_DIR);
	const ids = readdirSync(root).sort();
	for (const id of ids.slice(0, Math.max(0, ids.length - keep))) {
		rmSync(join(root, id), { recursive: true, force: true });
	}
}

/**
 * Writes (or deletes) the given files as one change: previous versions kept in the history,
 * atomic writes, the whole folder validated — on a `ConfigError` the files are put back and the
 * error is thrown —, then the configuration is reloaded. `commit` runs after the validation with
 * the new configuration (e.g. the database transaction that goes with a taxonomy change): when it
 * throws, the files are put back too and the change leaves no trace.
 */
export function applyConfigChange(
	configDir: string,
	action: string,
	writes: readonly FileWrite[],
	now = new Date(),
	commit?: (loaded: LoadedConfig, id: string) => void,
): { change: ConfigChange; loaded: LoadedConfig } {
	// the public demo never writes its configuration: every writer of the history comes here (9.17)
	assertNotDemo("config");
	const id = newChangeId(configDir, now);
	const snapshot = join(configDir, HISTORY_DIR, id, "files");
	mkdirSync(snapshot, { recursive: true });
	const files = writes.map((w) => {
		const path = checkedPath(w.path);
		const target = join(configDir, path);
		const existed = existsSync(target);
		if (existed) {
			mkdirSync(dirname(join(snapshot, path)), { recursive: true });
			cpSync(target, join(snapshot, path));
		}
		return { write: w, path, target, existed };
	});
	const rollback = (): void => {
		for (const f of files) {
			if (f.existed) {
				mkdirSync(dirname(f.target), { recursive: true });
				cpSync(join(snapshot, f.path), f.target);
			} else {
				rmSync(f.target, { force: true });
				removeEmptyParents(configDir, f.target);
			}
		}
		rmSync(join(configDir, HISTORY_DIR, id), { recursive: true, force: true });
	};
	try {
		for (const f of files) {
			if (f.write.content === null) {
				rmSync(f.target, { force: true });
				removeEmptyParents(configDir, f.target);
			} else {
				writeAtomic(f.target, f.write.content);
			}
		}
		const validated = validateFolder(configDir);
		commit?.(validated, id);
	} catch (e) {
		rollback();
		throw e;
	}
	// what the change wrote, so that a revert can undo just this change later
	for (const f of files) {
		if (f.write.content !== null) {
			const copy = join(configDir, HISTORY_DIR, id, "after", f.path);
			mkdirSync(dirname(copy), { recursive: true });
			writeFileSync(copy, f.write.content);
		}
	}
	const change: ConfigChange = {
		id,
		at: now.toISOString(),
		action,
		files: files.map((f) => ({
			path: f.path,
			existed: f.existed,
			...(f.write.content === null ? { removed: true } : {}),
		})),
	};
	writeFileSync(
		join(configDir, HISTORY_DIR, id, "change.json"),
		`${JSON.stringify(change, null, "\t")}\n`,
	);
	pruneHistory(configDir);
	// the folder just validated is the one reloaded (CONFIG_DIR for the server)
	return { change, loaded: reloadConfig(configDir) };
}

/** JSON with sorted keys, to compare values whatever the order of their keys. */
function canonical(value: unknown): string {
	if (value === undefined) {
		return "\u0000undefined";
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonical).join(",")}]`;
	}
	if (typeof value === "object" && value !== null) {
		return `{${Object.keys(value)
			.sort()
			.map((k) => `${JSON.stringify(k)}:${canonical((value as Json)[k])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}
const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const isJsonObject = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Undoes, in `current`, what turned `before` into `after`, key by key: a key the change did not
 * touch keeps its current value; a key changed again since the change is a conflict.
 */
function revertJson(
	before: Json,
	after: Json,
	current: Json,
	prefix: string,
	conflicts: string[],
): Json {
	const out: Json = { ...current };
	for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
		const b = before[key];
		const a = after[key];
		const c = current[key];
		const path = prefix ? `${prefix}.${key}` : key;
		if (same(b, a)) {
			continue;
		}
		if (isJsonObject(b) && isJsonObject(a) && isJsonObject(c)) {
			out[key] = revertJson(b, a, c, path, conflicts);
		} else if (!same(c, a)) {
			conflicts.push(path);
		} else if (b === undefined) {
			Reflect.deleteProperty(out, key);
		} else {
			out[key] = b;
		}
	}
	return out;
}

function parseJson(content: Uint8Array | null): Json | null {
	if (content === null) {
		return null;
	}
	try {
		const value: unknown = JSON.parse(new TextDecoder().decode(content));
		return isJsonObject(value) ? value : null;
	} catch {
		return null;
	}
}

const readIf = (path: string): Uint8Array | null => (existsSync(path) ? readFileSync(path) : null);
const sameBytes = (a: Uint8Array | null, b: Uint8Array | null): boolean =>
	a === null || b === null ? a === b : Buffer.from(a).equals(Buffer.from(b));

/**
 * The writes that undo change `id`: in a JSON file only the keys that change set are put back, so
 * later changes to other keys of the same file stay; any other file is put back when it is still
 * as the change left it. Something changed again since the change is a
 * `ConfigRevertConflictError`.
 */
export function revertWrites(configDir: string, id: string): FileWrite[] {
	const change = listConfigChanges(configDir).find((c) => c.id === id);
	if (!change) {
		throw new ConfigChangeNotFoundError(id);
	}
	const root = join(configDir, HISTORY_DIR, id);
	const conflicts: string[] = [];
	const writes: FileWrite[] = [];
	for (const f of change.files) {
		const before = f.existed ? readFileSync(join(root, "files", f.path)) : null;
		const afterPath = join(root, "after", f.path);
		const current = readIf(join(configDir, f.path));
		if (!f.removed && !existsSync(afterPath)) {
			// recorded before the change kept what it wrote: the file as it was, whole
			writes.push({ path: f.path, content: before });
			continue;
		}
		const after = f.removed ? null : readFileSync(afterPath);
		const [b, a, c] = [parseJson(before), parseJson(after), parseJson(current)];
		if (f.path.endsWith(".json") && b && a && c) {
			// conflicts named by key: config.json holds whole sections, a fragment one section
			const fragment = /^([a-z][\w-]*)\.json$/i.exec(f.path)?.[1];
			const prefix =
				f.path === "config.json"
					? ""
					: fragment && SECTION_NAMES.includes(fragment)
						? fragment
						: f.path;
			const merged = revertJson(b, a, c, prefix, conflicts);
			writes.push({ path: f.path, content: json(merged) });
		} else if (sameBytes(current, after)) {
			writes.push({ path: f.path, content: before });
		} else {
			conflicts.push(f.path);
		}
	}
	if (conflicts.length > 0) {
		throw new ConfigRevertConflictError(conflicts);
	}
	return writes;
}

/** The history's name of the change that undoes change `id`. */
export const revertAction = (id: string): string => `revert ${id}`;

const json = (value: unknown): string => `${JSON.stringify(value, null, "\t")}\n`;

/** The file a top-level section is written to: its fragment when present, else config.json. */
export function sectionFile(configDir: string, section: string): string {
	return existsSync(join(configDir, `${section}.json`)) ? `${section}.json` : "config.json";
}

/** The raw config.json, or the shipped example when it does not exist yet. */
function baseDocument(configDir: string): Json {
	const target = join(configDir, "config.json");
	return readJsonFile(existsSync(target) ? target : EXAMPLE_CONFIG_PATH);
}

/**
 * The write that replaces a whole top-level section in the file it comes from, keeping the
 * file's own comments (`_…` keys).
 */
export function sectionWrite(configDir: string, section: string, value: Json): FileWrite {
	const file = sectionFile(configDir, section);
	const keepComments = (raw: unknown): Json =>
		typeof raw === "object" && raw !== null
			? Object.fromEntries(Object.entries(raw).filter(([k]) => k.startsWith("_")))
			: {};
	let content: Json;
	if (file === "config.json") {
		content = baseDocument(configDir);
		content[section] = { ...keepComments(content[section]), ...value };
	} else {
		content = { ...keepComments(readJsonFile(join(configDir, file))), ...value };
	}
	return { path: file, content: json(content) };
}

/**
 * Validates the folder as the loader would read it with some files replaced by drafts (paths
 * relative to CONFIG_DIR) and, with `section`, that section of the merged result replaced; the
 * problems come back as issues, never thrown.
 */
function checkDraft(
	configDir: string,
	drafts: Readonly<Record<string, Json>>,
	section?: { name: string; value: Json },
): { config: AppConfig | null; issues: ConfigIssue[] } {
	const target = join(configDir, "config.json");
	const baseFile = existsSync(target) ? target : EXAMPLE_CONFIG_PATH;
	const read = (path: string): Json =>
		drafts[relative(configDir, path).split(sep).join("/")] ?? readJsonFile(path);
	try {
		const assembled = assembleConfig(
			configDir,
			drafts["config.json"] ?? readJsonFile(baseFile),
			baseFile,
			read,
		);
		if (section) {
			assembled.raw[section.name] = section.value;
		}
		const parsed = parseAssembled(assembled, baseFile);
		return { config: parsed.config, issues: parsed.warnings };
	} catch (e) {
		if (e instanceof ConfigError) {
			return { config: null, issues: e.issues };
		}
		throw e;
	}
}

/**
 * Validates a section as the editors hold it, before anything is written: the folder as it is
 * with `section` replaced by `value`.
 */
export function checkSectionDraft(
	configDir: string,
	section: string,
	value: Json,
): { config: AppConfig | null; issues: ConfigIssue[] } {
	return checkDraft(configDir, {}, { name: section, value });
}

/**
 * Validates the folder as the loader would read it with some files replaced by drafts (paths
 * relative to CONFIG_DIR: `config.json`, `<section>.json`, …).
 */
export function checkDraftFiles(
	configDir: string,
	drafts: Readonly<Record<string, Json>>,
): { config: AppConfig | null; issues: ConfigIssue[] } {
	return checkDraft(configDir, drafts);
}

/**
 * The file contents after setting keys (dotted paths; `undefined` removes the key, so its default
 * applies again), each key in the file that defines it — its section's fragment or config.json,
 * never a folder piece like `calendar.<year>.json`. Returns the drafts by relative path.
 */
export function keyDrafts(
	configDir: string,
	loaded: LoadedConfig,
	patch: Readonly<Record<string, unknown>>,
): Record<string, Json> {
	const drafts: Record<string, Json> = {};
	for (const [path, value] of Object.entries(patch)) {
		const section = path.split(".")[0] ?? "";
		if (!SECTION_NAMES.includes(section) || path === section) {
			throw new ConfigPathError(path);
		}
		const origin = originOf(loaded.origins, path);
		const inFolder = origin ? relative(configDir, origin).split(sep).join("/") : "";
		// a key the folder does not define yet (or a folder still on the example) goes to config.json
		const file = inFolder === "" || inFolder.startsWith("../") ? "config.json" : inFolder;
		let parts: string[];
		if (file === "config.json") {
			parts = path.split(".");
		} else if (file === `${section}.json`) {
			parts = path.split(".").slice(1);
		} else {
			throw new ConfigPathError(path);
		}
		const doc = (drafts[file] ??=
			file === "config.json"
				? baseDocument(configDir)
				: readJsonFile(join(configDir, checkedPath(file))));
		let node = doc;
		for (const part of parts.slice(0, -1)) {
			const next = node[part];
			if (typeof next !== "object" || next === null || Array.isArray(next)) {
				node[part] = {};
			}
			node = node[part] as Json;
		}
		const last = parts[parts.length - 1] ?? "";
		if (value === undefined) {
			Reflect.deleteProperty(node, last);
		} else {
			node[last] = value;
		}
	}
	return drafts;
}

/** The drafts of `keyDrafts` as writes for `applyConfigChange`. */
export function draftWrites(drafts: Readonly<Record<string, Json>>): FileWrite[] {
	return Object.entries(drafts).map(([path, doc]) => ({ path, content: json(doc) }));
}

/**
 * Sets keys (dotted paths) as one change, each in the file that defines it (`keyDrafts`); a folder
 * without config.json gets it from the shipped example in the same change. No reference guard
 * and no audit: the services of `config-sections.ts` add them (`saveConfigKeys`).
 */
export function setConfigKeys(
	configDir: string,
	action: string,
	set: Readonly<Record<string, unknown>>,
	now = new Date(),
): LoadedConfig {
	ensureConfigDirDefaults(configDir);
	const drafts = keyDrafts(configDir, loadConfig(configDir), set);
	return applyConfigChange(configDir, action, draftWrites(drafts), now).loaded;
}

/**
 * Turns on `classification.classPerItem` (the class-per-copy question of the catalogue import,
 * §3.17), in the file the classification comes from (normally `classification.json`).
 */
export function setClassPerItem(configDir: string, on: boolean): LoadedConfig {
	return setConfigKeys(configDir, "config.classification", {
		"classification.classPerItem": on,
	});
}
