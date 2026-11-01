// SPDX-License-Identifier: GPL-3.0-or-later
// Uploaded import files (PLAN.md §3.22): kept under `DATA_DIR/imports/uploads/<id>/` between the
// upload and the commit, then moved to `DATA_DIR/imports/<batch-id>/` where the original stays
// for traceability. Stale uploads (never committed) are swept after a day. The last column
// mapping used for a given header is remembered per kind so the next file of the same source
// needs no mapping at all.
import { NotFoundError } from "#lib/server/errors.js";
import { demoImportAllowed } from "#lib/server/demo/examples.js";
import {
	assertNotDemo,
	DEMO_IMPORT_MAX_BYTES,
	DemoBlockedError,
	isDemoPublic,
} from "#lib/server/demo/public.js";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { UPLOAD_ID } from "#lib/shared/input-schemas.js";

export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

export interface StoredUpload {
	id: string;
	filename: string;
	path: string;
}

/** The longest name kept for an uploaded file (its end, so the extension stays). */
const NAME_MAX = 100;

const safeName = (filename: string): string =>
	filename
		.replace(/[^\w.-]+/g, "_")
		.slice(-NAME_MAX)
		.replace(/^[_.]+|_+$/g, "") || "import.csv";

export function uploadsDir(dataDir: string): string {
	return join(dataDir, "imports", "uploads");
}

/** The imports that keep their file between the upload and the commit. */
export type UploadKind = "students" | "teachers" | "catalog" | "loans";

export function storeUpload(
	dataDir: string,
	filename: string,
	bytes: Uint8Array,
	kind: UploadKind,
): StoredUpload {
	if (bytes.length > DEMO_IMPORT_MAX_BYTES) {
		assertNotDemo("importSize");
	}
	// the public demo imports its example file only, and names the upload itself (Q121)
	if (!demoImportAllowed(dataDir, kind, bytes)) {
		throw new DemoBlockedError("importExample");
	}
	sweepUploads(dataDir);
	const id = crypto.randomUUID();
	const dir = join(uploadsDir(dataDir), id);
	mkdirSync(dir, { recursive: true });
	const name = isDemoPublic() ? `${kind}-import.csv` : safeName(filename);
	const path = join(dir, name);
	writeFileSync(path, bytes);
	return { id, filename: name, path };
}

export class UploadNotFoundError extends NotFoundError {
	constructor(readonly id: string) {
		super("upload", `upload ${id} not found`);
		this.name = "UploadNotFoundError";
	}
}

export function readUpload(dataDir: string, id: string): StoredUpload & { bytes: Uint8Array } {
	if (!UPLOAD_ID.test(id)) {
		throw new UploadNotFoundError(id);
	}
	const dir = join(uploadsDir(dataDir), id);
	if (!existsSync(dir)) {
		throw new UploadNotFoundError(id);
	}
	const filename = readdirSync(dir)[0];
	if (!filename) {
		throw new UploadNotFoundError(id);
	}
	const path = join(dir, filename);
	return { id, filename, path, bytes: new Uint8Array(readFileSync(path)) };
}

/** Moves the upload to `DATA_DIR/imports/<batch-id>/` and returns the stored path (relative). */
export function finalizeUpload(dataDir: string, id: string, batchId: number): string {
	const upload = readUpload(dataDir, id);
	const dir = join(dataDir, "imports", String(batchId));
	mkdirSync(dir, { recursive: true });
	renameSync(upload.path, join(dir, upload.filename));
	rmSync(join(uploadsDir(dataDir), id), { recursive: true, force: true });
	return join("imports", String(batchId), upload.filename);
}

/** Removes uploads older than the TTL (never committed). */
export function sweepUploads(dataDir: string, now = Date.now()): number {
	const base = uploadsDir(dataDir);
	if (!existsSync(base)) {
		return 0;
	}
	let removed = 0;
	for (const id of readdirSync(base)) {
		const dir = join(base, id);
		if (now - statSync(dir).mtimeMs > UPLOAD_TTL_MS) {
			rmSync(dir, { recursive: true, force: true });
			removed++;
		}
	}
	return removed;
}

/** Column mappings remembered per header signature (`DATA_DIR/imports/<kind>-mappings.json`). */
export function rememberedMapping<T>(dataDir: string, kind: string, signature: string): T | null {
	const file = join(dataDir, "imports", `${kind}-mappings.json`);
	if (!existsSync(file)) {
		return null;
	}
	try {
		const all = JSON.parse(readFileSync(file, "utf8")) as Record<string, T>;
		return all[signature] ?? null;
	} catch {
		return null;
	}
}

export function rememberMapping<T>(
	dataDir: string,
	kind: string,
	signature: string,
	mapping: T,
): void {
	const dir = join(dataDir, "imports");
	mkdirSync(dir, { recursive: true });
	const file = join(dir, `${kind}-mappings.json`);
	let all: Record<string, T> = {};
	if (existsSync(file)) {
		try {
			all = JSON.parse(readFileSync(file, "utf8")) as Record<string, T>;
		} catch {
			all = {};
		}
	}
	all[signature] = mapping;
	writeFileSync(file, JSON.stringify(all, null, "\t"));
}

/** The header signature: the cells of the first row, or the column count without a header. */
export function headerSignature(rows: readonly string[][], header: boolean): string {
	const first = rows[0] ?? [];
	return header ? first.map((c) => c.trim().toLowerCase()).join("|") : `columns:${first.length}`;
}
