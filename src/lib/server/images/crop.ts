// SPDX-License-Identifier: GPL-3.0-or-later
// Server-side image encoding with a centre crop (PLAN.md step 3.11). `Bun.Image` resizes and
// encodes but cannot crop, so the crop is done here without new dependencies: scale to the
// smallest size that covers the target, have `Bun.Image` write an uncompressed PNG, decode it with
// `node:zlib`, cut the centre and hand a 24-bit BMP back to `Bun.Image` for the final format.
import { inflateSync } from "node:zlib";

export type ImageFormat = "jpeg" | "webp";

export class ImageDecodeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ImageDecodeError";
	}
}

export interface RgbImage {
	width: number;
	height: number;
	/** 3 bytes per pixel, rows top to bottom. */
	rgb: Uint8Array;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function paeth(a: number, b: number, c: number): number {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decodes an 8-bit, non-interlaced PNG of colour type 0, 2, 4 or 6 into RGB (alpha over white). */
export function decodePng(bytes: Uint8Array): RgbImage {
	if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
		throw new ImageDecodeError("not a PNG");
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 8;
	let width = 0;
	let height = 0;
	let colourType = -1;
	const idat: Uint8Array[] = [];
	while (offset + 8 <= bytes.length) {
		const length = view.getUint32(offset);
		const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
		const data = bytes.subarray(offset + 8, offset + 8 + length);
		if (type === "IHDR") {
			width = view.getUint32(offset + 8);
			height = view.getUint32(offset + 12);
			const depth = data[8];
			colourType = data[9] ?? -1;
			if (depth !== 8 || data[12] !== 0) {
				throw new ImageDecodeError("only 8-bit non-interlaced PNG is supported");
			}
		} else if (type === "IDAT") {
			idat.push(data);
		} else if (type === "IEND") {
			break;
		}
		offset += 12 + length;
	}
	const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colourType];
	if (!channels || width === 0 || height === 0) {
		throw new ImageDecodeError(`unsupported PNG colour type ${colourType}`);
	}
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * channels;
	if (raw.length < (stride + 1) * height) {
		throw new ImageDecodeError("truncated PNG data");
	}
	const pixels = new Uint8Array(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)] ?? -1;
		const src = y * (stride + 1) + 1;
		const row = y * stride;
		const prev = row - stride;
		for (let x = 0; x < stride; x++) {
			const value = raw[src + x] ?? 0;
			const left = x >= channels ? (pixels[row + x - channels] ?? 0) : 0;
			const up = y > 0 ? (pixels[prev + x] ?? 0) : 0;
			const upLeft = y > 0 && x >= channels ? (pixels[prev + x - channels] ?? 0) : 0;
			let out: number;
			switch (filter) {
				case 0:
					out = value;
					break;
				case 1:
					out = value + left;
					break;
				case 2:
					out = value + up;
					break;
				case 3:
					out = value + Math.floor((left + up) / 2);
					break;
				case 4:
					out = value + paeth(left, up, upLeft);
					break;
				default:
					throw new ImageDecodeError(`unknown PNG filter ${String(filter)}`);
			}
			pixels[row + x] = out & 0xff;
		}
	}
	const rgb = new Uint8Array(width * height * 3);
	for (let i = 0; i < width * height; i++) {
		const p = i * channels;
		const grey = channels <= 2;
		let r = pixels[p] ?? 0;
		let g = grey ? r : (pixels[p + 1] ?? 0);
		let b = grey ? r : (pixels[p + 2] ?? 0);
		const alpha = channels === 2 ? pixels[p + 1] : channels === 4 ? pixels[p + 3] : 255;
		if (alpha !== undefined && alpha < 255) {
			// transparent areas become white, as on paper
			const a = alpha / 255;
			r = Math.round(r * a + 255 * (1 - a));
			g = Math.round(g * a + 255 * (1 - a));
			b = Math.round(b * a + 255 * (1 - a));
		}
		rgb[i * 3] = r;
		rgb[i * 3 + 1] = g;
		rgb[i * 3 + 2] = b;
	}
	return { width, height, rgb };
}

/** The centre `width × height` of an image (both not larger than the source). */
export function cropCentre(image: RgbImage, width: number, height: number): RgbImage {
	const w = Math.min(width, image.width);
	const h = Math.min(height, image.height);
	const left = Math.floor((image.width - w) / 2);
	const top = Math.floor((image.height - h) / 2);
	const rgb = new Uint8Array(w * h * 3);
	for (let y = 0; y < h; y++) {
		const from = ((top + y) * image.width + left) * 3;
		rgb.set(image.rgb.subarray(from, from + w * 3), y * w * 3);
	}
	return { width: w, height: h, rgb };
}

/** A 24-bit bottom-up BMP, the simplest input `Bun.Image` decodes. */
export function encodeBmp(image: RgbImage): Uint8Array {
	const rowSize = Math.ceil((image.width * 3) / 4) * 4;
	const size = 54 + rowSize * image.height;
	const out = new Uint8Array(size);
	const view = new DataView(out.buffer);
	out[0] = 0x42;
	out[1] = 0x4d;
	view.setUint32(2, size, true);
	view.setUint32(10, 54, true);
	view.setUint32(14, 40, true);
	view.setInt32(18, image.width, true);
	view.setInt32(22, image.height, true);
	view.setUint16(26, 1, true);
	view.setUint16(28, 24, true);
	view.setUint32(34, rowSize * image.height, true);
	for (let y = 0; y < image.height; y++) {
		const dest = 54 + (image.height - 1 - y) * rowSize;
		for (let x = 0; x < image.width; x++) {
			const s = (y * image.width + x) * 3;
			out[dest + x * 3] = image.rgb[s + 2] ?? 0;
			out[dest + x * 3 + 1] = image.rgb[s + 1] ?? 0;
			out[dest + x * 3 + 2] = image.rgb[s] ?? 0;
		}
	}
	return out;
}

function encoded(image: Bun.Image, format: ImageFormat, quality: number): Bun.Image {
	return format === "jpeg" ? image.jpeg({ quality }) : image.webp({ quality });
}

export interface EncodeOptions {
	width: number;
	height: number;
	format: ImageFormat;
	quality: number;
	maxPixels?: number;
}

/**
 * Exactly `width × height`: scaled to cover the target and cropped at the centre (no crop when the
 * proportions already match, as with the images the browser has cropped).
 */
export async function encodeCropped(
	input: Uint8Array,
	options: EncodeOptions,
): Promise<Uint8Array> {
	const maxPixels = options.maxPixels ?? 40_000_000;
	const meta = await new Bun.Image(input, { maxPixels }).metadata();
	const scale = Math.max(options.width / meta.width, options.height / meta.height);
	const coverW = Math.max(options.width, Math.round(meta.width * scale));
	const coverH = Math.max(options.height, Math.round(meta.height * scale));
	if (coverW === options.width && coverH === options.height) {
		return encoded(
			new Bun.Image(input, { maxPixels }).resize(options.width, options.height, {
				fit: "fill",
			}),
			options.format,
			options.quality,
		).bytes();
	}
	const png = await new Bun.Image(input, { maxPixels })
		.resize(coverW, coverH, { fit: "fill" })
		.png({ compressionLevel: 0 })
		.bytes();
	const bmp = encodeBmp(cropCentre(decodePng(png), options.width, options.height));
	return encoded(new Bun.Image(bmp), options.format, options.quality).bytes();
}

/** File extension and MIME type of a format, and the MIME type of a stored file by its name. */
export const IMAGE_EXTENSION: Record<ImageFormat, string> = { jpeg: "jpg", webp: "webp" };

export function imageMimeOf(path: string): string {
	return /\.jpe?g$/i.test(path)
		? "image/jpeg"
		: /\.png$/i.test(path)
			? "image/png"
			: "image/webp";
}
