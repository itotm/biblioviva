// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard.js";

describe("copyText", () => {
	it("uses the Clipboard API when the page has it", async () => {
		const writeText = vi.fn(() => Promise.resolve());
		expect(await copyText("abc", { writeText })).toBe(true);
		expect(writeText).toHaveBeenCalledWith("abc");
	});

	it("falls back to the copy command on plain http, and leaves nothing in the page", async () => {
		const exec = vi.spyOn(document, "execCommand").mockReturnValue(true);
		expect(await copyText("abc", undefined)).toBe(true);
		expect(exec).toHaveBeenCalledWith("copy");
		const refused = { writeText: vi.fn(() => Promise.reject(new Error("denied"))) };
		exec.mockReturnValue(false);
		expect(await copyText("abc", refused)).toBe(false);
		exec.mockImplementation(() => {
			throw new Error("unsupported");
		});
		expect(await copyText("abc", undefined)).toBe(false);
		expect(document.querySelector("textarea")).toBeNull();
		exec.mockRestore();
	});
});
