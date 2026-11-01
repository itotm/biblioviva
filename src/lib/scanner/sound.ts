// SPDX-License-Identifier: GPL-3.0-or-later
// The beep of a camera read (PLAN.md 9.40, Q137, ADR-041): the only sound of the application.
// Generated with Web Audio, no audio files: each sound is drawn once into a buffer, brought to
// the same peak level, and played from it. Browsers open audio only after a gesture, so the tap
// that opens the camera calls `unlockScanSound()`.

import type { ScanSound } from "#lib/shared/barcodes/scan-sounds.js";

const RATE = 48000;
const PEAK = 0.8;

/** A gain node that rises in `attack`, holds, then fades out in `release` (seconds). */
function envelope(
	ctx: BaseAudioContext,
	out: AudioNode,
	t0: number,
	[attack, hold, release]: [number, number, number],
	peak = 1,
): GainNode {
	const g = ctx.createGain();
	g.gain.setValueAtTime(0.0001, t0);
	g.gain.linearRampToValueAtTime(peak, t0 + attack);
	g.gain.setValueAtTime(peak, t0 + attack + hold);
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
	g.connect(out);
	return g;
}

function tone(
	ctx: BaseAudioContext,
	out: AudioNode,
	type: OscillatorType,
	hz: number,
	t0: number,
	seconds: number,
): void {
	const o = ctx.createOscillator();
	o.type = type;
	o.frequency.setValueAtTime(hz, t0);
	o.connect(out);
	o.start(t0);
	o.stop(t0 + seconds + 0.02);
}

interface SoundDefinition {
	/** Length of the buffer, in seconds. */
	length: number;
	build: (ctx: BaseAudioContext, out: AudioNode) => void;
}

/** The four sounds the owner chose on the mock (Q137). */
export const SOUND_DEFINITIONS: Record<Exclude<ScanSound, "off">, SoundDefinition> = {
	// the supermarket till: a sine at 2400 Hz, 90 ms
	till: {
		length: 0.12,
		build: (ctx, out) =>
			tone(ctx, envelope(ctx, out, 0, [0.003, 0.07, 0.02]), "sine", 2400, 0, 0.1),
	},
	// a handheld scanner: a square wave at 1800 Hz through a 3.5 kHz low-pass, 70 ms
	scanner: {
		length: 0.1,
		build: (ctx, out) => {
			const filter = ctx.createBiquadFilter();
			filter.type = "lowpass";
			filter.frequency.value = 3500;
			filter.connect(out);
			tone(
				ctx,
				envelope(ctx, filter, 0, [0.002, 0.055, 0.015], 0.6),
				"square",
				1800,
				0,
				0.08,
			);
		},
	},
	// two triangle notes rising a fifth, 660 → 990 Hz
	confirm: {
		length: 0.2,
		build: (ctx, out) => {
			tone(ctx, envelope(ctx, out, 0, [0.004, 0.05, 0.02]), "triangle", 660, 0, 0.08);
			tone(ctx, envelope(ctx, out, 0.075, [0.004, 0.05, 0.06]), "triangle", 990, 0.075, 0.12);
		},
	},
	// three triangle notes rising, C6 E6 G6
	arpeggio: {
		length: 0.32,
		build: (ctx, out) => {
			[1047, 1319, 1568].forEach((hz, i) => {
				const t = i * 0.055;
				const last = i === 2;
				tone(
					ctx,
					envelope(ctx, out, t, [0.003, 0.03, last ? 0.16 : 0.03]),
					"triangle",
					hz,
					t,
					last ? 0.2 : 0.07,
				);
			});
		},
	},
};

/** The sound drawn into a buffer and brought to the common peak. */
export async function renderScanSound(sound: Exclude<ScanSound, "off">): Promise<AudioBuffer> {
	const definition = SOUND_DEFINITIONS[sound];
	const ctx = new OfflineAudioContext(1, Math.ceil(RATE * definition.length), RATE);
	definition.build(ctx, ctx.destination);
	const buffer = await ctx.startRendering();
	const samples = buffer.getChannelData(0);
	let peak = 0;
	for (const v of samples) {
		peak = Math.max(peak, Math.abs(v));
	}
	if (peak > 0) {
		for (let i = 0; i < samples.length; i++) {
			samples[i] = ((samples[i] ?? 0) * PEAK) / peak;
		}
	}
	return buffer;
}

let live: AudioContext | null = null;
const buffers = new Map<ScanSound, Promise<AudioBuffer>>();

function buffer(sound: Exclude<ScanSound, "off">): Promise<AudioBuffer> {
	let b = buffers.get(sound);
	if (!b) {
		b = renderScanSound(sound);
		buffers.set(sound, b);
	}
	return b;
}

/**
 * Opens the audio of the page and prepares the sound; called by the tap that opens the camera
 * (a browser opens audio only during a gesture). Does nothing when the sound is off or the
 * browser has no Web Audio.
 */
export function unlockScanSound(sound: ScanSound): void {
	if (sound === "off" || typeof AudioContext === "undefined") {
		return;
	}
	live ??= new AudioContext();
	if (live.state === "suspended") {
		void live.resume().catch(() => undefined); // no audio: the read still shows and vibrates
	}
	void buffer(sound).catch(() => undefined);
}

/** Plays the sound of a taken read (silently nothing when off or when audio is not open). */
export async function playScanSound(sound: ScanSound): Promise<void> {
	if (sound === "off" || typeof AudioContext === "undefined") {
		return;
	}
	live ??= new AudioContext();
	if (live.state === "suspended") {
		await live.resume().catch(() => undefined);
	}
	const source = live.createBufferSource();
	source.buffer = await buffer(sound);
	source.connect(live.destination);
	source.start();
}
