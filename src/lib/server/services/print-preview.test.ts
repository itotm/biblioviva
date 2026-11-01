// SPDX-License-Identifier: GPL-3.0-or-later
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { templatesOverview } from "./print-preview.js";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-preview-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const config = parseConfig(exampleRaw()).config;

/** A user template folder: a copy of the built-in default, optionally broken. */
function userTemplate(configDir: string, name: string, patch?: (dir: string) => void): string {
	const dir = join(configDir, "cards", "templates", name);
	cpSync("config/cards/templates/default", dir, { recursive: true });
	writeFileSync(
		join(dir, "template.json"),
		JSON.stringify({ name, description: `copy ${name}`, patronTypes: ["teacher"] }),
	);
	patch?.(dir);
	return dir;
}

describe("templates overview", () => {
	it("lists every kind with source, default flag and validation state", () => {
		const configDir = temp();
		userTemplate(configDir, "docenti");
		mkdirSync(join(configDir, "cards", "templates", "rotto"), { recursive: true });
		writeFileSync(join(configDir, "cards", "templates", "rotto", "template.json"), "{ oops");
		mkdirSync(join(configDir, "labels", "templates", "pair-default"), { recursive: true });
		writeFileSync(
			join(configDir, "labels", "templates", "pair-default", "template.json"),
			JSON.stringify({
				name: "pair-default",
				description: "coppia",
				kind: "pair",
				unit: { cells: 2 },
			}),
		);
		mkdirSync(join(configDir, "slips", "templates", "bad"), { recursive: true });
		writeFileSync(join(configDir, "slips", "templates", "bad", "template.json"), "{}");

		const o = templatesOverview(config, configDir);
		expect(o.cards.map((t) => [t.name, t.source, t.isDefault, t.error === null])).toEqual([
			["default", "builtin", true, true],
			["docenti", "config", false, true],
			["fronte-retro", "builtin", false, true],
			["rotto", "config", false, false],
			["verticale", "builtin", false, true],
		]);
		expect(o.cards[1]?.patronTypes).toEqual(["teacher"]);
		expect(o.cards[3]?.error).toMatch(/template\.json/);
		// the user's pair-default overrides the built-in; barcode and spine stay built in (step 3.8)
		expect(o.labels.map((t) => [t.name, t.source, t.isDefault, t.labelKind])).toEqual([
			["barcode-default", "builtin", true, "barcode"],
			["pair-default", "config", true, "pair"],
			["spine-default", "builtin", true, "spine"],
		]);
		expect(o.labels[1]).toMatchObject({ error: null, description: "coppia", stocks: [] });
		expect(o.slips[0]).toMatchObject({ name: "bad", isDefault: false });
		expect(o.slips[0]?.error).toMatch(/name/);
		// the slips shipped, the configured overdue notice flagged as the default one
		expect(o.slips.map((t) => [t.name, t.isDefault, t.error === null])).toEqual([
			["bad", false, false],
			["checkout-receipt", false, true],
			["overdue-by-class", true, true],
			["overdue-patron", false, true],
		]);
	});

	it("checks a slip's template.json with the slip schema", () => {
		const configDir = temp();
		const dir = join(configDir, "slips", "templates", "nokind");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "template.json"), JSON.stringify({ name: "nokind" }));
		writeFileSync(join(dir, "slip.html"), "<p>{{date}}</p>");
		const slip = templatesOverview(config, configDir).slips.find((t) => t.name === "nokind");
		expect(slip?.error).toMatch(/kind/);
	});

	it("lists the stocks and the configured card templates", () => {
		const o = templatesOverview(config, temp());
		expect(o.stocks.map((s) => s.id)).toContain(config.labels.pair.stock);
		expect(o.defaults.cards).toBe("default");
	});
});
