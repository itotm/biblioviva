// SPDX-License-Identifier: GPL-3.0-or-later
// Image fixtures for unit tests: a solid image of any size and format, made with Bun.Image from a
// tiny BMP (no binary files in the repository).
export async function solidImage(
	width: number,
	height: number,
	format: "png" | "jpeg" | "webp",
	shade = 200,
): Promise<Uint8Array> {
	const rowSize = Math.ceil((width * 3) / 4) * 4;
	const bmp = new Uint8Array(54 + rowSize * height);
	const view = new DataView(bmp.buffer);
	bmp.set([0x42, 0x4d]);
	view.setUint32(2, bmp.length, true);
	view.setUint32(10, 54, true);
	view.setUint32(14, 40, true);
	view.setInt32(18, width, true);
	view.setInt32(22, height, true);
	view.setUint16(26, 1, true);
	view.setUint16(28, 24, true);
	bmp.fill(shade, 54);
	const img = new Bun.Image(bmp);
	return (format === "png" ? img.png() : format === "jpeg" ? img.jpeg() : img.webp()).bytes();
}
