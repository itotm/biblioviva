// SPDX-License-Identifier: GPL-3.0-or-later
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import SHIPPED from "./shipped.json" with { type: "json" };
import {
	contentHash,
	folderHashes,
	upgradeShippedCopies,
	type ShippedVersions,
} from "./upgrade.js";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-upgrade-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

function folder(root: string, path: string, files: Record<string, string>): void {
	for (const [f, content] of Object.entries(files)) {
		mkdirSync(join(root, path, f, ".."), { recursive: true });
		writeFileSync(join(root, path, f), content);
	}
}

describe("copies of the built-in templates", () => {
	it("records every file of the current built-ins (run bun run templates:shipped)", () => {
		const shipped = SHIPPED as ShippedVersions;
		for (const kind of ["cards", "labels", "slips"]) {
			const root = join("config", kind, "templates");
			for (const name of readdirSync(root)) {
				for (const [file, hash] of Object.entries(folderHashes(join(root, name)))) {
					expect(shipped[`${kind}/${name}`]?.[file], `${kind}/${name}/${file}`).toContain(
						hash,
					);
				}
			}
		}
	});

	it("records the shipped cards without the photo as cards-no-photo (9.38)", () => {
		const shipped = SHIPPED as ShippedVersions;
		const root = join("config", "cards", "templates-no-photo");
		// the same names as the cards with the photo: switching photos keeps the configuration's
		expect(readdirSync(root).sort()).toEqual(
			readdirSync(join("config", "cards", "templates")).sort(),
		);
		for (const name of readdirSync(root)) {
			for (const [file, hash] of Object.entries(folderHashes(join(root, name)))) {
				expect(shipped[`cards-no-photo/${name}`]?.[file], `${name}/${file}`).toContain(
					hash,
				);
			}
			expect(readFileSync(join(root, name, "front.html"), "utf8")).not.toContain("photo_url");
		}
	});

	it("an untouched copy of a shipped card follows photos switched off and on (9.38)", () => {
		const configDir = temp();
		const copy = join(configDir, "cards", "templates", "default");
		cpSync(join("config", "cards", "templates", "default"), copy, { recursive: true });
		const front = (): string => readFileSync(join(copy, "front.html"), "utf8");
		expect(front()).toContain("photo_url");
		expect(
			upgradeShippedCopies(configDir, "config", SHIPPED as ShippedVersions, false),
		).toContain("cards/default");
		expect(front()).not.toContain("photo_url");
		expect(
			upgradeShippedCopies(configDir, "config", SHIPPED as ShippedVersions, true),
		).toContain("cards/default");
		expect(front()).toContain("photo_url");
		// an edited copy stays as it is
		writeFileSync(join(copy, "front.html"), `${front()}<!-- mine -->`);
		expect(
			upgradeShippedCopies(configDir, "config", SHIPPED as ShippedVersions, false),
		).toEqual([]);
		expect(front()).toContain("<!-- mine -->");
	});

	it("compares text files without their formatting, other files byte for byte", () => {
		const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);
		expect(contentHash("s.css", bytes(".a .b { x: 1; y: 2; }"))).toBe(
			contentHash("s.css", bytes(".a .b {\n\tx: 1;\n\ty: 2;\n}\n")),
		);
		expect(contentHash("s.css", bytes(".a { x: 1 }"))).not.toBe(
			contentHash("s.css", bytes(".a { x: 2 }")),
		);
		expect(contentHash("a.png", bytes("a b"))).not.toBe(contentHash("a.png", bytes("a  b")));
	});

	it("replaces a copy made only of shipped versions and leaves edited copies alone", () => {
		const builtin = temp();
		const config = temp();
		folder(builtin, "cards/templates/default", { "front.html": "new", "assets/a.png": "A" });
		folder(builtin, "labels/templates/pair", { "top.html": "new" });
		folder(builtin, "slips/templates/same", { "slip.html": "same" });
		// an old untouched copy, an edited one, one with an extra file, one already current
		folder(config, "cards/templates/default", { "front.html": "old", "assets/a.png": "A" });
		folder(config, "labels/templates/pair", { "top.html": "edited" });
		folder(config, "slips/templates/same", { "slip.html": "same" });
		const versions = (files: Record<string, string[]>): Record<string, string[]> =>
			Object.fromEntries(
				Object.entries(files).map(([f, contents]) => {
					const d = temp();
					return [
						f,
						contents.map((c) => {
							writeFileSync(join(d, "x"), c);
							return folderHashes(d).x ?? "";
						}),
					];
				}),
			);
		const shipped: ShippedVersions = {
			"cards/default": versions({ "front.html": ["old", "new"], "assets/a.png": ["A"] }),
			"labels/pair": versions({ "top.html": ["old", "new"] }),
			"slips/same": versions({ "slip.html": ["same"] }),
		};
		expect(upgradeShippedCopies(config, builtin, shipped)).toEqual(["cards/default"]);
		expect(readFileSync(join(config, "cards/templates/default/front.html"), "utf8")).toBe(
			"new",
		);
		expect(readFileSync(join(config, "labels/templates/pair/top.html"), "utf8")).toBe("edited");

		// an uploaded asset makes the copy one's own
		folder(config, "cards/templates/default", { "front.html": "old", "assets/mine.png": "M" });
		expect(upgradeShippedCopies(config, builtin, shipped)).toEqual([]);
		// a built-in the record does not know, or no copy at all: nothing to do
		cpSync(join(builtin, "slips"), join(builtin, "slips2"), { recursive: true });
		rmSync(join(config, "slips"), { recursive: true });
		expect(upgradeShippedCopies(config, builtin, shipped)).toEqual([]);
	});
});
