// SPDX-License-Identifier: GPL-3.0-or-later
// Turns the PNG files of the shots run (tests/docs/shots.spec.ts) into lossless WebP in
// `site/.shots/<lang>/<name>.webp` (PLAN.md §3.23), then removes the PNG files.
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { PNG_DIR } from "../docs/shots.ts";

const OUT_DIR = "site/.shots";

function pngFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...pngFiles(path));
		} else if (entry.name.endsWith(".png")) {
			files.push(path);
		}
	}
	return files;
}

async function main(): Promise<void> {
	if (!statSync(PNG_DIR, { throwIfNoEntry: false })?.isDirectory()) {
		console.error(`No pictures in ${PNG_DIR}: run the Playwright shots first.`);
		process.exit(1);
	}
	let count = 0;
	let bytes = 0;
	for (const png of pngFiles(PNG_DIR)) {
		const target = join(OUT_DIR, relative(PNG_DIR, png).replace(/\.png$/, ".webp"));
		mkdirSync(dirname(target), { recursive: true });
		const webp = await new Bun.Image(await Bun.file(png).arrayBuffer())
			.webp({ lossless: true })
			.bytes();
		await Bun.write(target, webp);
		bytes += webp.byteLength;
		count += 1;
	}
	rmSync(PNG_DIR, { recursive: true, force: true });
	console.log(`${count} pictures in ${OUT_DIR} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
}

await main();
