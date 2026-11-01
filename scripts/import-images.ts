// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run classification:import-images <dir>` (step 3.8) — copies the library's existing
// pictograms, named by classification code (`B.gif`, `500.gif`, `MMM.gif`, …), into
// `CONFIG_DIR/classification/images/`, converting GIF to PNG with Bun.Image, and reports the codes
// of the taxonomy that still have no image (children inherit the parent's, so only parents and
// genres count). Files are named `<code>.png`; the taxonomy must reference them (`"image":
// "B.png"`), which the shipped classification.json already does.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { extname, join, parse, resolve } from "node:path";
import { loadConfig } from "#lib/server/config/load.js";
import { env } from "#lib/server/env.js";

const dir = process.argv[2];
if (!dir) {
	console.error(
		"usage: bun run classification:import-images <folder with <code>.gif|png|jpg|svg>",
	);
	process.exit(2);
}
const source = resolve(dir);
if (!existsSync(source)) {
	console.error(`folder not found: ${source}`);
	process.exit(2);
}
const configDir = env().CONFIG_DIR;
const target = join(configDir, "classification", "images");
mkdirSync(target, { recursive: true });
const { config } = loadConfig(configDir);

const RASTER = new Set([".gif", ".png", ".jpg", ".jpeg", ".webp", ".bmp"]);
const files = new Map<string, string>();
for (const name of readdirSync(source)) {
	const ext = extname(name).toLowerCase();
	if (RASTER.has(ext) || ext === ".svg") {
		files.set(parse(name).name, join(source, name));
	}
}

let copied = 0;
for (const [code, file] of files) {
	const ext = extname(file).toLowerCase();
	if (ext === ".svg") {
		await Bun.write(join(target, `${code}.svg`), Bun.file(file));
	} else {
		// every raster becomes PNG (GIF included), so the taxonomy can always point at <code>.png
		const png = await new Bun.Image(await Bun.file(file).bytes()).png().bytes();
		await Bun.write(join(target, `${code}.png`), png);
	}
	copied++;
	console.log(`${code}: ${parse(file).base} → ${code}.${ext === ".svg" ? "svg" : "png"}`);
}

const c = config.classification;
const wanted = [
	...c.genres.map((g) => ({ code: g.code, image: g.image ?? null })),
	...c.nonfiction.map((n) => ({ code: n.code, image: n.image ?? null })),
];
const missing = wanted.filter(
	(w) => !files.has(w.code) && !(w.image && existsSync(join(target, w.image))),
);
console.log(`${copied} image(s) written to ${target}`);
if (missing.length > 0) {
	console.log(`codes without an image: ${missing.map((m) => m.code).join(", ")}`);
}
