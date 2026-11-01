// SPDX-License-Identifier: GPL-3.0-or-later
// A class picture before it is sent (PLAN.md step 13.3): drawn upright (the orientation a phone
// camera writes in the EXIF data is applied by the browser) and scaled so its longest side is at
// most `maxPixels`, then encoded as JPEG. The server checks and re-encodes it again; the frames'
// corners are measured on the picture the server stores.

/** The size of a picture scaled to fit `maxPixels` on its longest side (never enlarged). */
export function fitSize(
	width: number,
	height: number,
	maxPixels: number,
): { width: number; height: number } {
	const scale = Math.min(1, maxPixels / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

/** The picture upright and scaled, as a JPEG blob (quality 0.92). */
export async function uprightJpeg(file: Blob, maxPixels: number): Promise<Blob> {
	const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	try {
		const { width, height } = fitSize(bitmap.width, bitmap.height, maxPixels);
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("no 2d context");
		}
		ctx.drawImage(bitmap, 0, 0, width, height);
		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(blob) =>
					blob ? resolve(blob) : reject(new Error("the picture cannot be encoded")),
				"image/jpeg",
				0.92,
			);
		});
	} finally {
		bitmap.close();
	}
}

/**
 * A photo or a file as a decoded image element. Its object URL is released as soon as the image
 * has loaded (the element stays drawable), so a run of shots does not keep every blob alive.
 */
export async function loadImage(blob: Blob): Promise<HTMLImageElement> {
	const url = URL.createObjectURL(blob);
	const img = new Image();
	try {
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error("image"));
			img.src = url;
		});
	} finally {
		URL.revokeObjectURL(url);
	}
	return img;
}

/** The pixels of an image element, for the frame detection. */
export function imageDataOf(img: HTMLImageElement): ImageData {
	const canvas = document.createElement("canvas");
	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) {
		throw new Error("no 2d context");
	}
	ctx.drawImage(img, 0, 0);
	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
