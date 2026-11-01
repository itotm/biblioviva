// SPDX-License-Identifier: GPL-3.0-or-later
// First-run wizard data. Once the setup is completed the page no longer exists (404).
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getLoadedConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { availableLocales } from "#lib/server/i18n/registry.js";
import { env } from "#lib/server/env.js";
import { MAX_UPLOAD_BYTES } from "#lib/server/services/export-archive.js";
import { megabytes } from "#lib/shared/bytes.js";
import {
	DEMO_PASSWORD,
	setupDefaults,
	WIZARD_ACCOUNTS,
	type WizardAccount,
} from "#lib/server/services/setup.js";
import { generatePassword } from "#lib/shared/password.js";
import { serverTranslator } from "#lib/i18n/server.js";
import { THEMES } from "#lib/shared/theme-palette.js";

/** One random proposal per wizard account (the operator may replace them). */
function proposedPasswords(): Record<WizardAccount, string> {
	const passwords = {} as Record<WizardAccount, string>;
	for (const account of WIZARD_ACCOUNTS) {
		passwords[account] = generatePassword();
	}
	return passwords;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	// read so that a change of language (`?lang=`) loads the presets again in it (9.41)
	url.searchParams.get("lang");
	if (!locals.setupMode) {
		error(404, "setup already completed");
	}
	const hasData =
		(getDb().$client.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM patron").get()?.n ??
			0) > 0;
	return {
		defaults: setupDefaults(
			getLoadedConfig(),
			await serverTranslator(locals.locale),
			locals.locale,
		),
		passwords: proposedPasswords(),
		accounts: WIZARD_ACCOUNTS,
		demoPassword: DEMO_PASSWORD,
		themes: THEMES,
		demoPreselected: env().DEMO === "1",
		hasData,
		/** The largest archive the restore from a backup takes (9.43), as the language writes it. */
		maxUploadMb: megabytes(MAX_UPLOAD_BYTES, locals.locale),
		/** Built-in languages first, then the valid packs of CONFIG_DIR/i18n (step 1.14). */
		locales: await availableLocales(),
	};
};
