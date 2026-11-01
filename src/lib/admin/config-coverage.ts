// SPDX-License-Identifier: GPL-3.0-or-later
// Coverage map of the configuration UI (PLAN.md Phase 11, completeness rule): which editor handles
// every key of the configuration schema and every kind of file of the configuration folder.
// Simple keys (text, numbers, yes/no, choices, lists) are handled by the settings pages generated
// from the schema (step 11.2) unless listed here; the entries below name the dedicated editor, or
// the step that will provide it (`pending`, none left since step 11.9). The unit test fails on
// any key or file kind without an editor, and on any pending entry.
import type { ResolvedPathname } from "$app/types";
import type { ConfigFileKind } from "#lib/server/config/folder.js";

export type ConfigEditor =
	| "settings"
	| "taxonomy"
	| "appearance"
	| "wizard"
	| "history"
	| "itemTypes"
	| "schoolLevels"
	| "barcodes"
	| "itemTypeRules"
	| "calendar"
	| "cardTemplates"
	| "stocks"
	| "templates"
	| "accounts"
	| "roles"
	| "z3950Targets"
	| "coverProviders"
	| "languages"
	| "reports";

export type Coverage = { editor: ConfigEditor } | { pending: string };

/**
 * Keys (and every key under them: `a.b` covers `a.b.c`, `a.b[].c`, `a.b.*`) handled by something
 * other than the generated settings forms.
 */
export const KEY_COVERAGE: Readonly<Record<string, Coverage>> = {
	"library.itemTypes": { editor: "itemTypes" },
	// the levels and stages of the school, and the preset they came from (Phase 12)
	"school.preset": { editor: "schoolLevels" },
	"school.stages": { editor: "schoolLevels" },
	"school.levels": { editor: "schoolLevels" },
	"barcodes.patron.counterStart": { editor: "barcodes" },
	// the formats and the codes of the past (step 12.2): planned and saved together
	"barcodes.libraryCode": { editor: "barcodes" },
	"barcodes.plainMaxLength": { editor: "barcodes" },
	"barcodes.item.format": { editor: "barcodes" },
	"barcodes.item.retired": { editor: "barcodes" },
	"barcodes.item.legacy": { editor: "barcodes" },
	"barcodes.patron.format": { editor: "barcodes" },
	"barcodes.patron.retired": { editor: "barcodes" },
	"barcodes.patron.legacy": { editor: "barcodes" },
	"circulation.itemTypeOverrides": { editor: "itemTypeRules" },
	"calendar.weeklyClosedDays": { editor: "calendar" },
	// also filled by calendar.<year>.json: edited with the calendar, never as a plain list
	"calendar.holidays": { editor: "calendar" },
	"calendar.closedRanges": { editor: "calendar" },
	"z3950.targets": { editor: "z3950Targets" },
	classification: { editor: "taxonomy" },
	"cards.templateByPatronType": { editor: "cardTemplates" },
	"cards.sheet.cutLines": { editor: "cardTemplates" },
	"labels.stocks": { editor: "stocks" },
	"covers.providers": { editor: "coverProviders" },
	"security.users": { editor: "accounts" },
	// "database" is personal accounts from the admin UI (Phase 10.1): shown with the accounts
	"security.auth": { editor: "accounts" },
	"security.roles": { editor: "roles" },
	"ui.locale": { editor: "appearance" },
	"ui.theme": { editor: "appearance" },
	"ui.dashboard": { editor: "appearance" },
	"ui.areaStyle": { editor: "appearance" },
	// set by the first-run wizard when it completes
	"ui.setupCompleted": { editor: "wizard" },
};

/** Every kind of file of the configuration folder (the table `CONFIG_FILES` of the loader). */
export const FILE_COVERAGE: Readonly<Record<ConfigFileKind, Coverage>> = {
	"config.json": { editor: "settings" },
	"<section>.json": { editor: "settings" },
	"calendar.<year>.json": { editor: "calendar" },
	"labels/stocks/<id>.json": { editor: "stocks" },
	"cards/templates/<name>/": { editor: "templates" },
	"labels/templates/<name>/": { editor: "templates" },
	"slips/templates/<name>/": { editor: "templates" },
	"reports/<name>.json": { editor: "reports" },
	"classification/images/": { editor: "taxonomy" },
	"branding/logo.png": { editor: "appearance" },
	"i18n/<code>/": { editor: "languages" },
	"history/": { editor: "history" },
};

/**
 * Editors drawn as blocks of a section's settings page, below its generated form (step 11.4): the
 * page draws the block of each editor listed here.
 */
export const SECTION_BLOCKS: Readonly<Record<string, readonly ConfigEditor[]>> = {
	library: ["itemTypes"],
	school: ["schoolLevels"],
	barcodes: ["barcodes"],
	circulation: ["itemTypeRules"],
	calendar: ["calendar"],
	cards: ["cardTemplates"],
	labels: ["stocks"],
	z3950: ["z3950Targets"],
	covers: ["coverProviders"],
	ui: ["languages"],
};

/** The entry that covers a leaf key (`library.itemTypes[].code`), or null for a settings key. */
export function coverageOf(path: string): { key: string; coverage: Coverage } | null {
	let best: string | null = null;
	for (const key of Object.keys(KEY_COVERAGE)) {
		const covers =
			path === key ||
			path.startsWith(`${key}.`) ||
			path.startsWith(`${key}[]`) ||
			path.startsWith(`${key}.*`);
		if (covers && (best === null || key.length > best.length)) {
			best = key;
		}
	}
	const coverage = best === null ? undefined : KEY_COVERAGE[best];
	return best !== null && coverage ? { key: best, coverage } : null;
}

/** Where an editor lives in the app (the settings pages are per section). */
export function editorHref(editor: ConfigEditor, section: string): ResolvedPathname | null {
	switch (editor) {
		case "settings":
			return `/admin/config/${section}`;
		case "taxonomy":
			return "/admin/config/classification";
		case "appearance":
			return "/admin/appearance";
		case "history":
			return "/admin/config/history";
		case "itemTypes":
			return "/admin/config/library";
		case "schoolLevels":
			return "/admin/config/school";
		case "barcodes":
			return "/admin/config/barcodes";
		case "itemTypeRules":
			return "/admin/config/circulation";
		case "calendar":
			return "/admin/config/calendar";
		case "cardTemplates":
			return "/admin/config/cards";
		case "stocks":
			return "/admin/config/labels";
		case "templates":
			return "/admin/config/templates";
		case "accounts":
		case "roles":
			return "/admin/users";
		case "z3950Targets":
			return "/admin/config/z3950";
		case "coverProviders":
			return "/admin/config/covers";
		case "languages":
			return "/admin/config/ui";
		case "reports":
			return "/admin/config/reports";
		case "wizard":
			return null;
	}
}
