// SPDX-License-Identifier: GPL-3.0-or-later
// A language pack from the first-run wizard (step 9.48, Q142): the packs of the release of this
// version, installed by download or from an uploaded zip, before any account exists. The same
// checks and installation as Aspetto e lingua (step 9.39); only while the setup mode holds
// (`requireSetupMode`, 404 afterwards), never in the public demo. The answers carry codes, not
// texts: the wizard's language is the page's (`?lang=`), which a remote request does not know.
import { command, form, query } from "$app/server";
import * as v from "valibot";
import { megabytes } from "#lib/shared/bytes.js";
import { uploadedFile } from "#lib/shared/input-schemas.js";
import { DEFAULT_LOCALE } from "#lib/i18n/index.js";
import { requireSetupMode } from "#lib/server/auth/setup-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { assertNotDemo, isDemoPublic } from "#lib/server/demo/public.js";
import { builtInDictionaries } from "#lib/server/i18n/registry.js";
import { refusing } from "#lib/server/http/errors.js";
import {
	downloadReleasePack,
	fetchPackIndex,
	releasePacksView,
	releasePageUrl,
} from "#lib/server/services/language-pack-releases.js";
import {
	installPack,
	LanguagePackError,
	MAX_PACK_ZIP_BYTES,
	packFolders,
	packsView,
} from "#lib/server/services/language-packs.js";

/** Why a pack was refused: the code of `config.languages.errors` and what it names. */
const refused = (e: LanguagePackError): { ok: false; code: string; details: string } => ({
	ok: false,
	code: e.code,
	details: e.details.slice(0, 10).join("; "),
});

/** The packs already in `CONFIG_DIR/i18n/` (the wizard lists the valid ones among its languages). */
export const getSetupLanguagePacks = query(async () => {
	requireSetupMode();
	const english = await builtInDictionaries(DEFAULT_LOCALE);
	return {
		packs: packsView(env().CONFIG_DIR, english, getConfig().ui.locale),
		folders: packFolders(env().CONFIG_DIR),
		maxMb: megabytes(MAX_PACK_ZIP_BYTES, getConfig().ui.locale),
	};
});

/** The packs of the release that matches this version, as in Aspetto e lingua. */
export const getSetupReleasePacks = query(async () => {
	requireSetupMode();
	if (isDemoPublic()) {
		return { state: "demo" as const };
	}
	try {
		const index = await fetchPackIndex();
		return {
			state: "ok" as const,
			packs: releasePacksView(index, packFolders(env().CONFIG_DIR)),
			releaseUrl: releasePageUrl(),
		};
	} catch (e) {
		if (e instanceof LanguagePackError) {
			return { state: "unavailable" as const, releaseUrl: releasePageUrl() };
		}
		throw e;
	}
});

/** Downloads and installs a pack of the release's list (the code is all the client sends). */
export const installSetupReleasePack = command(
	v.object({ code: v.pipe(v.string(), v.maxLength(10)) }),
	async ({ code: packCode }) => {
		requireSetupMode();
		assertNotDemo("languagePacks");
		return refusing(
			async () => {
				const entry = (await fetchPackIndex()).find((e) => e.code === packCode);
				if (!entry) {
					throw new LanguagePackError("notFound", [packCode]);
				}
				const zip = await downloadReleasePack(entry);
				const english = await builtInDictionaries(DEFAULT_LOCALE);
				const result = installPack(
					getDb(),
					env().CONFIG_DIR,
					zip,
					entry.code,
					english,
					getConfig().ui.locale,
					null,
				);
				void getSetupLanguagePacks().refresh();
				return { ok: true as const, pack: result.pack };
			},
			LanguagePackError,
			refused,
		);
	},
);

/** Installs a pack zip uploaded from the computer (an installation without internet). */
export const uploadSetupLanguagePack = form(
	v.object({
		code: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(10)), ""),
		pack: uploadedFile,
	}),
	async ({ code: packCode, pack }) => {
		requireSetupMode();
		assertNotDemo("languagePacks");
		const english = await builtInDictionaries(DEFAULT_LOCALE);
		return refusing(
			async () => {
				const result = installPack(
					getDb(),
					env().CONFIG_DIR,
					new Uint8Array(await pack.arrayBuffer()),
					packCode || null,
					english,
					getConfig().ui.locale,
					null,
				);
				void getSetupLanguagePacks().refresh();
				return { ok: true as const, pack: result.pack };
			},
			LanguagePackError,
			refused,
		);
	},
);
