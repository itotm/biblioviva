// SPDX-License-Identifier: GPL-3.0-or-later
// Patron photos and book covers can be switched off (9.38, Q135: `photos.enabled`,
// `covers.enabled`). Off, the pages and remote functions about them answer 404 as if they did not
// exist; the files already stored are kept, so switching back on shows them again.
import { error } from "@sveltejs/kit";
import { getConfig } from "#lib/server/config/index.js";
import type { AppConfig } from "#lib/server/config/schema.js";

export type Feature = "photos" | "covers";

export function featureOn(feature: Feature, config: AppConfig = getConfig()): boolean {
	return config[feature].enabled;
}

/** A 404 when the feature is switched off: the first line after `requireUser` of its endpoints. */
export function requireFeature(feature: Feature): void {
	if (!featureOn(feature)) {
		error(404, `${feature} are switched off`);
	}
}
