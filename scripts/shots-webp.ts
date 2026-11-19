// SPDX-License-Identifier: GPL-3.0-or-later
// Turns the PNG files of the shots run (tests/docs/shots.spec.ts) into lossless WebP in
// `site/.shots/<lang>/<name>.<window>.webp` (PLAN.md §3.23), then removes the PNG files. A run that
// took one language or one window only leaves the other pictures of `site/.shots/` as they were.
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
	let bytes = 0;
	// pictures of each language and window, for the summary
	const counts = new Map<string, number>();
	// a few pictures at a time: the encoder works in its own threads
	const queue = pngFiles(PNG_DIR);
	const workers = Array.from({ length: 4 }, async () => {
		for (let png = queue.pop(); png; png = queue.pop()) {
			const target = join(OUT_DIR, relative(PNG_DIR, png).replace(/\.png$/, ".webp"));
			mkdirSync(dirname(target), { recursive: true });
			const webp = await new Bun.Image(await Bun.file(png).arrayBuffer())
				.webp({ lossless: true })
				.bytes();
			await Bun.write(target, webp);
			bytes += webp.byteLength;
			const [lang = "", file = ""] = relative(PNG_DIR, png).split("/");
			const window = /\.([a-z]+)\.png$/.exec(file)?.[1] ?? "";
			counts.set(`${lang} ${window}`, (counts.get(`${lang} ${window}`) ?? 0) + 1);
		}
	});
	await Promise.all(workers);
	rmSync(PNG_DIR, { recursive: true, force: true });
	const total = [...counts.values()].reduce((a, b) => a + b, 0);
	const detail = [...counts].sort().map(([key, n]) => `${key}: ${String(n)}`);
	console.log(
		`${String(total)} pictures in ${OUT_DIR} (${(bytes / 1024 / 1024).toFixed(1)} MB) — ${detail.join(", ")}`,
	);
}

await main();
