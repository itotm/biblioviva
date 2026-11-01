// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, unzipSync, zipSync } from "fflate";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { NAMESPACES } from "#lib/i18n/index.js";
import { resetConfigCache } from "#lib/server/config/index.js";
import type { Db } from "#lib/server/db/client.js";
import { staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import type { Dictionaries } from "#lib/server/i18n/packs.js";
import { builtInDictionaries } from "#lib/server/i18n/registry.js";
import { revertConfigChange, setUiTheme } from "../../../../tests/helpers/config.js";
import {
	checkPackZip,
	installPack,
	LanguagePackError,
	packFolders,
	packsView,
	packZip,
	removePack,
} from "./language-packs.js";

let english: Dictionaries;
beforeAll(async () => {
	english = await builtInDictionaries("en");
});

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-packs-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
	setUiTheme(dir, "ocean");
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

function database(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

/** A German pack made of the English texts (valid), optionally in a folder. */
function germanZip(folder = "de", change?: (files: Record<string, unknown>) => void): Uint8Array {
	const files: Record<string, unknown> = {
		"pack.json": { name: "German", nativeName: "Deutsch" },
		...Object.fromEntries(NAMESPACES.map((ns) => [`${ns}.json`, english[ns]])),
	};
	change?.(files);
	return zipSync(
		Object.fromEntries(
			Object.entries(files).map(([f, v]) => [
				folder ? `${folder}/${f}` : f,
				strToU8(typeof v === "string" ? v : JSON.stringify(v)),
			]),
		),
	);
}

describe("language packs", () => {
	it("checks an uploaded pack, installs it, lists it and removes it", () => {
		const { db, actor } = database();
		expect(checkPackZip(germanZip(), null, english, "it").pack).toMatchObject({
			code: "de",
			nativeName: "Deutsch",
			valid: true,
			errors: 0,
		});
		const { change } = installPack(db, dir, germanZip(), null, english, "it", actor);
		expect(packsView(dir, english, "it").map((p) => [p.code, p.valid])).toEqual([["de", true]]);
		expect(packFolders(dir)).toContain("de");
		const zipped = unzipSync(packZip(dir, "de"));
		expect(Object.keys(zipped)).toContain("de/pack.json");

		expect(() => removePack(db, dir, "de", "de", actor)).toThrow(LanguagePackError);
		expect(() => removePack(db, dir, "it", "de", actor)).toThrow(LanguagePackError);
		removePack(db, dir, "de", "it", actor);
		expect(existsSync(join(dir, "i18n", "de"))).toBe(false);
		// the removal is a change of the history like the installation
		expect(change.action).toBe("config.ui");
	});

	it("takes a zip without a folder when the code is given, and replaces a pack", () => {
		const { db, actor } = database();
		installPack(db, dir, germanZip(""), "de-AT", english, "it", actor);
		expect(packFolders(dir)).toContain("de-AT");
		const { change } = installPack(
			db,
			dir,
			germanZip("", (f) => {
				f["pack.json"] = { name: "Austrian German", nativeName: "Österreichisch" };
			}),
			"de-AT",
			english,
			"it",
			actor,
		);
		expect(packsView(dir, english, "it")[0]?.nativeName).toBe("Österreichisch");
		revertConfigChange(dir, change.id);
		expect(packsView(dir, english, "it")[0]?.nativeName).toBe("Deutsch");
	});

	it("refuses packs with errors, bad codes, built-in codes and zips that are not packs", () => {
		const { db, actor } = database();
		const broken = germanZip("de", (f) => {
			f["common.json"] = "{";
		});
		expect(checkPackZip(broken, null, english, "it").pack.valid).toBe(false);
		expect(() => installPack(db, dir, broken, null, english, "it", actor)).toThrow(
			LanguagePackError,
		);
		const code = (fn: () => unknown): string | undefined => {
			try {
				fn();
			} catch (e) {
				return e instanceof LanguagePackError ? e.code : "other";
			}
			return undefined;
		};
		expect(code(() => checkPackZip(germanZip("it"), null, english, "it"))).toBe("builtIn");
		expect(code(() => checkPackZip(germanZip("Tedesco"), null, english, "it"))).toBe("badCode");
		expect(code(() => checkPackZip(strToU8("not a zip"), null, english, "it"))).toBe("notAZip");
		expect(
			code(() =>
				checkPackZip(
					zipSync({ "a/x.json": strToU8("{}"), "b/y.json": strToU8("{}") }),
					null,
					english,
					"it",
				),
			),
		).toBe("badLayout");
		expect(
			code(() => checkPackZip(zipSync({ "de/evil.sh": strToU8("x") }), null, english, "it")),
		).toBe("badLayout");
		// the safe archive reader: paths out of the folder, oversize files, macOS leftovers skipped
		expect(
			code(() =>
				checkPackZip(zipSync({ "../de/common.json": strToU8("{}") }), null, english, "it"),
			),
		).toBe("badLayout");
		expect(
			code(() =>
				checkPackZip(
					zipSync({ "de/common.json": new Uint8Array(3 * 1024 * 1024) }),
					null,
					english,
					"it",
				),
			),
		).toBe("tooLarge");
		const withLeftovers = unzipSync(germanZip("de"));
		withLeftovers["__MACOSX/de/._common.json"] = strToU8("junk");
		expect(checkPackZip(zipSync(withLeftovers), null, english, "it").pack.code).toBe("de");
		expect(existsSync(join(dir, "i18n", "de"))).toBe(false);
	});
});
