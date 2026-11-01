// SPDX-License-Identifier: GPL-3.0-or-later
// Mirrors `security.users` from config.json into the staff_user table (PLAN.md §3.5, Q20).
import { eq } from "drizzle-orm";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Db } from "#lib/server/db/client.js";
import { staffUser } from "#lib/server/db/schema.js";
import { hashPassword, verifyPassword } from "./password.js";
import { deleteUserSessions } from "./session.js";

export interface MirrorSummary {
	created: string[];
	updated: string[];
	deactivated: string[];
	/** Accounts whose `password` is written in clear in config.json (warning). */
	plainPasswords: string[];
}

/**
 * Clear passwords already checked against a stored hash in this process: a configuration reload
 * (every change made from the admin UI) does not run argon2 again for each of them.
 */
const verified = new Map<string, string>();

export async function mirrorConfigUsers(db: Db, config: AppConfig): Promise<MirrorSummary> {
	const summary: MirrorSummary = {
		created: [],
		updated: [],
		deactivated: [],
		plainPasswords: [],
	};
	const wanted = new Set<string>();

	for (const u of config.security.users) {
		wanted.add(u.username);
		const existing = db
			.select()
			.from(staffUser)
			.where(eq(staffUser.username, u.username))
			.get();
		let passwordHash: string;
		if (u.passwordHash) {
			passwordHash = u.passwordHash;
		} else {
			summary.plainPasswords.push(u.username);
			// Re-use the stored hash when the clear password did not change (argon2 is deliberately slow).
			const key = `${u.username}\u0000${u.password ?? ""}`;
			const same =
				existing !== undefined &&
				(verified.get(key) === existing.passwordHash ||
					(await verifyPassword(u.password ?? "", existing.passwordHash)));
			passwordHash =
				same && existing ? existing.passwordHash : await hashPassword(u.password ?? "");
			verified.set(key, passwordHash);
		}
		const values = {
			username: u.username,
			passwordHash,
			displayName: u.displayName ?? null,
			roles: u.roles,
			active: u.active ? 1 : 0,
			source: "config" as const,
			updatedAt: new Date().toISOString(),
		};
		if (!existing) {
			// two mirrors may run at once (a change from the admin UI and the reload it causes)
			db.insert(staffUser)
				.values(values)
				.onConflictDoUpdate({ target: staffUser.username, set: values })
				.run();
			summary.created.push(u.username);
		} else {
			const changed =
				existing.passwordHash !== values.passwordHash ||
				existing.displayName !== values.displayName ||
				JSON.stringify(existing.roles) !== JSON.stringify(values.roles) ||
				existing.active !== values.active;
			if (changed) {
				db.update(staffUser).set(values).where(eq(staffUser.id, existing.id)).run();
				summary.updated.push(u.username);
				if (values.active === 0 || existing.passwordHash !== values.passwordHash) {
					deleteUserSessions(db, existing.id);
				}
			}
		}
	}

	// Config accounts that disappeared from the file are deactivated (never deleted: audit rows point to them).
	const configRows = db.select().from(staffUser).where(eq(staffUser.source, "config")).all();
	for (const row of configRows) {
		if (!wanted.has(row.username) && row.active === 1) {
			db.update(staffUser)
				.set({ active: 0, updatedAt: new Date().toISOString() })
				.where(eq(staffUser.id, row.id))
				.run();
			deleteUserSessions(db, row.id);
			summary.deactivated.push(row.username);
		}
	}
	return summary;
}

/** True when at least one active account exists (otherwise the app runs in setup mode, 1.11). */
export function hasActiveAccounts(db: Db): boolean {
	return (
		db.select({ id: staffUser.id }).from(staffUser).where(eq(staffUser.active, 1)).get() !==
		undefined
	);
}

export function findUserByUsername(
	db: Db,
	username: string,
):
	| {
			createdAt: string;
			updatedAt: string;
			id: number;
			username: string;
			passwordHash: string;
			displayName: string | null;
			roles: string[];
			active: number;
			mustChangePassword: number;
			source: string;
			lastLoginAt: string | null;
	  }
	| undefined {
	return db.select().from(staffUser).where(eq(staffUser.username, username)).get();
}

export function touchLastLogin(db: Db, userId: number, now = new Date()): void {
	db.update(staffUser)
		.set({ lastLoginAt: now.toISOString() })
		.where(eq(staffUser.id, userId))
		.run();
}
