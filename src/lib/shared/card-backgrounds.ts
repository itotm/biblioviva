// SPDX-License-Identifier: GPL-3.0-or-later
// The backgrounds shipped for the cards (PLAN.md step 11.17): each picture in
// `config/cards/backgrounds/` is the card plus `BACKGROUND_BLEED_MM` on every side, to be cut away;
// copied into a template's `assets/` it takes the name `background-<name>.webp`, and a face shows
// it larger than the face by the bleed on both sides. Shared by the server, the designer and its
// gallery.

/** How far a shipped card background runs past the card on every side. */
export const BACKGROUND_BLEED_MM = 3;

/** The size of a background with bleed: the face and the bleed on both sides, centred on it. */
export const BLEED_BACKGROUND_SIZE = `calc(100% + ${2 * BACKGROUND_BLEED_MM}mm) calc(100% + ${2 * BACKGROUND_BLEED_MM}mm)`;

/** The name of a shipped background (`backgrounds.json`, the file `<name>.webp`). */
export const BACKGROUND_NAME = /^[a-z0-9-]{1,40}$/;

/** The file a shipped background takes in a template's `assets/`. */
export const cardBackgroundAsset = (name: string): string => `background-${name}.webp`;

/** A file of `assets/` that is a shipped background (its picture carries the bleed). */
export function isCardBackgroundAsset(asset: string | null): boolean {
	const m = /^background-(.+)\.webp$/.exec(asset ?? "");
	return m !== null && BACKGROUND_NAME.test(m[1] ?? "");
}

/**
 * Where a shipped background's picture goes over a card of `widthMm` × `heightMm` to show it cut
 * as on the card: its width and offsets, in % of the card, as CSS of an absolutely placed image.
 */
export function bleedPictureStyle(widthMm: number, heightMm: number): string {
	const b = BACKGROUND_BLEED_MM;
	return `width: ${(100 * (widthMm + 2 * b)) / widthMm}%; left: ${(-100 * b) / widthMm}%; top: ${(-100 * b) / heightMm}%`;
}
