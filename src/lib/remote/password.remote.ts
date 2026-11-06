// SPDX-License-Identifier: GPL-3.0-or-later
// One's own password (step 9.51): every account changes it from the account menu, and an account
// whose password was given by an administrator changes it before anything else opens.
import { command, getRequestEvent } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { MIN_PASSWORD_LENGTH } from "#lib/server/auth/password.js";
import { hashToken, SESSION_COOKIE } from "#lib/server/auth/session.js";
import { getDb } from "#lib/server/db/index.js";
import { assertNotDemo } from "#lib/server/demo/public.js";
import { env } from "#lib/server/env.js";
import {
	changeOwnPassword as changeOwnPasswordService,
	StaffConfigError,
} from "#lib/server/services/staff-config.js";

export const changeOwnPassword = command(
	v.object({
		current: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
		password: v.pipe(v.string(), v.minLength(MIN_PASSWORD_LENGTH), v.maxLength(256)),
	}),
	async ({ current, password }) => {
		// any account, the one whose change is due included (no permission asked)
		const user = requireUser();
		// the accounts of the public demo are shared by every visitor
		assertNotDemo("config");
		const token = getRequestEvent().cookies.get(SESSION_COOKIE);
		try {
			await changeOwnPasswordService(
				getDb(),
				env().CONFIG_DIR,
				user,
				{ current, next: password },
				token ? hashToken(token) : null,
			);
			return { ok: true as const };
		} catch (e) {
			if (
				e instanceof StaffConfigError &&
				(e.code === "wrongPassword" ||
					e.code === "samePassword" ||
					e.code === "passwordTooShort")
			) {
				return { ok: false as const, code: e.code };
			}
			throw e;
		}
	},
);
