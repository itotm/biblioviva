// SPDX-License-Identifier: GPL-3.0-or-later
// The parts a backup, a restore, an export or an import can cover (PLAN.md step 11.12, owner
// request): the library's data — patrons, catalogue with its copies, loans and their history,
// print lists, patron photos, covers, staff notes, the notable dates of the calendar, audit log — and every part of the configuration — the
// settings of each section, the classification with its pictograms, the adhesive stocks, the
// calendar, the reports, the card, label (pair, barcode label, spine band) and slip templates, the
// language packs, the logo. Shared by the pages (the checkboxes) and the server.

export const DATA_PARTS = [
	"patrons",
	"catalog",
	"loans",
	"printLists",
	"photos",
	"covers",
	"notes",
	"dates",
	"audit",
] as const;
export type DataPart = (typeof DATA_PARTS)[number];

/** Configuration parts that are not one plain section of the settings. */
export const CONFIG_PARTS = [
	"classification",
	"stocks",
	"calendar",
	"reports",
	"cardTemplates",
	"pairTemplates",
	"barcodeTemplates",
	"spineTemplates",
	"slipTemplates",
	"languages",
	"logo",
] as const;
export type ConfigPart = (typeof CONFIG_PARTS)[number];

/**
 * `data:<part>`, `config:<part>`, or `section:<name>` for the settings of one section (every
 * section of the schema except `classification` and `calendar`, which are parts of their own).
 */
export type PartId = `data:${DataPart}` | `config:${ConfigPart}` | `section:${string}`;

export const PART_ID = /^(data:[a-zA-Z]+|config:[a-zA-Z]+|section:[a-z0-9]+)$/;

export const dataPart = (p: DataPart): PartId => `data:${p}`;
export const configPart = (p: ConfigPart): PartId => `config:${p}`;
export const sectionPart = (s: string): PartId => `section:${s}`;

export function isPartId(value: string): value is PartId {
	if (!PART_ID.test(value)) {
		return false;
	}
	const [group, name = ""] = value.split(":");
	return group === "data"
		? (DATA_PARTS as readonly string[]).includes(name)
		: group === "config"
			? (CONFIG_PARTS as readonly string[]).includes(name)
			: true;
}

export const isDataPart = (id: string): boolean => id.startsWith("data:");

/**
 * What a data part needs to be restored on its own: its rows point at patrons or copies. The
 * restore checks the references for real; this is what the pages suggest.
 */
export const DATA_NEEDS: Readonly<Partial<Record<DataPart, readonly DataPart[]>>> = {
	loans: ["patrons", "catalog"],
	printLists: ["patrons", "catalog"],
	photos: ["patrons"],
	covers: ["catalog"],
};

/** The data parts among part ids (`data:loans` → `loans`). */
export function dataPartsOf(ids: readonly string[]): DataPart[] {
	return ids.filter(isDataPart).map((id) => id.slice("data:".length) as DataPart);
}

/** Sections of the settings that are parts of their own, with their files (the taxonomy, the calendar). */
const SECTION_PARTS: Readonly<Record<string, ConfigPart>> = {
	classification: "classification",
	calendar: "calendar",
};

/** The part of a section of the settings (`labels.stocks` is apart: the stocks part). */
export function sectionPartOf(section: string): PartId {
	const own = SECTION_PARTS[section];
	return own ? configPart(own) : sectionPart(section);
}

/**
 * A selection from `--only` / `--except` lists (comma-separated part ids or group names `data`,
 * `config`, `settings`), applied to the parts available.
 */
export function selectParts(
	available: readonly PartId[],
	only: readonly string[] | null,
	except: readonly string[] = [],
): PartId[] {
	const matches = (id: PartId, token: string): boolean =>
		token === id ||
		(token === "data" && id.startsWith("data:")) ||
		(token === "config" && !id.startsWith("data:")) ||
		(token === "settings" && id.startsWith("section:"));
	return available.filter(
		(id) =>
			(only === null || only.some((t) => matches(id, t))) &&
			!except.some((t) => matches(id, t)),
	);
}

/**
 * The staff accounts and their passwords (the settings of the security section). An import
 * leaves them out unless the operator asks for them and confirms: the accounts and passwords of
 * the archive replace the current ones.
 */
export const ACCOUNTS_PART: PartId = sectionPart("security");

/** The parts without the accounts: what an import takes by default. */
export function withoutAccounts(parts: readonly PartId[]): PartId[] {
	return parts.filter((id) => id !== ACCOUNTS_PART);
}
