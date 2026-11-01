// SPDX-License-Identifier: GPL-3.0-or-later
// A generator of text chunks as a byte stream for a download (step 7.3): chunks are gathered up
// to 64 KB per read, so large exports never sit in memory as a whole.
export function textStream(
	chunks: Iterator<string>,
	batchBytes = 65_536,
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			let text = "";
			while (text.length < batchBytes) {
				const next = chunks.next();
				if (next.done) {
					if (text) {
						controller.enqueue(encoder.encode(text));
					}
					controller.close();
					return;
				}
				text += next.value;
			}
			controller.enqueue(encoder.encode(text));
		},
	});
}
