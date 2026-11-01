// SPDX-License-Identifier: GPL-3.0-or-later
// Sessions (PLAN.md §3.5): random token, stored hashed, sliding expiration.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Db } from "#lib/server/db/client.js";
import { session, staffUser } from "#lib/server/db/schema.js";
import type { AuthUser } from "./types.js";
import { permissionsOf } from "./rbac.js";

export const SESSION_COOKIE = "bv_session";

/**
 * The session cookie's options. `Secure` follows the scheme of the request (the sidecar's
 * `x-forwarded-proto` behind Tailscale): over HTTPS the browser sends the cookie on HTTPS only;
 * the basic local-network mode (step 8.8) is plain HTTP, where a `Secure` cookie would be dropped
 * and nobody could log in.
 */
export function sessionCookieOptions(
	url: URL,
	days: number,
): { path: string; httpOnly: true; sameSite: "lax"; secure: boolean; maxAge: number } {
	return {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: url.protocol === "https:",
		maxAge: days * 86_400,
	};
}

const DAY_MS = 86_400_000;

export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
	return randomBytes(32).toString("base64url");
}

export interface SessionOptions {
	days: number;
	ip?: string | null;
	userAgent?: string | null;
	now?: Date;
}

/** Creates a session row and returns the cookie value (never stored in clear). */
export function createSession(db: Db, userId: number, options: SessionOptions): string {
	const token = newToken();
	const now = options.now ?? new Date();
	db.insert(session)
		.values({
			id: hashToken(token),
			userId,
			createdAt: now.toISOString(),
			lastSeenAt: now.toISOString(),
			expiresAt: new Date(now.getTime() + options.days * DAY_MS).toISOString(),
			ip: options.ip ?? null,
			userAgent: options.userAgent?.slice(0, 200) ?? null,
		})
		.run();
	return token;
}

export interface ResolvedSession {
	user: AuthUser;
	sessionId: string;
}

/**
 * Looks a token up; returns null when unknown, expired or the account is inactive.
 * Sliding expiration: the expiry moves forward once a day of use.
 */
export function resolveSession(
	db: Db,
	token: string | undefined,
	rolesConfig: Record<string, readonly string[]>,
	days: number,
	now = new Date(),
): ResolvedSession | null {
	if (!token) {
		return null;
	}
	const id = hashToken(token);
	const row = db
		.select({
			sessionId: session.id,
			expiresAt: session.expiresAt,
			lastSeenAt: session.lastSeenAt,
			userId: staffUser.id,
			username: staffUser.username,
			displayName: staffUser.displayName,
			roles: staffUser.roles,
			active: staffUser.active,
		})
		.from(session)
		.innerJoin(staffUser, eq(session.userId, staffUser.id))
		.where(and(eq(session.id, id), gt(session.expiresAt, now.toISOString())))
		.get();
	if (!row?.active) {
		return null;
	}
	if (now.getTime() - Date.parse(row.lastSeenAt) > DAY_MS) {
		db.update(session)
			.set({
				lastSeenAt: now.toISOString(),
				expiresAt: new Date(now.getTime() + days * DAY_MS).toISOString(),
			})
			.where(eq(session.id, id))
			.run();
	}
	return {
		sessionId: id,
		user: {
			id: row.userId,
			username: row.username,
			displayName: row.displayName ?? row.username,
			roles: row.roles,
			permissions: permissionsOf(row.roles, rolesConfig),
		},
	};
}

export function deleteSession(db: Db, token: string): void {
	db.delete(session)
		.where(eq(session.id, hashToken(token)))
		.run();
}

export function deleteUserSessions(db: Db, userId: number): void {
	db.delete(session).where(eq(session.userId, userId)).run();
}

/** Housekeeping: drop expired rows (called from the daily backup job). */
export function purgeExpiredSessions(db: Db, now = new Date()): number {
	return db.delete(session).where(lt(session.expiresAt, now.toISOString())).run().changes;
}
