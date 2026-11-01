// SPDX-License-Identifier: GPL-3.0-or-later
// The Configurazione area (step 11.2): overview of the sections and of the files, the settings
// form and the JSON of one section, the history of changes with "Ripristina", "Ricarica". The
// blocks of the other configuration pages have their own modules (config-archive,
// library-codes, barcode-formats, circulation-config). Permission `admin`.
import { command, query } from "$app/server";
import * as v from "valibot";
import { getAccounts } from "#lib/remote/accounts.remote.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { ConfigError, getLoadedConfig, reloadConfig } from "#lib/server/config/index.js";
import { refusal, refusing } from "#lib/server/http/errors.js";
import { changing, UNKNOWN_SETTING } from "#lib/server/http/config-changes.js";
import { schemaSections } from "#lib/server/config/introspect.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { audit } from "#lib/server/services/audit.js";
import {
	ConfigChangeNotFoundError,
	ConfigRevertConflictError,
} from "#lib/server/services/config-edit.js";
import { configRefused, failureOf, failureWith } from "#lib/server/services/config-commit.js";
import { issueLines } from "#lib/shared/config-issues.js";
import {
	checkSectionJson,
	configHistory,
	configOverview,
	RevertRefusedError,
	revertChange,
	saveSectionJson,
	saveSettings,
	sectionView,
} from "#lib/server/services/config-sections.js";

const section = v.pipe(
	v.string(),
	v.check((s) => schemaSections().includes(s), "unknown section"),
);
const json = v.record(v.string(), v.unknown());

export const getConfigOverview = query(async () => {
	requireUser("admin");
	return await configOverview(getLoadedConfig(), env().CONFIG_DIR);
});

export const getConfigSection = query(section, (name) => {
	requireUser("admin");
	return sectionView(getLoadedConfig(), env().CONFIG_DIR, name);
});

/** Saves keys of the settings form, each in the file that defines it. */
export const saveConfigSettings = command(
	v.object({
		section,
		set: json,
		reset: v.pipe(v.array(v.string()), v.maxLength(500)),
	}),
	({ section: name, set, reset }) => {
		const user = requireUser("admin");
		return changing(() => {
			const change = saveSettings(getDb(), env().CONFIG_DIR, name, { set, reset }, user);
			return { ok: true as const, change: change.id };
		});
	},
);

/** The problems of the section written as JSON (nothing is written). */
export const checkConfigSectionJson = command(
	v.object({ section, value: json }),
	({ section: name, value }) => {
		requireUser("admin");
		return checkSectionJson(env().CONFIG_DIR, name, value);
	},
);

export const saveConfigSectionJson = command(
	v.object({ section, value: json }),
	({ section: name, value }) => {
		const user = requireUser("admin");
		return changing(() => {
			const change = saveSectionJson(getDb(), env().CONFIG_DIR, name, value, user);
			return { ok: true as const, change: change.id };
		});
	},
);

export const getConfigHistory = query(() => {
	requireUser("admin");
	return configHistory(env().CONFIG_DIR);
});

/** "Ripristina": the files as they were before a change. */
export const revertConfigHistory = command(
	v.object({ id: v.pipe(v.string(), v.regex(/^\d{8}-\d{6}-\d{3}(-\d+)?$/)) }),
	({ id }) => {
		const user = requireUser("admin");
		return refusing(() => {
			const change = revertChange(getDb(), env().CONFIG_DIR, id, user);
			void getConfigHistory().refresh();
			return { ok: true as const, change: change.id };
		}, [
			refusal(RevertRefusedError, () => failureWith({ reason: "refused" as const })),
			refusal(ConfigRevertConflictError, (e) =>
				failureWith({ reason: "conflict" as const, conflicts: e.conflicts }),
			),
			refusal(ConfigChangeNotFoundError, () => failureWith({ reason: "notFound" as const })),
			UNKNOWN_SETTING,
			refusal(configRefused(), (e) => failureOf(e, { reason: "invalid" as const })),
		]);
	},
);

/** "Ricarica": reads the files again; on errors the running configuration stays. */
export const reloadConfiguration = command(() => {
	const user = requireUser("admin");
	audit(getDb(), user, "config.reload_requested", "config");
	return refusing(
		() => {
			// the reload listeners (hooks.server.ts) mirror the accounts and write the system audit row
			const loaded = reloadConfig();
			void getConfigOverview().refresh();
			void getAccounts().refresh();
			return { ok: true as const, warnings: issueLines(loaded.warnings) };
		},
		ConfigError,
		(e) => failureOf(e),
	);
});
