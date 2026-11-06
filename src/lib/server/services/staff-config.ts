// SPDX-License-Identifier: GPL-3.0-or-later
// Staff accounts and roles from the admin UI (PLAN.md step 11.7): the accounts of `security.users`
// (created, renamed, deactivated, removed once inactive, a new password written as an argon2id
// hash, never in clear) and the roles of `security.roles` over the fixed permission list (renamed
// roles followed by the accounts, a role in use never removed). Every change keeps at least one
// active account holding `admin`, is one configuration change, and is mirrored into `staff_user`
// before returning (a renamed account keeps its row, so its sessions and audit trail follow it).
// A password set by an administrator can be marked to change at the first login, and every
// account changes its own password (`changeOwnPassword`, 9.51).
import { ServiceError } from "#lib/server/errors.js";
import { and, eq, ne } from "drizzle-orm";
import { mirrorConfigUsers } from "#lib/server/auth/config-users.js";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "#lib/server/auth/password.js";
import { activeAdmins } from "#lib/server/auth/rbac.js";
import { getConfig } from "#lib/server/config/index.js";
import { loadConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { session, staffUser } from "#lib/server/db/schema.js";
import { PERMISSIONS, type RoleGrant } from "#lib/shared/permissions.js";
import { audit, type AuditActor } from "./audit.js";
import { commitConfigChange } from "./config-commit.js";
import { draftWrites, keyDrafts, type ConfigChange } from "./config-edit.js";
import { resolvePerformance } from "#lib/shared/performance.js";
import { ENTRY_ID } from "#lib/shared/input-schemas.js";

export const USERNAME = /^[a-z0-9._-]{2,32}$/;

type ConfigUser = AppConfig["security"]["users"][number];

export class StaffConfigError extends ServiceError {
	constructor(
		override readonly code:
			| "badUsername"
			| "usernameTaken"
			| "notFound"
			| "noRoles"
			| "unknownRole"
			| "passwordTooShort"
			| "passwordRequired"
			| "lastAdmin"
			| "stillActive"
			| "badRole"
			| "roleTaken"
			| "roleInUse"
			| "wrongPassword"
			| "samePassword",
		readonly details: string[] = [],
	) {
		super(
			code,
			`staff accounts: ${code}${details.length > 0 ? ` (${details.join(", ")})` : ""}`,
		);
		this.name = "StaffConfigError";
	}
}

/** The users and roles written back, audited, and mirrored into `staff_user`. */
async function commit(
	db: Db,
	configDir: string,
	users: ConfigUser[],
	roles: Record<string, RoleGrant[]>,
	action: string,
	details: Record<string, unknown>,
	actor: AuditActor,
	now: Date,
	renamed: Record<string, string> = {},
): Promise<ConfigChange> {
	if (activeAdmins(users, roles).length === 0) {
		throw new StaffConfigError("lastAdmin");
	}
	const loaded = loadConfig(configDir);
	const { change, loaded: after } = commitConfigChange(db, configDir, {
		action,
		writes: draftWrites(
			keyDrafts(configDir, loaded, {
				// the flag is written only where it is set
				"security.users": users.map(({ mustChangePassword, ...u }) =>
					mustChangePassword ? { ...u, mustChangePassword } : u,
				),
				"security.roles": roles,
			}),
		),
		move: (tx) => {
			for (const [from, to] of Object.entries(renamed)) {
				tx.update(staffUser)
					.set({ username: to, updatedAt: now.toISOString() })
					.where(eq(staffUser.username, from))
					.run();
			}
		},
		audit: { actor, entity: "staff_user", details },
		now,
	});
	await mirrorConfigUsers(db, after.config);
	return change;
}

/** Users as written in the file (the `password` in clear dropped once a hash replaces it). */
function rawUsers(config: AppConfig): ConfigUser[] {
	return config.security.users.map((u) => ({ ...u }));
}

export interface AccountDraft {
	/** The username when the dialog opened; null for a new account. */
	originalUsername: string | null;
	username: string;
	displayName: string;
	roles: string[];
	active: boolean;
	/** A new password (required for a new account); written as a hash. */
	password?: string;
	/** With a new password: the person changes it at the first login (9.51). */
	mustChangePassword?: boolean;
}

export async function saveAccount(
	db: Db,
	configDir: string,
	draft: AccountDraft,
	actor: AuditActor,
	now = new Date(),
): Promise<ConfigChange> {
	const config = loadConfig(configDir).config;
	const users = rawUsers(config);
	const username = draft.username.trim();
	if (!USERNAME.test(username)) {
		throw new StaffConfigError("badUsername", [username]);
	}
	const index =
		draft.originalUsername === null
			? -1
			: users.findIndex((u) => u.username === draft.originalUsername);
	if (draft.originalUsername !== null && index === -1) {
		throw new StaffConfigError("notFound", [draft.originalUsername]);
	}
	const known = db
		.select({ username: staffUser.username })
		.from(staffUser)
		.all()
		.map((r) => r.username);
	const taken =
		username !== draft.originalUsername &&
		(users.some((u) => u.username === username) || known.includes(username));
	if (taken) {
		throw new StaffConfigError("usernameTaken", [username]);
	}
	const roles = [...new Set(draft.roles)];
	if (roles.length === 0) {
		throw new StaffConfigError("noRoles");
	}
	const unknown = roles.filter((r) => !(r in config.security.roles));
	if (unknown.length > 0) {
		throw new StaffConfigError("unknownRole", unknown);
	}
	if (draft.password !== undefined && draft.password.length < MIN_PASSWORD_LENGTH) {
		throw new StaffConfigError("passwordTooShort");
	}
	if (index === -1 && draft.password === undefined) {
		throw new StaffConfigError("passwordRequired");
	}
	const previous = index === -1 ? null : users[index];
	// a new password sets the flag as asked; otherwise the account keeps its own
	const mustChange =
		draft.password !== undefined
			? draft.mustChangePassword === true
			: (previous?.mustChangePassword ?? false);
	const user: ConfigUser = {
		username,
		...(draft.displayName.trim() ? { displayName: draft.displayName.trim() } : {}),
		roles,
		active: draft.active,
		mustChangePassword: mustChange,
		...(draft.password !== undefined
			? {
					passwordHash: await hashPassword(
						draft.password,
						resolvePerformance(config.performance).argon2MemoryMb,
					),
				}
			: previous?.passwordHash
				? { passwordHash: previous.passwordHash }
				: { password: previous?.password }),
	};
	if (index === -1) {
		users.push(user);
	} else {
		users[index] = user;
	}
	const renamed =
		previous && previous.username !== username ? { [previous.username]: username } : {};
	return commit(
		db,
		configDir,
		users,
		config.security.roles,
		index === -1 ? "config.security.account_created" : "config.security.account_updated",
		{
			username,
			...(Object.keys(renamed).length > 0 ? { renamed } : {}),
			roles,
			active: draft.active,
			passwordChanged: draft.password !== undefined,
			...(mustChange ? { mustChangePassword: true } : {}),
		},
		actor,
		now,
		renamed,
	);
}

/**
 * An account changes its own password (9.51): the current one checked, the new one written as a
 * hash in the configuration, the change at the first login done; the account's other sessions
 * are closed, the one in use stays.
 */
export async function changeOwnPassword(
	db: Db,
	configDir: string,
	actor: AuditActor & { username: string },
	passwords: { current: string; next: string },
	keepSessionId: string | null,
	now = new Date(),
): Promise<ConfigChange> {
	const config = loadConfig(configDir).config;
	const users = rawUsers(config);
	const index = users.findIndex((u) => u.username === actor.username);
	const row = db.select().from(staffUser).where(eq(staffUser.id, actor.id)).get();
	const previous = users[index];
	if (index === -1 || !row || !previous) {
		throw new StaffConfigError("notFound", [actor.username]);
	}
	if (!(await verifyPassword(passwords.current, row.passwordHash))) {
		throw new StaffConfigError("wrongPassword");
	}
	if (passwords.next.length < MIN_PASSWORD_LENGTH) {
		throw new StaffConfigError("passwordTooShort");
	}
	if (passwords.next === passwords.current) {
		throw new StaffConfigError("samePassword");
	}
	const passwordHash = await hashPassword(
		passwords.next,
		resolvePerformance(config.performance).argon2MemoryMb,
	);
	const { password: _clear, ...rest } = previous;
	users[index] = { ...rest, passwordHash, mustChangePassword: false };
	// the mirror sees the hash already there and keeps the session in use; the others close here
	db.update(staffUser)
		.set({ passwordHash, mustChangePassword: 0, updatedAt: now.toISOString() })
		.where(eq(staffUser.id, actor.id))
		.run();
	const change = await commit(
		db,
		configDir,
		users,
		config.security.roles,
		"config.security.password_changed",
		{ username: actor.username },
		actor,
		now,
	);
	db.delete(session)
		.where(
			keepSessionId === null
				? eq(session.userId, actor.id)
				: and(eq(session.userId, actor.id), ne(session.id, keepSessionId)),
		)
		.run();
	return change;
}

/** Removes an inactive account from the file (its row stays, deactivated, for the audit trail). */
export async function removeAccount(
	db: Db,
	configDir: string,
	username: string,
	actor: AuditActor,
	now = new Date(),
): Promise<ConfigChange> {
	const config = loadConfig(configDir).config;
	const user = config.security.users.find((u) => u.username === username);
	if (!user) {
		throw new StaffConfigError("notFound", [username]);
	}
	if (user.active) {
		throw new StaffConfigError("stillActive", [username]);
	}
	return commit(
		db,
		configDir,
		rawUsers(config).filter((u) => u.username !== username),
		config.security.roles,
		"config.security.account_removed",
		{ username },
		actor,
		now,
	);
}

export interface RoleDraft {
	/** The name when the editor opened; null for a new role. */
	originalName: string | null;
	name: string;
	/** `*` for every permission, else a list of permissions. */
	grants: RoleGrant[];
}

/** The whole role list: renamed roles are followed by the accounts, removed ones must be unused. */
export async function saveRoles(
	db: Db,
	configDir: string,
	drafts: readonly RoleDraft[],
	actor: AuditActor,
	now = new Date(),
): Promise<ConfigChange> {
	const config = loadConfig(configDir).config;
	const names = drafts.map((d) => d.name.trim());
	const bad = names.filter((n) => !ENTRY_ID.test(n));
	if (bad.length > 0) {
		throw new StaffConfigError("badRole", bad);
	}
	const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
	if (duplicates.length > 0) {
		throw new StaffConfigError("roleTaken", [...new Set(duplicates)]);
	}
	const renamed = new Map(
		drafts.flatMap((d) =>
			d.originalName !== null && d.originalName !== d.name.trim()
				? [[d.originalName, d.name.trim()] as const]
				: [],
		),
	);
	const kept = new Set(drafts.flatMap((d) => (d.originalName === null ? [] : [d.originalName])));
	const users = rawUsers(config).map((u) => ({
		...u,
		roles: u.roles.map((r) => renamed.get(r) ?? r),
	}));
	const removedInUse = Object.keys(config.security.roles).filter(
		(r) => !kept.has(r) && config.security.users.some((u) => u.roles.includes(r)),
	);
	if (removedInUse.length > 0) {
		throw new StaffConfigError("roleInUse", removedInUse);
	}
	const roles: Record<string, RoleGrant[]> = Object.fromEntries(
		drafts.map((d) => [
			d.name.trim(),
			d.grants.includes("*") ? ["*"] : PERMISSIONS.filter((p) => d.grants.includes(p)),
		]),
	);
	return commit(
		db,
		configDir,
		users,
		roles,
		"config.security.roles",
		{ roles: Object.keys(roles), renamed: Object.fromEntries(renamed) },
		actor,
		now,
	);
}

/** What the accounts page shows about the roles: their grants and the accounts holding them. */
export function rolesView(config: AppConfig = getConfig()): {
	name: string;
	grants: RoleGrant[];
	usedBy: string[];
}[] {
	return Object.entries(config.security.roles).map(([name, grants]) => ({
		name,
		grants: [...grants],
		usedBy: config.security.users.filter((u) => u.roles.includes(name)).map((u) => u.username),
	}));
}

/**
 * A hash for a password typed in the helper of the accounts page, with the configured cost. The
 * helper is a tool, not a change: recorded without the hash itself.
 */
export async function helperPasswordHash(
	db: DbOrTx,
	config: AppConfig,
	password: string,
	actor: AuditActor,
): Promise<string> {
	const hash = await hashPassword(
		password,
		resolvePerformance(config.performance).argon2MemoryMb,
	);
	audit(db, actor, "auth.hash_generated", "staff_user");
	return hash;
}
