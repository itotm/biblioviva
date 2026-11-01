// SPDX-License-Identifier: GPL-3.0-or-later
// sveltekit-i18n configuration (PLAN.md §3.16). One language per installation (Q52):
// the locale comes from the configuration, never from the browser or the user.
import { I18n, type Config } from "sveltekit-i18n";

import { LOCALES } from "./locales.js";

export { LOCALES };
/** Built-in locale codes. */
export type BuiltInLocale = (typeof LOCALES)[number];
/** Any locale an installation can use: a built-in one or a language pack from CONFIG_DIR (step 1.14). */
export type AppLocale = string;
/** English is always shipped and is the first choice of the wizard (owner decision). */
export const DEFAULT_LOCALE: AppLocale = "en";

/** The language's own name ("Italiano", "English") for pickers, without a dictionary key. */
export function localeDisplayName(locale: string): string {
	const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
	return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/** Dictionary namespaces: `src/lib/i18n/{it,en}/<namespace>.json`. */
export const NAMESPACES = [
	"common",
	"nav",
	"auth",
	"errors",
	"admin",
	"setup",
	"patrons",
	"printing",
	"catalog",
	"about",
	"circulation",
	"dashboard",
	"reports",
	"notes",
	"config",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

/**
 * Namespaces needed only by some pages (step 9.2): the administration dictionaries are the largest
 * and every page carries its dictionaries, so they load only where they are used. Every other
 * namespace is loaded for every route (ADR-006).
 */
export const NAMESPACE_ROUTES: Partial<Record<Namespace, RegExp[]>> = {
	config: [/^\/admin(\/|$)/],
	admin: [/^\/admin(\/|$)/, /^\/patrons\/\d+/],
};

const loaders = LOCALES.flatMap((locale) =>
	NAMESPACES.map((namespace) => ({
		locale,
		namespace,
		...(NAMESPACE_ROUTES[namespace] ? { routes: NAMESPACE_ROUTES[namespace] } : {}),
		loader: async () =>
			(
				(await import(`./${locale}/${namespace}.json`)) as {
					default: Record<string, unknown>;
				}
			).default,
	})),
);

export const config = {
	fallbackLocale: DEFAULT_LOCALE,
	loaders,
	parserOptions: {
		onReport: (report: { message: string }) => console.warn("[i18n]", report.message),
	},
} satisfies Config;

export type AppI18n = InstanceType<typeof I18n>;

/** True for the built-in locales only (packs are known to the server registry). */
export function isBuiltInLocale(value: unknown): value is BuiltInLocale {
	return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Creates an instance; `translations` (a server snapshot) pre-fills it so loaders do not run again.
 * `withFallback` false leaves English out: a complete built-in language never needs it (the parity
 * test guarantees every key), and the page then carries one dictionary instead of two (9.2).
 */
export function createI18n(
	translations?: Record<string, Record<string, unknown>>,
	withFallback = true,
): AppI18n {
	return new I18n({
		...config,
		...(withFallback ? {} : { fallbackLocale: undefined }),
		translations: { ...(translations ?? {}) },
	});
}

/** Whether a locale needs English behind it: language packs may miss keys, built-ins never do. */
export function needsFallback(locale: string): boolean {
	return locale !== DEFAULT_LOCALE && !isBuiltInLocale(locale);
}
