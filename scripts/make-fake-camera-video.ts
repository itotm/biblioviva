// SPDX-License-Identifier: GPL-3.0-or-later
// Builds tests/fixtures/video/barcodes.mjpeg: the fake-camera feed of the e2e tests (step 3.3),
// a loop of three barcodes (an ISBN EAN-13, a Code 128 card number, a legacy Code 39 item code),
// each shown for one second at 30 fps. Chromium plays it through
// `--use-file-for-fake-video-capture`. Runs under Node (Playwright renders the frames):
//   node scripts/make-fake-camera-video.ts
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { toSVG } from "@bwip-js/generic";

const FRAMES_PER_CODE = 30;
const WIDTH = 320;
const HEIGHT = 240;
const CODES: { bcid: string; text: string; label: string }[] = [
	{ bcid: "ean13", text: "9788804668237", label: "ISBN" },
	{ bcid: "code128", text: "0000001240", label: "Tessera" },
	{ bcid: "code39", text: "2026-0042", label: "Copia (legacy)" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
const frames: Buffer[] = [];
for (const code of CODES) {
	const svg = toSVG({
		bcid: code.bcid,
		text: code.text,
		scale: 2,
		height: 12,
		includetext: false,
	});
	await page.setContent(
		`<html><body style="margin:0;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:${HEIGHT}px;font-family:sans-serif">` +
			`<div style="width:${WIDTH * 0.8}px">${svg.replace("<svg", '<svg style="width:100%;height:auto"')}</div>` +
			`<p style="margin:6px 0 0;font-size:12px;color:#333">${code.label}</p></body></html>`,
	);
	const jpeg = await page.screenshot({ type: "jpeg", quality: 85 });
	for (let i = 0; i < FRAMES_PER_CODE; i++) {
		frames.push(Buffer.from(jpeg));
	}
}
await browser.close();
const out = "tests/fixtures/video/barcodes.mjpeg";
writeFileSync(out, Buffer.concat(frames));
console.log(
	`wrote ${out}: ${frames.length} frames, ${Math.round(Buffer.concat(frames).length / 1024)} KB`,
);
