// SPDX-License-Identifier: GPL-3.0-or-later
import { dev } from "$app/env";
import { error } from "@sveltejs/kit";

/** The living style guide exists only in development and in the test build (DEV_UI=1). */
export function load(): Record<string, never> {
	if (!dev && process.env.DEV_UI !== "1") {
		error(404, "Not found");
	}
	return {};
}
