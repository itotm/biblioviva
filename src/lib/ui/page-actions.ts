// SPDX-License-Identifier: GPL-3.0-or-later
// One action of a page header, as `PageActions` shows it: a button, or an entry of the "Altre
// azioni" menu when the buttons do not fit on one row (9.13, rounds 21–22).
import type { ResolvedPathname } from "$app/types";
import type { IconComponent } from "./icons.js";

export interface PageAction {
	key: string;
	label: string;
	icon?: IconComponent;
	href?: ResolvedPathname;
	download?: boolean;
	onclick?: () => void;
	disabled?: boolean;
	/** The page's main action: first, in colour. */
	primary?: boolean;
	/** Removes something: last, in red. */
	danger?: boolean;
	testid?: string;
}

/** The look of the "Altre azioni" button, shared with the hidden copy `PageActions` measures. */
export const MORE_TRIGGER_CLASS = "btn preset-tonal px-3";
