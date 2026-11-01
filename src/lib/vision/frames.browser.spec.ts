// SPDX-License-Identifier: GPL-3.0-or-later
// Runs in Chromium (vitest browser project): the photo frames of the two demo pictures (step 13.1)
// against their hand-measured corners, and synthetic sheets of portraits.
import { describe, expect, it } from "vitest";
import cardsUrl from "../../../tests/fixtures/images/class-cards.jpg?url";
import cardsTruth from "../../../tests/fixtures/images/class-cards.frames.json";
import cardsPhotoUrl from "../../../tests/fixtures/images/class-cards-photo.jpg?url";
import cardsPhotoTruth from "../../../tests/fixtures/images/class-cards-photo.frames.json";
import sheetUrl from "../../../tests/fixtures/images/portraits-sheet.jpg?url";
import sheetTruth from "../../../tests/fixtures/images/portraits-sheet.frames.json";
import type { Quad } from "./dewarp.js";

interface Truth {
	width: number;
	height: number;
	frames: Quad[];
}
const cards = cardsTruth as unknown as Truth;
const cardsPhoto = cardsPhotoTruth as unknown as Truth;
const sheet = sheetTruth as unknown as Truth;
import { aspectOf, detectFrames, SCAN_DETECTION, type Frame } from "./frames.js";
import { loadOpenCv, type CvModule } from "./loader.js";

async function loadImage(url: string): Promise<HTMLImageElement> {
	const img = new Image();
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = () => reject(new Error(`cannot load ${url}`));
		img.src = url;
	});
	return img;
}

function imageDataOf(source: HTMLImageElement | HTMLCanvasElement): ImageData {
	const canvas = document.createElement("canvas");
	canvas.width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
	canvas.height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("no 2d context");
	}
	ctx.drawImage(source, 0, 0);
	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Largest corner error as a fraction of the picture's diagonal. */
function cornerError(found: Quad, truth: Quad, width: number, height: number): number {
	const diagonal = Math.hypot(width, height);
	return (
		Math.max(...found.map((p, i) => Math.hypot(p.x - truth[i]!.x, p.y - truth[i]!.y))) /
		diagonal
	);
}

function expectMatches(frames: Frame[], truth: Truth, tolerance: number): void {
	expect(frames).toHaveLength(truth.frames.length);
	frames.forEach((f, i) => {
		const t = truth.frames[i]!;
		expect(cornerError(f.quad, t, truth.width, truth.height), `frame ${i + 1}`).toBeLessThan(
			tolerance,
		);
	});
}

/** A white page with a grid of coloured portrait tiles, optionally rotated as a whole. */
function syntheticSheet(
	columns: number,
	rows: number,
	options: { rotate?: number; background?: string; border?: boolean } = {},
): { canvas: HTMLCanvasElement; count: number } {
	const tileW = 120;
	const tileH = 150;
	const gap = 40;
	const margin = 80;
	const canvas = document.createElement("canvas");
	canvas.width = margin * 2 + columns * tileW + (columns - 1) * gap;
	canvas.height = margin * 2 + rows * tileH + (rows - 1) * gap;
	const ctx = canvas.getContext("2d")!;
	ctx.fillStyle = options.background ?? "rgb(245, 245, 240)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.translate(canvas.width / 2, canvas.height / 2);
	ctx.rotate(((options.rotate ?? 0) * Math.PI) / 180);
	ctx.translate(-canvas.width / 2, -canvas.height / 2);
	const colours = ["#3b82f6", "#facc15", "#22c55e", "#ec4899", "#8b5cf6", "#14b8a6"];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < columns; c++) {
			const x = margin + c * (tileW + gap);
			const y = margin + r * (tileH + gap);
			if (options.border) {
				ctx.fillStyle = "white";
				ctx.fillRect(x - 8, y - 8, tileW + 16, tileH + 16);
			}
			ctx.fillStyle = colours[(r * columns + c) % colours.length]!;
			ctx.fillRect(x, y, tileW, tileH);
			// a face: skin disc, hair, shoulders
			ctx.fillStyle = "rgb(240, 200, 170)";
			ctx.beginPath();
			ctx.arc(x + tileW / 2, y + tileH * 0.42, tileW * 0.28, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "rgb(90, 60, 30)";
			ctx.fillRect(x + tileW * 0.25, y + tileH * 0.12, tileW * 0.5, tileH * 0.12);
			ctx.fillStyle = "rgb(250, 250, 250)";
			ctx.fillRect(x + tileW * 0.18, y + tileH * 0.78, tileW * 0.64, tileH * 0.22);
		}
	}
	return { canvas, count: rows * columns };
}

describe("detectFrames", () => {
	it("finds the ten photos of the demo class cards in reading order", async () => {
		const cv = await loadOpenCv();
		const img = await loadImage(cardsUrl);
		const frames = detectFrames(cv, imageDataOf(img));
		expectMatches(frames, cards, 0.02);
	}, 60_000);

	it("finds the thirty portraits of the demo sheet in reading order", async () => {
		const cv = await loadOpenCv();
		const img = await loadImage(sheetUrl);
		const frames = detectFrames(cv, imageDataOf(img));
		expectMatches(frames, sheet, 0.02);
	}, 60_000);

	it("finds every tile of synthetic sheets, rotated, on colour, with white borders", async () => {
		const cv = await loadOpenCv();
		for (const [columns, rows, options] of [
			[2, 1, {}],
			[5, 4, {}],
			[6, 6, { rotate: 4 }],
			[4, 3, { rotate: -8, background: "rgb(200, 210, 225)" }],
			[4, 3, { background: "rgb(60, 60, 70)", border: true }],
		] as const) {
			const { canvas, count } = syntheticSheet(columns, rows, options);
			const frames = detectFrames(cv, imageDataOf(canvas));
			expect(frames.length, `${columns}×${rows} ${JSON.stringify(options)}`).toBe(count);
		}
	}, 60_000);

	it("finds nothing on an empty page and caps the count", async () => {
		const cv = await loadOpenCv();
		const blank = document.createElement("canvas");
		blank.width = 800;
		blank.height = 1000;
		const ctx = blank.getContext("2d")!;
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, 800, 1000);
		expect(detectFrames(cv, imageDataOf(blank))).toEqual([]);
		const { canvas } = syntheticSheet(5, 4);
		expect(detectFrames(cv, imageDataOf(canvas), { maxFrames: 7 })).toHaveLength(7);
		// the aspect window refuses portraits when it asks for landscape frames (the long edges
		// around a block of tiles still draw landscape rectangles)
		const landscape = detectFrames(cv, imageDataOf(canvas), { minAspect: 0.5, maxAspect: 0.9 });
		expect(landscape.map((f) => aspectOf(f.quad) <= 0.9)).not.toContain(false);
	}, 60_000);

	it("finds the ten cards of the demo's sample of a photo, in perspective (9.26)", async () => {
		const cv = await loadOpenCv();
		const img = await loadImage(cardsPhotoUrl);
		const frames = detectFrames(cv, imageDataOf(img));
		expectMatches(frames, cardsPhoto, 0.02);
	}, 60_000);

	it("finds the ten demo cards in scan mode too, as rectangles turned by their angles (9.26)", async () => {
		const cv = await loadOpenCv();
		const img = await loadImage(cardsUrl);
		const frames = detectFrames(cv, imageDataOf(img), SCAN_DETECTION);
		expectMatches(frames, cards, 0.02);
	}, 60_000);

	it("finds the photos of a scanned page laid at any angle up to 45° (9.26)", async () => {
		const cv = await loadOpenCv();
		let found = 0;
		let total = 0;
		let wrong = 0;
		const report: string[] = [];
		for (const [seed, degrees] of [
			[4, 15],
			[5, -25],
			[6, 40],
			[7, -35],
		] as const) {
			// a page laid askew as a whole, its cards in their sleeves nearly aligned
			const page = await cardScan(random(seed), 0.5, degrees);
			const frames = detectFrames(cv, imageDataOf(page.image), SCAN_DETECTION);
			// in any order: a photo is found when a frame outlines it within 2 % of the diagonal
			const hits = page.truth.filter((t) =>
				frames.some(
					(f) => cornerError(f.quad, t, page.image.width, page.image.height) < 0.02,
				),
			).length;
			found += hits;
			total += page.truth.length;
			wrong += Math.max(0, frames.length - hits);
			report.push(`${degrees}°: ${hits}/${page.truth.length}, ${frames.length - hits} other`);
		}
		// the numbers recorded in STATUS.md
		console.warn(report);
		expect(found / total, report.join("; ")).toBeGreaterThanOrEqual(0.95);
		expect(wrong, report.join("; ")).toBeLessThanOrEqual(1);
	}, 60_000);

	it("reads a scan sent as a photo as a scan: the same frames in both modes", async () => {
		const cv = await loadOpenCv();
		for (const [seed, degrees] of [
			[1, 0],
			[6, 40],
		] as const) {
			const page = await cardScan(random(seed), 0.5, degrees);
			const asScan = detectFrames(cv, imageDataOf(page.image), SCAN_DETECTION);
			const asPhoto = detectFrames(cv, imageDataOf(page.image));
			expect(asPhoto.map((f) => f.quad)).toEqual(asScan.map((f) => f.quad));
		}
	}, 60_000);

	it("finds the photos of a scanned page of cards: pale, stamped, next to ruled lines", async () => {
		const cv = await loadOpenCv();
		for (const seed of [1, 2, 3]) {
			const { image, truth } = await cardScan(random(seed));
			const frames = detectFrames(cv, imageDataOf(image), SCAN_DETECTION);
			expectMatches(
				frames,
				{ width: image.width, height: image.height, frames: truth },
				0.02,
			);
		}
	}, 60_000);
});

/**
 * A scanned page of school cards (synthetic, the layout of real ones): eight white cards a little
 * askew on the scanner's glass, each with an ID photo on a pale background (a white shirt against
 * the card sometimes), ruled lines with handwriting beside it, printed lines under it and a round
 * stamp across the photo's corner; saved as a JPEG. The photos' corners are the truth.
 */
async function cardScan(
	next: () => number,
	/** How far each card lies askew, in degrees either way. */
	askew = 1.5,
	/** The angle of the whole page on the glass, in degrees (the cards about its middle). */
	page = 0,
): Promise<{ image: HTMLImageElement; truth: Quad[] }> {
	const turn = (page * Math.PI) / 180;
	const pageW = 1163;
	const pageH = 1600;
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(pageW * Math.abs(Math.cos(turn)) + pageH * Math.abs(Math.sin(turn)));
	canvas.height = Math.round(pageW * Math.abs(Math.sin(turn)) + pageH * Math.abs(Math.cos(turn)));
	const ctx = canvas.getContext("2d")!;
	ctx.fillStyle = "rgb(246, 246, 244)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	const truth: Quad[] = [];
	const cardW = 520;
	const cardH = 310;
	const photo = { x: 24, y: 22, w: 150, h: 196 };
	for (let row = 0; row < 4; row++) {
		for (let column = 0; column < 2; column++) {
			const px = 40 + column * 560 + cardW / 2 + (next() - 0.5) * 30 - pageW / 2;
			const py = 40 + row * 390 + cardH / 2 + (next() - 0.5) * 30 - pageH / 2;
			const cx = canvas.width / 2 + px * Math.cos(turn) - py * Math.sin(turn);
			const cy = canvas.height / 2 + px * Math.sin(turn) + py * Math.cos(turn);
			const angle = turn + ((next() - 0.5) * 2 * askew * Math.PI) / 180;
			ctx.save();
			ctx.translate(cx, cy);
			ctx.rotate(angle);
			ctx.translate(-cardW / 2, -cardH / 2);
			ctx.fillStyle = "rgb(252, 252, 250)";
			ctx.fillRect(0, 0, cardW, cardH);
			ctx.strokeStyle = "rgb(205, 205, 205)";
			ctx.lineWidth = 1.5;
			ctx.strokeRect(0, 0, cardW, cardH);
			// the photo: a pale studio background, hair, a face, a shirt (a print's white, darker
			// than the card's)
			const grey = 226 + Math.floor(next() * 10);
			ctx.fillStyle = `rgb(${grey}, ${grey}, ${grey + 2})`;
			ctx.fillRect(photo.x, photo.y, photo.w, photo.h);
			const shirt =
				next() < 0.4 ? "rgb(236, 236, 236)" : pick(next, ["#b91c1c", "#1e3a8a", "#475569"]);
			ctx.fillStyle = shirt;
			ctx.fillRect(photo.x + 20, photo.y + photo.h * 0.72, photo.w - 40, photo.h * 0.28);
			ctx.fillStyle = pick(next, ["rgb(60, 40, 25)", "rgb(120, 80, 40)", "rgb(30, 25, 20)"]);
			ctx.beginPath();
			ctx.ellipse(photo.x + photo.w / 2, photo.y + 80, 52, 62, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "rgb(236, 200, 172)";
			ctx.beginPath();
			ctx.ellipse(photo.x + photo.w / 2, photo.y + 95, 38, 48, 0, 0, Math.PI * 2);
			ctx.fill();
			// a glued print shows its outline on a scan, faint where a white shirt meets the card
			ctx.strokeStyle = "rgb(222, 222, 222)";
			ctx.lineWidth = 1;
			ctx.strokeRect(photo.x, photo.y, photo.w, photo.h);
			// ruled lines with handwriting, printed lines under the photo
			ctx.strokeStyle = "rgb(110, 110, 110)";
			ctx.lineWidth = 1.5;
			for (const y of [60, 100, 140, 180, 220]) {
				ctx.beginPath();
				ctx.moveTo(200, y);
				ctx.lineTo(cardW - 20, y);
				ctx.stroke();
			}
			ctx.strokeStyle = "rgb(40, 50, 120)";
			ctx.lineWidth = 2.5;
			for (const y of [60, 100, 140, 180]) {
				let x = 215 + next() * 20;
				while (x < cardW - 60) {
					const w = 10 + next() * 14;
					ctx.beginPath();
					ctx.moveTo(x, y - 4);
					ctx.lineTo(x + w * 0.5, y - 22);
					ctx.lineTo(x + w, y - 4);
					ctx.stroke();
					x += w + 6;
				}
			}
			ctx.fillStyle = "rgb(70, 70, 70)";
			for (const y of [238, 252, 266]) {
				for (let x = photo.x; x < photo.x + 170; x += 9) {
					ctx.fillRect(x, y, 6, 5);
				}
			}
			// the stamp across the photo's bottom-right corner
			ctx.strokeStyle = "rgb(55, 55, 65)";
			ctx.lineWidth = 3;
			for (const r of [52, 40]) {
				ctx.beginPath();
				ctx.arc(photo.x + photo.w + 10, photo.y + photo.h - 15, r, 0, Math.PI * 2);
				ctx.stroke();
			}
			ctx.restore();
			const corner = (x: number, y: number): { x: number; y: number } => {
				const dx = x - cardW / 2;
				const dy = y - cardH / 2;
				return {
					x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
					y: cy + dx * Math.sin(angle) + dy * Math.cos(angle),
				};
			};
			truth.push([
				corner(photo.x, photo.y),
				corner(photo.x + photo.w, photo.y),
				corner(photo.x + photo.w, photo.y + photo.h),
				corner(photo.x, photo.y + photo.h),
			]);
		}
	}
	const blob = await new Promise<Blob>((resolve) =>
		canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85),
	);
	const image = await loadImage(URL.createObjectURL(blob));
	return { image, truth };
}

/** Small seeded generator (mulberry32). */
function random(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const pick = <T>(next: () => number, list: readonly T[]): T =>
	list[Math.floor(next() * list.length)]!;

/** Applies the 3 × 3 homography `h` (row-major) to a point. */
function project(h: Float64Array, p: { x: number; y: number }): { x: number; y: number } {
	const w = h[6]! * p.x + h[7]! * p.y + h[8]!;
	return {
		x: (h[0]! * p.x + h[1]! * p.y + h[2]!) / w,
		y: (h[3]! * p.x + h[4]! * p.y + h[5]!) / w,
	};
}

interface Scene {
	image: HTMLImageElement;
	truth: Quad[];
	label: string;
}

/**
 * A printed sheet of portraits as a phone would see it: tiles on a page (studio gradients, plain
 * colours, a white border sometimes), the page on a table (plain, coloured, wood grain, noise),
 * rotated and foreshortened, a shadow across, saved as a JPEG.
 */
async function scene(cv: CvModule, next: () => number): Promise<Scene> {
	const columns = 1 + Math.floor(next() * 7);
	const rows = Math.max(1, Math.min(6, Math.round((2 + next() * 38) / columns)));
	const count = columns * rows < 2 ? 2 : columns * rows;
	const cols = count === 2 && columns * rows < 2 ? 2 : columns;
	const tileW = 70 + Math.floor(next() * 90);
	// ID photos and school portraits: 1.29 (35 × 45 mm) to 1.33 (3:4); cards a little squarer
	const tileH = Math.round(tileW * (1.15 + next() * 0.25));
	const gap = 14 + Math.floor(next() * 40);
	const bordered = next() < 0.3;
	const pageW = 60 + cols * tileW + (cols - 1) * gap;
	const pageH = 60 + rows * tileH + (rows - 1) * gap;
	const W = Math.round(pageW * 1.35);
	const H = Math.round(pageH * 1.35);
	const flat = document.createElement("canvas");
	flat.width = W;
	flat.height = H;
	const ctx = flat.getContext("2d")!;
	// the table
	const table = pick(next, ["plain", "colour", "wood", "noise"] as const);
	ctx.fillStyle =
		table === "plain"
			? "rgb(120, 120, 125)"
			: table === "colour"
				? pick(next, ["rgb(40, 70, 120)", "rgb(150, 60, 50)", "rgb(60, 110, 70)"])
				: table === "wood"
					? "rgb(150, 100, 62)"
					: "rgb(110, 105, 100)";
	ctx.fillRect(0, 0, W, H);
	if (table === "wood") {
		for (let g = 0; g < W; g += 7) {
			ctx.strokeStyle = g % 14 === 0 ? "rgba(90, 55, 30, 0.35)" : "rgba(200, 150, 100, 0.25)";
			ctx.beginPath();
			for (let y = 0; y <= H; y += 12) {
				const x = g + 3 * Math.sin(y / 41 + g);
				if (y === 0) {
					ctx.moveTo(x, y);
				} else {
					ctx.lineTo(x, y);
				}
			}
			ctx.stroke();
		}
	}
	if (table === "noise") {
		const data = ctx.getImageData(0, 0, W, H);
		for (let i = 0; i < data.data.length; i += 4) {
			const n = (next() - 0.5) * 50;
			data.data[i] = data.data[i]! + n;
			data.data[i + 1] = data.data[i + 1]! + n;
			data.data[i + 2] = data.data[i + 2]! + n;
		}
		ctx.putImageData(data, 0, 0);
	}
	// the page and the tiles
	const ox = (W - pageW) / 2;
	const oy = (H - pageH) / 2;
	ctx.fillStyle = pick(next, ["rgb(250, 250, 248)", "rgb(240, 236, 225)"]);
	ctx.fillRect(ox, oy, pageW, pageH);
	const flatTruth: Quad[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = ox + 30 + c * (tileW + gap);
			const y = oy + 30 + r * (tileH + gap);
			if (bordered) {
				ctx.fillStyle = "white";
				ctx.fillRect(x - 6, y - 6, tileW + 12, tileH + 12);
			}
			const style = next();
			if (style < 0.5) {
				// a studio backdrop: blue-grey gradient
				const g = ctx.createLinearGradient(x, y, x + tileW, y + tileH);
				g.addColorStop(0, "rgb(120, 140, 170)");
				g.addColorStop(1, "rgb(60, 75, 105)");
				ctx.fillStyle = g;
			} else {
				ctx.fillStyle = pick(next, [
					"#3b82f6",
					"#facc15",
					"#22c55e",
					"#ec4899",
					"#8b5cf6",
					"#14b8a6",
					"#9ca3af",
				]);
			}
			ctx.fillRect(x, y, tileW, tileH);
			ctx.fillStyle = pick(next, [
				"rgb(240, 200, 170)",
				"rgb(170, 120, 90)",
				"rgb(110, 75, 50)",
			]);
			ctx.beginPath();
			ctx.arc(x + tileW / 2, y + tileH * 0.42, tileW * 0.27, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = pick(next, [
				"rgb(40, 30, 20)",
				"rgb(200, 160, 60)",
				"rgb(120, 60, 30)",
			]);
			ctx.fillRect(x + tileW * 0.24, y + tileH * 0.12, tileW * 0.52, tileH * 0.1);
			ctx.fillStyle = pick(next, [
				"rgb(250, 250, 250)",
				"rgb(200, 40, 40)",
				"rgb(30, 30, 30)",
			]);
			ctx.fillRect(x + tileW * 0.15, y + tileH * 0.8, tileW * 0.7, tileH * 0.2);
			flatTruth.push([
				{ x, y },
				{ x: x + tileW, y },
				{ x: x + tileW, y: y + tileH },
				{ x, y: y + tileH },
			]);
		}
	}
	// rotation and perspective: the page corners move, a homography carries everything
	const angle = ((next() - 0.5) * 20 * Math.PI) / 180;
	const cx = W / 2;
	const cy = H / 2;
	const jitter = 0.05 * Math.min(W, H);
	const corners = [
		{ x: 0, y: 0 },
		{ x: W, y: 0 },
		{ x: W, y: H },
		{ x: 0, y: H },
	].map((p) => {
		const dx = p.x - cx;
		const dy = p.y - cy;
		return {
			x: cx + dx * Math.cos(angle) - dy * Math.sin(angle) + (next() - 0.5) * 2 * jitter,
			y: cy + dx * Math.sin(angle) + dy * Math.cos(angle) + (next() - 0.5) * 2 * jitter,
		};
	});
	const from = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W, 0, W, H, 0, H]);
	const to = cv.matFromArray(
		4,
		1,
		cv.CV_32FC2,
		corners.flatMap((p) => [p.x, p.y]),
	);
	const matrix = cv.getPerspectiveTransform(from, to);
	const h = Float64Array.from(matrix.data64F);
	const src = cv.imread(flat);
	const dst = new cv.Mat();
	const out = document.createElement("canvas");
	out.width = W;
	out.height = H;
	try {
		cv.warpPerspective(
			src,
			dst,
			matrix,
			new cv.Size(W, H),
			cv.INTER_LINEAR,
			cv.BORDER_REPLICATE,
		);
		cv.imshow(out, dst);
	} finally {
		for (const m of [from, to, matrix, src, dst]) {
			m.delete();
		}
	}
	// a shadow across part of the picture
	const shade = out.getContext("2d")!;
	const shadow = next() * 0.35;
	const g = shade.createLinearGradient(0, 0, W, H * next());
	g.addColorStop(0, `rgba(0, 0, 0, ${shadow})`);
	g.addColorStop(0.6, "rgba(0, 0, 0, 0)");
	shade.fillStyle = g;
	shade.fillRect(0, 0, W, H);
	const image = await loadImage(out.toDataURL("image/jpeg", 0.75));
	return {
		image,
		truth: flatTruth.map((q) => q.map((p) => project(h, p)) as Quad),
		label: `${cols}×${rows} ${table}${bordered ? " bordered" : ""} ${((angle * 180) / Math.PI).toFixed(1)}° shadow ${shadow.toFixed(2)}`,
	};
}

describe("detectFrames on synthetic phone pictures (benchmark)", () => {
	it("finds at least 95 % of the frames with at most 2 % false ones", async () => {
		const cv = await loadOpenCv();
		const next = random(20261005);
		let frames = 0;
		let found = 0;
		let falseFrames = 0;
		let detected = 0;
		const misses: string[] = [];
		for (let i = 0; i < 40; i++) {
			const s = await scene(cv, next);
			const result = detectFrames(cv, imageDataOf(s.image));
			const diagonal = Math.hypot(s.image.naturalWidth, s.image.naturalHeight);
			const matched = new Set<number>();
			for (const f of result) {
				const hit = s.truth.findIndex(
					(t, k) =>
						!matched.has(k) &&
						cornerError(f.quad, t, s.image.naturalWidth, s.image.naturalHeight) *
							diagonal <=
							0.02 * diagonal,
				);
				if (hit >= 0) {
					matched.add(hit);
				} else {
					falseFrames++;
				}
			}
			frames += s.truth.length;
			found += matched.size;
			detected += result.length;
			if (matched.size < s.truth.length || result.length > matched.size) {
				misses.push(
					`${s.label}: ${matched.size}/${s.truth.length}, ${result.length - matched.size} false`,
				);
			}
		}
		// the numbers recorded in STATUS.md
		console.warn(
			`frames benchmark: ${found}/${frames} found (${((100 * found) / frames).toFixed(1)} %), ${falseFrames} false of ${detected}`,
			misses,
		);
		expect(found / frames).toBeGreaterThanOrEqual(0.95);
		expect(falseFrames / Math.max(1, detected)).toBeLessThanOrEqual(0.02);
	}, 180_000);

	it("detects a 12 MP picture in under a second", async () => {
		const cv = await loadOpenCv();
		const img = await loadImage(cardsUrl);
		const big = document.createElement("canvas");
		big.width = 3000;
		big.height = 4000;
		big.getContext("2d")!.drawImage(img, 0, 0, 3000, 4000);
		const data = imageDataOf(big);
		const started = performance.now();
		const frames = detectFrames(cv, data);
		const elapsed = performance.now() - started;
		// the numbers recorded in STATUS.md
		console.warn(`frames: 12 MP picture in ${elapsed.toFixed(0)} ms`);
		expect(frames).toHaveLength(10);
		expect(elapsed).toBeLessThan(1000);
	}, 60_000);
});
