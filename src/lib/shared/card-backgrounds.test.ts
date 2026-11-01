// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	BACKGROUND_BLEED_MM,
	BLEED_BACKGROUND_SIZE,
	bleedPictureStyle,
	cardBackgroundAsset,
	isCardBackgroundAsset,
} from "./card-backgrounds.js";

describe("shipped card backgrounds", () => {
	it("names the copy in assets/ and recognises it", () => {
		expect(cardBackgroundAsset("d4")).toBe("background-d4.webp");
		expect(isCardBackgroundAsset(cardBackgroundAsset("h-5"))).toBe(true);
		expect(isCardBackgroundAsset("logo.png")).toBe(false);
		expect(isCardBackgroundAsset("background-D4.webp")).toBe(false);
		expect(isCardBackgroundAsset("background-d4.png")).toBe(false);
		expect(isCardBackgroundAsset(null)).toBe(false);
	});

	it("sizes the picture with its bleed on both sides", () => {
		expect(BACKGROUND_BLEED_MM).toBe(3);
		expect(BLEED_BACKGROUND_SIZE).toBe("calc(100% + 6mm) calc(100% + 6mm)");
		// a 100 × 50 mm card: the picture 106 mm wide, 3 mm to the left and above
		expect(bleedPictureStyle(100, 50)).toBe("width: 106%; left: -3%; top: -6%");
	});
});
