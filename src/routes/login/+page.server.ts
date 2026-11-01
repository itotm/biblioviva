// SPDX-License-Identifier: GPL-3.0-or-later
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** Logged-in users never see the login page. */
export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) {
		redirect(303, url.searchParams.get("redirectTo") ?? "/");
	}
	return {};
};
