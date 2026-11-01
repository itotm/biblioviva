// SPDX-License-Identifier: GPL-3.0-or-later
// The SVAR locale packages ship plain ES modules without type declarations.
declare module "@svar-ui/grid-locales" {
	export const en: { grid: Record<string, string> };
	export const cn: { grid: Record<string, string> };
}

declare module "@svar-ui/core-locales" {
	interface CoreLocale {
		core: Record<string, string>;
		calendar: Record<string, unknown>;
		formats: Record<string, string>;
		lang: string;
	}
	export const en: CoreLocale;
	export const it: CoreLocale;
	export const de: CoreLocale;
	export const es: CoreLocale;
	export const fr: CoreLocale;
}
