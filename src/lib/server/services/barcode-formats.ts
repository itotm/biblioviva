// SPDX-License-Identifier: GPL-3.0-or-later
// The formats of copy barcodes and card numbers from the admin UI (PLAN.md step 12.2): a draft is
// planned first — patterns that do not compile, the never-confused rule (Q90), ten example codes
// of each kind, how many stored codes each format has — and saved as one configuration change.
// Changing the format of a kind moves the previous one to its retired formats, so the codes
// already printed keep working; a retired or legacy format with codes in the database cannot be
// removed.
import { loadConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ServerContext } from "#lib/server/context.js";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { codesOfShape, type CodeColumn } from "#lib/server/barcodes/counters.js";
import { codeFormatsFromConfig } from "#lib/server/barcodes/table.js";
import { checkCodeTable, type FormatIssue } from "#lib/shared/barcodes/compare.js";
import {
	capacity,
	compileFormat,
	generateCode,
	matchesShape,
	PatternError,
	type CompiledFormat,
	type FormatDef,
	type PatternErrorCode,
} from "#lib/shared/barcodes/pattern.js";
import { buildCodeTable, type CodeFormats, type CodeKind } from "#lib/shared/barcodes/table.js";
import { sql } from "drizzle-orm";
import type { AuditActor } from "./audit.js";
import { commitConfigChange } from "./config-commit.js";
import { draftWrites, keyDrafts, type ConfigChange } from "./config-edit.js";

export interface KindDraft {
	format: FormatDef;
	retired: FormatDef[];
	legacy: FormatDef[];
}

export interface BarcodeFormatsDraft {
	item: KindDraft;
	patron: KindDraft;
	libraryCode: string;
	plainMaxLength: number;
}

export interface FormatUsage {
	format: FormatDef;
	/** Stored codes with this format's shape. */
	count: number;
}

export interface KindPlan {
	current: FormatUsage;
	retired: FormatUsage[];
	legacy: FormatUsage[];
	/** Ten codes of the current format, as new copies or cards would get them. */
	examples: string[];
}

export interface PatternProblem {
	kind: CodeKind;
	role: "current" | "retired" | "legacy";
	pattern: string;
	code: PatternErrorCode;
}

export interface RemovalProblem {
	kind: CodeKind;
	role: "retired" | "legacy";
	format: FormatDef;
	count: number;
}

export interface BarcodeFormatsPlan {
	/** The draft as it would be saved (a replaced format moved to the retired ones). */
	draft: BarcodeFormatsDraft;
	patterns: PatternProblem[];
	/** The never-confused rule (errors block the save, warnings do not). */
	issues: FormatIssue[];
	/** Formats with stored codes that the draft removes. */
	removals: RemovalProblem[];
	item: KindPlan | null;
	card: KindPlan | null;
	/** Digits of the longest plain number stored that matches no format (a hint for `plainMaxLength`). */
	plainLongest: number;
	changed: boolean;
	ready: boolean;
}

export class BarcodeFormatsNotReadyError extends Error {
	constructor(readonly plan: BarcodeFormatsPlan) {
		super("the barcode formats cannot be saved as they are");
		this.name = "BarcodeFormatsNotReadyError";
	}
}

const same = (a: FormatDef, b: FormatDef): boolean =>
	a.pattern === b.pattern && a.check === b.check;

/** The barcode settings of the configuration as an editable draft. */
export function currentBarcodeDraft(config: AppConfig): BarcodeFormatsDraft {
	const { item, patron, libraryCode, plainMaxLength } = config.barcodes;
	return {
		item: { format: item.format, retired: item.retired, legacy: item.legacy },
		patron: { format: patron.format, retired: patron.retired, legacy: patron.legacy },
		libraryCode,
		plainMaxLength,
	};
}

/** A replaced current format joins the retired ones (once), so its codes keep working. */
function withRetired(before: KindDraft, after: KindDraft): KindDraft {
	if (same(before.format, after.format)) {
		return after;
	}
	const retired = after.retired.filter((f) => !same(f, after.format));
	if (!retired.some((f) => same(f, before.format))) {
		retired.push(before.format);
	}
	return { ...after, retired };
}

function formatsOf(draft: BarcodeFormatsDraft, config: AppConfig): CodeFormats {
	const base = codeFormatsFromConfig(config);
	return {
		...base,
		item: {
			current: draft.item.format,
			retired: draft.item.retired,
			legacy: draft.item.legacy,
		},
		card: {
			current: draft.patron.format,
			retired: draft.patron.retired,
			legacy: draft.patron.legacy,
		},
		libraryCode: draft.libraryCode,
		plainMaxLength: draft.plainMaxLength,
	};
}

const COLUMN: Record<CodeKind, CodeColumn> = { item: "item.barcode", card: "patron.card_number" };

function usage(db: DbOrTx, kind: CodeKind, format: CompiledFormat): FormatUsage {
	return { format: format.def, count: codesOfShape(db, COLUMN[kind], format).length };
}

function examples(format: CompiledFormat, year: number): string[] {
	const top = capacity(format);
	// the first numbers, then numbers spread up to the largest the counter holds
	const first = [1, 2, 3, 42, 267].filter((n) => n <= top);
	const spread = Array.from({ length: 10 - first.length }, (_, k) =>
		Math.max(1, Math.floor((top * (k + 1)) / (10 - first.length))),
	);
	return [...new Set([...first, ...spread])]
		.sort((a, b) => a - b)
		.map((counter) => generateCode(format, { counter, year }));
}

/** Plans a draft against the database; nothing is written. */
export function planBarcodeFormats(
	db: Db,
	config: AppConfig,
	input: BarcodeFormatsDraft,
	year: number,
): BarcodeFormatsPlan {
	const before = currentBarcodeDraft(config);
	const draft: BarcodeFormatsDraft = {
		...input,
		item: withRetired(before.item, input.item),
		patron: withRetired(before.patron, input.patron),
	};
	const changed = JSON.stringify(draft) !== JSON.stringify(before);
	const formats = formatsOf(draft, config);

	const patterns: PatternProblem[] = [];
	for (const [kind, key] of [
		["item", "item"],
		["card", "patron"],
	] as const) {
		const k = draft[key];
		const all = [
			["current", k.format] as const,
			...k.retired.map((f) => ["retired", f] as const),
			...k.legacy.map((f) => ["legacy", f] as const),
		];
		for (const [role, def] of all) {
			try {
				compileFormat(def, {
					libraryCode: draft.libraryCode,
					counterOptional: role === "legacy",
				});
			} catch (e) {
				if (!(e instanceof PatternError)) {
					throw e;
				}
				patterns.push({ kind, role, pattern: def.pattern, code: e.code });
			}
		}
	}

	let issues: FormatIssue[] = [];
	let item: KindPlan | null = null;
	let card: KindPlan | null = null;
	const removals: RemovalProblem[] = [];
	let plainLongest = 0;
	if (patterns.length === 0) {
		const table = buildCodeTable(formats);
		issues = checkCodeTable(table);
		const plan = (kind: CodeKind): KindPlan => ({
			current: usage(db, kind, table[kind].current),
			retired: table[kind].retired.map((f) => usage(db, kind, f)),
			legacy: table[kind].legacy.map((f) => usage(db, kind, f)),
			examples: examples(table[kind].current, year),
		});
		item = plan("item");
		card = plan("card");
		// formats of the saved configuration that the draft drops while codes of theirs are stored
		const saved = buildCodeTable(codeFormatsFromConfig(config));
		for (const [kind, key] of [
			["item", "item"],
			["card", "patron"],
		] as const) {
			for (const role of ["retired", "legacy"] as const) {
				for (const f of saved[kind][role]) {
					const kept =
						draft[key][role].some((d) => same(d, f.def)) ||
						same(draft[key].format, f.def);
					if (!kept) {
						const count = usage(db, kind, f).count;
						if (count > 0) {
							removals.push({ kind, role, format: f.def, count });
						}
					}
				}
			}
		}
		const known = [table.item, table.card].flatMap((k) => [
			k.current,
			...k.retired,
			...k.legacy,
		]);
		const rows = db.all<{ code: string }>(
			sql`select barcode as code from item where barcode not glob '*[^0-9]*'
			    union all
			    select card_number as code from patron
			    where card_number is not null and card_number not glob '*[^0-9]*'`,
		);
		for (const { code } of rows) {
			if (code !== "" && !known.some((f) => matchesShape(f, code))) {
				plainLongest = Math.max(plainLongest, code.length);
			}
		}
	}
	const ready =
		patterns.length === 0 &&
		removals.length === 0 &&
		!issues.some((i) => i.severity === "error");
	return { draft, patterns, issues, removals, item, card, plainLongest, changed, ready };
}

/** Saves a ready draft as one configuration change (audited). */
export function saveBarcodeFormats(
	{ db, config, configDir }: Pick<ServerContext, "db" | "config" | "configDir">,
	input: BarcodeFormatsDraft,
	year: number,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	const plan = planBarcodeFormats(db, config, input, year);
	if (!plan.ready) {
		throw new BarcodeFormatsNotReadyError(plan);
	}
	const d = plan.draft;
	const drafts = keyDrafts(configDir, loadConfig(configDir), {
		"barcodes.libraryCode": d.libraryCode,
		"barcodes.plainMaxLength": d.plainMaxLength,
		"barcodes.item.format": d.item.format,
		"barcodes.item.retired": d.item.retired,
		"barcodes.item.legacy": d.item.legacy,
		"barcodes.patron.format": d.patron.format,
		"barcodes.patron.retired": d.patron.retired,
		"barcodes.patron.legacy": d.patron.legacy,
	});
	return commitConfigChange(db, configDir, {
		action: "config.barcodes",
		writes: draftWrites(drafts),
		audit: {
			actor,
			details: {
				item: d.item.format.pattern,
				itemCheck: d.item.format.check,
				card: d.patron.format.pattern,
				cardCheck: d.patron.format.check,
			},
		},
		now,
	}).change;
}
