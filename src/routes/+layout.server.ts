// SPDX-License-Identifier: GPL-3.0-or-later
import type { LayoutServerLoad } from "./$types";
import { needsFallback } from "#lib/i18n/index.js";
import { demoLanguages, loadServerI18n } from "#lib/i18n/server.js";
import { getConfig } from "#lib/server/config/index.js";
import { env } from "#lib/server/env.js";
import { logoUrl } from "#lib/server/services/branding.js";
import { libraryYear } from "#lib/server/services/calendar.js";
import { DEMO_PASSWORD, readDemoInfo, WIZARD_ACCOUNTS } from "#lib/server/services/setup.js";
import { isDemoPublic, shownVersion } from "#lib/server/demo/public.js";
import { themeColor } from "#lib/shared/theme-palette.js";
import { debugEnabled } from "#lib/server/log/debug.js";
import { codeFormatsFromConfig } from "#lib/server/barcodes/table.js";
import { docsBase } from "#lib/ui/help-links.js";

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// the pathname is not read, so this load — and the dictionaries it carries — does not run
	// again at every navigation (9.2); `?lang=` is, so the wizard (and the tests) switch language
	url.searchParams.get("lang");
	const i18n = await loadServerI18n(locals.locale, "/");
	return {
		locale: locals.locale,
		/** `library.timezone`: every date shown in the UI is formatted in this zone, never the browser's. */
		timezone: getConfig().library.timezone,
		/** The year in `library.timezone` (the examples of new codes): never the browser's clock. */
		libraryYear: libraryYear(getConfig()),
		/** Shown next to the logo and on the dashboard (owner review). */
		libraryName: getConfig().library.name,
		/** The browser's title bar on phones and in the installed app (step 9.9). */
		themeColor: themeColor(getConfig().ui.theme),
		/** How the top bar shows the area the operator is in (`ui.areaStyle`, step 9.16). */
		areaStyle: getConfig().ui.areaStyle,
		/** Patron photos and book covers at all (`photos.enabled`, `covers.enabled`, 9.38). */
		photosEnabled: getConfig().photos.enabled,
		coversEnabled: getConfig().covers.enabled,
		/** Whether missing patron photos are pointed out (`photos.required`, 9.13 round 3). */
		photosRequired: getConfig().photos.enabled && getConfig().photos.required,
		/** The formats of copy barcodes and card numbers: the browser recognises codes with them (Phase 12). */
		codeFormats: codeFormatsFromConfig(getConfig()),
		/** The beep of a camera read (`barcodes.cameraSound`, 9.40). */
		cameraSound: getConfig().barcodes.cameraSound,
		/** `LOG_LEVEL=debug`: the browser reports what the camera reads (9.13 round 7). */
		debug: debugEnabled(),
		/** The library's own logo, top left of the app (step 4.10); null until one is uploaded. */
		libraryLogo: locals.user ? logoUrl(env().CONFIG_DIR) : null,
		translations: i18n.snapshot(),
		/** English behind the language (language packs only). */
		fallback: needsFallback(locals.locale),
		/** The version in the menu: the build's time in the public demo. */
		version: shownVersion(getConfig().library.timezone),
		/** Where the help icon opens the documentation: this version, this language (9.5b). */
		docsBase: docsBase(locals.locale),
		/** Set while the synthetic demo data of the wizard is loaded (badge in the shell). */
		demo: readDemoInfo(env().DATA_DIR),
		/** The public demo's language switch (Q120, ADR-047): the languages a visitor can pick. */
		languages: isDemoPublic() ? demoLanguages() : null,
		/** The public demo (9.17): the reset time, the accounts and the password on the login page. */
		demoPublic: isDemoPublic()
			? {
					time: env().DEMO_RESET_AT,
					accounts: [...WIZARD_ACCOUNTS],
					password: DEMO_PASSWORD,
				}
			: null,
		/** Minimal view of the account for navigation gating (never the roles' internals). */
		user: locals.user
			? {
					id: locals.user.id,
					username: locals.user.username,
					displayName: locals.user.displayName,
					permissions: locals.user.permissions,
				}
			: null,
	};
};
