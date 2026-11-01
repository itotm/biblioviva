// SPDX-License-Identifier: GPL-3.0-or-later
// The paper sizes of the printouts (PLAN.md §3.12), portrait, in millimetres: the sheets of cards
// and labels are A4, a slip is A4 or A5.

export const PAPER_MM = {
	A4: { width: 210, height: 297 },
	A5: { width: 148, height: 210 },
} as const;

export type PaperFormat = keyof typeof PAPER_MM;

/** A paper size given as a CSS `@page` size (`A5 landscape`): its width and height in mm. */
export function pageSizeMm(page: string): { width: number; height: number } {
	const [format = "A4", orientation = "portrait"] = page.split(" ");
	const paper = PAPER_MM[format as PaperFormat] ?? PAPER_MM.A4;
	return orientation === "landscape"
		? { width: paper.height, height: paper.width }
		: { width: paper.width, height: paper.height };
}
