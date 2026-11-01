// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import { submitFile } from "./submit-file.js";

describe("submitFile", () => {
	it("puts the file into the input before submitting the form", async () => {
		const input = document.createElement("input");
		input.type = "file";
		const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
		const submit = vi.fn(() => Promise.resolve(input.files?.[0] === file));
		expect(await submitFile({ submit }, input, file)).toBe(true);
		expect(submit).toHaveBeenCalledOnce();
	});

	it("does nothing without an input, and reports a refusal", async () => {
		const submit = vi.fn(() => Promise.resolve(false));
		const file = new File(["x"], "a.zip");
		expect(await submitFile({ submit }, undefined, file)).toBe(false);
		expect(submit).not.toHaveBeenCalled();
		const input = document.createElement("input");
		input.type = "file";
		expect(await submitFile({ submit }, input, file)).toBe(false);
	});
});
