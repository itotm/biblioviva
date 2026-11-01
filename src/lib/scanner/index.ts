// SPDX-License-Identifier: GPL-3.0-or-later
// Lazy wrapper around `barcode-detector` (ponyfill of the BarcodeDetector API, zxing-wasm inside).
// Nothing from the library is imported statically: the ~1 MB chunk loads on the first `createDetector()`.
import { ean13Valid } from "#lib/shared/isbn.js";
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import { normalizeScan, recognise, type ScanResult } from "#lib/shared/scan.js";

/** The symbologies used by the library: EAN-13 (ISBN), Code 128 (new), Code 39 (legacy). */
export const SCAN_FORMATS = ["ean_13", "ean_8", "code_128", "code_39"] as const;

export interface Detection {
	rawValue: string;
	format: string;
}

export interface Detector {
	detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | Blob): Promise<Detection[]>;
}

let wasmConfigured = false;

/**
 * Serve the ZXing WASM from our own origin (Vite asset) instead of the jsDelivr CDN that
 * zxing-wasm uses by default: the app runs inside a tailnet and must not depend on the internet.
 */
async function configureWasm(): Promise<void> {
	if (wasmConfigured) {
		return;
	}
	wasmConfigured = true;
	const [{ prepareZXingModule }, wasm] = await Promise.all([
		import("barcode-detector/ponyfill"),
		import("zxing-wasm/reader/zxing_reader.wasm?url"),
	]);
	prepareZXingModule({
		overrides: {
			locateFile: (file: string, prefix: string) =>
				file.endsWith(".wasm") ? wasm.default : `${prefix}${file}`,
		},
	});
}

export async function createDetector(): Promise<Detector> {
	await configureWasm();
	const { BarcodeDetector } = await import("barcode-detector/ponyfill");
	const detector = new BarcodeDetector({ formats: [...SCAN_FORMATS] });
	return {
		async detect(source) {
			const found = await detector.detect(source);
			return found.map((d) => ({ rawValue: d.rawValue, format: d.format }));
		},
	};
}

/**
 * Turns a raw detection into the §3.7 kinds. EAN-13 values are ISBNs only when they start with
 * 978/979; any other EAN-13 (a DVD, a product) is `ambiguous` for the caller to judge — fast add
 * takes it as the EAN of a non-book item, the desk looks it up and reports it unknown. A Code
 * 39/128 value goes through the same normalisation as scanner input.
 */
export function normaliseDetection(detection: Detection, codes: CodeTable): ScanResult {
	const value = normalizeScan(detection.rawValue, codes);
	if (detection.format === "ean_13" && !/^97[89]/.test(value)) {
		return ean13Valid(value)
			? { kind: "ambiguous", value }
			: { kind: "invalid", value, reason: "unrecognised" };
	}
	return recognise(value, codes);
}
