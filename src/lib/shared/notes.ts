// SPDX-License-Identifier: GPL-3.0-or-later
// The staff notes ("Segnalazioni", PLAN.md step 9.18, Q113), shared by the pages and the server:
// the post-it colours a note can have and the length of its text.

/** The post-it colours, the first one the default; decoration only, the same in every colour set. */
export const NOTE_COLORS = ["yellow", "pink", "green", "blue", "orange"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_MAX_LENGTH = 500;

export function isNoteColor(value: unknown): value is NoteColor {
	return typeof value === "string" && (NOTE_COLORS as readonly string[]).includes(value);
}
