// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { textStream } from "./stream.js";

function* chunks(n: number): Generator<string> {
	for (let i = 0; i < n; i++) {
		yield `riga ${i} è qui\n`;
	}
}

describe("text stream", () => {
	it("streams every chunk, gathered in batches, and closes", async () => {
		const expected = [...chunks(500)].join("");
		let reads = 0;
		const reader = textStream(chunks(500), 1000).getReader();
		const parts: Uint8Array[] = [];
		for (;;) {
			const { value, done } = await reader.read();
			if (done) {
				break;
			}
			reads++;
			parts.push(value);
		}
		expect(new TextDecoder().decode(Buffer.concat(parts))).toBe(expected);
		expect(reads).toBeGreaterThan(1);
		expect(reads).toBeLessThan(500);
		expect(await new Response(textStream(chunks(0))).text()).toBe("");
	});
});
