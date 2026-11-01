// SPDX-License-Identifier: GPL-3.0-or-later
// The sounds a camera read can make (`barcodes.cameraSound`, PLAN.md 9.40, Q137): none or one of
// the four the owner chose; `#lib/scanner/sound.ts` draws them.
export const SCAN_SOUNDS = ["off", "till", "scanner", "confirm", "arpeggio"] as const;
export type ScanSound = (typeof SCAN_SOUNDS)[number];
export const DEFAULT_SCAN_SOUND: ScanSound = "confirm";
