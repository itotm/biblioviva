// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { auditLog, staffUser } from "#lib/server/db/schema.js";
import { createPatron, getPatron, PatronNotFoundError } from "./patrons.js";
import {
	deletePatronPhoto,
	encodePhoto,
	MediaError,
	patronPhotoFile,
	savePatronPhoto,
} from "./media.js";
import { PATRON_RULES } from "../../../../tests/helpers/school.js";

const settings = { width: 480, height: 640, quality: 80, maxUploadBytes: 8_000_000 };
const portrait = new Uint8Array(readFileSync("tests/fixtures/images/portrait-exif.jpg"));
const landscape = new Uint8Array(readFileSync("tests/fixtures/images/landscape.jpg"));
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const hasExif = (bytes: Uint8Array): boolean => Buffer.from(bytes).includes(Buffer.from("Exif"));

describe("encodePhoto", () => {
	it("re-encodes to the configured format and size and drops EXIF/GPS", async () => {
		expect(hasExif(portrait)).toBe(true);
		const out = await encodePhoto(portrait, settings);
		// WebP by default (step 3.11)
		expect(Buffer.from(out.subarray(8, 12)).toString()).toBe("WEBP");
		expect(hasExif(out)).toBe(false);
		expect(Buffer.from(out).includes(Buffer.from("Synthetic"))).toBe(false);
		expect(await new Bun.Image(out).metadata()).toMatchObject({
			width: 480,
			height: 640,
			format: "webp",
		});
		const thumb = await encodePhoto(portrait, settings, "thumb");
		expect(await new Bun.Image(thumb).metadata()).toMatchObject({ width: 120, height: 160 });
		// JPEG stays available (photos for another program)
		const jpeg = await encodePhoto(portrait, { ...settings, format: "jpeg" });
		expect([jpeg[0], jpeg[1]]).toEqual([0xff, 0xd8]);
	});

	it("crops other aspect ratios at the centre to exactly the configured size", async () => {
		const meta = await new Bun.Image(await encodePhoto(landscape, settings)).metadata();
		expect(meta).toMatchObject({ width: 480, height: 640, format: "webp" });
		const square = await encodePhoto(landscape, { ...settings, width: 300, height: 300 });
		expect(await new Bun.Image(square).metadata()).toMatchObject({ width: 300, height: 300 });
	});

	it("rejects empty, oversize and non-image uploads with a readable code", async () => {
		await expect(encodePhoto(new Uint8Array(), settings)).rejects.toMatchObject({
			code: "empty",
		});
		await expect(
			encodePhoto(portrait, { ...settings, maxUploadBytes: 1000 }),
		).rejects.toMatchObject({ code: "too_large" });
		await expect(
			encodePhoto(
				new Uint8Array(readFileSync("tests/fixtures/images/not-an-image.jpg")),
				settings,
			),
		).rejects.toBeInstanceOf(MediaError);
		await expect(
			encodePhoto(
				new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
				settings,
			),
		).rejects.toBeInstanceOf(MediaError);
	});
});

describe("patron photo storage", () => {
	it("stores main + thumbnail atomically, replaces and deletes them, audits without paths", async () => {
		const dataDir = mkdtempSync(join(tmpdir(), "bv-media-"));
		dirs.push(dataDir);
		const db = createTestDb();
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const id = createPatron(
			db,
			{
				patronType: "teacher",
				firstName: "A",
				lastName: "B",
				levelCode: "",
				groupId: "",
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
		expect(patronPhotoFile(db, dataDir, id, "main")).toBeNull();

		const first = await savePatronPhoto(db, dataDir, id, portrait, settings, actor);
		const folder = join("uploads", "patrons", String(id % 100).padStart(2, "0"));
		expect(first.path).toMatch(new RegExp(`^${folder}/${id}-main-\\d+\\.webp$`));
		expect(existsSync(join(dataDir, first.path))).toBe(true);
		expect(existsSync(`${join(dataDir, first.path)}.tmp`)).toBe(false);
		expect(getPatron(db, id, "2026-09-19").hasPhoto).toBe(true);
		const main = patronPhotoFile(db, dataDir, id, "main")!;
		const thumb = patronPhotoFile(db, dataDir, id, "thumb")!;
		expect(main.endsWith(`-main-${first.path.split("-main-")[1]}`)).toBe(true);
		expect(thumb).toContain("-thumb-");

		await new Promise((r) => setTimeout(r, 2));
		const second = await savePatronPhoto(db, dataDir, id, landscape, settings, actor);
		expect(second.path).not.toBe(first.path);
		expect(existsSync(join(dataDir, first.path))).toBe(false);
		expect(existsSync(thumb)).toBe(false);

		expect(deletePatronPhoto(db, dataDir, id, actor)).toBe(true);
		expect(getPatron(db, id, "2026-09-19").hasPhoto).toBe(false);
		expect(existsSync(join(dataDir, second.path))).toBe(false);
		expect(deletePatronPhoto(db, dataDir, id, actor)).toBe(false);
		await expect(savePatronPhoto(db, dataDir, 999, portrait, settings, actor)).rejects.toThrow(
			PatronNotFoundError,
		);
		expect(() => deletePatronPhoto(db, dataDir, 999, actor)).toThrow(PatronNotFoundError);

		const rows = db.select().from(auditLog).all();
		expect(rows.map((r) => r.action)).toEqual([
			"patron.create",
			"patron.photo_upload",
			"patron.photo_upload",
			"patron.photo_delete",
		]);
		expect(JSON.stringify(rows)).not.toContain("uploads/");
	});
});
