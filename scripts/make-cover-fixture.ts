// SPDX-License-Identifier: GPL-3.0-or-later
// Builds tests/fixtures/images/book-angled.jpg (+ .json with the corners): a synthetic photo of
// a book cover seen at an angle on a table, used by the cover-straightening tests (step 3.7),
// and book-cover.jpg, the same cover seen straight (the mock cover provider of 3.7b).
// The cover is an HTML box projected with a CSS matrix3d computed from the wanted corners, so
// the expected quadrilateral is known exactly. Runs under Node (Playwright renders the page):
//   node scripts/make-cover-fixture.ts
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const WIDTH = 900;
const HEIGHT = 700;
const COVER = { w: 360, h: 540 };
/** Where the cover's corners land in the photo (top-left, top-right, bottom-right, bottom-left). */
const CORNERS = [
	{ x: 236, y: 92 },
	{ x: 642, y: 58 },
	{ x: 704, y: 606 },
	{ x: 188, y: 578 },
];

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

/** Homography mapping the cover box (0,0)-(w,h) onto the four corners, as a CSS matrix3d. */
function matrix3d(): string {
	const src = [
		{ x: 0, y: 0 },
		{ x: COVER.w, y: 0 },
		{ x: COVER.w, y: COVER.h },
		{ x: 0, y: COVER.h },
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
	const [h0, h1, h2, h3, h4, h5, h6, h7] = solve(a, b) as [
		number,
		number,
		number,
		number,
		number,
		number,
		number,
		number,
	];
	// column-major 4×4: x' = h0 x + h1 y + h2, y' = h3 x + h4 y + h5, w' = h6 x + h7 y + 1
	return `matrix3d(${[h0, h3, 0, h6, h1, h4, 0, h7, 0, 0, 1, 0, h2, h5, 0, 1].join(",")})`;
}

const coverHtml = (transform: string): string =>
	`<div style="position:absolute;left:0;top:0;width:${COVER.w}px;height:${COVER.h}px;transform-origin:0 0;transform:${transform};
		background:linear-gradient(160deg,#f4efe4,#e6dcc6);box-shadow:0 0 0 3px #3b2d20;box-sizing:border-box;overflow:hidden;padding:36px 28px;color:#2a2118;font-family:Georgia,serif">
		<div style="border:3px solid #7a3b1e;height:100%;box-sizing:border-box;padding:28px 18px;text-align:center">
			<p style="margin:0;font-size:16px;letter-spacing:4px">FRANCES H. BURNETT</p>
			<h1 style="margin:60px 0 0;font-size:54px;line-height:1.05">IL GIARDINO SEGRETO</h1>
			<div style="margin:70px auto 0;width:140px;height:140px;border-radius:50%;background:#7a3b1e"></div>
			<p style="margin:40px 0 0;font-size:20px">Mondadori</p>
		</div>
	</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
await page.setContent(`<html><body style="margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;
	background:repeating-linear-gradient(95deg,#8a6a4a 0 18px,#7d5f42 18px 40px,#95755a 40px 61px)">
	<div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.18),rgba(0,0,0,.25))"></div>
	${coverHtml(matrix3d())}</body></html>`);
const jpeg = await page.screenshot({ type: "jpeg", quality: 88 });
await page.setViewportSize({ width: COVER.w, height: COVER.h });
await page.setContent(
	`<html><body style="margin:0;width:${COVER.w}px;height:${COVER.h}px;overflow:hidden">${coverHtml("none")}</body></html>`,
);
const straight = await page.screenshot({ type: "jpeg", quality: 88 });
await browser.close();
writeFileSync("tests/fixtures/images/book-cover.jpg", straight);
writeFileSync("tests/fixtures/images/book-angled.jpg", jpeg);
writeFileSync(
	"tests/fixtures/images/book-angled.json",
	`${JSON.stringify({ width: WIDTH, height: HEIGHT, corners: CORNERS }, null, "\t")}\n`,
);
console.log(`wrote tests/fixtures/images/book-angled.jpg (${jpeg.byteLength} bytes)`);
