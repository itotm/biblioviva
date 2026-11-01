// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { auditLog, biblio, staffUser } from "#lib/server/db/schema.js";
import { BiblioNotFoundError, catalogRules, createBiblio } from "./catalog.js";
import { coverFile, deleteCover, encodeCover, saveCover } from "./covers.js";
import { MediaError } from "./media.js";
import type { Db } from "#lib/server/db/client.js";

const settings = { width: 600, quality: 80, maxUploadBytes: 12_000_000 };
const portrait = new Uint8Array(readFileSync("tests/fixtures/images/portrait-exif.jpg"));
const landscape = new Uint8Array(readFileSync("tests/fixtures/images/landscape.jpg"));
const rules = catalogRules(parseConfig(exampleRaw()).config);
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

function setup(): { db: Db; actor: { id: number }; id: number; dataDir: string } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const id = createBiblio(
		db,
		{
			title: "Copertina",
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "Rossi, Mario",
			publisher: "s.n.",
			publicationPlace: "",
			publicationYear: "",
			isbn: "",
			issn: "",
			ean: "",
			physicalDescription: "",
			series: "",
			seriesNumber: "",
			dewey: "",
			kind: "fiction",
			genreCode: "A",
			classCode: "",
			readingLevel: "",
			subjects: "",
			notes: "",
		},
		actor,
		rules,
	);
	const dataDir = mkdtempSync(join(tmpdir(), "bv-covers-"));
	dirs.push(dataDir);
	return { db, actor, id, dataDir };
}

describe("encodeCover", () => {
	it("scales to the configured width keeping the aspect ratio, main and thumbnail", async () => {
		const main = await encodeCover(portrait, settings);
		expect(await new Bun.Image(main).metadata()).toMatchObject({ width: 600, format: "webp" });
		const thumb = await encodeCover(landscape, settings, "thumb");
		const meta = await new Bun.Image(thumb).metadata();
		expect(meta.width).toBe(150);
		expect(meta.height).toBeLessThan(150);
		expect(Buffer.from(main).includes(Buffer.from("Exif"))).toBe(false);
		const webp = await encodeCover(portrait, { ...settings, format: "webp" });
		expect(await new Bun.Image(webp).metadata()).toMatchObject({ width: 600, format: "webp" });
	});

	it("caps the height without cropping (step 3.11)", async () => {
		const portraitMeta = await new Bun.Image(portrait).metadata();
		const capped = await encodeCover(portrait, { ...settings, maxHeight: 400 });
		const meta = await new Bun.Image(capped).metadata();
		expect(meta.height).toBe(400);
		// the proportions of the original are kept
		expect(
			Math.abs(meta.width / meta.height - portraitMeta.width / portraitMeta.height),
		).toBeLessThan(0.02);
		const wide = await encodeCover(landscape, { ...settings, maxHeight: 4000 });
		expect((await new Bun.Image(wide).metadata()).width).toBe(600);
	});

	it("refuses empty, oversized and non-image input", async () => {
		await expect(encodeCover(new Uint8Array(), settings)).rejects.toMatchObject({
			code: "empty",
		});
		await expect(
			encodeCover(portrait, { ...settings, maxUploadBytes: 10 }),
		).rejects.toMatchObject({
			code: "too_large",
		});
		await expect(
			encodeCover(new TextEncoder().encode("<html>not an image</html>"), settings),
		).rejects.toBeInstanceOf(MediaError);
	});
});

describe("saveCover / deleteCover", () => {
	it("stores main and thumbnail, records the source, replaces and removes", async () => {
		const { db, actor, id, dataDir } = setup();
		const first = await saveCover(db, dataDir, id, portrait, settings, actor);
		// two directory levels (the last two digits of the id) keep folders small
		const folder = join("uploads", "covers", String(id % 100).padStart(2, "0"));
		expect(first.path).toMatch(new RegExp(`^${folder}/${id}-main-\\d+\\.webp$`));
		expect(existsSync(join(dataDir, first.path))).toBe(true);
		expect(coverFile(db, dataDir, id, "thumb")).toBe(
			join(dataDir, first.path.replace("-main-", "-thumb-")),
		);
		expect(db.select().from(biblio).where(eq(biblio.id, id)).get()).toMatchObject({
			coverPath: first.path,
			coverSource: "photo",
		});
		await Bun.sleep(2);
		const jpeg = { ...settings, format: "jpeg" as const };
		const second = await saveCover(db, dataDir, id, landscape, jpeg, actor, "upload");
		expect(second.path).toMatch(new RegExp(`^${folder}/${id}-main-\\d+\\.jpg$`));
		expect(existsSync(join(dataDir, first.path))).toBe(false);
		expect(db.select().from(biblio).where(eq(biblio.id, id)).get()?.coverSource).toBe("upload");
		expect(deleteCover(db, dataDir, id, actor)).toBe(true);
		expect(deleteCover(db, dataDir, id, actor)).toBe(false);
		expect(coverFile(db, dataDir, id, "main")).toBeNull();
		expect(existsSync(join(dataDir, second.path))).toBe(false);
		expect(
			db
				.select()
				.from(auditLog)
				.all()
				.map((a) => a.action),
		).toEqual([
			"biblio.create",
			"biblio.cover_upload",
			"biblio.cover_upload",
			"biblio.cover_delete",
		]);
		await expect(saveCover(db, dataDir, 999, portrait, settings, actor)).rejects.toBeInstanceOf(
			BiblioNotFoundError,
		);
		expect(() => deleteCover(db, dataDir, 999, actor)).toThrow(BiblioNotFoundError);
	});
});
