// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { can, opensOnDesk } from "#lib/server/auth/rbac.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { pinnedNotes } from "#lib/server/services/notes.js";
import type { PageServerLoad } from "./$types";

/** Checkout desk (step 4.3): `loans`; the override of Appendix I needs `admin`. */
export const load: PageServerLoad = ({ locals, url }) => {
	const user = requirePermission(locals, "loans");
	const patron = Number(url.searchParams.get("patron"));
	const config = getConfig();
	return {
		canOverride: can(user, "admin"),
		/** "Classifica" on a copy of a record still to classify (9.21). */
		canClassify: can(user, "catalog"),
		idleSeconds: config.ui.checkoutIdleSeconds,
		/** "Stampa ricevuta" (`circulation.receipts`, off by default). */
		receipts: config.circulation.receipts,
		/** "Vai a Prestiti con questo utente" from the Returns page. */
		patronId: Number.isInteger(patron) && patron > 0 ? patron : null,
		/** The pinned staff notes, for the accounts that never see the dashboard (9.18). */
		pinnedNotes: opensOnDesk(user) ? pinnedNotes(getDb()) : [],
	};
};
