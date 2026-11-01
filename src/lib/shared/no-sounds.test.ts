// SPDX-License-Identifier: GPL-3.0-or-later
// No sounds at the desk (Q40, Appendix I): no audio element, Audio object, WebAudio or speech
// synthesis anywhere in the application code (video elements of the camera are silent), except
// the beep of a camera read, drawn with Web Audio in one module (9.40, Q137).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			return name === "vendor" ? [] : files(path);
		}
		return /\.(ts|svelte|js)$/.test(name) && !/\.(test|spec)\.ts$/.test(name) ? [path] : [];
	});
}

/** The one module allowed to make a sound: the beep of a camera read. */
const SCAN_SOUND = join("src", "lib", "scanner", "sound.ts");

describe("the application makes no sound but the camera's beep", () => {
	it("has no audio element, Audio object or WebAudio call outside the beep", () => {
		const offenders = files("src").filter(
			(path) =>
				path !== SCAN_SOUND &&
				/<audio\b|new Audio\(|AudioContext|webkitAudioContext|speechSynthesis/.test(
					readFileSync(path, "utf8"),
				),
		);
		expect(offenders).toEqual([]);
	});

	it("keeps the beep in Web Audio, without audio files or speech", () => {
		const source = readFileSync(SCAN_SOUND, "utf8");
		expect(source).toMatch(/AudioContext/);
		expect(source).not.toMatch(/<audio\b|new Audio\(|speechSynthesis|\.(mp3|wav|ogg)\b/);
	});
});
