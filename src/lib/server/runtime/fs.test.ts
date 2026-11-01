// SPDX-License-Identifier: GPL-3.0-or-later
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { freeFileName, listFilesRecursive, writeAtomic } from "./fs.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

describe("writeAtomic", () => {
	it("creates the folder, replaces the file whole and leaves no temporary file", () => {
		const dir = mkdtempSync(join(tmpdir(), "bv-fs-"));
		dirs.push(dir);
		const target = join(dir, "a", "b", "file.txt");
		writeAtomic(target, "first");
		writeAtomic(target, new TextEncoder().encode("second"));
		expect(readFileSync(target, "utf8")).toBe("second");
		expect(readdirSync(join(dir, "a", "b"))).toEqual(["file.txt"]);
		expect(existsSync(`${target}.tmp`)).toBe(false);
	});
});

describe("listFilesRecursive", () => {
	it("lists regular files with forward slashes, sorted, without links, temporary files or skipped folders", () => {
		const dir = mkdtempSync(join(tmpdir(), "bv-fs-"));
		dirs.push(dir);
		mkdirSync(join(dir, "b", "c"), { recursive: true });
		mkdirSync(join(dir, "history", "x"), { recursive: true });
		writeFileSync(join(dir, "z.json"), "{}");
		writeFileSync(join(dir, "b", "c", "a.png"), "");
		writeFileSync(join(dir, "b", "c", "a.png.tmp"), "");
		writeFileSync(join(dir, "history", "x", "change.json"), "{}");
		symlinkSync(join(dir, "z.json"), join(dir, "link.json"));
		expect(listFilesRecursive(dir, (d) => d === "history")).toEqual(["b/c/a.png", "z.json"]);
		expect(listFilesRecursive(dir)).toEqual(["b/c/a.png", "history/x/change.json", "z.json"]);
		expect(listFilesRecursive(join(dir, "missing"))).toEqual([]);
	});
});

describe("freeFileName", () => {
	it("adds a counter while the name is taken", () => {
		const dir = mkdtempSync(join(tmpdir(), "bv-fs-"));
		dirs.push(dir);
		expect(freeFileName(dir, "b-20261025-1015", ".zip")).toBe("b-20261025-1015.zip");
		writeFileSync(join(dir, "b-20261025-1015.zip"), "");
		writeFileSync(join(dir, "b-20261025-1015-2.zip"), "");
		expect(freeFileName(dir, "b-20261025-1015", ".zip")).toBe("b-20261025-1015-3.zip");
	});
});
