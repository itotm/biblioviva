// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { resetEnvCache } from "#lib/server/env.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import { webManifest } from "./web-manifest.js";

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-manifest-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

describe("web app manifest", () => {
	it("opens the dashboard standalone, in the colours of the chosen set", () => {
		setUiTheme(dir, "ocean");
		const m = webManifest(getConfig());
		expect(m).toMatchObject({
			short_name: "BiblioViva",
			start_url: "/",
			display: "standalone",
			theme_color: "#006edc",
		});
		expect(m.name).toContain(getConfig().library.name);
		expect(m.icons.map((i) => [i.sizes, i.purpose])).toEqual([
			["192x192", "any"],
			["512x512", "any"],
			["512x512", "maskable"],
		]);
		setUiTheme(dir, "cherry");
		expect(webManifest(getConfig()).theme_color).not.toBe("#006edc");
	});
});
