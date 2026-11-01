// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { exampleRaw } from "./load.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "#lib/server/env.js";
import {
	getConfig,
	getLoadedConfig,
	installReloadSignal,
	onConfigReload,
	reloadConfig,
	resetConfigCache,
} from "./index.js";
import { getUiLocale } from "./locale.js";

const example = (): Record<string, any> => exampleRaw() as Record<string, any>;

let dir: string;
const originalConfigDir = process.env.CONFIG_DIR;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-config-index-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	if (originalConfigDir === undefined) {
		delete process.env.CONFIG_DIR;
	} else {
		process.env.CONFIG_DIR = originalConfigDir;
	}
	resetEnvCache();
	resetConfigCache();
});

describe("process-wide configuration", () => {
	it("loads lazily and memoises", () => {
		const raw = example();
		raw.library.name = "Biblioteca di prova";
		writeFileSync(join(dir, "config.json"), JSON.stringify(raw));
		expect(getConfig().library.name).toBe("Biblioteca di prova");
		expect(getLoadedConfig().source).toBe("file");
		expect(getUiLocale()).toBe("en");
	});

	it("reloads and notifies listeners; a broken file keeps the previous configuration", () => {
		const raw = example();
		writeFileSync(join(dir, "config.json"), JSON.stringify(raw));
		expect(getConfig().ui.locale).toBe("en");
		const seen: string[] = [];
		const off = onConfigReload((c) => seen.push(c.ui.locale));
		raw.ui.locale = "en";
		writeFileSync(join(dir, "config.json"), JSON.stringify(raw));
		reloadConfig();
		expect(getConfig().ui.locale).toBe("en");
		expect(seen).toEqual(["en"]);
		writeFileSync(join(dir, "config.json"), "{ broken");
		expect(() => reloadConfig()).toThrow();
		expect(getConfig().ui.locale).toBe("en");
		off();
	});

	it("installs the SIGHUP handler once and reloads on the signal", async () => {
		writeFileSync(join(dir, "config.json"), JSON.stringify(example()));
		const messages: string[] = [];
		installReloadSignal((m) => messages.push(m));
		installReloadSignal((m) => messages.push(m)); // no-op
		const before = process.listenerCount("SIGHUP");
		process.emit("SIGHUP");
		await new Promise((r) => setTimeout(r, 10));
		expect(messages.some((m) => m.includes("reloaded"))).toBe(true);
		expect(process.listenerCount("SIGHUP")).toBe(before);
	});
});
