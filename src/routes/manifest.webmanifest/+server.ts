// SPDX-License-Identifier: GPL-3.0-or-later
// The web app manifest (step 9.9). Public like the icons: the browser fetches it without the
// session cookie; it tells only the library's name and colours.
import { getConfig } from "#lib/server/config/index.js";
import { webManifest } from "#lib/server/services/web-manifest.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () =>
	new Response(JSON.stringify(webManifest(getConfig())), {
		headers: {
			"Content-Type": "application/manifest+json; charset=utf-8",
			"Cache-Control": "no-cache",
		},
	});
