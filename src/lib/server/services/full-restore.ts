// SPDX-License-Identifier: GPL-3.0-or-later
// Taking parts of an archive back (PLAN.md §3.6, step 11.12): "Ripristina" on the backups page or
// `bun run backup:restore`, and "Importa configurazione" on the Configurazione page or `bun run
// config:import`. Every archive has the one format of `export-archive.ts`, so both read any of
// them: a backup, "Esporta tutto", "Esporta configurazione". The source — a zip archive, or for
// the restore a database copy of BACKUP_DIR — is staged in DATA_DIR/tmp/<area>/<token>/ with
// the one reader (`unpackArchive`), its parts listed, and the chosen ones checked before anything
// is written (§3.22): the data in a transaction that is rolled back (references, structure), the
// configuration as the folder the live one would become (`config-archive.ts`). Only a clean check
// is applied: the data parts replaced in one transaction, photos and covers swapped, the
// configuration written as one change of the history. The parts not chosen stay exactly as they
// are. The configuration import is the same path limited to the configuration parts: the database
// and the uploads of the archive are not even unpacked, and an archive without configuration
// parts is refused.
import { assertNotDemo } from "#lib/server/demo/public.js";
import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { ServerContext } from "#lib/server/context.js";
import { discardStaged, newStaging, stagedDir } from "#lib/server/archive/staging.js";
import {
	DATA_PARTS,
	dataPart,
	dataPartsOf,
	isDataPart,
	type DataPart,
	type PartId,
} from "#lib/shared/archive-parts.js";
import { audit, type AuditActor } from "./audit.js";
import { listFilesRecursive } from "#lib/server/runtime/fs.js";
import {
	applyCandidate,
	changesSomething,
	checkMergedConfig,
	type CandidateCheck,
} from "./config-archive.js";
import type { ConfigChange } from "./config-edit.js";
import { partsIn } from "./config-parts.js";
import {
	DataRestoreError,
	dbPartsOf,
	restoreDataParts,
	uploadFoldersOf,
	type DataRestorePlan,
	type ReferenceGap,
} from "./data-parts.js";
import {
	ArchiveReadError,
	DB_ENTRY,
	MAX_UPLOAD_BYTES,
	unpackArchive,
	type ExportManifest,
} from "./export-archive.js";

/** A staging area: where its archives wait, how long, and whether only the configuration is taken. */
interface Area {
	name: string;
	/** Older staged archives are cleared after this long; without it, by every new one. */
	keepMs?: number;
	configOnly: boolean;
}
/** The restores: one at a time, a new one clears the others. */
const RESTORE: Area = { name: "restore", configOnly: false };
/** The configuration imports: one is kept for a day. */
const CONFIG_IMPORT: Area = {
	name: "config-import",
	keepMs: 24 * 60 * 60 * 1000,
	configOnly: true,
};

export interface RestoreSource {
	kind: "archive" | "database";
	name: string;
	createdAt: string | null;
	version: string | null;
	/** The library that wrote the archive, when its manifest says. */
	library: string | null;
}

export interface RestoreCheck {
	token: string;
	source: RestoreSource;
	available: PartId[];
	selected: PartId[];
	data: {
		counts: DataRestorePlan["counts"];
		/** Rows that would point at missing ones: what the selection lacks. */
		gaps: ReferenceGap[];
		/** Tables whose structure differs (a copy from another version). */
		schema: string[];
		photos: number;
		covers: number;
	};
	config: CandidateCheck | null;
	ready: boolean;
}

export class RestoreNotReadyError extends Error {
	constructor(readonly check: RestoreCheck | null) {
		super("the backup cannot be restored as chosen");
		this.name = "RestoreNotReadyError";
	}
}

/** Stages a zip archive or (not for the configuration) a database copy; returns its token. */
async function stage(
	dataDir: string,
	area: Area,
	sourcePath: string,
	name: string,
	now?: number,
): Promise<string> {
	const { token, dir } = newStaging(dataDir, area.name, { keepMs: area.keepMs, now });
	mkdirSync(join(dir, "data"), { recursive: true });
	mkdirSync(join(dir, "config"), { recursive: true });
	let source: RestoreSource;
	if (!area.configOnly && name.endsWith(".db")) {
		mkdirSync(join(dir, "data", "db"), { recursive: true });
		copyFileSync(sourcePath, join(dir, "data", DB_ENTRY));
		source = {
			kind: "database",
			name,
			createdAt: statSync(sourcePath).mtime.toISOString(),
			version: null,
			library: null,
		};
	} else {
		let manifest: ExportManifest;
		try {
			// the one reader refuses an unsafe, oversized or foreign archive; what it wrote goes with it
			({ manifest } = await unpackArchive(
				sourcePath,
				join(dir, "data"),
				join(dir, "config"),
				{
					configOnly: area.configOnly,
				},
			));
		} catch (e) {
			discardStaged(dataDir, area.name, token);
			throw e;
		}
		source = {
			kind: "archive",
			name,
			createdAt: manifest.createdAt,
			version: manifest.version,
			library: manifest.library ?? null,
		};
		writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
	}
	writeFileSync(join(dir, "source.json"), JSON.stringify(source));
	return token;
}

/**
 * Stages an archive uploaded from another computer (at most `MAX_UPLOAD_BYTES`): written aside in
 * DATA_DIR/tmp, staged, the upload removed whatever happens; returns the token.
 */
async function stageUpload(
	dataDir: string,
	area: Area,
	bytes: Uint8Array,
	name: string,
	now?: number,
): Promise<string> {
	if (bytes.byteLength > MAX_UPLOAD_BYTES) {
		throw new ArchiveReadError("too_large");
	}
	const tmp = join(dataDir, "tmp", `upload-${crypto.randomUUID()}.zip`);
	mkdirSync(join(dataDir, "tmp"), { recursive: true });
	writeFileSync(tmp, bytes);
	try {
		return await stage(dataDir, area, tmp, name, now);
	} finally {
		rmSync(tmp, { force: true });
	}
}

/** Stages a backup, an archive or a database copy for a restore; returns its token. */
export async function stageRestore(
	dataDir: string,
	sourcePath: string,
	name: string,
): Promise<string> {
	assertNotDemo("restore");
	return stage(dataDir, RESTORE, sourcePath, name);
}

/** Stages an archive uploaded from another computer for a restore; returns the token. */
export async function stageUploadedRestore(
	dataDir: string,
	bytes: Uint8Array,
	name: string,
): Promise<string> {
	assertNotDemo("restore");
	return stageUpload(dataDir, RESTORE, bytes, name);
}

/** The upload files of a data part in a staged source. */
const uploadsOf = (dir: string, part: DataPart): number =>
	uploadFoldersOf(part).reduce(
		(n, folder) => n + listFilesRecursive(join(dir, "data", "uploads", folder)).length,
		0,
	);

/** The parts a staged source holds. */
function stagedParts(dir: string): PartId[] {
	const manifest = existsSync(join(dir, "manifest.json"))
		? (JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as ExportManifest)
		: null;
	const hasDb = existsSync(join(dir, "data", DB_ENTRY));
	const dbParts = hasDb
		? dbPartsOf(manifest?.parts ? dataPartsOf(manifest.parts) : [...DATA_PARTS])
		: [];
	return [
		...new Set<PartId>([
			...dbParts.map(dataPart),
			...(uploadsOf(dir, "photos") > 0 ? ["data:photos" as const] : []),
			...(uploadsOf(dir, "covers") > 0 ? ["data:covers" as const] : []),
			...partsIn(join(dir, "config")),
		]),
	];
}

/** What staging, checking and applying an archive read: the database and the two volumes. */
type StagingContext = Pick<ServerContext, "db" | "configDir" | "dataDir">;

/**
 * Checks the chosen parts of a staged source (all of them by default); nothing is written. Null
 * for a token that is unknown or gone. The configuration import checks the configuration even
 * with no part chosen (nothing changes).
 */
async function checkStaged(
	ctx: StagingContext,
	area: Area,
	token: string,
	parts?: readonly PartId[],
): Promise<RestoreCheck | null> {
	const dir = stagedDir(ctx.dataDir, area.name, token);
	if (!dir) {
		return null;
	}
	const source = JSON.parse(readFileSync(join(dir, "source.json"), "utf8")) as RestoreSource;
	const available = stagedParts(dir);
	const selected = parts ? available.filter((p) => parts.includes(p)) : available;
	const data: RestoreCheck["data"] = {
		counts: {},
		gaps: [],
		schema: [],
		photos: selected.includes("data:photos") ? uploadsOf(dir, "photos") : 0,
		covers: selected.includes("data:covers") ? uploadsOf(dir, "covers") : 0,
	};
	const dbParts = dbPartsOf(dataPartsOf(selected));
	if (dbParts.length > 0) {
		try {
			data.counts = restoreDataParts(ctx.db, join(dir, "data", DB_ENTRY), dbParts, {
				dryRun: true,
			}).counts;
		} catch (e) {
			if (!(e instanceof DataRestoreError)) {
				throw e;
			}
			data.gaps = e.gaps;
			data.schema = e.tables;
		}
	}
	const configParts = selected.filter((p) => !isDataPart(p));
	const config =
		configParts.length > 0 || area.configOnly
			? await checkMergedConfig(
					ctx.db,
					ctx.configDir,
					join(dir, "config"),
					configParts,
					join(dir, "candidate"),
				)
			: null;
	return {
		token,
		source,
		available,
		selected,
		data,
		config,
		ready:
			selected.length > 0 &&
			data.gaps.length === 0 &&
			data.schema.length === 0 &&
			(config === null || config.ready),
	};
}

/** Checks the chosen parts of a staged restore (all of them by default); nothing is written. */
export async function checkRestore(
	ctx: StagingContext,
	token: string,
	parts?: readonly PartId[],
): Promise<RestoreCheck> {
	const check = await checkStaged(ctx, RESTORE, token, parts);
	if (!check) {
		throw new RestoreNotReadyError(null);
	}
	return check;
}

/**
 * Restores the chosen parts of a staged source after checking them again: data in one
 * transaction, photos and covers swapped, the configuration as one change (returned).
 */
export async function applyRestore(
	ctx: StagingContext,
	token: string,
	parts: readonly PartId[],
	actor: AuditActor | null,
	now = new Date(),
): Promise<{ check: RestoreCheck; change: ConfigChange | null }> {
	assertNotDemo("restore");
	const check = await checkRestore(ctx, token, parts);
	if (!check.ready) {
		throw new RestoreNotReadyError(check);
	}
	const dir = stagedDir(ctx.dataDir, RESTORE.name, token) ?? "";
	const dbParts = dbPartsOf(dataPartsOf(check.selected));
	if (dbParts.length > 0) {
		restoreDataParts(ctx.db, join(dir, "data", DB_ENTRY), dbParts);
	}
	for (const part of dataPartsOf(check.selected)) {
		for (const sub of uploadFoldersOf(part)) {
			const target = join(ctx.dataDir, "uploads", sub);
			rmSync(target, { recursive: true, force: true });
			if (existsSync(join(dir, "data", "uploads", sub))) {
				mkdirSync(join(ctx.dataDir, "uploads"), { recursive: true });
				cpSync(join(dir, "data", "uploads", sub), target, { recursive: true });
			}
		}
	}
	const change =
		check.config && changesSomething(check.config)
			? // audited below with the whole restore
				applyCandidate(ctx.db, ctx.configDir, join(dir, "candidate"), check.config, {
					action: "config.restore",
					audit: null,
					inUse: () => new RestoreNotReadyError(check),
					now,
				})
			: null;
	audit(
		ctx.db,
		actor,
		"backup.restore",
		"backup",
		check.source.name,
		{
			parts: check.selected,
			rows: check.data.counts,
			photos: check.data.photos,
			covers: check.data.covers,
			configChange: change?.id ?? null,
		},
		now,
	);
	rmSync(dir, { recursive: true, force: true });
	return { check, change };
}

export function discardRestore(dataDir: string, token: string): void {
	discardStaged(dataDir, RESTORE.name, token);
}

// --- "Importa configurazione": the configuration parts of any archive --------------------------

/** What importing the chosen configuration parts of a staged archive would change. */
export interface ConfigImportCheck extends CandidateCheck {
	token: string;
	source: RestoreSource;
	/** The configuration parts the archive holds, and those taken (the others stay as they are). */
	available: PartId[];
	selected: PartId[];
}

export class ArchiveNotReadyError extends Error {
	constructor(readonly check: CandidateCheck | null) {
		super("the configuration of the archive cannot be imported");
		this.name = "ArchiveNotReadyError";
	}
}

async function checkConfigStaged(
	ctx: StagingContext,
	token: string,
	parts?: readonly PartId[],
): Promise<ConfigImportCheck> {
	const check = await checkStaged(ctx, CONFIG_IMPORT, token, parts);
	if (!check?.config) {
		throw new ArchiveNotReadyError(null);
	}
	const { source, available, selected } = check;
	return { ...check.config, token, source, available, selected };
}

/**
 * "Importa configurazione", first half: an archive (any of them: a backup, "Esporta tutto",
 * "Esporta configurazione") staged with only its configuration and checked against the live
 * folder with the chosen parts (all those it holds by default), nothing written. Throws
 * `ArchiveReadError` for an unsafe or foreign archive and for one without configuration parts.
 */
export async function checkConfigArchive(
	ctx: StagingContext,
	zipPath: string,
	options: { parts?: readonly PartId[]; now?: number; name?: string } = {},
): Promise<ConfigImportCheck> {
	assertNotDemo("configImport");
	const token = await stage(
		ctx.dataDir,
		CONFIG_IMPORT,
		zipPath,
		options.name ?? "archive.zip",
		options.now,
	);
	return firstConfigCheck(ctx, token, options.parts);
}

/** The same for an archive uploaded from the page (at most `MAX_UPLOAD_BYTES`). */
export async function checkUploadedConfigArchive(
	ctx: StagingContext,
	bytes: Uint8Array,
	options: { parts?: readonly PartId[]; now?: number } = {},
): Promise<ConfigImportCheck> {
	assertNotDemo("configImport");
	const token = await stageUpload(ctx.dataDir, CONFIG_IMPORT, bytes, "archive.zip", options.now);
	return firstConfigCheck(ctx, token, options.parts);
}

async function firstConfigCheck(
	ctx: StagingContext,
	token: string,
	parts: readonly PartId[] | undefined,
): Promise<ConfigImportCheck> {
	const check = await checkConfigStaged(ctx, token, parts);
	if (check.available.length === 0) {
		discardConfigArchive(ctx.dataDir, token);
		throw new ArchiveReadError("no_config");
	}
	return check;
}

/** The same staged archive checked again with another choice of parts. */
export async function recheckConfigArchive(
	ctx: StagingContext,
	token: string,
	parts: readonly PartId[],
): Promise<ConfigImportCheck> {
	return checkConfigStaged(ctx, token, parts);
}

/**
 * Imports the chosen configuration parts of a staged archive: checked again, then every added,
 * changed or removed file written as one configuration change (the replaced files go in the
 * history), the configuration reloaded and the audit written. The staged archive goes.
 */
export async function applyConfigArchive(
	ctx: StagingContext,
	token: string,
	actor: AuditActor | null,
	options: { parts?: readonly PartId[]; now?: Date } = {},
): Promise<ConfigChange> {
	assertNotDemo("configImport");
	const {
		token: _t,
		source,
		available: _a,
		selected,
		...check
	} = await checkConfigStaged(ctx, token, options.parts);
	if (!check.ready) {
		throw new ArchiveNotReadyError(check);
	}
	const dir = stagedDir(ctx.dataDir, CONFIG_IMPORT.name, token) ?? "";
	const change = applyCandidate(ctx.db, ctx.configDir, join(dir, "candidate"), check, {
		action: "config.import",
		audit: {
			actor,
			details: {
				parts: selected,
				source: source.name,
				added: check.files.added.length,
				changed: check.files.changed.length,
				removed: check.files.removed.length,
				sections: check.sections,
			},
		},
		inUse: (problems) => new ArchiveNotReadyError({ ...check, inUse: problems, ready: false }),
		now: options.now,
	});
	rmSync(dir, { recursive: true, force: true });
	return change;
}

/** Drops a staged archive (the operator did not import it). */
export function discardConfigArchive(dataDir: string, token: string): void {
	discardStaged(dataDir, CONFIG_IMPORT.name, token);
}
