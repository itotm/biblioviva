// SPDX-License-Identifier: GPL-3.0-or-later
// The one reader of the zip archives the program receives: the archives of its one format (the
// export, the backups of chosen parts, the configuration export; §3.6, 1.9b, 11.3, 11.12) and the
// language packs (11.8). Before
// anything is inflated or written, the central directory is read and every entry checked: a safe
// relative path (no absolute path, drive letter, backslash, `.` or `..`), no symbolic link, no name
// twice, at most so many entries, each file and the whole within the limits of its use. While
// inflating, the bytes actually produced are counted again, so an entry that lies about its size
// stops the reading too. The limits and the names a use accepts are its own (`ArchiveRules`).
import {
	closeSync,
	fstatSync,
	mkdirSync,
	openSync,
	readSync,
	rmSync,
	statSync,
	writeSync,
} from "node:fs";
import { dirname } from "node:path";
import { strFromU8, unzipSync, Unzip, UnzipInflate } from "fflate";

export interface ArchiveLimits {
	/** The largest archive file. */
	maxArchiveBytes: number;
	/** The most entries (files; folders are not counted). */
	maxEntries: number;
	/** The largest unpacked file. */
	maxFileBytes: number;
	/** The most bytes unpacked in all. */
	maxTotalBytes: number;
}

export interface ArchiveRules extends ArchiveLimits {
	/** Entries left out: neither unpacked nor checked against `known` (still counted). */
	skip?: (name: string) => boolean;
	/** The names this kind of archive may hold; any other is refused as `unknown_file`. */
	known?: (name: string) => boolean;
	/** Safe paths this kind of archive must never hold, refused as `unsafe_path`. */
	forbidden?: (name: string) => boolean;
}

export type ArchiveProblem =
	"too_large" | "not_zip" | "too_many_files" | "unsafe_path" | "link" | "unknown_file";

export class ArchiveError extends Error {
	constructor(
		readonly code: ArchiveProblem,
		readonly detail = "",
	) {
		super(`archive: ${code}${detail ? ` (${detail})` : ""}`);
		this.name = "ArchiveError";
	}
}

/** An entry of the central directory. */
export interface ArchiveEntry {
	name: string;
	/** The unpacked size it declares. */
	size: number;
	link: boolean;
}

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
/** The end record (22 bytes) and the longest comment it may carry. */
const TAIL_BYTES = 22 + 65_535;
/** Sizes and offsets of ZIP64 archives, which the program never writes. */
const ZIP64 = 0xffffffff;

/** The offset and length of the central directory, from the end record found in `tail`. */
function endRecord(tail: Uint8Array, fileBytes: number): { offset: number; length: number } {
	const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
	for (let i = tail.byteLength - 22; i >= 0; i--) {
		if (view.getUint32(i, true) !== END_OF_DIRECTORY) {
			continue;
		}
		const length = view.getUint32(i + 12, true);
		const offset = view.getUint32(i + 16, true);
		if (offset === ZIP64 || length === ZIP64) {
			throw new ArchiveError("too_large");
		}
		if (offset + length > fileBytes) {
			throw new ArchiveError("not_zip");
		}
		return { offset, length };
	}
	throw new ArchiveError("not_zip");
}

/**
 * The entries of a central directory. It is walked by its length, not by the 16-bit count of the
 * end record, which wraps beyond 65 535 entries.
 */
function directoryEntries(directory: Uint8Array): ArchiveEntry[] {
	const view = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);
	const entries: ArchiveEntry[] = [];
	let offset = 0;
	while (offset < directory.byteLength) {
		if (
			offset + 46 > directory.byteLength ||
			view.getUint32(offset, true) !== DIRECTORY_ENTRY
		) {
			throw new ArchiveError("not_zip");
		}
		const madeBy = view.getUint16(offset + 4, true) >> 8;
		const size = view.getUint32(offset + 24, true);
		const nameLength = view.getUint16(offset + 28, true);
		const extraLength = view.getUint16(offset + 30, true);
		const commentLength = view.getUint16(offset + 32, true);
		const external = view.getUint32(offset + 38, true);
		if (size === ZIP64) {
			throw new ArchiveError("too_large");
		}
		const name = strFromU8(directory.subarray(offset + 46, offset + 46 + nameLength));
		// Unix (3) or macOS (19) entries keep the file mode in the upper 16 bits
		const mode = madeBy === 3 || madeBy === 19 ? external >>> 16 : 0;
		entries.push({ name, size, link: (mode & 0o170000) === 0o120000 });
		offset += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

/** The central directory of an archive held in memory. */
export function zipEntries(zip: Uint8Array): ArchiveEntry[] {
	const tail = zip.subarray(Math.max(0, zip.byteLength - TAIL_BYTES));
	const { offset, length } = endRecord(tail, zip.byteLength);
	return directoryEntries(zip.subarray(offset, offset + length));
}

/** The central directory of an archive on disk, read without reading the rest of the file. */
export function zipFileEntries(path: string): { entries: ArchiveEntry[]; bytes: number } {
	const fd = openSync(path, "r");
	try {
		const bytes = fstatSync(fd).size;
		const read = (position: number, length: number): Uint8Array => {
			const buffer = new Uint8Array(length);
			let done = 0;
			while (done < length) {
				const n = readSync(fd, buffer, done, length - done, position + done);
				if (n === 0) {
					throw new ArchiveError("not_zip");
				}
				done += n;
			}
			return buffer;
		};
		const tailLength = Math.min(bytes, TAIL_BYTES);
		const { offset, length } = endRecord(read(bytes - tailLength, tailLength), bytes);
		return { entries: directoryEntries(read(offset, length)), bytes };
	} finally {
		closeSync(fd);
	}
}

/** A path that stays inside the folder it is unpacked into. */
export function safeArchivePath(name: string): boolean {
	return (
		name.length > 0 &&
		name.length <= 400 &&
		!name.startsWith("/") &&
		!name.includes("\\") &&
		!name.includes("\0") &&
		!/^[A-Za-z]:/.test(name) &&
		!name.split("/").some((part) => part === ".." || part === "." || part === "")
	);
}

const isFolder = (name: string): boolean => name.endsWith("/");

/**
 * Checks the central directory against the rules; returns the declared size of every file to
 * unpack (the skipped ones and the folders left out). Nothing is inflated or written.
 */
export function checkEntries(
	entries: readonly ArchiveEntry[],
	archiveBytes: number,
	rules: ArchiveRules,
): Map<string, number> {
	if (archiveBytes > rules.maxArchiveBytes) {
		throw new ArchiveError("too_large");
	}
	const files = entries.filter((e) => !isFolder(e.name));
	if (files.length > rules.maxEntries) {
		throw new ArchiveError("too_many_files");
	}
	const taken = new Map<string, number>();
	const seen = new Set<string>();
	let total = 0;
	for (const entry of entries) {
		if (entry.link) {
			throw new ArchiveError("link", entry.name);
		}
		const name = isFolder(entry.name) ? entry.name.slice(0, -1) : entry.name;
		if (!safeArchivePath(name) || seen.has(entry.name) || rules.forbidden?.(entry.name)) {
			throw new ArchiveError("unsafe_path", entry.name);
		}
		seen.add(entry.name);
		if (isFolder(entry.name) || rules.skip?.(entry.name)) {
			continue;
		}
		if (rules.known && !rules.known(entry.name)) {
			throw new ArchiveError("unknown_file", entry.name);
		}
		if (entry.size > rules.maxFileBytes) {
			throw new ArchiveError("too_large", entry.name);
		}
		total += entry.size;
		taken.set(entry.name, entry.size);
	}
	if (total > rules.maxTotalBytes) {
		throw new ArchiveError("too_large");
	}
	return taken;
}

/** An archive held in memory (an upload): its files, checked as the rules say. */
export function readZip(zip: Uint8Array, rules: ArchiveRules): Record<string, Uint8Array> {
	if (zip.byteLength > rules.maxArchiveBytes) {
		throw new ArchiveError("too_large");
	}
	const taken = checkEntries(zipEntries(zip), zip.byteLength, rules);
	let files: Record<string, Uint8Array>;
	try {
		// each file inflates into a buffer of the size the directory declared, checked above
		files = unzipSync(zip, { filter: (f) => taken.has(f.name) });
	} catch {
		throw new ArchiveError("not_zip");
	}
	for (const [name, bytes] of Object.entries(files)) {
		if (taken.get(name) !== bytes.byteLength) {
			throw new ArchiveError("not_zip", name);
		}
	}
	return files;
}

export interface UnpackResult {
	files: number;
	bytes: number;
	/** The entries asked for in memory (`inMemory`), not written. */
	kept: Record<string, Uint8Array>;
}

/**
 * An archive on disk (a backup, an export) unpacked as it is read, never held in memory: each
 * entry written where `target` says (null: left out), the ones named in `inMemory` kept in memory.
 * The central directory is checked before anything is written; a file that inflates beyond its
 * declared size, or a local name the directory does not list, stops the reading. Written files are
 * left for the caller to discard when it fails (they are in its staging folder).
 */
export async function unpackZipFile(
	path: string,
	rules: ArchiveRules,
	target: (name: string) => string | null,
	inMemory: readonly string[] = [],
): Promise<UnpackResult> {
	if (statSync(path).size > rules.maxArchiveBytes) {
		throw new ArchiveError("too_large");
	}
	const { entries, bytes: archiveBytes } = zipFileEntries(path);
	const taken = checkEntries(entries, archiveBytes, rules);
	const listed = new Set(entries.map((e) => e.name));
	const result: UnpackResult = { files: 0, bytes: 0, kept: {} };
	const unzip = new Unzip();
	unzip.register(UnzipInflate);
	let failure: Error | null = null;
	const fail = (err: unknown): void => {
		failure ??= err instanceof Error ? err : new Error(String(err));
	};
	unzip.onfile = (file) => {
		if (failure) {
			return;
		}
		const declared = taken.get(file.name);
		if (declared === undefined) {
			// a folder, a skipped entry, or a local name the directory does not list
			if (!listed.has(file.name)) {
				fail(new ArchiveError("unsafe_path", file.name));
			}
			return;
		}
		const memory = inMemory.includes(file.name);
		const destination = memory ? null : target(file.name);
		if (!memory && !destination) {
			return;
		}
		let written = 0;
		const count = (chunk: Uint8Array): boolean => {
			written += chunk.byteLength;
			result.bytes += chunk.byteLength;
			if (written > declared || result.bytes > rules.maxTotalBytes) {
				fail(new ArchiveError("too_large", file.name));
				file.terminate();
				return false;
			}
			return true;
		};
		if (memory) {
			const parts: Uint8Array[] = [];
			file.ondata = (err, chunk, final) => {
				if (err) {
					fail(err);
					return;
				}
				if (!count(chunk)) {
					return;
				}
				parts.push(chunk);
				if (final) {
					result.kept[file.name] = concat(parts);
				}
			};
			file.start();
			return;
		}
		mkdirSync(dirname(destination ?? ""), { recursive: true });
		const fd = openSync(destination ?? "", "w");
		let open = true;
		const close = (): void => {
			if (open) {
				open = false;
				closeSync(fd);
			}
		};
		file.ondata = (err, chunk, final) => {
			if (err) {
				fail(err);
				close();
				return;
			}
			if (!count(chunk)) {
				close();
				rmSync(destination ?? "", { force: true });
				return;
			}
			if (chunk.byteLength > 0) {
				writeSync(fd, chunk);
			}
			if (final) {
				close();
				result.files++;
			}
		};
		file.start();
	};
	for await (const chunk of Bun.file(path).stream()) {
		unzip.push(chunk);
		if (failure) {
			throw failure as Error;
		}
	}
	unzip.push(new Uint8Array(), true);
	if (failure) {
		throw failure as Error;
	}
	return result;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.byteLength;
	}
	return out;
}
