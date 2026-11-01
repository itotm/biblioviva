// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkUpload, encodeUpload, MediaError } from "./store.js";

const jpeg = new Uint8Array(readFileSync("tests/fixtures/images/landscape.jpg"));

describe("stored images", () => {
	it("checks an upload against the accepted formats", async () => {
		expect(await checkUpload(jpeg, 8_000_000)).toMatchObject({ format: "jpeg" });
		await expect(checkUpload(jpeg, 8_000_000, new Set(["png"]))).rejects.toMatchObject({
			code: "unsupported_format",
		});
	});

	it("reports an encoder that fails as not an image", async () => {
		const failing = encodeUpload(jpeg, 8_000_000, () => Promise.reject(new Error("broken")));
		await expect(failing).rejects.toBeInstanceOf(MediaError);
		await expect(failing).rejects.toMatchObject({ code: "not_an_image" });
	});
});
