// SPDX-License-Identifier: GPL-3.0-or-later
// Language packs from the admin UI (PLAN.md step 11.8): the packs of `CONFIG_DIR/i18n/` with their
// validation report, a pack uploaded as a zip (checked against the English dictionaries first and
// installed only without errors, replacing a pack with the same code), a pack removed (never the
// language in use), and any folder downloaded as a zip to start a translation from. Installing and
// removing are configuration changes (history, audit, "Ripristina").
import { ServiceError } from "#lib/server/errors.js";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { ArchiveError, readZip, type ArchiveRules } from "#lib/server/archive/read.js";
import { LOCALES } from "#lib/i18n/index.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import {
	describeProblem,
	discoverPacks,
	LOCALE_CODE,
	PACKS_DIR,
	validatePack,
	type Dictionaries,
	type PackInfo,
} from "#lib/server/i18n/packs.js";
import type { AuditActor } from "./audit.js";
import type { ConfigChange, FileWrite } from "./config-edit.js";
import { saveConfigWrites } from "./config-sections.js";

export const MAX_PACK_ZIP_BYTES = 5_000_000;
const MAX_PACK_FILE_BYTES = 2_000_000;
const MAX_PACK_FILES = 60;
/** What an uploaded pack may hold: macOS leftovers and hidden files are left out. */
const PACK_RULES: ArchiveRules = {
	maxArchiveBytes: MAX_PACK_ZIP_BYTES,
	maxEntries: MAX_PACK_FILES * 4,
	maxFileBytes: MAX_PACK_FILE_BYTES,
	maxTotalBytes: 32_000_000,
	skip: (name) => /(^|\/)(__MACOSX|\.)/.test(name),
};

export class LanguagePackError extends ServiceError {
	constructor(
		override readonly code:
			| "notAZip"
			| "tooLarge"
			| "badLayout"
			| "badCode"
			| "builtIn"
			| "invalid"
			| "inUse"
			| "notFound"
			| "unavailable"
			| "checksum",
		readonly details: string[] = [],
	) {
		super(
			code,
			`language pack: ${code}${details.length > 0 ? ` (${details.join("; ")})` : ""}`,
		);
		this.name = "LanguagePackError";
	}
}

export interface PackView {
	code: string;
	name: string | null;
	nativeName: string | null;
	valid: boolean;
	errors: number;
	warnings: number;
	/** Readable lines, the errors first (at most 50). */
	problems: string[];
	/** The language of the installation. */
	inUse: boolean;
}

function view(pack: PackInfo, locale: string): PackView {
	const sorted = [...pack.problems].sort((a, b) =>
		a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1,
	);
	return {
		code: pack.code,
		name: pack.meta?.name ?? null,
		nativeName: pack.meta?.nativeName ?? null,
		valid: pack.valid,
		errors: pack.problems.filter((p) => p.severity === "error").length,
		warnings: pack.problems.filter((p) => p.severity === "warning").length,
		problems: sorted
			.slice(0, 50)
			.map((p) => describeProblem(pack.code, p).replace(/^\[i18n\] /, "")),
		inUse: pack.code === locale,
	};
}

export function packsView(configDir: string, english: Dictionaries, locale: string): PackView[] {
	return discoverPacks(configDir, english).map((p) => view(p, locale));
}

/** The folders that can be downloaded: the packs and the built-in examples (`en`, `it`). */
export function packFolders(configDir: string): string[] {
	const root = join(configDir, PACKS_DIR);
	return existsSync(root)
		? readdirSync(root)
				.filter((c) => LOCALE_CODE.test(c) && statSync(join(root, c)).isDirectory())
				.sort()
		: [];
}

/** One folder of `i18n/` as a zip with the folder inside (`de/pack.json`, `de/common.json`, …). */
export function packZip(configDir: string, code: string): Uint8Array {
	if (!packFolders(configDir).includes(code)) {
		throw new LanguagePackError("notFound", [code]);
	}
	const dir = join(configDir, PACKS_DIR, code);
	const files: Record<string, Uint8Array> = {};
	for (const f of readdirSync(dir).sort()) {
		if (f.endsWith(".json")) {
			files[`${code}/${f}`] = new Uint8Array(readFileSync(join(dir, f)));
		}
	}
	return zipSync(files, { level: 6 });
}

/**
 * The files of an uploaded pack: `.json` files at the top of the zip or inside one folder named
 * after the code (as `packZip` writes them). The code comes from that folder or from `code`.
 */
function unpack(
	zip: Uint8Array,
	code: string | null,
): { code: string; files: Record<string, Uint8Array> } {
	let entries: Record<string, Uint8Array>;
	try {
		entries = readZip(zip, PACK_RULES);
	} catch (e) {
		if (!(e instanceof ArchiveError)) {
			throw e;
		}
		throw e.code === "too_large"
			? new LanguagePackError("tooLarge")
			: e.code === "not_zip"
				? new LanguagePackError("notAZip")
				: new LanguagePackError("badLayout", e.detail ? [e.detail] : []);
	}
	const names = Object.keys(entries);
	if (names.length === 0 || names.length > MAX_PACK_FILES) {
		throw new LanguagePackError("badLayout");
	}
	const folders = new Set(names.map((n) => (n.includes("/") ? n.split("/")[0] : "")));
	if (folders.size !== 1) {
		throw new LanguagePackError("badLayout");
	}
	const folder = [...folders][0] ?? "";
	const packCode = code ?? folder;
	if (!LOCALE_CODE.test(packCode)) {
		throw new LanguagePackError("badCode", [packCode]);
	}
	if ((LOCALES as readonly string[]).includes(packCode)) {
		throw new LanguagePackError("builtIn", [packCode]);
	}
	const files: Record<string, Uint8Array> = {};
	for (const n of names) {
		const file = folder ? n.slice(folder.length + 1) : n;
		if (!/^[\w-]+\.json$/.test(file)) {
			throw new LanguagePackError("badLayout", [n]);
		}
		const bytes = entries[n];
		if (bytes) {
			files[file] = bytes;
		}
	}
	return { code: packCode, files };
}

/** The pack checked in a temporary folder: its report, and the files to install. */
export function checkPackZip(
	zip: Uint8Array,
	code: string | null,
	english: Dictionaries,
	locale: string,
): { pack: PackView; files: Record<string, Uint8Array> } {
	const unpacked = unpack(zip, code);
	const staging = mkdtempSync(join(tmpdir(), "bv-pack-"));
	try {
		const dir = join(staging, unpacked.code);
		mkdirSync(dir);
		for (const [f, bytes] of Object.entries(unpacked.files)) {
			writeFileSync(join(dir, f), bytes);
		}
		return {
			pack: view(validatePack(unpacked.code, dir, english), locale),
			files: unpacked.files,
		};
	} finally {
		rmSync(staging, { recursive: true, force: true });
	}
}

/** Installs an uploaded pack when it has no errors (one change; a pack with that code is replaced). */
export function installPack(
	db: DbOrTx,
	configDir: string,
	zip: Uint8Array,
	code: string | null,
	english: Dictionaries,
	locale: string,
	actor: AuditActor,
	now = new Date(),
): { pack: PackView; change: ConfigChange } {
	const checked = checkPackZip(zip, code, english, locale);
	if (!checked.pack.valid) {
		throw new LanguagePackError("invalid", checked.pack.problems);
	}
	const dir = join(configDir, PACKS_DIR, checked.pack.code);
	const old = existsSync(dir) ? readdirSync(dir).filter((f) => !(f in checked.files)) : [];
	const writes: FileWrite[] = [
		...Object.entries(checked.files).map(([f, bytes]) => ({
			path: `${PACKS_DIR}/${checked.pack.code}/${f}`,
			content: bytes,
		})),
		...old.map((f) => ({ path: `${PACKS_DIR}/${checked.pack.code}/${f}`, content: null })),
	];
	const change = saveConfigWrites(
		db,
		configDir,
		"ui",
		writes,
		actor,
		{ languagePack: checked.pack.code, installed: true, warnings: checked.pack.warnings },
		now,
	);
	return { pack: checked.pack, change };
}

/** Removes a pack folder; never the language in use, never a built-in example. */
export function removePack(
	db: DbOrTx,
	configDir: string,
	code: string,
	locale: string,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	if ((LOCALES as readonly string[]).includes(code)) {
		throw new LanguagePackError("builtIn", [code]);
	}
	if (code === locale) {
		throw new LanguagePackError("inUse", [code]);
	}
	if (!packFolders(configDir).includes(code)) {
		throw new LanguagePackError("notFound", [code]);
	}
	const dir = join(configDir, PACKS_DIR, code);
	return saveConfigWrites(
		db,
		configDir,
		"ui",
		readdirSync(dir).map((f) => ({ path: `${PACKS_DIR}/${code}/${f}`, content: null })),
		actor,
		{ languagePack: code, removed: true },
		now,
	);
}
