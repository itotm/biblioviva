// SPDX-License-Identifier: GPL-3.0-or-later
// Guard of the first-run wizard's remote functions: only while the setup has not been completed.
import { error } from "@sveltejs/kit";
import { getRequestEvent } from "$app/server";

export function requireSetupMode(): void {
	if (!getRequestEvent().locals.setupMode) {
		error(404, "setup already completed");
	}
}
