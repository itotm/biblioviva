// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { catalogRules } from "./catalog.js";
import { classificationImage, nodeByCode, placeholderPictogram } from "./classification-media.js";

const scheme = catalogRules(parseConfig(exampleRaw()).config).scheme;
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

describe("classification pictograms", () => {
	it("serves the configured file when present, inherited by children, else a placeholder disc", () => {
		const configDir = mkdtempSync(join(tmpdir(), "bv-pict-"));
		dirs.push(configDir);
		expect(classificationImage(scheme, configDir, "ZZZ")).toBeNull();
		const missing = classificationImage(scheme, configDir, "A")!;
		expect(missing.path).toBeNull();
		expect(missing.mime).toBe("image/svg+xml");
		const svg = placeholderPictogram(missing.node);
		expect(svg).toContain(">A<");
		expect(svg).toContain(missing.node.color ?? "");
		mkdirSync(join(configDir, "classification", "images"), { recursive: true });
		writeFileSync(join(configDir, "classification", "images", "500.svg"), "<svg/>");
		const child = classificationImage(scheme, configDir, "590")!;
		expect(child.path).toBe(join(configDir, "classification", "images", "500.svg"));
		expect(child.mime).toBe("image/svg+xml");
		expect(nodeByCode(scheme, "590")?.parent).toBe("500");
		expect(
			placeholderPictogram({
				code: "MMM",
				label: "x",
				image: null,
				color: null,
				parent: null,
				kind: "nonfiction",
			}),
		).toContain('font-size="30"');
	});
});
