// SPDX-License-Identifier: GPL-3.0-or-later
// "Controllo installazione" (step 8.7): the checklist of the installation, in status and links
// — nothing is edited here. The address is read from the request as the server sees it (the scheme
// comes from the proxy's header, the Tailscale sidecar or the local-network front); requires the
// `admin` permission.
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { serverContext } from "#lib/server/context.js";
import { env } from "#lib/server/env.js";
import { installCheck } from "#lib/server/services/install-check.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, "admin");
	const ctx = serverContext();
	const { labels, cards } = ctx.config;
	return {
		check: await installCheck(ctx, {
			request: { protocol: url.protocol, hostname: url.hostname, host: url.host },
			lanFront: env().LAN_PORT !== undefined,
			deep: true,
		}),
		/** What the test pages are printed with: the default card template, the pair's stock. */
		print: {
			cardTemplate: cards.defaultTemplate,
			labelStock: labels.pair.stock,
		},
	};
};
