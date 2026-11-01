// SPDX-License-Identifier: GPL-3.0-or-later
// Staff accounts page (step 1.8, editable since step 11.7): the accounts of `security.users`
// (create, edit, rename, new password, deactivate, remove), the roles over the fixed permission
// list, the password hash helper (the configuration reload is in config.remote.ts).
import { command, query } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { MIN_PASSWORD_LENGTH } from "#lib/server/auth/password.js";
import { getLoadedConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { PERMISSIONS } from "#lib/shared/permissions.js";
import { ENTRY_ID } from "#lib/shared/input-schemas.js";
import { listAccounts } from "#lib/server/services/accounts.js";
import { failureLines, failureOf } from "#lib/server/services/config-commit.js";
import {
	helperPasswordHash,
	removeAccount,
	rolesView,
	saveAccount,
	saveRoles,
	StaffConfigError,
	USERNAME,
} from "#lib/server/services/staff-config.js";

export const getAccounts = query(() => {
	requireUser("admin");
	const loaded = getLoadedConfig();
	return {
		accounts: listAccounts(getDb(), loaded.config),
		configPath: loaded.path,
		configSource: loaded.source,
		roles: Object.keys(loaded.config.security.roles),
		roleGrants: rolesView(loaded.config),
		permissions: PERMISSIONS,
		authMode: loaded.config.security.auth.mode,
		minPassword: MIN_PASSWORD_LENGTH,
	};
});

interface StaffFailure {
	ok: false;
	code: string;
	details: string[];
}

function staffFailure(e: unknown): StaffFailure {
	if (e instanceof StaffConfigError) {
		return { ok: false, code: e.code, details: e.details };
	}
	return { ok: false, code: "invalid", details: failureLines(failureOf(e)) };
}

const grant = v.picklist(["*", ...PERMISSIONS]);

export const saveStaffAccount = command(
	v.object({
		originalUsername: v.nullable(v.string()),
		username: v.pipe(v.string(), v.trim(), v.regex(USERNAME)),
		displayName: v.pipe(v.string(), v.maxLength(120)),
		roles: v.pipe(v.array(v.pipe(v.string(), v.maxLength(32))), v.maxLength(20)),
		active: v.boolean(),
		password: v.optional(v.pipe(v.string(), v.maxLength(256))),
	}),
	async (draft) => {
		const user = requireUser("admin");
		try {
			const change = await saveAccount(getDb(), env().CONFIG_DIR, draft, user);
			void getAccounts().refresh();
			return { ok: true as const, change: change.id };
		} catch (e) {
			return staffFailure(e);
		}
	},
);

export const removeStaffAccount = command(
	v.object({ username: v.pipe(v.string(), v.regex(USERNAME)) }),
	async ({ username }) => {
		const user = requireUser("admin");
		try {
			const change = await removeAccount(getDb(), env().CONFIG_DIR, username, user);
			void getAccounts().refresh();
			return { ok: true as const, change: change.id };
		} catch (e) {
			return staffFailure(e);
		}
	},
);

export const saveStaffRoles = command(
	v.object({
		roles: v.pipe(
			v.array(
				v.object({
					originalName: v.nullable(v.string()),
					name: v.pipe(v.string(), v.trim(), v.regex(ENTRY_ID)),
					grants: v.array(grant),
				}),
			),
			v.minLength(1),
			v.maxLength(50),
		),
	}),
	async ({ roles }) => {
		const user = requireUser("admin");
		try {
			const change = await saveRoles(getDb(), env().CONFIG_DIR, roles, user);
			void getAccounts().refresh();
			return { ok: true as const, change: change.id };
		} catch (e) {
			return staffFailure(e);
		}
	},
);

export const generatePasswordHash = command(
	v.object({ password: v.pipe(v.string(), v.minLength(MIN_PASSWORD_LENGTH), v.maxLength(256)) }),
	async ({ password }) => {
		const user = requireUser("admin");
		return {
			hash: await helperPasswordHash(getDb(), getLoadedConfig().config, password, user),
		};
	},
);
