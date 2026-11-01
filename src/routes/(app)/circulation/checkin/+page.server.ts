// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** Check-in desk (step 4.4): `loans`. `?barcode=` comes from the checkout desk's messages. */
export const load: PageServerLoad = ({ locals, url }) => {
	requirePermission(locals, "loans");
	return { barcode: (url.searchParams.get("barcode") ?? "").slice(0, 64) };
};
