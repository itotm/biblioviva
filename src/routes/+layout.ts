// SPDX-License-Identifier: GPL-3.0-or-later
import { browser } from "$app/env";
import type { LayoutLoad } from "./$types";
import { createI18n, type AppI18n } from "#lib/i18n/index.js";

// One instance per browser session; on the server every request gets its own (from the
// server snapshot, so loaders do not run twice).
let client: AppI18n | undefined;

export const load: LayoutLoad = async ({ data, url }) => {
	const i18n = client ?? createI18n(data.translations, data.fallback);
	if (browser) {
		if (client && !client.locales.includes(data.locale)) {
			// a language pack (step 1.14) has no client loader: take the server snapshot
			client.addTranslations(data.translations);
		}
		client = i18n;
	}
	await i18n.loadTranslations(data.locale, url.pathname);
	return {
		locale: data.locale,
		timezone: data.timezone,
		libraryYear: data.libraryYear,
		libraryName: data.libraryName,
		themeColor: data.themeColor,
		areaStyle: data.areaStyle,
		photosEnabled: data.photosEnabled,
		coversEnabled: data.coversEnabled,
		photosRequired: data.photosRequired,
		codeFormats: data.codeFormats,
		cameraSound: data.cameraSound,
		debug: data.debug,
		libraryLogo: data.libraryLogo,
		i18n,
		user: data.user,
		demo: data.demo,
		demoPublic: data.demoPublic,
		languages: data.languages,
		version: data.version,
		docsBase: data.docsBase,
	};
};
