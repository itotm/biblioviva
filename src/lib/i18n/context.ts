// SPDX-License-Identifier: GPL-3.0-or-later
import { getContext, setContext } from "svelte";
import type { AppI18n } from "./index.js";

const KEY = Symbol("biblioviva.i18n");

export function provideI18n(i18n: AppI18n): void {
	setContext(KEY, i18n);
}

/** Context map for mounting components outside the layout (component tests). */
export function i18nContext(i18n: AppI18n): Map<symbol, AppI18n> {
	return new Map([[KEY, i18n]]);
}

/** The i18n instance of the current request/page (set by the root layout). */
export function useI18n(): AppI18n {
	const i18n = getContext<AppI18n | undefined>(KEY);
	if (!i18n) {
		throw new Error("i18n context missing: is the root layout mounted?");
	}
	return i18n;
}
