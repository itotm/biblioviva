// SPDX-License-Identifier: GPL-3.0-or-later
// Uploaded pictures kept as PNG (steps 4.10, 11.1): the library's logo and the classification
// pictograms. PNG, JPEG and WebP are accepted (SVG never: it can carry scripts), scaled down to
// fit `maxSide` (never up), transparency kept, metadata dropped.
import { imageWork } from "#lib/server/runtime/limit.js";
import { checkUpload } from "./store.js";

const ACCEPTED = new Set(["png", "jpeg", "webp"]);

export function encodePng(
	input: Uint8Array,
	options: { maxSide: number; maxBytes: number },
): Promise<Uint8Array> {
	// the image work of the profile, `imageConcurrency` jobs at once (step 9.28)
	return imageWork.run(async () => {
		const meta = await checkUpload(input, options.maxBytes, ACCEPTED);
		const image = new Bun.Image(input, { maxPixels: 40_000_000 });
		const scaled =
			Math.max(meta.width, meta.height) > options.maxSide
				? image.resize(options.maxSide, options.maxSide, { fit: "inside" })
				: image;
		return scaled.png().bytes();
	});
}
