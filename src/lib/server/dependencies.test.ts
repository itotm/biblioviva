// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectDependencies, DEPENDENCIES_FILE, SYSTEM_COMPONENTS } from "./dependencies.js";

describe("dependency inventory (About page)", () => {
	it("lists every pinned package with licence and homepage, and the committed file is current", () => {
		const data = collectDependencies();
		expect(data.app).toMatchObject({ name: "biblioviva", license: "GPL-3.0-or-later" });
		expect(data.app.repository).toBe("https://github.com/itotm/biblioviva");
		const kit = data.development.find((d) => d.name === "@sveltejs/kit");
		expect(kit?.version).toMatch(/^\d/);
		expect(kit?.license).toBe("MIT");
		expect(data.runtime.map((d) => d.name)).toContain("papaparse");
		expect(data.runtime.every((d) => /^\d+\.\d+\.\d+/.test(d.version))).toBe(true);
		expect(data.runtime.every((d) => d.homepage.startsWith("http"))).toBe(true);
		expect(data.system).toBe(SYSTEM_COMPONENTS);
		// the committed file must be what the generator produces (run `bun run deps:generate`)
		expect(JSON.parse(readFileSync(DEPENDENCIES_FILE, "utf8"))).toEqual(data);
	});
});
