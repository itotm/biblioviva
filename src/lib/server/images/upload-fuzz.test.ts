// SPDX-License-Identifier: GPL-3.0-or-later
// Upload fuzzing (PLAN.md step 9.1): whatever arrives as a photo, a cover, the logo or a pictogram
// is decoded by the image library with a pixel cap and re-encoded; anything else is refused with a
// readable code, never stored as it came.
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { encodeCover } from "#lib/server/services/covers.js";
import { encodePhoto, MediaError } from "#lib/server/services/media.js";
import { encodePng } from "./png.js";

const photo = {
	width: 120,
	height: 160,
	format: "jpeg" as const,
	quality: 80,
	maxUploadBytes: 5_000_000,
};
const cover = {
	width: 120,
	maxHeight: null,
	format: "jpeg" as const,
	quality: 80,
	maxUploadBytes: 5_000_000,
};

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	out.set(new TextEncoder().encode(type), 4);
	out.set(data, 8);
	view.setUint32(8 + data.length, Bun.hash.crc32(out.subarray(4, 8 + data.length)));
	return out;
}

/** A PNG whose header claims `width × height`; the pixels are a zero-filled block (a "bomb"). */
function png(width: number, height: number, rows = height): Uint8Array {
	const ihdr = new Uint8Array(13);
	const v = new DataView(ihdr.buffer);
	v.setUint32(0, width);
	v.setUint32(4, height);
	ihdr.set([8, 0, 0, 0, 0], 8); // 8-bit greyscale
	const raw = new Uint8Array((width + 1) * Math.min(rows, height));
	const idat = new Uint8Array(deflateSync(raw));
	const parts = [
		new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", idat),
		chunk("IEND", new Uint8Array()),
	];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
}

const text = (s: string): Uint8Array => new TextEncoder().encode(s);
const SVG = text(
	'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
);
const HTML = text("<html><body><script>alert(1)</script></body></html>");
const RANDOM = new Uint8Array(4096).map((_, i) => (i * 7919) % 251);

async function codeOf(p: Promise<unknown>): Promise<string> {
	try {
		await p;
		return "accepted";
	} catch (e) {
		return e instanceof MediaError ? e.code : String(e);
	}
}

describe("upload fuzzing", () => {
	it("re-encodes a real image and refuses what is not one", async () => {
		const ok = png(20, 30);
		expect(await codeOf(encodePhoto(ok, photo))).toBe("accepted");
		expect(await codeOf(encodeCover(ok, cover))).toBe("accepted");
		for (const bad of [SVG, HTML, RANDOM, text("GIF89a"), new Uint8Array([0xff, 0xd8, 0xff])]) {
			expect(await codeOf(encodePhoto(bad, photo))).toMatch(
				/not_an_image|unsupported_format/,
			);
			expect(await codeOf(encodeCover(bad, cover))).toMatch(
				/not_an_image|unsupported_format/,
			);
			expect(await codeOf(encodePng(bad, { maxSide: 512, maxBytes: 1_000_000 }))).toMatch(
				/not_an_image|unsupported_format/,
			);
		}
		expect(await codeOf(encodePhoto(new Uint8Array(), photo))).toBe("empty");
		expect(await codeOf(encodePhoto(RANDOM, { ...photo, maxUploadBytes: 100 }))).toBe(
			"too_large",
		);
	});

	it("refuses images claiming huge dimensions before decoding them", async () => {
		// 60 000 × 60 000 claimed in the header, a few rows of data
		const huge = png(60_000, 60_000, 4);
		expect(huge.byteLength).toBeLessThan(2_000_000);
		expect(await codeOf(encodePhoto(huge, photo))).toBe("not_an_image");
		expect(await codeOf(encodeCover(huge, cover))).toBe("not_an_image");
		expect(await codeOf(encodePng(huge, { maxSide: 512, maxBytes: 5_000_000 }))).toMatch(
			/not_an_image|too_large/,
		);
	});
});
