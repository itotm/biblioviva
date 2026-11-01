// SPDX-License-Identifier: GPL-3.0-or-later
// Appearance page (steps 2.3b, 4.10, 11.13): the colour set of the installation, changeable after
// the wizard, the installation language, the library's name and logo, the sections of the
// dashboard (step 11.15).
import { command, form, query } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { localeCode, uploadedFile } from "#lib/shared/input-schemas.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { storeUploadedMedia } from "#lib/server/http/errors.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { AREA_STYLES, THEMES } from "#lib/shared/theme-palette.js";
import { DASHBOARD_SECTIONS, type DashboardSection } from "#lib/shared/dashboard-sections.js";
import {
	saveConfigKeys,
	saveSettingIfChanged,
	saveUiChoice,
} from "#lib/server/services/config-sections.js";
import { availableLocales, isAvailableLocale } from "#lib/server/i18n/registry.js";
import { invalidateServerI18n } from "#lib/i18n/server.js";
import {
	LOGO_MAX_BYTES,
	logoUrl,
	removeLibraryLogo,
	saveLibraryLogo,
} from "#lib/server/services/branding.js";

export const getAppearance = query(() => {
	requireUser("admin");
	return {
		theme: getConfig().ui.theme,
		libraryName: getConfig().library.name,
		dashboard: getConfig().ui.dashboard,
		areaStyle: getConfig().ui.areaStyle,
		locale: getConfig().ui.locale,
		logo: logoUrl(env().CONFIG_DIR),
	};
});

export const setTheme = command(v.object({ theme: v.picklist(THEMES) }), ({ theme }) => {
	const user = requireUser("admin");
	saveUiChoice(getDb(), env().CONFIG_DIR, "theme", theme, user);
	void getAppearance().refresh();
	return { ok: true as const, theme };
});

/** How the top bar shows the area (step 9.16): tinted, filled, accents or none. */
export const setAreaStyle = command(v.object({ style: v.picklist(AREA_STYLES) }), ({ style }) => {
	const user = requireUser("admin");
	saveSettingIfChanged(getDb(), env().CONFIG_DIR, "ui.areaStyle", style, user);
	void getAppearance().refresh();
	return { ok: true as const, style };
});

/** The sections shown on the dashboard (step 11.15), all of them saved as one change. */
export const setDashboard = command(
	v.object(
		Object.fromEntries(DASHBOARD_SECTIONS.map((s) => [s, v.boolean()])) as Record<
			DashboardSection,
			v.BooleanSchema<undefined>
		>,
	),
	(sections) => {
		const user = requireUser("admin");
		saveConfigKeys(getDb(), env().CONFIG_DIR, "ui", { "ui.dashboard": sections }, user);
		void getAppearance().refresh();
		return { ok: true as const };
	},
);

/** The library's name (step 11.13), set in the wizard and changed here at any time. */
export const setLibraryName = command(
	v.object({ name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)) }),
	({ name }) => {
		const user = requireUser("admin");
		saveSettingIfChanged(getDb(), env().CONFIG_DIR, "library.name", name, user);
		void getAppearance().refresh();
		return { ok: true as const, name };
	},
);

/** The installation language (one per installation, Q52): applied to every page on the next load. */
export const setLocale = command(v.object({ locale: localeCode }), async ({ locale }) => {
	const user = requireUser("admin");
	if (!(await isAvailableLocale(locale))) {
		error(400, "unknown locale");
	}
	if (saveUiChoice(getDb(), env().CONFIG_DIR, "locale", locale, user)) {
		invalidateServerI18n();
	}
	void getAppearance().refresh();
	return { ok: true as const, locale };
});

/** Built-in languages first, then the valid packs of CONFIG_DIR/i18n (step 1.14). */
export const getAvailableLocales = query(() => {
	requireUser("admin");
	return availableLocales();
});

/** The library's logo (step 4.10): PNG, JPEG or WebP, stored as PNG in the configuration folder. */
export const uploadLogo = form(v.object({ logo: uploadedFile }), async ({ logo }, issue) => {
	const user = requireUser("admin");
	await storeUploadedMedia(
		logo,
		(bytes) => saveLibraryLogo(getDb(), env().CONFIG_DIR, bytes, user),
		issue.logo,
		"admin.appearance.logo.errors",
		LOGO_MAX_BYTES,
	);
	void getAppearance().refresh();
	return { ok: true as const };
});

export const removeLogo = command(() => {
	const user = requireUser("admin");
	removeLibraryLogo(getDb(), env().CONFIG_DIR, user);
	void getAppearance().refresh();
	return { ok: true as const };
});
