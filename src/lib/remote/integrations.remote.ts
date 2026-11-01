// SPDX-License-Identifier: GPL-3.0-or-later
// Integrations and languages in the Configurazione area (step 11.8): the Z39.50 targets with
// "Prova connessione", the cover providers in order with their flags, the language packs (upload
// checked against English, removal, download). Permission `admin`.
import { command, form, query } from "$app/server";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { megabytes } from "#lib/shared/bytes.js";
import { entryId, uploadedFile } from "#lib/shared/input-schemas.js";
import { DEFAULT_LOCALE } from "#lib/i18n/index.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { assertNotDemo, isDemoPublic } from "#lib/server/demo/public.js";
import { builtInDictionaries } from "#lib/server/i18n/registry.js";
import { refusedWithCode, refusing } from "#lib/server/http/errors.js";
import { failureOf } from "#lib/server/services/config-commit.js";
import { saveConfigKeys } from "#lib/server/services/config-sections.js";
import { testZ3950Target } from "#lib/server/services/integrations-config.js";
import { Z3950_HOST, Z3950_WORD } from "#lib/shared/z3950.js";
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
	removePack,
} from "#lib/server/services/language-packs.js";
import { getConfigHistory, getConfigOverview } from "./config.remote.js";

function refreshAll(): void {
	void getConfigOverview().refresh();
	void getConfigHistory().refresh();
}

// --- Z39.50 -----------------------------------------------------------------------------------

const target = v.object({
	id: entryId,
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
	host: v.pipe(v.string(), v.trim(), v.regex(Z3950_HOST)),
	port: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535)),
	database: v.pipe(v.string(), v.trim(), v.regex(Z3950_WORD)),
	syntax: v.picklist(["unimarc", "marc21"]),
	charset: v.pipe(v.string(), v.trim(), v.maxLength(40), v.regex(Z3950_WORD)),
	elements: v.pipe(v.string(), v.trim(), v.maxLength(20), v.regex(Z3950_WORD)),
});

export const getZ3950Targets = query(() => {
	requireUser("admin");
	const config = getConfig();
	return { targets: config.z3950.targets, defaultTarget: config.z3950.defaultTarget };
});

export const testZ3950Connection = command(target, async (t) => {
	requireUser("admin");
	return testZ3950Target(t, getConfig(), env());
});

export const saveZ3950Targets = command(
	v.object({ targets: v.pipe(v.array(target), v.minLength(1), v.maxLength(20)) }),
	({ targets }) => {
		const user = requireUser("admin");
		try {
			const change = saveConfigKeys(
				getDb(),
				env().CONFIG_DIR,
				"z3950",
				{ "z3950.targets": targets },
				user,
			);
			void getZ3950Targets().refresh();
			refreshAll();
			return { ok: true as const, change: change.id };
		} catch (e) {
			return failureOf(e);
		}
	},
);

// --- Covers -----------------------------------------------------------------------------------

const PROVIDERS = ["amazon", "openlibrary", "googlebooks"] as const;

export const getCoverProviders = query(() => {
	requireUser("admin");
	const config = getConfig();
	const listed = config.covers.providers;
	// every provider shown, the ones missing from the list at the end and off
	const providers = [
		...listed,
		...PROVIDERS.filter((id) => !listed.some((p) => p.id === id)).map((id) => ({
			id,
			enabled: false,
		})),
	];
	return { providers, googleKey: Boolean(env().GOOGLE_BOOKS_API_KEY) };
});

export const saveCoverProviders = command(
	v.object({
		providers: v.pipe(
			v.array(v.object({ id: v.picklist(PROVIDERS), enabled: v.boolean() })),
			v.check(
				(list) => new Set(list.map((p) => p.id)).size === list.length,
				"each provider once",
			),
		),
	}),
	({ providers }) => {
		const user = requireUser("admin");
		try {
			const change = saveConfigKeys(
				getDb(),
				env().CONFIG_DIR,
				"covers",
				{ "covers.providers": providers },
				user,
			);
			void getCoverProviders().refresh();
			refreshAll();
			return { ok: true as const, change: change.id };
		} catch (e) {
			return failureOf(e);
		}
	},
);

// --- Language packs ---------------------------------------------------------------------------

export const getLanguagePacks = query(async () => {
	requireUser("admin");
	const english = await builtInDictionaries(DEFAULT_LOCALE);
	return {
		packs: packsView(env().CONFIG_DIR, english, getConfig().ui.locale),
		folders: packFolders(env().CONFIG_DIR),
		maxMb: megabytes(MAX_PACK_ZIP_BYTES, requestLocale()),
	};
});

/** The packs of the release that matches this version (read from the public release, step 9.39). */
export const getReleasePacks = query(async () => {
	requireUser("admin");
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

/** Installs a pack of the release's list: the file is the index's, the code is all the client sends. */
export const installReleasePack = command(
	v.object({ code: v.pipe(v.string(), v.maxLength(10)) }),
	async ({ code: packCode }) => {
		const user = requireUser("admin");
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
					user,
				);
				void getLanguagePacks().refresh();
				refreshAll();
				return { ok: true as const, pack: result.pack };
			},
			LanguagePackError,
			(e) => ({
				ok: false as const,
				code: e.code,
				details: e.details.slice(0, 10).join("; "),
			}),
		);
	},
);

export const uploadLanguagePack = form(
	v.object({
		code: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(10)), ""),
		pack: uploadedFile,
	}),
	async ({ code: packCode, pack }, issue) => {
		const user = requireUser("admin");
		const english = await builtInDictionaries(DEFAULT_LOCALE);
		try {
			const result = installPack(
				getDb(),
				env().CONFIG_DIR,
				new Uint8Array(await pack.arrayBuffer()),
				packCode || null,
				english,
				getConfig().ui.locale,
				user,
			);
			void getLanguagePacks().refresh();
			refreshAll();
			return { pack: result.pack };
		} catch (e) {
			if (e instanceof LanguagePackError) {
				invalid(
					issue.pack(
						await tServer(requestLocale(), `config.languages.errors.${e.code}`, {
							details: e.details.slice(0, 10).join("; "),
							maxMb: megabytes(MAX_PACK_ZIP_BYTES, requestLocale()),
						}),
					),
				);
			}
			throw e;
		}
	},
);

export const removeLanguagePack = command(
	v.object({ code: v.pipe(v.string(), v.maxLength(10)) }),
	({ code: packCode }) => {
		const user = requireUser("admin");
		return refusing(
			() => {
				const change = removePack(
					getDb(),
					env().CONFIG_DIR,
					packCode,
					getConfig().ui.locale,
					user,
				);
				void getLanguagePacks().refresh();
				refreshAll();
				return { ok: true as const, change: change.id };
			},
			LanguagePackError,
			refusedWithCode,
		);
	},
);
