// SPDX-License-Identifier: GPL-3.0-or-later
// Staff accounts as seen by /admin/users (PLAN.md step 1.8): read-only view of the accounts
// mirrored from `security.users`, with the warnings an administrator needs to act on.
import { asc } from "drizzle-orm";
import { permissionsOf } from "#lib/server/auth/rbac.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Db } from "#lib/server/db/client.js";
import { staffUser } from "#lib/server/db/schema.js";
import type { Permission } from "#lib/shared/permissions.js";

export interface AccountView {
	id: number;
	username: string;
	displayName: string | null;
	roles: string[];
	permissions: Permission[];
	active: boolean;
	source: "config" | "database";
	lastLoginAt: string | null;
	/** The password is written in clear in config.json (should be replaced by a hash). */
	plainPassword: boolean;
	/** Present in config.json (false = removed from the file and therefore deactivated). */
	inConfig: boolean;
}

export function listAccounts(db: Db, config: AppConfig): AccountView[] {
	const byUsername = new Map(config.security.users.map((u) => [u.username, u]));
	return db
		.select()
		.from(staffUser)
		.orderBy(asc(staffUser.username))
		.all()
		.map((row) => {
			const cfg = byUsername.get(row.username);
			return {
				id: row.id,
				username: row.username,
				displayName: row.displayName,
				roles: row.roles,
				permissions: permissionsOf(row.roles, config.security.roles),
				active: row.active === 1,
				source: row.source as "config" | "database",
				lastLoginAt: row.lastLoginAt,
				plainPassword: Boolean(cfg && !cfg.passwordHash && cfg.password),
				inConfig: cfg !== undefined,
			};
		});
}
