// SPDX-License-Identifier: GPL-3.0-or-later
import type { Permission } from "#lib/shared/permissions.js";

/** The logged-in staff account as seen by the rest of the server (never the password hash). */
export interface AuthUser {
	id: number;
	username: string;
	displayName: string;
	roles: string[];
	permissions: Permission[];
	/** The password was given by an administrator: nothing else opens until it is changed (9.51). */
	mustChangePassword?: boolean;
}
