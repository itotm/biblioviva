// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, patron, staffUser } from "#lib/server/db/schema.js";
import { createPatron } from "./patrons.js";
import {
	importPatronPhotos,
	photoImportDir,
	readPhotoFolder,
	readPhotoZip,
	type PhotoFile,
} from "./photo-import.js";
import { PATRON_RULES, classId } from "../../../../tests/helpers/school.js";

const settings = { width: 480, height: 640, quality: 80, maxUploadBytes: 8_000_000 };
const portrait = new Uint8Array(readFileSync("tests/fixtures/images/portrait-exif.jpg"));
const landscape = new Uint8Array(readFileSync("tests/fixtures/images/landscape.jpg"));
const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-photos-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

function setup(): { db: Db; actor: { id: number }; cards: string[]; ids: number[] } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	// a new-format card and a legacy plain counter from Koha
	const ids = [
		["Rossi", ""],
		["Bianchi", "12345"],
	].map(([lastName, cardNumber]) =>
		createPatron(
			db,
			{
				patronType: "student",
				firstName: "Anna",
				lastName: lastName ?? "",
				levelCode: "2",
				groupId: String(classId(db, "2", "A")),
				groupName: "",
				cardNumber: cardNumber ?? "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			PATRON_RULES,
		),
	);
	const cards = ids.map(
		(id) =>
			db.select({ c: patron.cardNumber }).from(patron).where(eq(patron.id, id)).get()?.c ??
			"",
	);
	return { db, actor, cards, ids };
}

const photoOf = (db: Db, id: number): string | null =>
	db.select({ p: patron.photoPath }).from(patron).where(eq(patron.id, id)).get()?.p ?? null;

describe("patron photos from Koha", () => {
	it("imports the matching files, lists the unmatched and unreadable ones", async () => {
		const { db, actor, cards, ids } = setup();
		const dataDir = temp();
		const files: PhotoFile[] = [
			{ name: `${cards[0]}.jpg`, bytes: portrait },
			{ name: "12345.JPG", bytes: landscape },
			{ name: "99999.jpg", bytes: portrait },
			{ name: "leggimi.txt", bytes: new TextEncoder().encode("ciao") },
			{ name: "rotta.jpg", bytes: new TextEncoder().encode("non sono un jpeg") },
		];
		const summary = await importPatronPhotos(db, dataDir, files, settings, actor);
		expect(summary).toEqual({
			imported: 2,
			replaced: 0,
			kept: 0,
			unmatched: ["99999.jpg", "rotta.jpg"],
			unreadable: ["leggimi.txt"],
		});
		expect(photoOf(db, ids[0] ?? 0)).toMatch(/\.webp$/);
		expect(photoOf(db, ids[1] ?? 0)).toMatch(/\.webp$/);
		// the landscape photo from Koha is cropped at the centre to the configured 480 × 640 (3.11)
		const stored = new Uint8Array(readFileSync(join(dataDir, photoOf(db, ids[1] ?? 0) ?? "")));
		expect(await new Bun.Image(stored).metadata()).toMatchObject({
			width: 480,
			height: 640,
			format: "webp",
		});
		const rows = db.select().from(auditLog).where(eq(auditLog.action, "import.photos")).all();
		expect(rows[0]?.details).toEqual({
			imported: 2,
			replaced: 0,
			kept: 0,
			unmatched: 2,
			unreadable: 1,
		});
	});

	it("keeps existing photos unless asked to replace, and reports an unreadable match", async () => {
		const { db, actor, cards, ids } = setup();
		const dataDir = temp();
		await importPatronPhotos(
			db,
			dataDir,
			[{ name: `${cards[0]}.jpg`, bytes: portrait }],
			settings,
			actor,
		);
		const first = photoOf(db, ids[0] ?? 0);
		const kept = await importPatronPhotos(
			db,
			dataDir,
			[
				{ name: `${cards[0]}.jpg`, bytes: landscape },
				{ name: "12345.png", bytes: new TextEncoder().encode("rotta") },
			],
			settings,
			actor,
		);
		expect(kept).toMatchObject({ imported: 0, kept: 1, unreadable: ["12345.png"] });
		expect(photoOf(db, ids[0] ?? 0)).toBe(first);
		expect(photoOf(db, ids[1] ?? 0)).toBeNull();
		const replaced = await importPatronPhotos(
			db,
			dataDir,
			[
				{ name: `${cards[0]}.jpg`, bytes: landscape },
				{ name: `${cards[0]}.png`, bytes: landscape },
			],
			settings,
			actor,
			{ replace: true },
		);
		// the second file of the same patron is not a second photo
		expect(replaced).toMatchObject({ replaced: 1, unmatched: [`${cards[0]}.png`] });
		expect(photoOf(db, ids[0] ?? 0)).not.toBe(first);
	});

	it("reads the drop folder and ZIP archives", () => {
		const dataDir = temp();
		expect(readPhotoFolder(photoImportDir(dataDir))).toEqual([]);
		mkdirSync(photoImportDir(dataDir), { recursive: true });
		writeFileSync(join(photoImportDir(dataDir), "b.jpg"), portrait);
		writeFileSync(join(photoImportDir(dataDir), "a.jpg"), portrait);
		writeFileSync(join(photoImportDir(dataDir), ".DS_Store"), "x");
		mkdirSync(join(photoImportDir(dataDir), "sub"));
		expect(readPhotoFolder(photoImportDir(dataDir)).map((f) => f.name)).toEqual([
			"a.jpg",
			"b.jpg",
		]);
		const zip = zipSync({
			"foto/0000001240.jpg": portrait,
			"foto/": new Uint8Array(),
			"__MACOSX/._x.jpg": new Uint8Array([1]),
			".hidden.jpg": new Uint8Array([1]),
			"12345.jpg": landscape,
		});
		expect(readPhotoZip(zip).map((f) => f.name)).toEqual(["0000001240.jpg", "12345.jpg"]);
		expect(() => readPhotoZip(new TextEncoder().encode("not a zip"))).toThrow();
	});
});
