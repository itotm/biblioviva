// SPDX-License-Identifier: GPL-3.0-or-later
// Builds the demo's sample of a photo (step 9.26, Q126): the sample of a scan,
// docs/reference/demo/class-cards.jpg, laid on a table and photographed at an angle — the page is
// an image projected with a CSS matrix3d computed from the wanted corners, so its photos'
// corners are known exactly: the corners of tests/fixtures/images/class-cards.frames.json carried
// through the same projection. Writes the picture to docs/reference/demo/, demo/census/ and
// tests/fixtures/images/ (with its .frames.json). Runs under Node (Playwright renders the page):
//   node scripts/make-class-photo.ts
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const SOURCE = "docs/reference/demo/class-cards.jpg";
const TRUTH = "tests/fixtures/images/class-cards.frames.json";
const WIDTH = 1200;
const HEIGHT = 1500;
/** Where the page's corners land in the photo (top-left, top-right, bottom-right, bottom-left). */
const CORNERS = [
	{ x: 170, y: 96 },
	{ x: 1050, y: 70 },
	{ x: 1160, y: 1440 },
	{ x: 50, y: 1462 },
];

interface Truth {
	width: number;
	height: number;
	frames: { x: number; y: number }[][];
}

/** Solves A·x = b (Gaussian elimination with partial pivoting). */
function solve(a: number[][], b: number[]): number[] {
	const n = b.length;
	const m = a.map((row, i) => [...row, b[i] ?? 0]);
	const at = (i: number): number[] => m[i] ?? [];
	for (let c = 0; c < n; c++) {
		let pivot = c;
		for (let r = c + 1; r < n; r++) {
			if (Math.abs(m[r]?.[c] ?? 0) > Math.abs(m[pivot]?.[c] ?? 0)) {
				pivot = r;
			}
		}
		[m[c], m[pivot]] = [at(pivot), at(c)];
		const row = at(c);
		for (let r = c + 1; r < n; r++) {
			const target = at(r);
			const f = (target[c] ?? 0) / (row[c] ?? 1);
			for (let k = c; k <= n; k++) {
				target[k] = (target[k] ?? 0) - f * (row[k] ?? 0);
			}
		}
	}
	const x = new Array<number>(n).fill(0);
	for (let r = n - 1; r >= 0; r--) {
		const row = at(r);
		let sum = row[n] ?? 0;
		for (let k = r + 1; k < n; k++) {
			sum -= (row[k] ?? 0) * (x[k] ?? 0);
		}
		x[r] = sum / (row[r] ?? 1);
	}
	return x;
}

const truth = JSON.parse(readFileSync(TRUTH, "utf8")) as Truth;
const page = { w: truth.width, h: truth.height };

/** The homography mapping the page (0,0)-(w,h) onto the four corners: h0…h7 (h8 = 1). */
function homography(): number[] {
	const src = [
		{ x: 0, y: 0 },
		{ x: page.w, y: 0 },
		{ x: page.w, y: page.h },
		{ x: 0, y: page.h },
	];
	const a: number[][] = [];
	const b: number[] = [];
	src.forEach((s, i) => {
		const d = CORNERS[i] as { x: number; y: number };
		a.push([s.x, s.y, 1, 0, 0, 0, -s.x * d.x, -s.y * d.x]);
		b.push(d.x);
		a.push([0, 0, 0, s.x, s.y, 1, -s.x * d.y, -s.y * d.y]);
		b.push(d.y);
	});
	return solve(a, b);
}

const h = homography() as [number, number, number, number, number, number, number, number];
const [h0, h1, h2, h3, h4, h5, h6, h7] = h;
const project = (p: { x: number; y: number }): { x: number; y: number } => {
	const w = h6 * p.x + h7 * p.y + 1;
	return {
		x: Math.round(((h0 * p.x + h1 * p.y + h2) / w) * 10) / 10,
		y: Math.round(((h3 * p.x + h4 * p.y + h5) / w) * 10) / 10,
	};
};
// column-major 4×4: x' = h0 x + h1 y + h2, y' = h3 x + h4 y + h5, w' = h6 x + h7 y + 1
const transform = `matrix3d(${[h0, h3, 0, h6, h1, h4, 0, h7, 0, 0, 1, 0, h2, h5, 0, 1].join(",")})`;
const picture = `data:image/jpeg;base64,${readFileSync(SOURCE).toString("base64")}`;

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
await tab.setContent(`<html><body style="margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;
	background:repeating-linear-gradient(97deg,#8a6a4a 0 22px,#7d5f42 22px 47px,#95755a 47px 70px)">
	<img src="${picture}" style="position:absolute;left:0;top:0;width:${page.w}px;height:${page.h}px;
		transform-origin:0 0;transform:${transform};box-shadow:0 18px 40px rgba(0,0,0,.45)" />
	<div style="position:absolute;inset:0;background:radial-gradient(circle at 70% 15%,rgba(255,255,255,.22),rgba(0,0,0,.28))"></div>
	</body></html>`);
await tab.waitForFunction(() => document.querySelector("img")?.complete === true);
const jpeg = await tab.screenshot({ type: "jpeg", quality: 88 });
await browser.close();

const frames = {
	width: WIDTH,
	height: HEIGHT,
	frames: truth.frames.map((quad) => quad.map(project)),
};
for (const path of [
	"docs/reference/demo/class-cards-photo.jpg",
	"demo/census/class-cards-photo.jpg",
	"tests/fixtures/images/class-cards-photo.jpg",
]) {
	writeFileSync(path, jpeg);
}
writeFileSync(
	"tests/fixtures/images/class-cards-photo.frames.json",
	`${JSON.stringify(frames, null, "\t")}\n`,
);
console.log(`wrote the sample of a photo (${jpeg.byteLength} bytes) and its frames`);
