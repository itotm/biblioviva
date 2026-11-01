// SPDX-License-Identifier: GPL-3.0-or-later
// Class pictures for the photo census (PLAN.md Phase 13, step 13.2, Q103–Q109): a picture with many
// photos (the photographer's sheet, the class's cards on a table) belongs to a class or a patron
// list. The browser finds the frames (`#lib/vision/frames.ts`) and sends their corners; the server
// straightens each frame into a photo of the configured size (`#lib/server/images/warp.ts`) and
// keeps it next to the picture. The operator picks a patron for each frame — drafts, one patron
// per frame and one frame per patron among the pictures of the set — and "Salva le foto" stores
// them as the patrons' photos in one go, after a summary (§3.22). Pictures are kept until the class
// upgrade (Q106); removing a patron erases at once every frame where they were chosen
// (`class-sheet-erasure.ts`).
import { ServiceError } from "#lib/server/errors.js";
import { assertNotDemo, isDemoClassPicture, isDemoPublic } from "#lib/server/demo/public.js";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq, inArray, isNotNull, ne, sql, type SQL } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import type { FRAME_STATES } from "#lib/server/db/schema.js";
import { classPhotoFrame, classPhotoSheet, patron } from "#lib/server/db/schema.js";
import { IMAGE_EXTENSION, type ImageFormat } from "#lib/server/images/crop.js";
import {
	decodeRgb,
	encodeRgb,
	insetCorners,
	warpFrame,
	type Corners,
} from "#lib/server/images/warp.js";
import { squareQuad, type SheetKind } from "#lib/shared/sheet-frames.js";
import { audit, type AuditActor } from "./audit.js";
import {
	ACCEPTED_FORMATS,
	encodePhoto,
	removePhotoFiles,
	writePhotoFiles,
	type PhotoSettings,
} from "./media.js";
import { isListSet, isMember, setExists, setMembers, type PatronSet } from "./patron-sets.js";
import { writeAtomic } from "#lib/server/runtime/fs.js";
import { imageWork } from "#lib/server/runtime/limit.js";

/** `photos.sheet` (Q105). */
export interface SheetLimits {
	maxUploadBytes: number;
	maxPixels: number;
	maxFrames: number;
	minAspect: number;
	maxAspect: number;
}

export type SheetSettings = PhotoSettings & { sheet: SheetLimits };

export type SheetErrorCode =
	| "not_found"
	| "set_not_found"
	| "empty"
	| "too_large"
	| "not_an_image"
	| "unsupported_format"
	| "too_many_frames"
	| "bad_corners"
	| "already_detected"
	| "frame_saved"
	| "frame_erased"
	| "not_a_member"
	| "patron_taken"
	| "confirm_replace"
	| "nothing_to_save";

export class SheetError extends ServiceError {
	constructor(
		override readonly code: SheetErrorCode,
		/** The other frame holding the patron (`patron_taken`), or how many photos are replaced. */
		readonly detail: { sheetId?: number; position?: number; count?: number } = {},
	) {
		super(code, `class sheet: ${code}`);
		this.name = "SheetError";
	}
}

/** The share of the frame left out on every side of the photo: its border and rounded corners. */
export const FRAME_INSET = 0.03;

/** Where the class pictures are kept under DATA_DIR. */
export const SHEET_ROOT = join("uploads", "class-sheets");

/** The folder of a picture under DATA_DIR: the picture and its frames' photos. */
export const sheetFolder = (sheetId: number): string => join(SHEET_ROOT, String(sheetId));

export const removeSheetFolder = (dataDir: string, sheetId: number): void => {
	rmSync(join(dataDir, sheetFolder(sheetId)), { recursive: true, force: true });
};

function requireSheet(db: DbOrTx, sheetId: number): typeof classPhotoSheet.$inferSelect {
	const row = db.select().from(classPhotoSheet).where(eq(classPhotoSheet.id, sheetId)).get();
	if (!row) {
		throw new SheetError("not_found");
	}
	return row;
}

/** A saved frame is history, an erased one belongs to nobody (Q106): neither changes again. */
function requireOpen(frame: { state: string }): void {
	if (frame.state === "saved") {
		throw new SheetError("frame_saved");
	}
	if (frame.state === "erased") {
		throw new SheetError("frame_erased");
	}
}

function requireFrame(db: DbOrTx, frameId: number): typeof classPhotoFrame.$inferSelect {
	const row = db.select().from(classPhotoFrame).where(eq(classPhotoFrame.id, frameId)).get();
	if (!row) {
		throw new SheetError("not_found");
	}
	return row;
}

/** The class or list a picture belongs to. */
export function setOfSheet(sheet: {
	classGroupId: number | null;
	printListId: number | null;
}): PatronSet {
	return sheet.printListId !== null ? { list: sheet.printListId } : { group: sheet.classGroupId };
}

/** The condition selecting the pictures of a set. */
const sheetsOf = (set: PatronSet): SQL | undefined =>
	isListSet(set)
		? eq(classPhotoSheet.printListId, set.list)
		: set.group === null
			? sql`0`
			: eq(classPhotoSheet.classGroupId, set.group);

/**
 * Stores a class picture: checked like a photo (size, readable, a known format), scaled down to
 * `sheet.maxPixels` on its longest side and re-encoded as JPEG (no EXIF/GPS left). The browser
 * sends it upright already (it draws the camera's orientation into a canvas). `kind` is the kind
 * the picture starts as (a photo unless said otherwise: the demo's sample of a scan, 9.26).
 */
export async function uploadSheet(
	db: Db,
	dataDir: string,
	set: PatronSet,
	input: Uint8Array,
	settings: SheetSettings,
	actor: AuditActor | null,
	options: { kind?: SheetKind; now?: Date } = {},
): Promise<{ id: number; width: number; height: number }> {
	const now = options.now ?? new Date();
	// the public demo takes only the shipped demo picture of a class (9.17)
	if (isDemoPublic() && !isDemoClassPicture(input)) {
		assertNotDemo("pictures");
	}
	if (!isListSet(set) && set.group === null) {
		throw new SheetError("set_not_found");
	}
	if (!setExists(db, set)) {
		throw new SheetError("set_not_found");
	}
	if (input.byteLength === 0) {
		throw new SheetError("empty");
	}
	if (input.byteLength > settings.sheet.maxUploadBytes) {
		throw new SheetError("too_large");
	}
	let meta: { width: number; height: number; format: string };
	try {
		meta = await new Bun.Image(input, { maxPixels: 100_000_000 }).metadata();
	} catch {
		throw new SheetError("not_an_image");
	}
	if (!ACCEPTED_FORMATS.has(meta.format)) {
		throw new SheetError("unsupported_format");
	}
	const scale = Math.min(1, settings.sheet.maxPixels / Math.max(meta.width, meta.height));
	const width = Math.max(1, Math.round(meta.width * scale));
	const height = Math.max(1, Math.round(meta.height * scale));
	let bytes: Uint8Array;
	try {
		// the image work of the profile, `imageConcurrency` jobs at once (step 9.28)
		bytes = await imageWork.run(() =>
			new Bun.Image(input, { maxPixels: 100_000_000 })
				.resize(width, height, { fit: "fill" })
				.jpeg({ quality: 90 })
				.bytes(),
		);
	} catch {
		throw new SheetError("not_an_image");
	}
	const id = db.transaction((tx) => {
		const row = tx
			.insert(classPhotoSheet)
			.values({
				classGroupId: isListSet(set) ? null : set.group,
				printListId: isListSet(set) ? set.list : null,
				path: "",
				width,
				height,
				kind: options.kind ?? "photo",
				uploadedBy: actor?.id ?? null,
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
			})
			.returning({ id: classPhotoSheet.id })
			.get();
		const path = join(sheetFolder(row.id), `picture-${now.getTime()}.jpg`);
		tx.update(classPhotoSheet).set({ path }).where(eq(classPhotoSheet.id, row.id)).run();
		audit(
			tx,
			actor,
			"class_sheet.upload",
			"class_sheet",
			row.id,
			isListSet(set) ? { list: set.list } : { group: set.group },
			now,
		);
		writeAtomic(join(dataDir, path), bytes);
		return row.id;
	});
	return { id, width, height };
}

export interface SheetSummary {
	id: number;
	width: number;
	height: number;
	createdAt: string;
	detected: boolean;
	frames: number;
	saved: number;
	pending: number;
}

/** The pictures of a class or list, newest first, with their frames counted. */
export function listSheets(db: DbOrTx, set: PatronSet): SheetSummary[] {
	return db
		.select({
			id: classPhotoSheet.id,
			width: classPhotoSheet.width,
			height: classPhotoSheet.height,
			createdAt: classPhotoSheet.createdAt,
			detectedAt: classPhotoSheet.detectedAt,
			frames: sql<number>`count(${classPhotoFrame.id})`,
			saved: sql<number>`coalesce(sum(case when ${classPhotoFrame.state} = 'saved' then 1 else 0 end), 0)`,
			pending: sql<number>`coalesce(sum(case when ${classPhotoFrame.state} = 'pending' then 1 else 0 end), 0)`,
		})
		.from(classPhotoSheet)
		.leftJoin(classPhotoFrame, eq(classPhotoFrame.sheetId, classPhotoSheet.id))
		.where(sheetsOf(set))
		.groupBy(classPhotoSheet.id)
		.orderBy(sql`${classPhotoSheet.id} desc`)
		.all()
		.map(({ detectedAt, ...r }) => ({ ...r, detected: detectedAt !== null }));
}

export interface FrameView {
	id: number;
	position: number;
	corners: Corners;
	state: (typeof FRAME_STATES)[number];
	patronId: number | null;
	/** Changes with the crop: part of the crop's address so the browser fetches the new one. */
	version: string;
}

export interface SheetView {
	id: number;
	set: PatronSet;
	kind: SheetKind;
	width: number;
	height: number;
	detected: boolean;
	createdAt: string;
	frames: FrameView[];
}

const frameView = (f: typeof classPhotoFrame.$inferSelect): FrameView => ({
	id: f.id,
	position: f.position,
	corners: f.corners as Corners,
	state: f.state as (typeof FRAME_STATES)[number],
	patronId: f.patronId,
	version: f.cropPath.replace(/^.*-(\d+)\.\w+$/, "$1"),
});

/** A picture with its frames in reading order. */
export function getSheet(db: DbOrTx, sheetId: number): SheetView {
	const sheet = requireSheet(db, sheetId);
	const frames = db
		.select()
		.from(classPhotoFrame)
		.where(eq(classPhotoFrame.sheetId, sheetId))
		.orderBy(asc(classPhotoFrame.position))
		.all();
	return {
		id: sheet.id,
		set: setOfSheet(sheet),
		kind: sheet.kind as SheetKind,
		width: sheet.width,
		height: sheet.height,
		detected: sheet.detectedAt !== null,
		createdAt: sheet.createdAt,
		frames: frames.map(frameView),
	};
}

/** Corners inside the picture (a little margin allowed) and a convex quadrilateral. */
export function validCorners(
	corners: readonly { x: number; y: number }[],
	w: number,
	h: number,
): boolean {
	if (corners.length !== 4) {
		return false;
	}
	const margin = 0.02 * Math.max(w, h);
	if (
		corners.some(
			(p) =>
				!Number.isFinite(p.x) ||
				!Number.isFinite(p.y) ||
				p.x < -margin ||
				p.y < -margin ||
				p.x > w + margin ||
				p.y > h + margin,
		)
	) {
		return false;
	}
	let sign = 0;
	for (let i = 0; i < 4; i++) {
		const a = corners[i] ?? { x: 0, y: 0 };
		const b = corners[(i + 1) % 4] ?? a;
		const c = corners[(i + 2) % 4] ?? a;
		const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
		if (Math.abs(cross) < 1 || (sign !== 0 && Math.sign(cross) !== sign)) {
			return false;
		}
		sign = Math.sign(cross);
	}
	return true;
}

/** Straightens the frames of a picture into photo-sized crops (one decode of the picture). */
function cropFrames(
	dataDir: string,
	sheet: typeof classPhotoSheet.$inferSelect,
	quads: readonly Corners[],
	settings: SheetSettings,
): Promise<Uint8Array[]> {
	// the image work of the profile, `imageConcurrency` jobs at once (step 9.28)
	return imageWork.run(() => cropFramesNow(dataDir, sheet, quads, settings));
}

async function cropFramesNow(
	dataDir: string,
	sheet: typeof classPhotoSheet.$inferSelect,
	quads: readonly Corners[],
	settings: SheetSettings,
): Promise<Uint8Array[]> {
	for (const q of quads) {
		if (!validCorners(q, sheet.width, sheet.height)) {
			throw new SheetError("bad_corners");
		}
	}
	if (quads.length === 0) {
		return [];
	}
	const picture = await decodeRgb(new Uint8Array(readFileSync(join(dataDir, sheet.path))));
	const out: Uint8Array[] = [];
	for (const q of quads) {
		const rgb = warpFrame(
			picture,
			insetCorners(q, FRAME_INSET),
			settings.width,
			settings.height,
		);
		if (!rgb) {
			throw new SheetError("bad_corners");
		}
		out.push(await encodeRgb(rgb, settings.format ?? "webp", Math.max(settings.quality, 90)));
	}
	return out;
}

/** The corners a frame takes on its picture: as they are on a photo, a turned rectangle on a scan. */
const shapeOf = (sheet: { kind: string }, corners: Corners): Corners =>
	sheet.kind === "scan" ? squareQuad(corners) : corners;

const cropName = (sheetId: number, frameId: number, version: number, format: ImageFormat): string =>
	join(sheetFolder(sheetId), `frame-${frameId}-${version}.${IMAGE_EXTENSION[format]}`);

/**
 * The frames the browser found, in reading order. The first time only, or with `replace` (the
 * photos looked for again after the picture became a photo or a scan) while no frame has been
 * given to anyone, ignored or saved; afterwards frames are added, moved and removed one by one,
 * so the choices already made stay.
 */
export async function setFrames(
	db: Db,
	dataDir: string,
	sheetId: number,
	quads: readonly Corners[],
	settings: SheetSettings,
	now = new Date(),
	options: { replace?: boolean } = {},
): Promise<FrameView[]> {
	const sheet = requireSheet(db, sheetId);
	const previous = db
		.select()
		.from(classPhotoFrame)
		.where(eq(classPhotoFrame.sheetId, sheetId))
		.all();
	const untouched = previous.every((f) => f.state === "pending" && f.patronId === null);
	if (sheet.detectedAt !== null && !(options.replace && untouched)) {
		throw new SheetError("already_detected");
	}
	if (quads.length > settings.sheet.maxFrames) {
		throw new SheetError("too_many_frames");
	}
	const shaped = quads.map((q) => shapeOf(sheet, q));
	const crops = await cropFrames(dataDir, sheet, shaped, settings);
	const format = settings.format ?? "webp";
	const version = now.getTime();
	db.transaction((tx) => {
		requireSheet(tx, sheetId);
		tx.delete(classPhotoFrame).where(eq(classPhotoFrame.sheetId, sheetId)).run();
		shaped.forEach((corners, i) => {
			const row = tx
				.insert(classPhotoFrame)
				.values({ sheetId, position: i + 1, corners, cropPath: "" })
				.returning({ id: classPhotoFrame.id })
				.get();
			const cropPath = cropName(sheetId, row.id, version, format);
			writeAtomic(join(dataDir, cropPath), crops[i] ?? new Uint8Array());
			tx.update(classPhotoFrame)
				.set({ cropPath })
				.where(eq(classPhotoFrame.id, row.id))
				.run();
		});
		tx.update(classPhotoSheet)
			.set({ detectedAt: now.toISOString(), updatedAt: now.toISOString() })
			.where(eq(classPhotoSheet.id, sheetId))
			.run();
	});
	for (const f of previous) {
		rmSync(join(dataDir, f.cropPath), { force: true });
	}
	return getSheet(db, sheetId).frames;
}

/** A frame the operator drew: numbered after the others. */
export async function addFrame(
	db: Db,
	dataDir: string,
	sheetId: number,
	corners: Corners,
	settings: SheetSettings,
	now = new Date(),
): Promise<FrameView> {
	const sheet = requireSheet(db, sheetId);
	const count = db
		.select({ n: sql<number>`count(*)` })
		.from(classPhotoFrame)
		.where(eq(classPhotoFrame.sheetId, sheetId))
		.get();
	if ((count?.n ?? 0) >= settings.sheet.maxFrames) {
		throw new SheetError("too_many_frames");
	}
	const shaped = shapeOf(sheet, corners);
	const [crop] = await cropFrames(dataDir, sheet, [shaped], settings);
	const format = settings.format ?? "webp";
	const id = db.transaction((tx) => {
		const last = tx
			.select({ p: sql<number>`coalesce(max(${classPhotoFrame.position}), 0)` })
			.from(classPhotoFrame)
			.where(eq(classPhotoFrame.sheetId, sheetId))
			.get();
		const row = tx
			.insert(classPhotoFrame)
			.values({
				sheetId,
				position: (last?.p ?? 0) + 1,
				corners: shaped,
				cropPath: "",
			})
			.returning({ id: classPhotoFrame.id })
			.get();
		const cropPath = cropName(sheetId, row.id, now.getTime(), format);
		writeAtomic(join(dataDir, cropPath), crop ?? new Uint8Array());
		tx.update(classPhotoFrame).set({ cropPath }).where(eq(classPhotoFrame.id, row.id)).run();
		if (sheet.detectedAt === null) {
			tx.update(classPhotoSheet)
				.set({ detectedAt: now.toISOString() })
				.where(eq(classPhotoSheet.id, sheetId))
				.run();
		}
		return row.id;
	});
	return frameView(requireFrame(db, id));
}

/** New corners for a frame (dragged by the operator): the crop is made again, the choice stays. */
export async function moveFrame(
	db: Db,
	dataDir: string,
	frameId: number,
	corners: Corners,
	settings: SheetSettings,
	now = new Date(),
): Promise<FrameView> {
	const frame = requireFrame(db, frameId);
	requireOpen(frame);
	const sheet = requireSheet(db, frame.sheetId);
	const shaped = shapeOf(sheet, corners);
	const [crop] = await cropFrames(dataDir, sheet, [shaped], settings);
	const cropPath = cropName(sheet.id, frameId, now.getTime(), settings.format ?? "webp");
	writeAtomic(join(dataDir, cropPath), crop ?? new Uint8Array());
	db.update(classPhotoFrame)
		.set({ corners: shaped, cropPath, updatedAt: now.toISOString() })
		.where(eq(classPhotoFrame.id, frameId))
		.run();
	if (frame.cropPath !== cropPath) {
		rmSync(join(dataDir, frame.cropPath), { force: true });
	}
	return frameView(requireFrame(db, frameId));
}

/**
 * "Foto" or "Scansione": on a scan the frames still open (neither saved nor erased) become the
 * closest turned rectangles and are cut again; back on a photo they stay as they are, and their
 * corners may follow the perspective again.
 */
export async function setSheetKind(
	db: Db,
	dataDir: string,
	sheetId: number,
	kind: SheetKind,
	settings: SheetSettings,
	now = new Date(),
): Promise<SheetView> {
	const sheet = requireSheet(db, sheetId);
	if (sheet.kind === kind) {
		return getSheet(db, sheetId);
	}
	const open =
		kind === "scan"
			? db
					.select()
					.from(classPhotoFrame)
					.where(
						and(
							eq(classPhotoFrame.sheetId, sheetId),
							inArray(classPhotoFrame.state, ["pending", "ignored"]),
						),
					)
					.all()
			: [];
	const shaped = open.map((f) => squareQuad(f.corners as Corners));
	const crops = await cropFrames(dataDir, sheet, shaped, settings);
	const version = now.getTime();
	const format = settings.format ?? "webp";
	const replaced: string[] = [];
	db.transaction((tx) => {
		tx.update(classPhotoSheet)
			.set({ kind, updatedAt: now.toISOString() })
			.where(eq(classPhotoSheet.id, sheetId))
			.run();
		open.forEach((f, i) => {
			const cropPath = cropName(sheetId, f.id, version, format);
			writeAtomic(join(dataDir, cropPath), crops[i] ?? new Uint8Array());
			tx.update(classPhotoFrame)
				.set({ corners: shaped[i], cropPath, updatedAt: now.toISOString() })
				.where(eq(classPhotoFrame.id, f.id))
				.run();
			if (f.cropPath !== cropPath) {
				replaced.push(f.cropPath);
			}
		});
	});
	for (const path of replaced) {
		rmSync(join(dataDir, path), { force: true });
	}
	return getSheet(db, sheetId);
}

/** Removes a frame that is not a photo; the frames after it keep their numbers. */
export function deleteFrame(db: Db, dataDir: string, frameId: number): void {
	const frame = requireFrame(db, frameId);
	requireOpen(frame);
	db.delete(classPhotoFrame).where(eq(classPhotoFrame.id, frameId)).run();
	rmSync(join(dataDir, frame.cropPath), { force: true });
}

/** The frame of the set's pictures (other than `exceptFrame`) that holds the patron, if any. */
function holderOf(
	db: DbOrTx,
	set: PatronSet,
	patronId: number,
	exceptFrame: number,
): { sheetId: number; position: number } | null {
	return (
		db
			.select({ sheetId: classPhotoFrame.sheetId, position: classPhotoFrame.position })
			.from(classPhotoFrame)
			.innerJoin(classPhotoSheet, eq(classPhotoSheet.id, classPhotoFrame.sheetId))
			.where(
				and(
					sheetsOf(set),
					eq(classPhotoFrame.patronId, patronId),
					ne(classPhotoFrame.id, exceptFrame),
				),
			)
			.get() ?? null
	);
}

/**
 * The patron chosen for a frame (a draft: nothing touches the patron until the picture is saved),
 * or none. Only a member of the picture's class or list (Q108), and one frame per patron among
 * the pictures of that set: the frame already holding them is named in the error.
 */
export function assignFrame(
	db: Db,
	frameId: number,
	patronId: number | null,
	now = new Date(),
): FrameView {
	return db.transaction((tx) => {
		const frame = requireFrame(tx, frameId);
		requireOpen(frame);
		const set = setOfSheet(requireSheet(tx, frame.sheetId));
		if (patronId !== null) {
			if (!isMember(tx, set, patronId)) {
				throw new SheetError("not_a_member");
			}
			const holder = holderOf(tx, set, patronId, frameId);
			if (holder) {
				throw new SheetError("patron_taken", holder);
			}
		}
		tx.update(classPhotoFrame)
			.set({
				patronId,
				state: "pending",
				assignedAt: patronId === null ? null : now.toISOString(),
				updatedAt: now.toISOString(),
			})
			.where(eq(classPhotoFrame.id, frameId))
			.run();
		return frameView(requireFrame(tx, frameId));
	});
}

/** "Ignora": the frame is not a photo of anyone in the set (its choice is cleared); undone by false. */
export function ignoreFrame(
	db: Db,
	frameId: number,
	ignored: boolean,
	now = new Date(),
): FrameView {
	const frame = requireFrame(db, frameId);
	requireOpen(frame);
	db.update(classPhotoFrame)
		.set({
			state: ignored ? "ignored" : "pending",
			patronId: null,
			assignedAt: null,
			updatedAt: now.toISOString(),
		})
		.where(eq(classPhotoFrame.id, frameId))
		.run();
	return frameView(requireFrame(db, frameId));
}

export interface SavePlan {
	/** The frames with a patron, waiting to be saved. */
	save: { frameId: number; position: number; patronId: number; replaces: boolean }[];
	/** Frames without a patron (they stay as they are). */
	unassigned: number;
	ignored: number;
	saved: number;
}

/** What "Salva le foto" would do (§3.22): new photos, the ones replaced, the frames left. */
export function planSave(db: DbOrTx, sheetId: number): SavePlan {
	requireSheet(db, sheetId);
	const frames = db
		.select({
			id: classPhotoFrame.id,
			position: classPhotoFrame.position,
			state: classPhotoFrame.state,
			patronId: classPhotoFrame.patronId,
			photoPath: patron.photoPath,
		})
		.from(classPhotoFrame)
		.leftJoin(patron, eq(patron.id, classPhotoFrame.patronId))
		.where(eq(classPhotoFrame.sheetId, sheetId))
		.orderBy(asc(classPhotoFrame.position))
		.all();
	const plan: SavePlan = { save: [], unassigned: 0, ignored: 0, saved: 0 };
	for (const f of frames) {
		if (f.state === "saved") {
			plan.saved++;
		} else if (f.state === "ignored" || f.state === "erased") {
			plan.ignored++;
		} else if (f.patronId === null) {
			plan.unassigned++;
		} else {
			plan.save.push({
				frameId: f.id,
				position: f.position,
				patronId: f.patronId,
				replaces: f.photoPath !== null,
			});
		}
	}
	return plan;
}

/**
 * "Salva le foto": every frame with a patron becomes that patron's photo, all or none. The photos
 * (the crops, already at the photo size) and their thumbnails are written first under new names;
 * one transaction then points the patrons at them, marks the frames saved and writes the audit
 * (`patron.photo_upload`, source `class_sheet`, no names); the replaced files go after the commit.
 * Replacing photos needs `confirmReplace` (the summary listed them).
 */
export async function saveSheet(
	db: Db,
	dataDir: string,
	sheetId: number,
	settings: PhotoSettings,
	actor: AuditActor | null,
	options: { confirmReplace?: boolean } = {},
	now = new Date(),
): Promise<{ saved: number; replaced: number }> {
	const plan = planSave(db, sheetId);
	if (plan.save.length === 0) {
		throw new SheetError("nothing_to_save");
	}
	const replacing = plan.save.filter((s) => s.replaces).length;
	if (replacing > 0 && !options.confirmReplace) {
		throw new SheetError("confirm_replace", { count: replacing });
	}
	const crops = new Map(
		db
			.select({ id: classPhotoFrame.id, cropPath: classPhotoFrame.cropPath })
			.from(classPhotoFrame)
			.where(
				inArray(
					classPhotoFrame.id,
					plan.save.map((s) => s.frameId),
				),
			)
			.all()
			.map((r) => [r.id, r.cropPath]),
	);
	const version = now.getTime();
	const written: { patronId: number; mainPath: string }[] = [];
	try {
		for (const s of plan.save) {
			const cropPath = crops.get(s.frameId) ?? "";
			const main = new Uint8Array(readFileSync(join(dataDir, cropPath)));
			const thumb = await encodePhoto(main, settings, "thumb");
			const format: ImageFormat = cropPath.endsWith(".jpg") ? "jpeg" : "webp";
			written.push({
				patronId: s.patronId,
				mainPath: writePhotoFiles(dataDir, s.patronId, { main, thumb, format, version }),
			});
		}
		const previous = db.transaction((tx) => {
			const old: string[] = [];
			for (const s of plan.save) {
				const frame = requireFrame(tx, s.frameId);
				if (frame.state !== "pending" || frame.patronId !== s.patronId) {
					throw new SheetError("frame_saved");
				}
				const current = tx
					.select({ photoPath: patron.photoPath, status: patron.status })
					.from(patron)
					.where(eq(patron.id, s.patronId))
					.get();
				if (!current || current.status === "anonymized") {
					throw new SheetError("not_a_member");
				}
				const mainPath = written.find((w) => w.patronId === s.patronId)?.mainPath ?? "";
				tx.update(patron)
					.set({ photoPath: mainPath, updatedAt: now.toISOString() })
					.where(eq(patron.id, s.patronId))
					.run();
				if (current.photoPath && current.photoPath !== mainPath) {
					old.push(current.photoPath);
				}
				tx.update(classPhotoFrame)
					.set({
						state: "saved",
						savedAt: now.toISOString(),
						updatedAt: now.toISOString(),
					})
					.where(eq(classPhotoFrame.id, s.frameId))
					.run();
				audit(
					tx,
					actor,
					"patron.photo_upload",
					"patron",
					s.patronId,
					{ source: "class_sheet", sheet: sheetId },
					now,
				);
			}
			return old;
		});
		for (const path of previous) {
			removePhotoFiles(dataDir, path);
		}
	} catch (e) {
		for (const w of written) {
			removePhotoFiles(dataDir, w.mainPath);
		}
		throw e;
	}
	return { saved: plan.save.length, replaced: replacing };
}

/** "Elimina immagine": the picture and its frames go; the photos already saved stay on the patrons. */
export function deleteSheet(
	db: Db,
	dataDir: string,
	sheetId: number,
	actor: AuditActor | null,
): void {
	db.transaction((tx) => {
		requireSheet(tx, sheetId);
		tx.delete(classPhotoSheet).where(eq(classPhotoSheet.id, sheetId)).run();
		audit(tx, actor, "class_sheet.delete", "class_sheet", sheetId);
	});
	removeSheetFolder(dataDir, sheetId);
}

/** The frames where the patron was chosen (draft or saved): the removal dialog counts them. */
export function frameCountOfPatron(db: DbOrTx, patronId: number): number {
	return (
		db
			.select({ n: sql<number>`count(*)` })
			.from(classPhotoFrame)
			.where(eq(classPhotoFrame.patronId, patronId))
			.get()?.n ?? 0
	);
}
/** The absolute path of a picture, or of a frame's photo, when it exists. */
export function sheetFile(db: DbOrTx, dataDir: string, sheetId: number): string | null {
	const row = db
		.select({ path: classPhotoSheet.path })
		.from(classPhotoSheet)
		.where(eq(classPhotoSheet.id, sheetId))
		.get();
	const abs = row?.path ? join(dataDir, row.path) : null;
	return abs && existsSync(abs) ? abs : null;
}

export function frameFile(db: DbOrTx, dataDir: string, frameId: number): string | null {
	const row = db
		.select({ path: classPhotoFrame.cropPath })
		.from(classPhotoFrame)
		.where(eq(classPhotoFrame.id, frameId))
		.get();
	const abs = row?.path ? join(dataDir, row.path) : null;
	return abs && existsSync(abs) ? abs : null;
}

/** The members of a picture's set, for its drop-downs, and who holds which frame of the set. */
export function sheetCandidates(
	db: DbOrTx,
	sheetId: number,
): {
	members: ReturnType<typeof setMembers>;
	taken: { patronId: number; sheetId: number; position: number }[];
} {
	const set = setOfSheet(requireSheet(db, sheetId));
	const taken = db
		.select({
			patronId: classPhotoFrame.patronId,
			sheetId: classPhotoFrame.sheetId,
			position: classPhotoFrame.position,
		})
		.from(classPhotoFrame)
		.innerJoin(classPhotoSheet, eq(classPhotoSheet.id, classPhotoFrame.sheetId))
		.where(and(sheetsOf(set), isNotNull(classPhotoFrame.patronId)))
		.all()
		.map((r) => ({ patronId: r.patronId ?? 0, sheetId: r.sheetId, position: r.position }));
	return { members: setMembers(db, set), taken };
}
