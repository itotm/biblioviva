// SPDX-License-Identifier: GPL-3.0-or-later
// Every target of the help links of the app, for `bun run site:check` and the tests.
import { CHECKLIST_HELP, CHECKLIST_TEST_HELP } from "./help-checklist.js";
import { CONFIG_SECTION_ANCHORS, HELP_PAGES, type HelpTarget, SCREEN_HELP } from "./help-links.js";
import { HELP_SPOTS } from "./help-spots.js";

/**
 * Every page and section the app can open in the documentation: the entries of `SCREEN_HELP` (the
 * entries that read a parameter, once for each value they know), the page of each area, the
 * small help icons of `HELP_SPOTS` and the links of the installation check. `bun run site:check` checks each one in every language.
 */
export function allHelpTargets(): HelpTarget[] {
	const targets: HelpTarget[] = [];
	for (const entry of Object.values(SCREEN_HELP)) {
		if (typeof entry === "function") {
			for (const key of Object.keys(CONFIG_SECTION_ANCHORS)) {
				targets.push(entry({ section: key }));
			}
			targets.push(entry({ section: "" }));
		} else if (entry) {
			targets.push(entry);
		}
	}
	for (const page of Object.values(HELP_PAGES)) {
		targets.push({ page });
	}
	targets.push(...Object.values(HELP_SPOTS));
	targets.push(...Object.values(CHECKLIST_HELP), ...Object.values(CHECKLIST_TEST_HELP));
	return targets;
}
