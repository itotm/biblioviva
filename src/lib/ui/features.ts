// SPDX-License-Identifier: GPL-3.0-or-later
// Patron photos and book covers switched on or off for the installation (9.38, Q135), from the
// root layout's data: read inside a template or a `$derived`, they follow a configuration change.
import { page } from "$app/state";

/** Patron photos (`photos.enabled`): off, no photo is taken, shown or asked for. */
export function photosOn(): boolean {
	return page.data.photosEnabled !== false;
}

/** Book covers (`covers.enabled`): off, no cover is looked up, taken or shown. */
export function coversOn(): boolean {
	return page.data.coversEnabled !== false;
}
