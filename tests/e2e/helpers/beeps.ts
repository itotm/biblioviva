// SPDX-License-Identifier: GPL-3.0-or-later
// The beeps of the camera (9.40) counted in the page: every sound started through Web Audio.
import type { Page } from "@playwright/test";

/** Counts every sound the page starts from now on (call before `goto`). */
export async function countBeeps(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const w = window as unknown as { beeps: number };
		w.beeps = 0;
		const proto = AudioBufferSourceNode.prototype;
		const start = Object.getOwnPropertyDescriptor(proto, "start")?.value as (
			this: AudioBufferSourceNode,
			...args: unknown[]
		) => void;
		proto.start = function (this: AudioBufferSourceNode, ...args: unknown[]): void {
			w.beeps += 1;
			start.apply(this, args);
		};
	});
}

/** The sounds started so far. */
export function beeps(page: Page): Promise<number> {
	return page.evaluate(() => (window as unknown as { beeps: number }).beeps);
}
