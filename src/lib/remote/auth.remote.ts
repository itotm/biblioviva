// SPDX-License-Identifier: GPL-3.0-or-later
// Login and logout (PLAN.md step 1.3). The only unauthenticated remote function is `login`.
import { clientAddress } from "#lib/server/auth/client-address.js";
import { command, form, getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";
import * as v from "valibot";
import {
	SESSION_COOKIE,
	createSession,
	deleteSession,
	findUserByUsername,
	sessionCookieOptions,
	touchLastLogin,
	verifyPassword,
} from "#lib/server/auth/index.js";
import { loginLimiter } from "#lib/server/auth/login-limiter.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { isDemoPublic } from "#lib/server/demo/public.js";
import { audit } from "#lib/server/services/audit.js";

export type LoginError = "invalid_credentials" | "rate_limited";

const loginSchema = v.object({
	username: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.minLength(1), v.maxLength(64)),
	password: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
	redirectTo: v.optional(v.string(), "/"),
});

function safeRedirectTarget(target: string): string {
	return target.startsWith("/") && !target.startsWith("//") ? target : "/";
}

export const login = form(loginSchema, async ({ username, password, redirectTo }) => {
	const event = getRequestEvent();
	const db = getDb();
	const config = getConfig();
	const limiter = loginLimiter();
	const ipKey = `ip:${clientAddress(event)}`;
	const userKey = `user:${username}`;

	if (!limiter.allowed(ipKey) || !limiter.allowed(userKey)) {
		return {
			error: "rate_limited" as LoginError,
			retryAfter: Math.max(
				limiter.retryAfterSeconds(ipKey),
				limiter.retryAfterSeconds(userKey),
			),
		};
	}

	const user = findUserByUsername(db, username);
	// Constant-time failure path: always run a verification, even when the user does not exist.
	const ok = await verifyPassword(
		password,
		user?.passwordHash ??
			"$argon2id$v=19$m=65536,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
	);
	if (!user || !ok || user.active !== 1) {
		limiter.fail(ipKey);
		limiter.fail(userKey);
		return { error: "invalid_credentials" as LoginError, retryAfter: 0 };
	}

	limiter.reset(ipKey);
	limiter.reset(userKey);
	// the address the proxy reports (a tailnet IP in production): which device logged in; the
	// public demo never stores a visitor's address (9.17), the limiters keep it in memory only
	const ip = isDemoPublic() ? null : clientAddress(event);
	const token = createSession(db, user.id, {
		days: config.security.sessionDays,
		ip,
		userAgent: event.request.headers.get("user-agent"),
	});
	touchLastLogin(db, user.id);
	audit(
		db,
		{ id: user.id },
		"auth.login",
		"staff_user",
		user.id,
		ip === null ? undefined : { ip },
	);
	event.cookies.set(
		SESSION_COOKIE,
		token,
		sessionCookieOptions(event.url, config.security.sessionDays),
	);
	redirect(303, safeRedirectTarget(redirectTo));
});

export const logout = command(() => {
	const event = getRequestEvent();
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		deleteSession(getDb(), token);
	}
	if (event.locals.user) {
		audit(getDb(), event.locals.user, "auth.logout", "staff_user", event.locals.user.id);
	}
	event.cookies.delete(SESSION_COOKIE, { path: "/" });
	return { ok: true };
});
