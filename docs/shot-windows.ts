// SPDX-License-Identifier: GPL-3.0-or-later
// The windows and languages of the documentation's pictures (PLAN.md §3.23), without any import so
// that the shot list, the Playwright runs, the WebP conversion and the two site builds all read the
// same table. A picture is the file `<lang>/<name>.<window>.webp` of `site/.shots/`.

/** The three windows a screen is taken in, in the order the figure switch shows them. */
export const WINDOWS = ["computer", "tablet", "phone"] as const;
export type Window = (typeof WINDOWS)[number];

/** Size (CSS pixels) and scale of each window: an upright 11-inch tablet, a current phone. */
export const WINDOW_SIZES: Record<Window, { width: number; height: number; scale: number }> = {
	computer: { width: 1280, height: 800, scale: 1 },
	tablet: { width: 834, height: 1194, scale: 2 },
	phone: { width: 412, height: 915, scale: 2 },
};

/** The languages of the site: every picture is taken in each of them. */
export const SHOT_LANGS = ["it", "en"] as const;
export type ShotLang = (typeof SHOT_LANGS)[number];

/** The path of a picture below its root (`site/.shots/` or the folder of the PNG files). */
export const shotFile = (lang: string, name: string, window: Window, ext: string): string =>
	`${lang}/${name}.${window}.${ext}`;

/** A comma-separated list of an environment variable, kept to the known values; all when unset. */
function pick<T extends string>(all: readonly T[], value: string | undefined): T[] {
	if (!value) {
		return [...all];
	}
	const wanted = value.split(",").map((v) => v.trim());
	const chosen = all.filter((v) => wanted.includes(v));
	if (chosen.length === 0) {
		throw new Error(`nothing known in "${value}" (known: ${all.join(", ")})`);
	}
	return chosen;
}

/** The languages of this run: `BV_SHOTS_LANGS=it` takes the Italian pictures only. */
export const runLangs = (env: Record<string, string | undefined> = process.env): ShotLang[] =>
	pick(SHOT_LANGS, env.BV_SHOTS_LANGS);

/** The windows of this run: `BV_SHOTS_WINDOWS=computer` leaves the other windows out. */
export const runWindows = (env: Record<string, string | undefined> = process.env): Window[] =>
	pick(WINDOWS, env.BV_SHOTS_WINDOWS);
