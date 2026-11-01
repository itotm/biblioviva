// SPDX-License-Identifier: GPL-3.0-or-later
// Read confirmation for the camera scanner (9.13, round 8): a code counts only once it has been
// read the same way in consecutive detections. A single-frame misread passes the EAN-13 check
// digit one time in ten (an Italian book once came back as the non-ISBN 0101876694291); the same
// misread twice in a row practically never happens. Frames with no code in between do not break
// the run, a pause longer than `gapMs` does.

export interface ReadConfirmer {
	/** Records a read; true when `value` has now been read `needed` times in a row. */
	read(value: string, now: number): boolean;
}

export function createReadConfirmer(needed = 2, gapMs = 800): ReadConfirmer {
	let candidate = "";
	let hits = 0;
	let seenAt = Number.NEGATIVE_INFINITY;
	return {
		read(value, now) {
			if (value === candidate && now - seenAt < gapMs) {
				hits += 1;
			} else {
				candidate = value;
				hits = 1;
			}
			seenAt = now;
			return hits >= needed;
		},
	};
}
