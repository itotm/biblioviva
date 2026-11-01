// SPDX-License-Identifier: GPL-3.0-or-later
// Every text/surface pair the app relies on must reach WCAG AA (4.5:1), PLAN.md §3.18 / step 0.9.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseCssColor, toHex } from "#lib/shared/color.js";
import { buildThemeCss, THEMES } from "#lib/shared/theme-palette.js";

const base = readFileSync("node_modules/@skeletonlabs/skeleton/src/base/theme.css", "utf8");
const shared = readFileSync("src/lib/theme.css", "utf8");

/** Collects `--name: value;` declarations; later files override earlier ones. */
function collectVars(...sources: string[]): Map<string, string> {
	const vars = new Map<string, string>();
	for (const source of sources) {
		for (const m of source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
			vars.set(m[1]!, m[2]!.trim());
		}
	}
	return vars;
}

let vars = new Map<string, string>();

function useTheme(theme: (typeof THEMES)[number]): void {
	const generated = readFileSync(`src/lib/themes/${theme}.css`, "utf8");
	// the committed file must be what the palette produces (run `bun run themes:generate`)
	expect(generated).toBe(buildThemeCss(theme));
	vars = collectVars(base, shared, generated);
}

function resolve(name: string, depth = 0): string {
	const value = vars.get(name);
	if (!value) {
		throw new Error(`unknown token ${name}`);
	}
	const ref = /^var\((--[\w-]+)\)$/.exec(value);
	if (ref) {
		if (depth > 10) {
			throw new Error(`cycle at ${name}`);
		}
		return resolve(ref[1]!, depth + 1);
	}
	return value;
}

function ratio(fg: string, bg: string): number {
	const f = parseCssColor(resolve(fg));
	const b = parseCssColor(resolve(bg));
	if (!f || !b) {
		throw new Error(`cannot parse ${fg} / ${bg}`);
	}
	return contrastRatio(f, b);
}

const tones = ["primary", "secondary", "tertiary", "success", "warning", "error"] as const;

describe.each(THEMES)("theme contrast (WCAG 2.2 AA): %s", (theme) => {
	it.each(tones)("filled %s-500 preset has readable text", (tone) => {
		useTheme(theme);
		const r = ratio(`--color-${tone}-contrast-500`, `--color-${tone}-500`);
		expect(
			r,
			`${theme}/${tone}: ${toHex(parseCssColor(resolve(`--color-${tone}-500`))!)}`,
		).toBeGreaterThanOrEqual(4.5);
	});

	it("body text is readable on every light surface", () => {
		useTheme(theme);
		for (const level of [50, 100, 200]) {
			expect(ratio("--color-surface-950", `--color-surface-${level}`)).toBeGreaterThanOrEqual(
				4.5,
			);
		}
	});

	it("primary text (links, icons) is readable on the page background", () => {
		useTheme(theme);
		expect(ratio("--color-primary-700", "--color-surface-50")).toBeGreaterThanOrEqual(4.5);
		expect(ratio("--color-primary-600", "--color-surface-100")).toBeGreaterThanOrEqual(4.5);
	});

	it("tonal badges (700 text on 100 background) are readable", () => {
		useTheme(theme);
		for (const tone of tones) {
			expect(ratio(`--color-${tone}-700`, `--color-${tone}-100`)).toBeGreaterThanOrEqual(4.5);
		}
	});
});
