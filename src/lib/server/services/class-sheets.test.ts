// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { eq } from "drizzle-orm";
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "#lib/server/env.js";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { classId, PATRON_RULES } from "../../../../tests/helpers/school.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, classPhotoFrame, patron, staffUser } from "#lib/server/db/schema.js";
import { decodeRgb, type Corners } from "#lib/server/images/warp.js";
import { rectOf } from "#lib/shared/sheet-frames.js";
import { anonymizePatron, removePatronNow } from "./anonymize.js";
import { listFilesRecursive } from "#lib/server/runtime/fs.js";
import { backupNow } from "./backup.js";
import { writeArchiveBackup } from "./export-archive.js";
import {
	addFrame,
	assignFrame,
	deleteFrame,
	deleteSheet,
	frameFile,
	getSheet,
	ignoreFrame,
	listSheets,
	moveFrame,
	planSave,
	saveSheet,
	setFrames,
	sheetCandidates,
	sheetFile,
	frameCountOfPatron,
	SheetError,
	setSheetKind,
	uploadSheet,
	validCorners,
	type SheetSettings,
} from "./class-sheets.js";
import { paintErasedFrames } from "./class-sheet-erasure.js";
import { savePatronPhoto } from "./media.js";
import { createPatron } from "./patrons.js";
import { censusLists, isMember, setExists, setMembers } from "./patron-sets.js";
import { addEntries, createPrintList, deletePrintList } from "./print-lists.js";

const settings: SheetSettings = {
	width: 120,
	height: 160,
	format: "webp",
	quality: 80,
	maxUploadBytes: 8_000_000,
	sheet: {
		maxUploadBytes: 4_000_000,
		maxPixels: 1000,
		maxFrames: 40,
		minAspect: 1,
		maxAspect: 1.6,
	},
};
const picture = new Uint8Array(readFileSync("tests/fixtures/images/portraits-sheet.jpg"));
const truth = JSON.parse(
	readFileSync("tests/fixtures/images/portraits-sheet.frames.json", "utf8"),
) as {
	frames: Corners[];
};

const dirs: string[] = [];
const savedBackupDir = process.env.BACKUP_DIR;
afterEach(() => {
	if (savedBackupDir === undefined) {
		delete process.env.BACKUP_DIR;
	} else {
		process.env.BACKUP_DIR = savedBackupDir;
	}
	resetEnvCache();
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

function setup(): {
	db: Db;
	dataDir: string;
	actor: { id: number };
	group: number;
	add: (lastName: string, name?: string) => number;
} {
	const db = createTestDb();
	const dataDir = mkdtempSync(join(tmpdir(), "bv-sheets-"));
	dirs.push(dataDir);
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const add = (lastName: string, name = "C"): number =>
		createPatron(
			db,
			{
				patronType: "student",
				firstName: "Nome",
				lastName,
				levelCode: "2",
				groupId: String(classId(db, "2", name)),
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			PATRON_RULES,
		);
	return { db, dataDir, actor, group: classId(db, "2", "C"), add };
}

/** The first `n` frames of the portrait sheet, scaled to the stored picture (longest side 1000). */
function quads(n: number, scale: number): Corners[] {
	return truth.frames
		.slice(0, n)
		.map((q) => q.map((p) => ({ x: p.x * scale, y: p.y * scale })) as Corners);
}

describe("patron sets", () => {
	it("lists the active members of a class or a list, without a photo first", async () => {
		const { db, dataDir, actor, group, add } = setup();
		const a = add("Alfa");
		const b = add("Beta");
		const other = add("Gamma", "D");
		await savePatronPhoto(db, dataDir, a, picture, settings, actor);
		expect(setMembers(db, { group }).map((m) => [m.id, m.hasPhoto])).toEqual([
			[b, false],
			[a, true],
		]);
		const list = createPrintList(db, "patrons", "Nuovi", actor);
		addEntries(db, list, [b, other], actor);
		expect(setMembers(db, { list }).map((m) => m.id)).toEqual([b, other]);
		expect(isMember(db, { list }, a)).toBe(false);
		expect(isMember(db, { group }, a)).toBe(true);
		expect(setExists(db, { list })).toBe(true);
		expect(setExists(db, { list: 999 })).toBe(false);
		expect(setExists(db, { group: 999 })).toBe(false);
		expect(setExists(db, { group: null })).toBe(true);
		expect(censusLists(db)).toEqual([{ listId: list, name: "Nuovi", total: 2, withPhoto: 0 }]);
		// an anonymized member no longer counts
		anonymizePatron(db, dataDir, other, actor);
		expect(censusLists(db)[0]).toMatchObject({ total: 1 });
	});
});

describe("class pictures", () => {
	it("starts a picture as a photo unless asked for a scan (the demo's sample, 9.26)", async () => {
		const { db, dataDir, actor, group } = setup();
		const photo = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		expect(getSheet(db, photo.id).kind).toBe("photo");
		const scan = await uploadSheet(db, dataDir, { group }, picture, settings, actor, {
			kind: "scan",
		});
		expect(getSheet(db, scan.id).kind).toBe("scan");
	});

	it("stores the picture re-encoded and scaled, refuses what is not one", async () => {
		const { db, dataDir, actor, group } = setup();
		const sheet = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		expect(sheet.height).toBe(1000);
		expect(sheet.width).toBe(Math.round((896 * 1000) / 1200));
		const file = sheetFile(db, dataDir, sheet.id);
		expect(file).not.toBeNull();
		expect(
			await new Bun.Image(new Uint8Array(readFileSync(file ?? ""))).metadata(),
		).toMatchObject({
			width: sheet.width,
			height: 1000,
			format: "jpeg",
		});
		const failing = async (bytes: Uint8Array, set = { group }): Promise<string> =>
			uploadSheet(db, dataDir, set, bytes, settings, actor).then(
				() => "ok",
				(e: unknown) => (e as SheetError).code,
			);
		expect(await failing(new Uint8Array())).toBe("empty");
		expect(await failing(new Uint8Array(4_000_001))).toBe("too_large");
		expect(await failing(new TextEncoder().encode("not an image"))).toBe("not_an_image");
		expect(await failing(picture, { group: 999 })).toBe("set_not_found");
		expect(listSheets(db, { group })).toMatchObject([
			{ id: sheet.id, detected: false, frames: 0 },
		]);
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "class_sheet.upload")).all(),
		).toHaveLength(1);
	});

	it("crops the frames, numbers them, lets the operator add, move and remove frames", async () => {
		const { db, dataDir, actor, group } = setup();
		const sheet = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		const scale = 1000 / 1200;
		const frames = await setFrames(db, dataDir, sheet.id, quads(3, scale), settings);
		expect(frames.map((f) => f.position)).toEqual([1, 2, 3]);
		const crop = frameFile(db, dataDir, frames[0]?.id ?? 0);
		expect(
			await new Bun.Image(new Uint8Array(readFileSync(crop ?? ""))).metadata(),
		).toMatchObject({
			width: 120,
			height: 160,
			format: "webp",
		});
		await expect(
			setFrames(db, dataDir, sheet.id, quads(1, scale), settings),
		).rejects.toMatchObject({
			code: "already_detected",
		});
		const added = await addFrame(db, dataDir, sheet.id, quads(4, scale)[3]!, settings);
		expect(added.position).toBe(4);
		const moved = await moveFrame(
			db,
			dataDir,
			added.id,
			quads(5, scale)[4]!,
			settings,
			new Date(Date.now() + 5),
		);
		expect(moved.version).not.toBe(added.version);
		expect(frameFile(db, dataDir, added.id)).not.toBeNull();
		deleteFrame(db, dataDir, frames[1]?.id ?? 0);
		expect(getSheet(db, sheet.id).frames.map((f) => f.position)).toEqual([1, 3, 4]);
		// corners outside the picture or crossed are refused
		const crossed: Corners = [
			{ x: 10, y: 10 },
			{ x: 100, y: 100 },
			{ x: 100, y: 10 },
			{ x: 10, y: 100 },
		];
		await expect(addFrame(db, dataDir, sheet.id, crossed, settings)).rejects.toMatchObject({
			code: "bad_corners",
		});
		expect(validCorners([{ x: 0, y: 0 }], 10, 10)).toBe(false);
		expect(
			validCorners(
				[
					{ x: 0, y: 0 },
					{ x: 5000, y: 0 },
					{ x: 5000, y: 10 },
					{ x: 0, y: 10 },
				],
				100,
				100,
			),
		).toBe(false);
		// the frame limit
		const few = { ...settings, sheet: { ...settings.sheet, maxFrames: 3 } };
		await expect(
			addFrame(db, dataDir, sheet.id, quads(6, scale)[5]!, few),
		).rejects.toMatchObject({
			code: "too_many_frames",
		});
		const second = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		await expect(setFrames(db, dataDir, second.id, quads(4, scale), few)).rejects.toMatchObject(
			{
				code: "too_many_frames",
			},
		);
	});

	it("assigns one patron per frame and one frame per patron across the set's pictures", async () => {
		const { db, dataDir, actor, group, add } = setup();
		const a = add("Alfa");
		const b = add("Beta");
		const outsider = add("Zeta", "D");
		const scale = 1000 / 1200;
		const one = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		const [f1, f2] = await setFrames(db, dataDir, one.id, quads(2, scale), settings);
		const two = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		const [g1] = await setFrames(db, dataDir, two.id, quads(1, scale), settings);
		expect(assignFrame(db, f1?.id ?? 0, a)).toMatchObject({ patronId: a, state: "pending" });
		// the same patron again, in the other picture of the class: refused, the frame named
		expect(() => assignFrame(db, g1?.id ?? 0, a)).toThrow(
			expect.objectContaining({
				code: "patron_taken",
				detail: { sheetId: one.id, position: 1 },
			}) as Error,
		);
		// only the members of the class
		expect(() => assignFrame(db, f2?.id ?? 0, outsider)).toThrow(
			expect.objectContaining({ code: "not_a_member" }) as Error,
		);
		assignFrame(db, f2?.id ?? 0, b);
		// moving a patron: free the first frame, then choose them elsewhere
		assignFrame(db, f1?.id ?? 0, null);
		assignFrame(db, g1?.id ?? 0, a);
		expect(sheetCandidates(db, one.id)).toMatchObject({
			members: [{ id: a }, { id: b }],
			taken: expect.arrayContaining([
				{ patronId: b, sheetId: one.id, position: 2 },
				{ patronId: a, sheetId: two.id, position: 1 },
			]) as unknown,
		});
		// "Ignora" clears the choice; undone, the frame is pending again
		expect(ignoreFrame(db, f2?.id ?? 0, true)).toMatchObject({
			state: "ignored",
			patronId: null,
		});
		expect(ignoreFrame(db, f2?.id ?? 0, false)).toMatchObject({ state: "pending" });
		expect(listSheets(db, { group }).map((s) => s.id)).toEqual([two.id, one.id]);
	});

	it("saves the chosen photos in one go, asks before replacing, keeps the drafts until then", async () => {
		const { db, dataDir, actor, group, add } = setup();
		const a = add("Alfa");
		const b = add("Beta");
		await savePatronPhoto(db, dataDir, b, picture, settings, actor);
		const before = db.select().from(patron).where(eq(patron.id, b)).get()?.photoPath ?? "";
		const scale = 1000 / 1200;
		const sheet = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		const [f1, f2, f3] = await setFrames(db, dataDir, sheet.id, quads(3, scale), settings);
		await expect(saveSheet(db, dataDir, sheet.id, settings, actor)).rejects.toMatchObject({
			code: "nothing_to_save",
		});
		assignFrame(db, f1?.id ?? 0, a);
		assignFrame(db, f2?.id ?? 0, b);
		ignoreFrame(db, f3?.id ?? 0, true);
		expect(planSave(db, sheet.id)).toEqual({
			save: [
				{ frameId: f1?.id, position: 1, patronId: a, replaces: false },
				{ frameId: f2?.id, position: 2, patronId: b, replaces: true },
			],
			unassigned: 0,
			ignored: 1,
			saved: 0,
		});
		// a draft does not touch the patron
		expect(db.select().from(patron).where(eq(patron.id, a)).get()?.photoPath).toBeNull();
		await expect(saveSheet(db, dataDir, sheet.id, settings, actor)).rejects.toMatchObject({
			code: "confirm_replace",
			detail: { count: 1 },
		});
		expect(
			await saveSheet(db, dataDir, sheet.id, settings, actor, { confirmReplace: true }),
		).toEqual({
			saved: 2,
			replaced: 1,
		});
		const photoOf = (id: number): string =>
			db.select().from(patron).where(eq(patron.id, id)).get()?.photoPath ?? "";
		expect(photoOf(a)).not.toBe("");
		expect(existsSync(join(dataDir, photoOf(a)))).toBe(true);
		expect(existsSync(join(dataDir, photoOf(a).replace("-main-", "-thumb-")))).toBe(true);
		expect(photoOf(b)).not.toBe(before);
		expect(existsSync(join(dataDir, before))).toBe(false);
		expect(getSheet(db, sheet.id).frames.map((f) => f.state)).toEqual([
			"saved",
			"saved",
			"ignored",
		]);
		const audits = db
			.select()
			.from(auditLog)
			.where(eq(auditLog.action, "patron.photo_upload"))
			.all();
		expect(audits.at(-1)?.details).toEqual({ source: "class_sheet", sheet: sheet.id });
		// saved frames are history: no more changes
		expect(() => assignFrame(db, f1?.id ?? 0, null)).toThrow(
			expect.objectContaining({ code: "frame_saved" }) as Error,
		);
		expect(() => deleteFrame(db, dataDir, f1?.id ?? 0)).toThrow(
			expect.objectContaining({ code: "frame_saved" }) as Error,
		);
		// deleting the picture keeps the photos
		deleteSheet(db, dataDir, sheet.id, actor);
		expect(existsSync(join(dataDir, photoOf(a)))).toBe(true);
		expect(sheetFile(db, dataDir, sheet.id)).toBeNull();
		expect(() => getSheet(db, sheet.id)).toThrow(SheetError);
	});

	it("keeps the frames of a scan as turned rectangles, those of a photo as they are drawn", async () => {
		const { db, dataDir, actor, group, add } = setup();
		const a = add("Alfa");
		const scale = 1000 / 1200;
		const sheet = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		expect(getSheet(db, sheet.id).kind).toBe("photo");
		const [f1, f2, f3] = await setFrames(db, dataDir, sheet.id, quads(3, scale), settings);
		assignFrame(db, f1?.id ?? 0, a);
		await saveSheet(db, dataDir, sheet.id, settings, actor);
		// a frame pulled out of square, as the perspective of a photo would
		const skewed: Corners = [
			{ x: 100, y: 100 },
			{ x: 300, y: 110 },
			{ x: 290, y: 380 },
			{ x: 95, y: 370 },
		];
		const moved = await moveFrame(db, dataDir, f2?.id ?? 0, skewed, settings);
		expect(moved.corners).toEqual(skewed);
		const crop2 = frameFile(db, dataDir, f2?.id ?? 0) ?? "";
		const before1 = getSheet(db, sheet.id).frames[0]?.corners;

		const view = await setSheetKind(db, dataDir, sheet.id, "scan", settings);
		expect(view.kind).toBe("scan");
		const isRectangle = (q: Corners): boolean => {
			const top = { x: q[1].x - q[0].x, y: q[1].y - q[0].y };
			const left = { x: q[3].x - q[0].x, y: q[3].y - q[0].y };
			return Math.abs(top.x * left.x + top.y * left.y) < 1e-6;
		};
		// the saved frame is history; the open ones are squared and cut again
		expect(view.frames[0]?.corners).toEqual(before1);
		expect(isRectangle(view.frames[1]!.corners)).toBe(true);
		expect(rectOf(view.frames[1]!.corners).centre.x).toBeCloseTo(196.25, 6);
		expect(existsSync(crop2)).toBe(false);
		expect(existsSync(frameFile(db, dataDir, f2?.id ?? 0) ?? "")).toBe(true);
		// on a scan, moved and drawn frames are rectangles too
		const again = await moveFrame(db, dataDir, f3?.id ?? 0, skewed, settings);
		expect(isRectangle(again.corners)).toBe(true);
		const drawn = await addFrame(db, dataDir, sheet.id, skewed, settings);
		expect(isRectangle(drawn.corners)).toBe(true);

		// back on a photo: nothing moves, and a frame may follow the perspective again
		const onScan = getSheet(db, sheet.id).frames.map((f) => f.corners);
		const photo = await setSheetKind(db, dataDir, sheet.id, "photo", settings);
		expect(photo.kind).toBe("photo");
		expect(photo.frames.map((f) => f.corners)).toEqual(onScan);
		expect((await moveFrame(db, dataDir, f3?.id ?? 0, skewed, settings)).corners).toEqual(
			skewed,
		);
	});

	it("looks for the photos again only while no frame is given, ignored or saved", async () => {
		const { db, dataDir, actor, group, add } = setup();
		const a = add("Alfa");
		const scale = 1000 / 1200;
		const sheet = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		const first = await setFrames(db, dataDir, sheet.id, quads(3, scale), settings);
		const crop = frameFile(db, dataDir, first[0]?.id ?? 0) ?? "";
		await expect(
			setFrames(db, dataDir, sheet.id, quads(2, scale), settings),
		).rejects.toMatchObject({ code: "already_detected" });
		const again = await setFrames(
			db,
			dataDir,
			sheet.id,
			quads(2, scale),
			settings,
			new Date(),
			{
				replace: true,
			},
		);
		expect(again.map((f) => f.position)).toEqual([1, 2]);
		expect(getSheet(db, sheet.id).frames).toHaveLength(2);
		expect(existsSync(crop)).toBe(false);
		assignFrame(db, again[0]?.id ?? 0, a);
		await expect(
			setFrames(db, dataDir, sheet.id, quads(3, scale), settings, new Date(), {
				replace: true,
			}),
		).rejects.toMatchObject({ code: "already_detected" });
		expect(getSheet(db, sheet.id).frames[0]?.patronId).toBe(a);
	});

	it("rolls back and removes the new files when a frame changed meanwhile", async () => {
		const { db, dataDir, actor, group, add } = setup();
		const a = add("Alfa");
		const scale = 1000 / 1200;
		const sheet = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		const [f1] = await setFrames(db, dataDir, sheet.id, quads(1, scale), settings);
		assignFrame(db, f1?.id ?? 0, a);
		// the patron was removed between the summary and the save
		db.update(patron).set({ status: "anonymized" }).where(eq(patron.id, a)).run();
		await expect(saveSheet(db, dataDir, sheet.id, settings, actor)).rejects.toMatchObject({
			code: "not_a_member",
		});
		expect(db.select().from(patron).where(eq(patron.id, a)).get()?.photoPath).toBeNull();
		expect(db.select().from(classPhotoFrame).get()?.state).toBe("pending");
	});

	it("covers a removed patron's frames in the picture, which stays; a list's pictures go with it", async () => {
		const { db, dataDir, actor, group, add } = setup();
		const a = add("Alfa");
		const b = add("Beta");
		const scale = 1000 / 1200;
		const sheet = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		const [f1, f2] = await setFrames(db, dataDir, sheet.id, quads(2, scale), settings);
		assignFrame(db, f1?.id ?? 0, a);
		assignFrame(db, f2?.id ?? 0, b);
		await saveSheet(db, dataDir, sheet.id, settings, actor);
		expect(frameCountOfPatron(db, a)).toBe(1);
		const before = sheetFile(db, dataDir, sheet.id) ?? "";
		const crop = frameFile(db, dataDir, f1?.id ?? 0) ?? "";
		// inside the removal's transaction: the frame is erased and its photo file goes at once
		anonymizePatron(db, dataDir, a, actor);
		expect(existsSync(crop)).toBe(false);
		expect(getSheet(db, sheet.id).frames.map((f) => [f.state, f.patronId])).toEqual([
			["erased", null],
			["saved", b],
		]);
		const removal = db
			.select()
			.from(auditLog)
			.where(eq(auditLog.action, "patron.anonymize"))
			.get();
		expect(removal?.details).toMatchObject({ classSheetFrames: 1 });
		// then the face is painted over: a new picture file, grey where the frame was
		expect(await paintErasedFrames(db, dataDir)).toBe(1);
		expect(await paintErasedFrames(db, dataDir)).toBe(0);
		const after = sheetFile(db, dataDir, sheet.id) ?? "";
		expect(after).not.toBe(before);
		expect(existsSync(before)).toBe(false);
		const pixels = await decodeRgb(new Uint8Array(readFileSync(after)));
		const q = quads(1, scale)[0]!;
		const cx = Math.round(q.reduce((n, p) => n + p.x, 0) / 4);
		const cy = Math.round(q.reduce((n, p) => n + p.y, 0) / 4);
		const k = (cy * pixels.width + cx) * 3;
		const grey = [pixels.rgb[k] ?? 0, pixels.rgb[k + 1] ?? 0, pixels.rgb[k + 2] ?? 0];
		expect(grey.every((c, i) => Math.abs(c - [156, 163, 175][i]!) <= 6)).toBe(true);
		// the picture stays with the class, an erased frame changes no more
		expect(listSheets(db, { group }).map((s) => s.id)).toEqual([sheet.id]);
		expect(() => assignFrame(db, f1?.id ?? 0, b)).toThrow(
			expect.objectContaining({ code: "frame_erased" }) as Error,
		);
		expect(planSave(db, sheet.id)).toMatchObject({ ignored: 1, saved: 1 });
		// a list's pictures go with the list
		const list = createPrintList(db, "patrons", "Nuovi", actor);
		addEntries(db, list, [b], actor);
		const ofList = await uploadSheet(db, dataDir, { list }, picture, settings, actor);
		expect(listSheets(db, { list }).map((s) => s.id)).toEqual([ofList.id]);
		deletePrintList(db, list, actor, new Date(), dataDir);
		expect(sheetFile(db, dataDir, ofList.id)).toBeNull();
		expect(existsSync(join(dataDir, "uploads", "class-sheets", String(ofList.id)))).toBe(false);
	});
});

describe("a removed pupil's face never leaves the library (Q106)", () => {
	/** A saved picture with one frame given to a pupil who is then removed, faces not painted yet. */
	async function removedFace(): Promise<{
		db: Db;
		dataDir: string;
		configDir: string;
		backupDir: string;
		original: string;
	}> {
		const { db, dataDir, actor, group, add } = setup();
		const configDir = mkdtempSync(join(tmpdir(), "bv-sheets-config-"));
		dirs.push(configDir);
		const backupDir = mkdtempSync(join(tmpdir(), "bv-sheets-backups-"));
		dirs.push(backupDir);
		process.env.BACKUP_DIR = backupDir;
		resetEnvCache();
		const a = add("Alfa");
		const sheet = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		const [f1] = await setFrames(db, dataDir, sheet.id, quads(1, 1000 / 1200), settings);
		assignFrame(db, f1?.id ?? 0, a);
		await saveSheet(db, dataDir, sheet.id, settings, actor);
		const original = relative(dataDir, sheetFile(db, dataDir, sheet.id) ?? "")
			.split(/[\\/]/)
			.join("/");
		anonymizePatron(db, dataDir, a, actor);
		return { db, dataDir, configDir, backupDir, original };
	}

	it("removing a patron covers the face before it answers", async () => {
		const { db, dataDir, actor, group, add } = setup();
		const a = add("Alfa");
		const sheet = await uploadSheet(db, dataDir, { group }, picture, settings, actor);
		const [f1] = await setFrames(db, dataDir, sheet.id, quads(1, 1000 / 1200), settings);
		assignFrame(db, f1?.id ?? 0, a);
		await saveSheet(db, dataDir, sheet.id, settings, actor);
		const before = sheetFile(db, dataDir, sheet.id);
		expect(await removePatronNow(db, dataDir, a, actor)).toBe(true);
		expect(sheetFile(db, dataDir, sheet.id)).not.toBe(before);
		expect(await paintErasedFrames(db, dataDir)).toBe(0);
	});

	it("an archive backup of chosen parts holds the painted picture, not the original", async () => {
		const { db, dataDir, configDir, backupDir, original } = await removedFace();
		const backup = await writeArchiveBackup(db, dataDir, configDir, {
			timezone: "Europe/Rome",
			parts: ["data:photos"],
		});
		const names = Object.keys(
			unzipSync(new Uint8Array(readFileSync(join(backupDir, backup.name)))),
		);
		const pictures = names.filter((n) => n.startsWith("uploads/class-sheets/"));
		expect(pictures).toHaveLength(1);
		expect(pictures).not.toContain(original);
		expect(
			db
				.select({ paintedAt: classPhotoFrame.paintedAt })
				.from(classPhotoFrame)
				.all()
				.every((f) => f.paintedAt !== null),
		).toBe(true);
	});

	it("the database backup's uploads mirror holds the painted picture, and the run is audited", async () => {
		const { db, dataDir, backupDir, original } = await removedFace();
		const result = await backupNow(
			db,
			dataDir,
			{ timezone: "Europe/Rome", keepDays: 30 },
			null,
		);
		const mirrored = listFilesRecursive(join(backupDir, "uploads"))
			.map((rel) => rel.split(/[\\/]/).join("/"))
			.filter((rel) => rel.startsWith("class-sheets/"));
		expect(mirrored).toHaveLength(1);
		expect(`uploads/${mirrored[0] ?? ""}`).not.toBe(original);
		const entry = db.select().from(auditLog).where(eq(auditLog.action, "backup.create")).get();
		expect(entry).toMatchObject({ entityId: result.backup.name });
		expect(entry?.details).toMatchObject({ scheduled: true });
	});
});
