// SPDX-License-Identifier: GPL-3.0-or-later
// The beep of a camera read (9.40): each sound renders to a buffer of its length, never silent,
// at the common peak; "off" opens no audio at all, the others play the rendered buffer.
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCAN_SOUNDS } from "#lib/shared/barcodes/scan-sounds.js";
import { playScanSound, renderScanSound, SOUND_DEFINITIONS, unlockScanSound } from "./sound.js";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("camera read sounds", () => {
	it("defines every sound of the configuration but off", () => {
		expect(Object.keys(SOUND_DEFINITIONS).sort()).toEqual(
			SCAN_SOUNDS.filter((s) => s !== "off").sort(),
		);
	});

	it.each(Object.keys(SOUND_DEFINITIONS) as (keyof typeof SOUND_DEFINITIONS)[])(
		"renders %s at the common peak, sounding through most of its length",
		async (sound) => {
			const buffer = await renderScanSound(sound);
			expect(buffer.duration).toBeCloseTo(SOUND_DEFINITIONS[sound].length, 2);
			const samples = buffer.getChannelData(0);
			let peak = 0;
			let loud = 0;
			for (const v of samples) {
				peak = Math.max(peak, Math.abs(v));
				loud += Math.abs(v) > 0.05 ? 1 : 0;
			}
			expect(peak).toBeCloseTo(0.8, 3);
			expect(loud / samples.length).toBeGreaterThan(0.25);
			// it starts at once: the read and the beep are heard together
			const first = samples.findIndex((v) => Math.abs(v) > 0.05);
			expect(first / buffer.sampleRate).toBeLessThan(0.01);
		},
	);

	it("opens no audio when the sound is off, plays the buffer otherwise", async () => {
		const started: (AudioBuffer | null)[] = [];
		const made = vi.fn();
		const connected = vi.fn();
		interface FakeSource {
			buffer: AudioBuffer | null;
			connect: () => void;
			start: () => void;
		}
		class FakeAudioContext {
			state = "suspended";
			destination = {};
			constructor() {
				made();
			}
			resume(): Promise<void> {
				this.state = "running";
				return Promise.resolve();
			}
			createBufferSource(): FakeSource {
				const source: FakeSource = {
					buffer: null,
					connect: connected,
					start: () => started.push(source.buffer),
				};
				return source;
			}
		}
		vi.stubGlobal("AudioContext", FakeAudioContext);
		unlockScanSound("off");
		await playScanSound("off");
		expect(made).not.toHaveBeenCalled();
		unlockScanSound("confirm");
		await playScanSound("confirm");
		expect(made).toHaveBeenCalledTimes(1);
		expect(started).toHaveLength(1);
		expect(started[0]?.duration).toBeCloseTo(SOUND_DEFINITIONS.confirm.length, 2);
	});
});
