// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import {
	ArchiveError,
	readZip,
	safeArchivePath,
	unpackZipFile,
	zipEntries,
	zipFileEntries,
	type ArchiveRules,
} from "./read.js";

const dirs: string[] = [];
function tempDir(): string {
	const d = mkdtempSync(join(tmpdir(), "bv-archive-read-"));
	dirs.push(d);
	return d;
}
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const RULES: ArchiveRules = {
	maxArchiveBytes: 1_000_000,
	maxEntries: 10,
	maxFileBytes: 100_000,
	maxTotalBytes: 200_000,
};

const codeOf = (fn: () => unknown): string => {
	try {
		fn();
	} catch (e) {
		return e instanceof ArchiveError ? `${e.code}${e.detail ? `:${e.detail}` : ""}` : "other";
	}
	return "none";
};

describe("the safe archive reader", () => {
	it("tells safe paths from the others", () => {
		expect(safeArchivePath("a/b.json")).toBe(true);
		for (const bad of ["", "/etc/passwd", "a\\b", "C:/x", "a/../b", "./a", "a//b", "a\0b"]) {
			expect(safeArchivePath(bad)).toBe(false);
		}
	});

	it("reads the directory from memory and from disk alike, folders included", () => {
		const zip = zipSync({ "a/": new Uint8Array(), "a/b.txt": strToU8("hello") });
		const path = join(tempDir(), "x.zip");
		writeFileSync(path, zip);
		expect(zipEntries(zip)).toEqual([
			{ name: "a/", size: 0, link: false },
			{ name: "a/b.txt", size: 5, link: false },
		]);
		expect(zipFileEntries(path)).toEqual({ entries: zipEntries(zip), bytes: zip.byteLength });
		expect(codeOf(() => zipEntries(strToU8("no zip here")))).toBe("not_zip");
	});

	it("applies the rules of each use: skipped, unknown and forbidden names, sizes, links", () => {
		const zip = zipSync({ "keep.json": strToU8("{}"), ".hidden": strToU8("x") });
		expect(Object.keys(readZip(zip, { ...RULES, skip: (n) => n.startsWith(".") }))).toEqual([
			"keep.json",
		]);
		expect(codeOf(() => readZip(zip, { ...RULES, known: (n) => n.endsWith(".json") }))).toBe(
			"unknown_file:.hidden",
		);
		expect(codeOf(() => readZip(zip, { ...RULES, forbidden: (n) => n === "keep.json" }))).toBe(
			"unsafe_path:keep.json",
		);
		expect(codeOf(() => readZip(zip, { ...RULES, maxArchiveBytes: 10 }))).toBe("too_large");
		expect(codeOf(() => readZip(zip, { ...RULES, maxEntries: 1 }))).toBe("too_many_files");
		expect(
			codeOf(() =>
				readZip(zipSync({ big: new Uint8Array(1000) }), { ...RULES, maxFileBytes: 999 }),
			),
		).toBe("too_large:big");
		expect(
			codeOf(() =>
				readZip(zipSync({ a: new Uint8Array(600), b: new Uint8Array(600) }), {
					...RULES,
					maxTotalBytes: 1000,
				}),
			),
		).toBe("too_large");
		const link = zipSync({ l: [strToU8("/etc"), { os: 3, attrs: 0o120777 << 16 }] });
		expect(codeOf(() => readZip(link, RULES))).toBe("link:l");
	});

	it("refuses an archive of the ZIP64 kind, which the program never writes", () => {
		const zip = zipSync({ a: strToU8("x") });
		const view = new DataView(zip.buffer);
		for (let i = 0; i + 4 < zip.byteLength; i++) {
			if (view.getUint32(i, true) === 0x02014b50) {
				view.setUint32(i + 24, 0xffffffff, true);
			}
		}
		expect(codeOf(() => zipEntries(zip))).toBe("too_large");
	});

	it("unpacks from disk to the targets chosen, keeps some entries in memory", async () => {
		const zip = zipSync({
			"manifest.json": strToU8('{"a":1}'),
			"in/one.txt": strToU8("1"),
			"out/two.txt": strToU8("2"),
		});
		const path = join(tempDir(), "x.zip");
		writeFileSync(path, zip);
		const dir = tempDir();
		const result = await unpackZipFile(
			path,
			RULES,
			(name) => (name.startsWith("in/") ? join(dir, name) : null),
			["manifest.json"],
		);
		expect(result).toMatchObject({ files: 1, bytes: 8 });
		expect(new TextDecoder().decode(result.kept["manifest.json"])).toBe('{"a":1}');
		expect(readdirSync(join(dir, "in"))).toEqual(["one.txt"]);
		await expect(
			unpackZipFile(path, { ...RULES, maxArchiveBytes: 1 }, () => null),
		).rejects.toMatchObject({ code: "too_large" });
	});
});
