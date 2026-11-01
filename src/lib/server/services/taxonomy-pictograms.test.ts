// SPDX-License-Identifier: GPL-3.0-or-later
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { solidImage } from "../../../../tests/helpers/images.js";
import { MediaError } from "./media.js";
import { listPictogramFiles, stagedPictogramPath, stagePictogram } from "./taxonomy-pictograms.js";

let configDir = "";
let dataDir = "";
beforeEach(() => {
	configDir = mkdtempSync(join(tmpdir(), "bv-pictograms-config-"));
	dataDir = mkdtempSync(join(tmpdir(), "bv-pictograms-data-"));
});
afterEach(() => {
	rmSync(configDir, { recursive: true, force: true });
	rmSync(dataDir, { recursive: true, force: true });
});

describe("pictograms", () => {
	it("stages uploads as PNG, refuses other files and forgets old ones", async () => {
		const token = await stagePictogram(dataDir, await solidImage(800, 400, "jpeg"));
		expect(token).toMatch(/^[a-f0-9]{32}$/);
		const path = stagedPictogramPath(dataDir, token) ?? "";
		expect(await new Bun.Image(readFileSync(path)).metadata()).toMatchObject({
			format: "png",
			width: 512,
			height: 256,
		});
		expect(stagedPictogramPath(dataDir, "../etc/passwd")).toBeNull();
		expect(stagedPictogramPath(dataDir, "b".repeat(32))).toBeNull();
		await expect(stagePictogram(dataDir, new TextEncoder().encode("<svg/>"))).rejects.toThrow(
			MediaError,
		);
		const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
		utimesSync(path, old, old);
		await stagePictogram(dataDir, await solidImage(10, 10, "png"));
		expect(existsSync(path)).toBe(false);
	});

	it("lists the images of the folder in natural order, none without the folder", () => {
		expect(listPictogramFiles(configDir)).toEqual([]);
		const images = join(configDir, "classification", "images");
		mkdirSync(images, { recursive: true });
		for (const name of ["10.png", "2.svg", "B.webp", "notes.txt"]) {
			writeFileSync(join(images, name), "x");
		}
		expect(listPictogramFiles(configDir)).toEqual(["2.svg", "10.png", "B.webp"]);
	});
});
