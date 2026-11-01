// SPDX-License-Identifier: GPL-3.0-or-later
// The web app manifest (step 9.9): the app installed from the phone's browser opens on the
// dashboard in a window of its own, with the library's name and the title bar in the colours of
// the chosen set. Icons are the BiblioViva logo (static/icons).
import type { AppConfig } from "#lib/server/config/schema.js";
import { backgroundColor, themeColor } from "#lib/shared/theme-palette.js";

export interface WebManifest {
	name: string;
	short_name: string;
	lang: string;
	start_url: string;
	scope: string;
	display: "standalone";
	orientation: "any";
	theme_color: string;
	background_color: string;
	icons: { src: string; sizes: string; type: string; purpose: "any" | "maskable" }[];
}

export function webManifest(config: AppConfig): WebManifest {
	return {
		name: `${config.library.name} · BiblioViva`,
		short_name: "BiblioViva",
		lang: config.ui.locale,
		start_url: "/",
		scope: "/",
		display: "standalone",
		orientation: "any",
		theme_color: themeColor(config.ui.theme),
		background_color: backgroundColor(config.ui.theme),
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{
				src: "/icons/icon-maskable-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
}
