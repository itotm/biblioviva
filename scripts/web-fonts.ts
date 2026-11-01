// SPDX-License-Identifier: GPL-3.0-or-later
// The type of the home page and of the documentation site (ADR-044): the same Inter and JetBrains Mono
// that the app loads, copied from their packages with a style sheet of their own. Only the Latin
// subsets: both sites are written in Italian and English.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGES = fileURLToPath(new URL("../node_modules/@fontsource-variable/", import.meta.url));

const FACES = [
	{ family: "Inter Variable", pkg: "inter", file: "inter", styles: ["normal", "italic"] },
	{
		family: "JetBrains Mono Variable",
		pkg: "jetbrains-mono",
		file: "jetbrains-mono",
		styles: ["normal"],
	},
] as const;

const SUBSETS = [
	{
		name: "latin-ext",
		range: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
	},
	{
		name: "latin",
		range: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
	},
] as const;

/** The files of the fonts, by their path under `prefix` (`fonts/`), and the style sheet `fonts.css`. */
export function webFonts(prefix = "fonts/"): Map<string, string | Uint8Array> {
	const files = new Map<string, string | Uint8Array>();
	const rules: string[] = [];
	for (const face of FACES) {
		const dir = join(PACKAGES, face.pkg, "files");
		for (const style of face.styles) {
			for (const subset of SUBSETS) {
				const name = `${face.file}-${subset.name}-wght-${style}.woff2`;
				files.set(`${prefix}${name}`, new Uint8Array(readFileSync(join(dir, name))));
				rules.push(
					`@font-face{font-family:"${face.family}";font-style:${style};font-display:swap;font-weight:100 900;src:url(${name}) format("woff2");unicode-range:${subset.range}}`,
				);
			}
		}
	}
	files.set(`${prefix}fonts.css`, `${rules.join("\n")}\n`);
	return files;
}
