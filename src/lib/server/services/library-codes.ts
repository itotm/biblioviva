// SPDX-License-Identifier: GPL-3.0-or-later
// Codes of the library that the catalogue and the patrons use (PLAN.md step 11.4): the item
// types (`library.itemTypes`, with the loan rules of `circulation.itemTypeOverrides` that name
// them). Like the classification (11.1), a draft is
// planned first — how many copies or students each code has, which codes disappear and where their
// copies or students go (a renamed code: to its new name) — and saved as one configuration change
// with the database updates inside it. Also the barcode counters: the next card number and the
// next copy barcode as a draft would produce them, without using them up.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { loadConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ConfigIssue } from "#lib/server/config/validate.js";
import type { ServerContext } from "#lib/server/context.js";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { item } from "#lib/server/db/schema.js";
import { nextCardNumber, type CardCounterStart } from "#lib/server/barcodes/cards.js";
import { nextItemBarcode } from "#lib/server/barcodes/items.js";
import { codeTable } from "#lib/server/barcodes/table.js";
import { findTemplate } from "#lib/server/templates/engine.js";
import type { AuditActor } from "./audit.js";
import { libraryYear } from "./calendar.js";
import { commitConfigChange } from "./config-commit.js";
import { checkDraftFiles, draftWrites, keyDrafts, type ConfigChange } from "./config-edit.js";
import { templateReferences } from "./template-refs.js";

export interface ItemTypeDraft {
	code: string;
	label: string;
	notForLoan: boolean;
}

export interface RemovedLibraryCode {
	code: string;
	label: string;
	/** Copies of the item type. */
	count: number;
	/** Where they go; required when `count` > 0. */
	replacement: string | null;
}

export interface CodesPlan {
	issues: ConfigIssue[];
	removed: RemovedLibraryCode[];
	changed: boolean;
	ready: boolean;
}

export class CodesNotReadyError extends Error {
	constructor(readonly plan: CodesPlan) {
		super("the change of the codes cannot be saved as it is");
		this.name = "CodesNotReadyError";
	}
}

/** Copies per item type. */
export function itemTypeUsage(db: DbOrTx): Record<string, number> {
	return Object.fromEntries(
		db
			.select({ code: item.itemType, n: sql<number>`count(*)` })
			.from(item)
			.groupBy(item.itemType)
			.all()
			.map((r) => [r.code, r.n]),
	);
}

const normalizeTypes = (draft: readonly ItemTypeDraft[]): Record<string, unknown>[] =>
	draft.map((t) => ({
		code: t.code.trim(),
		label: t.label.trim(),
		...(t.notForLoan ? { notForLoan: true } : {}),
	}));

/** The item-type overrides after renames (moved to the new code) and removals (dropped). */
function overridesAfter(
	config: AppConfig,
	codes: readonly string[],
	replacements: Readonly<Record<string, string>>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	const existing = config.library.itemTypes.map((t) => t.code);
	for (const [code, rule] of Object.entries(config.circulation.itemTypeOverrides)) {
		const target = codes.includes(code) ? code : replacements[code];
		// a renamed type (its new code did not exist) keeps its rule; merged into another type,
		// its copies follow that type's rules
		const renamed = target !== code && target !== undefined && !existing.includes(target);
		if (target && codes.includes(target) && (target === code || renamed) && !(target in out)) {
			out[target] = rule;
		}
	}
	return out;
}

function planCodes(
	before: readonly { code: string; label: string }[],
	after: readonly string[],
	usage: Readonly<Record<string, number>>,
	replacements: Readonly<Record<string, string>>,
	issues: ConfigIssue[],
	changed: boolean,
	what: string,
): CodesPlan {
	const removed: RemovedLibraryCode[] = before
		.filter((c) => !after.includes(c.code))
		.map((c) => {
			const wanted = replacements[c.code];
			if (wanted !== undefined && !after.includes(wanted)) {
				issues.push({
					level: "error",
					path: what,
					message: `"${c.code}" cannot move to "${wanted}": no such code`,
				});
			}
			return {
				code: c.code,
				label: c.label,
				count: usage[c.code] ?? 0,
				replacement: wanted !== undefined && after.includes(wanted) ? wanted : null,
			};
		});
	return {
		issues,
		removed,
		changed,
		ready:
			changed &&
			!issues.some((i) => i.level === "error") &&
			!removed.some((r) => r.count > 0 && r.replacement === null),
	};
}

function itemTypeDrafts(
	configDir: string,
	config: AppConfig,
	draft: readonly ItemTypeDraft[],
	replacements: Readonly<Record<string, string>>,
): Record<string, Record<string, unknown>> {
	const loaded = loadConfig(configDir);
	const codes = draft.map((t) => t.code.trim());
	const overrides = overridesAfter(config, codes, replacements);
	const patch: Record<string, unknown> = { "library.itemTypes": normalizeTypes(draft) };
	if (JSON.stringify(overrides) !== JSON.stringify(config.circulation.itemTypeOverrides)) {
		patch["circulation.itemTypeOverrides"] = overrides;
	}
	return keyDrafts(configDir, loaded, patch);
}

/** What saving the item types would do (nothing written). */
export function planItemTypes(
	{ db, config, configDir }: Pick<ServerContext, "db" | "config" | "configDir">,
	draft: readonly ItemTypeDraft[],
	replacements: Readonly<Record<string, string>> = {},
): CodesPlan {
	const issues = [
		...checkDraftFiles(configDir, itemTypeDrafts(configDir, config, draft, replacements))
			.issues,
	];
	const changed =
		JSON.stringify(normalizeTypes(draft)) !==
		JSON.stringify(normalizeTypes(config.library.itemTypes));
	return planCodes(
		config.library.itemTypes,
		draft.map((t) => t.code.trim()),
		itemTypeUsage(db),
		replacements,
		issues,
		changed,
		"library.itemTypes",
	);
}

/**
 * Saves the item types: the copies of removed (or renamed) types move to their replacement, the
 * loan rules of a renamed type follow it, all in one configuration change.
 */
export function saveItemTypes(
	ctx: Pick<ServerContext, "db" | "config" | "configDir">,
	draft: readonly ItemTypeDraft[],
	replacements: Readonly<Record<string, string>>,
	actor: AuditActor,
	now = new Date(),
): { change: ConfigChange; copies: number } {
	const { db, config, configDir } = ctx;
	const plan = planItemTypes(ctx, draft, replacements);
	if (!plan.ready) {
		throw new CodesNotReadyError(plan);
	}
	let copies = 0;
	const { change } = commitConfigChange(db, configDir, {
		action: "config.library",
		writes: draftWrites(itemTypeDrafts(configDir, config, draft, replacements)),
		move: (tx) => {
			const moved: Record<string, string> = {};
			for (const r of plan.removed) {
				if (r.replacement !== null && r.count > 0) {
					tx.update(item)
						.set({ itemType: r.replacement, updatedAt: now.toISOString() })
						.where(eq(item.itemType, r.code))
						.run();
					copies += r.count;
					moved[r.code] = r.replacement;
				}
			}
			return { moved, copies };
		},
		audit: { actor, details: { itemTypes: draft.map((t) => t.code) } },
		inUse: (problems) =>
			new CodesNotReadyError({
				issues: problems.map((p) => ({
					level: "error",
					path: p.kind,
					message: `${p.code}: ${p.count}`,
				})),
				removed: [],
				changed: true,
				ready: false,
			}),
		now,
	});
	return { change, copies };
}

// --- Barcode counters -------------------------------------------------------------------------

/** Thrown to roll a preview transaction back. */
class PreviewRollback extends Error {}

/** Runs `fn` in a transaction that is always rolled back: what it would do, without doing it. */
function preview<T>(db: Db, fn: (tx: DbOrTx) => T): T {
	let out: T | undefined;
	try {
		db.transaction((tx) => {
			out = fn(tx);
			throw new PreviewRollback("preview");
		});
	} catch (e) {
		if (!(e instanceof PreviewRollback)) {
			throw e;
		}
	}
	return out as T;
}

export interface BarcodePreview {
	/** The number the next new card would get with the given counter start. */
	card: string;
	/** The barcode the next new copy would get this year. */
	item: string;
}

export function barcodePreview(
	db: Db,
	config: AppConfig,
	counterStart: CardCounterStart,
	now = new Date(),
): BarcodePreview {
	const year = libraryYear(config, now);
	const codes = codeTable(config);
	return {
		card: preview(db, (tx) => nextCardNumber(tx, codes, counterStart, year)),
		item: preview(db, (tx) => nextItemBarcode(tx, codes, year)),
	};
}

/** `barcodes.patron.counterStart`: after the highest old card number, or from a given number. */
export function saveCounterStart(
	db: DbOrTx,
	configDir: string,
	value: CardCounterStart,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	return commitConfigChange(db, configDir, {
		action: "config.barcodes",
		writes: draftWrites(
			keyDrafts(configDir, loadConfig(configDir), { "barcodes.patron.counterStart": value }),
		),
		audit: { actor, details: { counterStart: value } },
		now,
	}).change;
}

/**
 * The print templates in use that choose their own barcode type in `template.json`: for them the
 * setting of `barcodes.*.symbology` does not apply.
 */
export function symbologyOverrides(
	config: AppConfig,
	configDir: string,
): { kind: "cards" | "labels"; name: string; symbology: string }[] {
	// the templates the settings name that print a barcode (a spine band prints none)
	const used = templateReferences(config).flatMap((r): ["cards" | "labels", string][] =>
		r.kind === "cards" || (r.kind === "labels" && r.labelKind !== "spine")
			? [[r.kind, r.name]]
			: [],
	);
	const out: { kind: "cards" | "labels"; name: string; symbology: string }[] = [];
	for (const [kind, name] of used) {
		if (out.some((o) => o.kind === kind && o.name === name)) {
			continue;
		}
		const folder = findTemplate(kind, name, configDir);
		if (!folder) {
			continue;
		}
		try {
			const raw = JSON.parse(readFileSync(join(folder.dir, "template.json"), "utf8")) as {
				barcode?: { symbology?: string };
			};
			if (raw.barcode?.symbology) {
				out.push({ kind, name, symbology: raw.barcode.symbology });
			}
		} catch {
			// a broken template.json is reported by the template pages
		}
	}
	return out;
}
