// SPDX-License-Identifier: GPL-3.0-or-later
// Barcode rendering (PLAN.md step 2.2): Code 128 for everything new, Code 39 kept for reprints of
// legacy labels/cards. Pure JS through @bwip-js/generic, output is an SVG string.
import { toSVG } from "@bwip-js/generic";

export type Symbology = "code128" | "code39" | "ean13";

export interface BarcodeOptions {
	symbology?: Symbology;
	/** Print the human-readable text under the bars. */
	text?: boolean;
	/** Bar height in millimetres (bwip-js units: 1 = 1 mm at scale 1). */
	heightMm?: number;
	/** Horizontal module scale (px per module in the SVG viewBox). */
	scale?: number;
}

/** Characters accepted in a barcode value (Code 39 is the most restrictive: digits, A–Z, `-`, `.`, space). */
export const BARCODE_TEXT = /^[0-9A-Za-z\-. ]{1,40}$/;

export class BarcodeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BarcodeError";
	}
}

export function renderBarcodeSvg(value: string, options: BarcodeOptions = {}): string {
	const symbology = options.symbology ?? "code128";
	if (!BARCODE_TEXT.test(value)) {
		throw new BarcodeError("unsupported characters in barcode value");
	}
	if (symbology === "code39" && !/^[0-9A-Z\-. ]+$/.test(value)) {
		throw new BarcodeError('Code 39 supports digits, capital letters, "-", "." and space only');
	}
	if (symbology === "ean13" && !/^\d{12,13}$/.test(value)) {
		throw new BarcodeError("EAN-13 needs 12 or 13 digits");
	}
	try {
		return toSVG({
			bcid: symbology,
			text: value,
			scale: options.scale ?? 2,
			height: options.heightMm ?? 10,
			includetext: options.text ?? true,
			textxalign: "center",
			textsize: 9,
			paddingwidth: 2,
			paddingheight: 1,
		});
	} catch (e) {
		throw new BarcodeError(e instanceof Error ? e.message : String(e));
	}
}
