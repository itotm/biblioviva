// SPDX-License-Identifier: GPL-3.0-or-later
// The steps every CSV import takes on the server (PLAN.md §3.22), whatever it imports (the catalogue
// takes a MARC file too, read into the same rows, step 9.65): the upload
// (refusals, the stored file, the detected format and the remembered mapping), the validate phase
// and the commit phase over the stored file. Each import is an `ImportKind` (`./kinds.ts`); its
// remote functions validate their input, call `requireUser` and hand over to these functions.
import type { AuthUser } from "#lib/server/auth/types.js";
import type { ServerContext } from "#lib/server/context.js";
import { DemoBlockedError } from "#lib/server/demo/public.js";
import { missingHeaders, type ImportSpec } from "#lib/shared/import-columns.js";
import { readCsv } from "./csv.js";
import { ImportNotReadyError } from "./pipeline.js";
import {
	finalizeUpload,
	headerSignature,
	readUpload,
	rememberedMapping,
	rememberMapping,
	storeUpload,
	UploadNotFoundError,
	type UploadKind,
} from "./uploads.js";

/** The format detected in a file: header or not, the column mapping, and whether to look at it. */
export interface Detection<F extends string> {
	header: boolean;
	mapping: (F | null)[];
	/** False when the operator must look at the columns before validating. */
	certain: boolean;
}

/** What every validate and commit call names: the stored file and how to read it. */
export interface ImportRun<F extends string> {
	uploadId: string;
	mapping: (F | null)[];
	header: boolean;
}

/** The original file of a commit, kept with its batch. */
export interface KeptFile {
	filename: string;
	storeFile: (batchId: number) => string | null;
}

/** What the upload of a kind needs. */
export interface UploadSpec<F extends string, D extends Detection<F>> {
	/** The upload's name: its folder, its remembered mappings and the demo's example file. */
	name: UploadKind;
	spec: ImportSpec<F>;
	/** The largest file accepted, in bytes. */
	maxBytes: number;
	/** The file's name when the browser sends none. */
	fallbackName: string;
	detect: (rows: readonly string[][]) => D;
	/**
	 * A file that is not a CSV, read into the rows of the import (a MARC file of the catalogue,
	 * step 9.65): null when the bytes are not of that kind, so they are read as a CSV.
	 */
	read?: (bytes: Uint8Array) => { rows: string[][]; lines: number[]; format: string } | null;
}

/** The rows of a file: the kind's own reader when it recognises the bytes, else the CSV reader. */
function readTable(
	kind: Pick<UploadSpec<string, Detection<string>>, "read">,
	bytes: Uint8Array,
): { rows: string[][]; lines: number[]; encoding: string; delimiter: string; format?: string } {
	const own = kind.read?.(bytes);
	return own ? { ...own, encoding: "UTF-8", delimiter: "" } : readCsv(bytes);
}

/** One CSV import: its columns and upload, how its rows are read, validated and committed. */
export interface ImportKind<
	F extends string,
	D extends Detection<F>,
	I,
	R extends ImportRun<F>,
	V extends object,
	S extends object,
> extends UploadSpec<F, D> {
	map: (
		rows: readonly string[][],
		mapping: readonly (F | null)[],
		header: boolean,
		lines: readonly number[],
	) => I[];
	validate: (ctx: ServerContext, inputs: I[], run: R, actor: AuthUser) => V;
	commit: (ctx: ServerContext, inputs: I[], run: R, actor: AuthUser, file: KeptFile) => S;
}

/** An upload refused: the i18n key of the message shown on the file field, and its parameters. */
export interface UploadRefusal {
	refused: { key: string; params?: Record<string, string | number> };
}

/** A stored upload, ready for the mapping step. */
export interface UploadOutcome<F extends string, D extends Detection<F>> {
	uploadId: string;
	filename: string;
	encoding: string;
	delimiter: string;
	/** Data rows (the header excluded). */
	rowCount: number;
	detection: D;
	mapping: (F | null)[];
	/** The mapping is the one remembered for this header. */
	remembered: boolean;
	/** The first rows of the file, for the column mapping. */
	sample: string[][];
	/** A file that is not a CSV: its format as shown (`MARC 21 · MARCXML`). */
	format?: string;
}

/** Why a validate or commit call did not run: the columns still missing, the file gone, errors left. */
export type ImportFailure =
	| { ok: false; error: "mappingIncomplete"; columns: string }
	| { ok: false; error: "uploadGone" | "notReady" };

const refusal = (key: string, params?: Record<string, string | number>): UploadRefusal => ({
	refused: { key, params },
});

/**
 * The upload step: refuses an empty, too large or empty-of-rows file (and what the public demo
 * does not take), stores it, detects its format and offers the mapping remembered for its header
 * when that still fits the file and names columns of the import.
 */
export async function receiveUpload<F extends string, D extends Detection<F>>(
	kind: UploadSpec<F, D>,
	dataDir: string,
	file: Blob,
): Promise<UploadRefusal | UploadOutcome<F, D>> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (bytes.length === 0) {
		return refusal("common.import.errors.empty");
	}
	if (bytes.length > kind.maxBytes) {
		return refusal("common.import.errors.tooLarge", { mb: kind.maxBytes / 1_000_000 });
	}
	const parsed = readTable(kind, bytes);
	if (parsed.rows.length === 0) {
		return refusal("common.import.errors.noRows");
	}
	let stored;
	try {
		stored = storeUpload(
			dataDir,
			(file as Partial<File>).name ?? kind.fallbackName,
			bytes,
			kind.name,
		);
	} catch (e) {
		// what the public demo refuses is said on the file field (9.17, Q121)
		if (e instanceof DemoBlockedError) {
			return refusal(`common.demoPublic.blocked.${e.feature}`);
		}
		throw e;
	}
	const detection = kind.detect(parsed.rows);
	const signature = headerSignature(parsed.rows, detection.header);
	const remembered = rememberedMapping<(F | null)[]>(dataDir, kind.name, signature);
	const fields: readonly string[] = kind.spec.columns.map((c) => c.field);
	const mapping =
		remembered?.length === detection.mapping.length &&
		remembered.every((f) => f === null || fields.includes(f))
			? remembered
			: detection.mapping;
	return {
		uploadId: stored.id,
		filename: stored.filename,
		encoding: parsed.encoding,
		delimiter: parsed.delimiter,
		rowCount: parsed.rows.length - (detection.header ? 1 : 0),
		detection,
		mapping,
		remembered: mapping === remembered,
		sample: parsed.rows.slice(0, 6),
		...(parsed.format ? { format: parsed.format } : {}),
	};
}

/** The stored file of a run, read and mapped (`UploadNotFoundError` when it is gone). */
function prepare<F extends string, I>(
	kind: Pick<ImportKind<F, Detection<F>, I, ImportRun<F>, object, object>, "map" | "read">,
	dataDir: string,
	run: ImportRun<F>,
): { upload: ReturnType<typeof readUpload>; signature: string; inputs: I[] } {
	const upload = readUpload(dataDir, run.uploadId);
	const parsed = readTable(kind, upload.bytes);
	return {
		upload,
		signature: headerSignature(parsed.rows, run.header),
		inputs: kind.map(parsed.rows, run.mapping, run.header, parsed.lines),
	};
}

const incomplete = <F extends string>(
	spec: ImportSpec<F>,
	mapping: readonly (F | null)[],
): ImportFailure | null => {
	const columns = missingHeaders(spec, mapping);
	return columns ? { ok: false, error: "mappingIncomplete", columns } : null;
};

/** The validate phase: repeatable, writes nothing but the mapping remembered for the header. */
export function validateImport<
	F extends string,
	D extends Detection<F>,
	I,
	R extends ImportRun<F>,
	V extends object,
	S extends object,
>(
	kind: ImportKind<F, D, I, R, V, S>,
	ctx: ServerContext,
	run: R,
	actor: AuthUser,
): ImportFailure | ({ ok: true } & V) {
	const missing = incomplete(kind.spec, run.mapping);
	if (missing) {
		return missing;
	}
	try {
		const { signature, inputs } = prepare(kind, ctx.dataDir, run);
		rememberMapping(ctx.dataDir, kind.name, signature, run.mapping);
		return { ok: true, ...kind.validate(ctx, inputs, run, actor) };
	} catch (e) {
		if (e instanceof UploadNotFoundError) {
			return { ok: false, error: "uploadGone" };
		}
		throw e;
	}
}

/** The commit phase: validates again and writes everything in one transaction. */
export function commitImport<
	F extends string,
	D extends Detection<F>,
	I,
	R extends ImportRun<F>,
	V extends object,
	S extends object,
>(
	kind: ImportKind<F, D, I, R, V, S>,
	ctx: ServerContext,
	run: R,
	actor: AuthUser,
): ImportFailure | ({ ok: true } & S) {
	const missing = incomplete(kind.spec, run.mapping);
	if (missing) {
		return missing;
	}
	try {
		const { upload, inputs } = prepare(kind, ctx.dataDir, run);
		const summary = kind.commit(ctx, inputs, run, actor, {
			filename: upload.filename,
			storeFile: (batchId) => finalizeUpload(ctx.dataDir, upload.id, batchId),
		});
		return { ok: true, ...summary };
	} catch (e) {
		if (e instanceof UploadNotFoundError) {
			return { ok: false, error: "uploadGone" };
		}
		if (e instanceof ImportNotReadyError) {
			return { ok: false, error: "notReady" };
		}
		throw e;
	}
}
