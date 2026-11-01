// SPDX-License-Identifier: GPL-3.0-or-later
// Server-side i18n helpers (PLAN.md §3.16). The active locale is a deployment setting; only the
// public demo follows its visitor (Q120, ADR-047).
import { dev } from "$app/env";
import { getRequestEvent } from "$app/server";
import type { RequestEvent } from "@sveltejs/kit";
import { getUiLocale } from "#lib/server/config/locale.js";
import { isDemoPublic } from "#lib/server/demo/public.js";
import { isKnownLocale, knownLocales, packTranslations } from "#lib/server/i18n/registry.js";
import { browserLanguage, LANG_COOKIE } from "#lib/shared/demo-language.js";
import { createI18n, needsFallback, type AppI18n, type AppLocale } from "./index.js";

/**
 * The language of a request: the configured one. `?lang=` overrides it in development, in the test
 * build and in the wizard; in the public demo the visitor's choice (the cookie `bv_lang` of the
 * switch, shared on biblioviva.org) comes first, then the browser's preferred language.
 */
export function resolveLocale(
	event: Pick<RequestEvent, "url" | "cookies" | "request">,
	allowOverride = false,
): AppLocale {
	if (allowOverride || dev || process.env.ALLOW_LANG_OVERRIDE === "1") {
		const override = event.url.searchParams.get("lang");
		if (override && isKnownLocale(override)) {
			return override;
		}
	}
	if (isDemoPublic()) {
		const chosen = event.cookies.get(LANG_COOKIE);
		if (chosen && isKnownLocale(chosen)) {
			return chosen;
		}
		const browser = browserLanguage(
			event.request.headers.get("Accept-Language"),
			knownLocales(),
		);
		if (browser) {
			return browser;
		}
	}
	return getUiLocale();
}

/** The languages of the public demo's switch: the installation's first, then the others available. */
export function demoLanguages(): AppLocale[] {
	const configured = getUiLocale();
	return [configured, ...knownLocales().filter((code) => code !== configured)];
}

/**
 * The language of the request being served (`event.locals.locale`), for the messages, exports and
 * sheets built on the server; the configured one outside a request.
 */
export function requestLocale(): AppLocale {
	try {
		return getRequestEvent().locals.locale;
	} catch {
		return getUiLocale();
	}
}

/**
 * Fresh instance for one request, with every namespace loaded (ADR-006). A language pack is
 * pre-filled from the registry; English (the fallback locale) covers its gaps.
 */
export async function loadServerI18n(locale: AppLocale, pathname: string): Promise<AppI18n> {
	const i18n = createI18n(packTranslations(locale) ?? undefined, needsFallback(locale));
	await i18n.loadTranslations(locale, pathname);
	return i18n;
}

/**
 * Translate in server code that has no component context (services raising user-facing
 * errors, exports, slips). Instances are cached per locale; call `invalidateServerI18n()`
 * after a configuration reload.
 */
const cache = new Map<AppLocale, Promise<AppI18n>>();

export async function tServer(
	locale: AppLocale,
	key: string,
	params?: Record<string, unknown>,
): Promise<string> {
	let instance = cache.get(locale);
	if (!instance) {
		// a path every namespace matches: server messages may come from any of them
		instance = loadServerI18n(locale, "/admin/config");
		cache.set(locale, instance);
	}
	const i18n = await instance;
	return i18n.t(key, params);
}

/** The translations of `locale` as a plain function, for code that translates many keys at once. */
export async function serverTranslator(
	locale: AppLocale,
): Promise<(key: string, params?: Record<string, unknown>) => string> {
	let instance = cache.get(locale);
	if (!instance) {
		instance = loadServerI18n(locale, "/admin/config");
		cache.set(locale, instance);
	}
	const i18n = await instance;
	return (key, params) => i18n.t(key, params);
}

export function invalidateServerI18n(): void {
	cache.clear();
}
