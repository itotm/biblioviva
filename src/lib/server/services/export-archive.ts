// SPDX-License-Identifier: GPL-3.0-or-later
// The one archive format of BiblioViva (PLAN.md §3.6, steps 1.9b, 11.3, 11.12): every archive the
// program writes — "Esporta tutto", "Esporta configurazione", a backup of chosen parts — is one ZIP
// with a manifest (`manifest.json`, the parts it holds), a database snapshot (`db/`), the uploads
// (`uploads/`: patron photos, class pictures, covers) and the configuration folder (`config/`),
// each present only for the parts asked for: the database copy keeps only the chosen data
// (`pruneSnapshot`), the uploads only photos and/or covers, the configuration only the chosen parts
// (`selectedFiles`, never the history). Built as a stream with fflate so nothing but the snapshot
// touches the disk and no file is held in memory; images are stored, text is deflated. The faces
// of removed pupils are painted over in the class pictures before anything is read (Q106).
// `unpackArchive` is the one reader: the restore and the configuration import stage an archive
// with it, after the safe reader has checked every entry.
import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	renameSync,
	rmSync,
	statSync,
	writeSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, normalize } from "node:path";
import { strFromU8, strToU8, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import {
	ArchiveError,
	unpackZipFile,
	type ArchiveLimits,
	type ArchiveProblem,
	type ArchiveRules,
} from "#lib/server/archive/read.js";
import { fileKindOf, HISTORY_DIR } from "#lib/server/config/folder.js";
import type { ServerContext } from "#lib/server/context.js";
import type { Db } from "#lib/server/db/client.js";
import { assertNotDemo } from "#lib/server/demo/public.js";
import { ServiceError } from "#lib/server/errors.js";
import { APP_VERSION } from "#lib/shared/version.js";
import {
	DATA_PARTS,
	dataPart,
	dataPartsOf,
	isDataPart,
	isPartId,
	type PartId,
} from "#lib/shared/archive-parts.js";
import { freeFileName, listFilesRecursive } from "#lib/server/runtime/fs.js";
import { heavyWork } from "#lib/server/runtime/limit.js";
import { fileStamp } from "#lib/shared/dates.js";
import { audit, type AuditActor } from "./audit.js";
import { backupsDir, summarizeUploads, type UploadsSummary } from "./backup.js";
import { paintErasedFrames } from "./class-sheet-erasure.js";
import { partsIn, selectedFiles } from "./config-parts.js";
import { dbPartsOf, pruneSnapshot, UPLOAD_FOLDERS } from "./data-parts.js";

export const MANIFEST_NAME = "manifest.json";
export const DB_ENTRY = "db/biblioviva.db";
export const ARCHIVE_APP = "BiblioViva";
/** The largest archive taken as an upload (the server accepts bodies up to BODY_SIZE_LIMIT, 32 MB). */
export const MAX_UPLOAD_BYTES = 30_000_000;

export interface ExportManifest {
	app: typeof ARCHIVE_APP;
	version: string;
	createdAt: string;
	timezone: string;
	/** The name of the library that wrote it. */
	library?: string;
	database: { bytes: number };
	uploads: UploadsSummary;
	config: { files: number };
	/** The parts the archive holds. */
	parts: PartId[];
}

/** Every part a full export can hold, for this installation. */
export function exportableParts(configDir: string): PartId[] {
	return [...DATA_PARTS.map(dataPart), ...partsIn(configDir)];
}

/** `biblioviva-export-YYYYMMDD-HHmm.zip` in the library time zone. */
export function exportArchiveName(now: Date, timezone: string): string {
	return `biblioviva-export-${fileStamp(now, timezone)}.zip`;
}

/** `biblioviva-configurazione-YYYYMMDD-HHmm.zip`: the archive of the configuration parts. */
export function configArchiveName(now: Date, timezone: string): string {
	return `biblioviva-configurazione-${fileStamp(now, timezone)}.zip`;
}

const STORED = /\.(webp|jpe?g|png|gif|avif|heic|db|zip|gz|br|woff2?)$/i;

interface Entry {
	name: string;
	/** The file to stream, or the bytes (configuration documents cut to the chosen sections). */
	path: string | null;
	bytes: number;
	content?: Uint8Array;
}

/** Everything the archive will contain, in order (manifest and snapshot are added by the stream). */
function collectEntries(
	dataDir: string,
	configDir: string,
	parts: readonly PartId[],
): { config: Entry[]; uploads: Entry[] } {
	const uploadsRoot = join(dataDir, "uploads");
	const uploads = listFilesRecursive(uploadsRoot)
		.filter((rel) => {
			const part = UPLOAD_FOLDERS[rel.split("/")[0] ?? ""];
			return part !== undefined && parts.includes(`data:${part}`);
		})
		.map((rel) => ({
			name: `uploads/${rel}`,
			path: join(uploadsRoot, rel),
			bytes: statSync(join(uploadsRoot, rel)).size,
		}));
	const config = Object.entries(
		selectedFiles(
			configDir,
			parts.filter((p) => !isDataPart(p)),
		),
	).map(([rel, content]) => ({
		name: `config/${rel}`,
		path: null,
		bytes: content.byteLength,
		content,
	}));
	return { config, uploads };
}

export interface ExportOptions {
	timezone: string;
	now?: Date;
	/** Folder for the temporary snapshot (`DATA_DIR/tmp`). */
	tmpDir?: string;
	/** The parts to include; every part when absent. */
	parts?: readonly PartId[];
	/** The library's name, recorded in the manifest. */
	library?: string;
}

/**
 * Streams the archive. The faces of removed pupils still to cover are painted over first, so no
 * caller can copy one (Q106); the database snapshot is taken with `VACUUM INTO` when the stream
 * starts (so the download reflects that instant) and deleted when it has been sent.
 */
export async function createExportStream(
	db: Db,
	dataDir: string,
	configDir: string,
	options: ExportOptions,
): Promise<{ stream: ReadableStream<Uint8Array>; manifest: ExportManifest }> {
	await paintErasedFrames(db, dataDir);
	const now = options.now ?? new Date();
	const tmpDir = options.tmpDir ?? join(dataDir, "tmp");
	mkdirSync(tmpDir, { recursive: true });
	const available = exportableParts(configDir);
	const parts = options.parts ? available.filter((p) => options.parts?.includes(p)) : available;
	const dbParts = dbPartsOf(dataPartsOf(parts));
	const snapshot = join(tmpDir, `export-${crypto.randomUUID()}.db`);
	if (dbParts.length > 0) {
		db.$client.run("VACUUM INTO ?", [snapshot]);
		pruneSnapshot(snapshot, dbParts);
	}
	const entries = collectEntries(dataDir, configDir, parts);
	const uploads = summarizeUploads(join(dataDir, "uploads"));
	const manifest: ExportManifest = {
		app: ARCHIVE_APP,
		version: APP_VERSION,
		createdAt: now.toISOString(),
		timezone: options.timezone,
		...(options.library === undefined ? {} : { library: options.library }),
		database: { bytes: dbParts.length > 0 ? statSync(snapshot).size : 0 },
		uploads: {
			...uploads,
			photos: parts.includes("data:photos") ? uploads.photos : 0,
			covers: parts.includes("data:covers") ? uploads.covers : 0,
			other: 0,
			bytes: entries.uploads.reduce((n, e) => n + e.bytes, 0),
		},
		config: { files: entries.config.length },
		parts,
	};
	const files: Entry[] = [
		...(dbParts.length > 0
			? [{ name: DB_ENTRY, path: snapshot, bytes: manifest.database.bytes }]
			: []),
		...entries.config,
		...entries.uploads,
	];

	const queue: Uint8Array[] = [];
	let failed: Error | null = null;
	const zip = new Zip((err, chunk, final) => {
		if (err) {
			failed = err;
			return;
		}
		if (chunk.byteLength > 0) {
			queue.push(chunk);
		}
		if (final) {
			done = true;
		}
	});
	let done = false;

	/** One step per chunk of one file; the generator ends after `zip.end()`. */
	async function* steps(): AsyncGenerator<void> {
		const manifestEntry = new ZipDeflate(MANIFEST_NAME, { level: 6 });
		zip.add(manifestEntry);
		manifestEntry.push(strToU8(JSON.stringify(manifest, null, "\t")), true);
		yield;
		for (const file of files) {
			const entry = STORED.test(file.name)
				? new ZipPassThrough(file.name)
				: new ZipDeflate(file.name, { level: 6 });
			entry.mtime = now;
			zip.add(entry);
			if (file.bytes === 0 || file.path === null) {
				entry.push(file.content ?? new Uint8Array(), true);
				yield;
				continue;
			}
			for await (const chunk of Bun.file(file.path).stream()) {
				entry.push(chunk);
				yield;
			}
			entry.push(new Uint8Array(), true);
			yield;
		}
		zip.end();
	}
	const iterator = steps();
	const cleanup = (): void => rmSync(snapshot, { force: true });

	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				while (queue.length === 0 && !done) {
					const next = await iterator.next();
					if (failed) {
						throw failed;
					}
					if (next.done) {
						break;
					}
				}
				for (const chunk of queue.splice(0)) {
					controller.enqueue(chunk);
				}
				if (done) {
					cleanup();
					controller.close();
				}
			} catch (e) {
				cleanup();
				controller.error(e);
			}
		},
		cancel() {
			zip.terminate();
			cleanup();
		},
	});
	return { stream, manifest };
}

/**
 * An archive of chosen parts written into the backups folder (`BACKUP_DIR`) as
 * `biblioviva-YYYYMMDD-HHmm.zip` (a manual backup, 11.12), listed and restored like the nightly
 * database copies.
 */
export async function writeArchiveBackup(
	db: Db,
	dataDir: string,
	configDir: string,
	options: ExportOptions,
): Promise<{ name: string; bytes: number; manifest: ExportManifest }> {
	assertNotDemo("backups");
	const now = options.now ?? new Date();
	const dir = backupsDir();
	mkdirSync(dir, { recursive: true });
	const name = freeFileName(dir, `biblioviva-${fileStamp(now, options.timezone)}`, ".zip");
	const { stream, manifest } = await createExportStream(db, dataDir, configDir, {
		...options,
		now,
	});
	const bytes = await writeStreamTo(stream, join(dir, name));
	return { name, bytes, manifest };
}

/**
 * Writes an archive stream to a file through a temporary one beside it (`.<name>.part`, renamed
 * when complete, removed when the stream fails); returns its size.
 */
export async function writeStreamTo(
	stream: ReadableStream<Uint8Array>,
	target: string,
): Promise<number> {
	const tmp = join(dirname(target), `.${basename(target)}.part`);
	const fd = openSync(tmp, "w");
	let bytes = 0;
	try {
		for await (const chunk of stream) {
			writeSync(fd, chunk);
			bytes += chunk.byteLength;
		}
	} catch (e) {
		closeSync(fd);
		rmSync(tmp, { force: true });
		throw e;
	}
	closeSync(fd);
	renameSync(tmp, target);
	return bytes;
}

/**
 * "Backup delle parti scelte" of the backups page: the archive written, audited, a heavy job that
 * waits its turn (9.32).
 */
export async function archiveBackupNow(
	{ db, dataDir, configDir }: Pick<ServerContext, "db" | "dataDir" | "configDir">,
	options: ExportOptions,
	actor: AuditActor,
): Promise<{ name: string; bytes: number }> {
	const result = await heavyWork.run(() => writeArchiveBackup(db, dataDir, configDir, options));
	audit(db, actor, "backup.create", "backup", result.name, {
		bytes: result.bytes,
		parts: result.manifest.parts,
	});
	return { name: result.name, bytes: result.bytes };
}

// --- Reading an archive ----------------------------------------------------------------------

export type ArchiveReadProblem = ArchiveProblem | "not_archive" | "no_config";

/** An archive refused before anything of it is used: unsafe, damaged, not BiblioViva's, empty. */
export class ArchiveReadError extends ServiceError<ArchiveReadProblem> {
	constructor(
		code: ArchiveReadProblem,
		readonly detail = "",
	) {
		super(code, `archive: ${code}${detail ? ` (${detail})` : ""}`);
		this.name = "ArchiveReadError";
	}
}

export interface UnpackedArchive {
	files: number;
	bytes: number;
	manifest: ExportManifest;
}

/** Where an archive entry lands, or null for anything unexpected (guards against path traversal). */
export function restoreTarget(name: string, dataDir: string, configDir: string): string | null {
	const clean = normalize(name).split(/[\\/]/).join("/");
	if (clean.includes("..") || isAbsolute(clean) || clean.endsWith("/")) {
		return null;
	}
	if (clean === MANIFEST_NAME) {
		return null;
	}
	if (clean.startsWith("db/") || clean.startsWith("uploads/")) {
		return join(dataDir, clean);
	}
	if (clean.startsWith("config/")) {
		return join(configDir, clean.slice("config/".length));
	}
	return null;
}

/**
 * The entries an archive may hold: the manifest, the database snapshot, files of the upload
 * folders, and files of the configuration folder that the loader knows (never its history).
 */
export function knownEntry(name: string): boolean {
	if (name === MANIFEST_NAME || name === DB_ENTRY) {
		return true;
	}
	const [top, folder = "", ...rest] = name.split("/");
	if (top === "uploads") {
		return UPLOAD_FOLDERS[folder] !== undefined && rest.length > 0;
	}
	return top === "config" && fileKindOf(name.slice("config/".length)) !== null;
}

/**
 * The limits of an archive of `archiveBytes` (a library of 10 000 copies: the database and tens
 * of thousands of covers and photos). Pictures and the database are stored, not deflated, so a
 * real archive unpacks to little more than its own size: twenty times its size plus 64 MB (the
 * deflated text of the configuration) is generous, 8 GiB the ceiling in any case, and a zip bomb
 * is refused before a byte is written.
 */
export function fullArchiveLimits(archiveBytes: number): ArchiveLimits {
	const total = Math.min(8 * 1024 ** 3, archiveBytes * 20 + 64 * 1024 ** 2);
	return {
		maxArchiveBytes: 8 * 1024 ** 3,
		maxEntries: 200_000,
		maxFileBytes: total,
		maxTotalBytes: total,
	};
}

/** The manifest of an archive, or null when it is not one BiblioViva wrote. */
function parseManifest(bytes: Uint8Array | undefined): ExportManifest | null {
	try {
		const manifest = bytes ? (JSON.parse(strFromU8(bytes)) as Partial<ExportManifest>) : null;
		return manifest?.app === ARCHIVE_APP &&
			Array.isArray(manifest.parts) &&
			manifest.parts.every((p) => typeof p === "string" && isPartId(p))
			? (manifest as ExportManifest)
			: null;
	} catch {
		return null;
	}
}

/**
 * Unpacks an archive into a data and a configuration folder (a staging area: the restore and the
 * configuration import) through the safe reader (`#lib/server/archive/read.ts`): every entry is
 * checked before anything is written — a safe path, no link, a name the format knows
 * (`knownEntry`), the limits — and an archive without BiblioViva's manifest is refused.
 * `configOnly` leaves the database and the uploads in the archive (the configuration import).
 * Throws `ArchiveReadError`; what was written before a failure is the caller's to discard.
 */
export async function unpackArchive(
	zipPath: string,
	dataDir: string,
	configDir: string,
	options: { configOnly?: boolean; limits?: ArchiveLimits } = {},
): Promise<UnpackedArchive> {
	const rules: ArchiveRules = {
		...(options.limits ?? fullArchiveLimits(statSync(zipPath).size)),
		known: knownEntry,
		forbidden: (name) => name.startsWith(`config/${HISTORY_DIR}/`),
		skip: options.configOnly
			? (name) => (name === DB_ENTRY || name.startsWith("uploads/")) && knownEntry(name)
			: undefined,
	};
	let unpacked: Awaited<ReturnType<typeof unpackZipFile>>;
	try {
		unpacked = await unpackZipFile(
			zipPath,
			rules,
			(name) => restoreTarget(name, dataDir, configDir),
			[MANIFEST_NAME],
		);
	} catch (e) {
		if (e instanceof ArchiveError) {
			throw new ArchiveReadError(e.code, e.detail);
		}
		// fflate's errors carry a numeric code: damaged compressed data
		if (e instanceof Error && typeof (e as { code?: unknown }).code === "number") {
			throw new ArchiveReadError("not_zip");
		}
		throw e;
	}
	const manifest = parseManifest(unpacked.kept[MANIFEST_NAME]);
	if (!manifest) {
		throw new ArchiveReadError("not_archive");
	}
	for (const stale of ["biblioviva.db-wal", "biblioviva.db-shm"]) {
		const path = join(dataDir, "db", stale);
		if (existsSync(path)) {
			rmSync(path, { force: true });
		}
	}
	return { files: unpacked.files, bytes: unpacked.bytes, manifest };
}
