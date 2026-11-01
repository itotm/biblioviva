// SPDX-License-Identifier: GPL-3.0-or-later
// The UI locale is a deployment setting: `ui.locale` in config.json (PLAN.md Q52).
import { DEFAULT_LOCALE, type AppLocale } from "#lib/i18n/index.js";
import { isKnownLocale } from "#lib/server/i18n/registry.js";
import { getConfig } from "./index.js";

let warned: string | null = null;

/** The configured locale when it is built in or a valid pack, English otherwise (warned once). */
export function getUiLocale(): AppLocale {
	const configured = getConfig().ui.locale;
	if (isKnownLocale(configured)) {
		return configured;
	}
	if (warned !== configured) {
		warned = configured;
		console.warn(`[i18n] ui.locale "${configured}" is not available: using ${DEFAULT_LOCALE}`);
	}
	return DEFAULT_LOCALE;
}
