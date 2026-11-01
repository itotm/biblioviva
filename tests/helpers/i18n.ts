// SPDX-License-Identifier: GPL-3.0-or-later
// Italian i18n instance for component tests (browser project): dictionaries imported statically.
import common from "#lib/i18n/it/common.json";
import nav from "#lib/i18n/it/nav.json";
import auth from "#lib/i18n/it/auth.json";
import errors from "#lib/i18n/it/errors.json";
import admin from "#lib/i18n/it/admin.json";
import setup from "#lib/i18n/it/setup.json";
import patrons from "#lib/i18n/it/patrons.json";
import config from "#lib/i18n/it/config.json";
import { i18nContext } from "#lib/i18n/context.js";
import { createI18n, type AppI18n } from "#lib/i18n/index.js";

export async function testI18nContext(): Promise<Map<symbol, AppI18n>> {
	const i18n = createI18n({ it: { common, nav, auth, errors, admin, setup, patrons, config } });
	await i18n.loadTranslations("it");
	return i18nContext(i18n);
}
