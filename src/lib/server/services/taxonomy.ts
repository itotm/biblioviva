// SPDX-License-Identifier: GPL-3.0-or-later
// Classification taxonomy editor (PLAN.md step 11.1): genres, the two-level non-fiction tree,
// the Dewey map, the class flags and the call number patterns, edited as one draft and saved to
// the file the section comes from (`classification.json`) as one configuration change.
//
// `planTaxonomy` tells what a draft does to the catalogue before anything is written: a code in
// use that disappears needs a replacement (a renamed code is replaced by its new name) — its
// records move to it, the leading token of their copies' call numbers is rewritten and their
// spine bands go back among the labels to print —; bands whose name, colour or pictogram changes
// can be sent to print again; moving the associated class between records and copies
// (`classPerItem`) is refused while copies of one title sit in different classes. The database
// work runs inside the configuration change, so a failure leaves both untouched.
//
// Pictograms uploaded into the staging folder (`taxonomy-pictograms.ts`, `draft:<token>` in the
// draft) become files of `CONFIG_DIR/classification/images/` only when the taxonomy is saved;
// images no node references any more leave the folder in the same change (the history keeps
// them, so "Ripristina versione precedente" brings them back).
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ConfigIssue } from "#lib/server/config/validate.js";
import type { ServerContext } from "#lib/server/context.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { biblio, item } from "#lib/server/db/schema.js";
import {
	classOf,
	genreOf,
	type ClassificationScheme,
	type ResolvedNode,
} from "#lib/shared/classification.js";
import type { AuditActor } from "./audit.js";
import { pictogramUrl } from "./classification-media.js";
import { commitConfigChange } from "./config-commit.js";
import { checkSectionDraft, sectionFile, sectionWrite, type FileWrite } from "./config-edit.js";
import { sampleLabelItem } from "./label-context.js";
import { IMAGE_FILE, IMAGES_DIR, stagedPictogramPath } from "./taxonomy-pictograms.js";
import { renderLabelPreview, type LabelPreview } from "./labels.js";
import {
	DRAFT_IMAGE,
	LEVEL_KEY,
	TAXONOMY_KINDS,
	type CodeUsage,
	type TaxonomyDraft,
	type TaxonomyKind,
	type TaxonomyLeaf,
	type TaxonomyNode,
	type TaxonomyUsage,
} from "#lib/shared/taxonomy.js";

export { DRAFT_IMAGE, TAXONOMY_KINDS };
export type { CodeUsage, TaxonomyDraft, TaxonomyKind, TaxonomyLeaf, TaxonomyNode, TaxonomyUsage };

const leafOf = (l: {
	code: string;
	label: string;
	image?: string | null;
	color?: string | null;
}): TaxonomyLeaf => ({
	code: l.code,
	label: l.label,
	image: l.image ?? null,
	color: l.color ?? null,
});

/** The editor's starting point: the classification of the active configuration. */
export function taxonomyOf(config: AppConfig): TaxonomyDraft {
	const c = config.classification;
	return {
		fictionByClass: c.fictionByClass,
		readingLevels: c.readingLevels.map((l) => ({ code: l.code, label: l.label })),
		classPerItem: c.classPerItem,
		genres: c.genres.map(leafOf),
		nonfiction: c.nonfiction.map((n) => ({ ...leafOf(n), children: n.children.map(leafOf) })),
		deweyMap: c.deweyMap.map((m) => ({ prefix: m.prefix, code: m.code })),
		callNumber: { ...c.callNumber },
	};
}

/** The draft as the file stores it: no empty image or colour keys, no empty children. */
export function sectionOf(draft: TaxonomyDraft): Record<string, unknown> {
	const out = (l: TaxonomyLeaf): Record<string, unknown> => ({
		code: l.code.trim(),
		label: l.label.trim(),
		...(l.image ? { image: l.image } : {}),
		...(l.color ? { color: l.color } : {}),
	});
	return {
		fictionByClass: draft.fictionByClass,
		readingLevels: draft.readingLevels.map((l) => ({
			code: l.code.trim(),
			label: l.label.trim(),
		})),
		classPerItem: draft.classPerItem,
		genres: draft.genres.map(out),
		nonfiction: draft.nonfiction.map((n) => ({
			...out(n),
			...(n.children.length > 0 ? { children: n.children.map(out) } : {}),
		})),
		deweyMap: draft.deweyMap.map((m) => ({ prefix: m.prefix.trim(), code: m.code })),
		callNumber: { ...draft.callNumber },
	};
}

/** The draft as a configuration section (types of the schema; images kept as they are). */
function classificationOf(draft: TaxonomyDraft): AppConfig["classification"] {
	const leaf = (l: TaxonomyLeaf): AppConfig["classification"]["genres"][number] => ({
		code: l.code,
		label: l.label,
		image: l.image ?? undefined,
		color: l.color ?? undefined,
	});
	return {
		fictionByClass: draft.fictionByClass,
		readingLevels: draft.readingLevels,
		classPerItem: draft.classPerItem,
		genres: draft.genres.map(leaf),
		nonfiction: draft.nonfiction.map((n) => ({ ...leaf(n), children: n.children.map(leaf) })),
		deweyMap: draft.deweyMap,
		callNumber: draft.callNumber,
	};
}

function schemeOf(draft: TaxonomyDraft): ClassificationScheme {
	return {
		fictionByClass: draft.fictionByClass,
		classPerItem: draft.classPerItem,
		genres: draft.genres,
		nonfiction: draft.nonfiction,
		callNumber: draft.callNumber,
		readingLevels: draft.readingLevels,
		deweyMap: draft.deweyMap,
	};
}

const nodeOf = (
	scheme: ClassificationScheme,
	kind: TaxonomyKind,
	code: string,
): ResolvedNode | null => (kind === "fiction" ? genreOf(scheme, code) : classOf(scheme, code));

function codesOf(draft: TaxonomyDraft): Record<TaxonomyKind, string[]> {
	return {
		fiction: draft.genres.map((g) => g.code),
		nonfiction: draft.nonfiction.flatMap((n) => [n.code, ...n.children.map((c) => c.code)]),
	};
}

function leavesOf(draft: TaxonomyDraft): TaxonomyLeaf[] {
	return [...draft.genres, ...draft.nonfiction.flatMap((n) => [n, ...n.children])];
}

/** Image files referenced by the nodes (staged uploads left out). */
function imagesOf(draft: TaxonomyDraft): Set<string> {
	return new Set(
		leavesOf(draft)
			.map((l) => l.image)
			.filter((i): i is string => i !== null && !i.startsWith(DRAFT_IMAGE)),
	);
}

// --- Usage ------------------------------------------------------------------------------------

const RECORD_CODE = sql<
	string | null
>`CASE WHEN biblio.kind = 'fiction' THEN biblio.genre_code ELSE biblio.class_code END`;

/** Records and copies per genre and per class. */
export function taxonomyUsage(db: DbOrTx): TaxonomyUsage {
	const usage: TaxonomyUsage = { fiction: {}, nonfiction: {} };
	const rows = db
		.select({
			kind: biblio.kind,
			code: RECORD_CODE,
			records: sql<number>`count(DISTINCT biblio.id)`,
			copies: sql<number>`count(item.id)`,
		})
		.from(biblio)
		.leftJoin(item, eq(item.biblioId, biblio.id))
		.groupBy(biblio.kind, RECORD_CODE)
		.all();
	for (const r of rows) {
		if (r.code !== null) {
			usage[r.kind === "fiction" ? "fiction" : "nonfiction"][r.code] = {
				records: r.records,
				copies: r.copies,
			};
		}
	}
	return usage;
}

/** Codes the catalogue uses that the taxonomy does not define (hand edits of the file). */
export function orphanCodes(
	usage: TaxonomyUsage,
	draft: TaxonomyDraft,
): ({ kind: TaxonomyKind; code: string } & CodeUsage)[] {
	const codes = codesOf(draft);
	return TAXONOMY_KINDS.flatMap((kind) =>
		Object.entries(usage[kind])
			.filter(([code]) => !codes[kind].includes(code))
			.map(([code, u]) => ({ kind, code, ...u })),
	);
}

// --- Associated class: record or copy (Q72) ---------------------------------------------------

/**
 * `classPerItem` turned on: every copy takes its record's associated class, the records lose it
 * (also used by the catalogue import when the operator says yes to the class-per-copy question).
 */
export function moveClassesToItems(db: DbOrTx): number {
	const moved = db.run(
		sql`UPDATE item SET reading_level = (SELECT b.reading_level FROM biblio b WHERE b.id = item.biblio_id)
		    WHERE reading_level IS NULL
		      AND (SELECT b.reading_level FROM biblio b WHERE b.id = item.biblio_id) IS NOT NULL`,
	).changes;
	db.update(biblio)
		.set({ readingLevel: null })
		.where(sql`${biblio.readingLevel} IS NOT NULL`)
		.run();
	return moved;
}

/** Fiction records whose copies sit in different associated classes (they block the way back). */
export function classPerItemConflicts(db: DbOrTx): number {
	return (
		db
			.select({ n: sql<number>`count(DISTINCT item.biblio_id)` })
			.from(item)
			.where(
				sql`item.reading_level IS NOT NULL AND EXISTS (SELECT 1 FROM item other WHERE other.biblio_id = item.biblio_id AND other.reading_level IS NOT NULL AND other.reading_level <> item.reading_level)`,
			)
			.get()?.n ?? 0
	);
}

/**
 * `classPerItem` turned off: each fiction record takes the class its copies share, the copies
 * lose it. Callers check `classPerItemConflicts` first.
 */
export function moveClassesToRecords(db: DbOrTx): number {
	const receiving = sql`biblio.kind = 'fiction' AND biblio.reading_level IS NULL
		AND EXISTS (SELECT 1 FROM item i WHERE i.biblio_id = biblio.id AND i.reading_level IS NOT NULL)`;
	// counted first: the search index triggers inflate `changes` on biblio
	const moved =
		db
			.select({ n: sql<number>`count(*)` })
			.from(biblio)
			.where(receiving)
			.get()?.n ?? 0;
	db.run(
		sql`UPDATE biblio SET reading_level = (SELECT max(i.reading_level) FROM item i WHERE i.biblio_id = biblio.id)
		    WHERE ${receiving}`,
	);
	db.update(item)
		.set({ readingLevel: null })
		.where(sql`${item.readingLevel} IS NOT NULL`)
		.run();
	return moved;
}

/** Records and copies that carry a reading level. */
function levelUsage(db: DbOrTx, code: string): CodeUsage {
	return {
		records:
			db
				.select({ n: sql<number>`count(*)` })
				.from(biblio)
				.where(eq(biblio.readingLevel, code))
				.get()?.n ?? 0,
		copies:
			db
				.select({ n: sql<number>`count(*)` })
				.from(item)
				.where(eq(item.readingLevel, code))
				.get()?.n ?? 0,
	};
}

/**
 * The call number of a fiction copy filed with a level carries it as its second token
 * (`B 4 DEL`): the token follows the level to its replacement, or goes with it.
 */
function moveLevelInCallNumbers(tx: DbOrTx, from: string, to: string, at: string): number {
	const token = sql`(' ' || ${from} || ' ')`;
	const at2 = sql`instr(call_number, ' ')`;
	const replacement = to === "" ? sql`' '` : sql`(' ' || ${to} || ' ')`;
	return tx.run(
		sql`UPDATE item SET
			call_number = substr(call_number, 1, ${at2} - 1) || ${replacement} || substr(call_number, ${at2} + length(${token})),
			spine_label_printed_at = NULL, barcode_label_printed_at = NULL, updated_at = ${at}
			WHERE ${at2} > 0 AND substr(call_number, ${at2}, length(${token})) = ${token}
			  AND (reading_level = ${from}
			   OR biblio_id IN (SELECT id FROM biblio WHERE reading_level = ${from}))`,
	).changes;
}

function recordsWithClass(db: DbOrTx, onCopies: boolean): number {
	return onCopies
		? (db
				.select({ n: sql<number>`count(DISTINCT item.biblio_id)` })
				.from(item)
				.where(sql`item.reading_level IS NOT NULL`)
				.get()?.n ?? 0)
		: (db
				.select({ n: sql<number>`count(*)` })
				.from(biblio)
				.where(sql`biblio.reading_level IS NOT NULL`)
				.get()?.n ?? 0);
}

// --- Plan -------------------------------------------------------------------------------------

export interface RemovedCode {
	kind: TaxonomyKind;
	code: string;
	label: string;
	records: number;
	copies: number;
	/** The code its records move to (a renamed code: its new name); required when in use. */
	replacement: string | null;
}

/** A reading level the draft removes (or renames) with the books that carry it. */
export interface RemovedLevel {
	code: string;
	label: string;
	records: number;
	copies: number;
	/** The level its books move to, "" for none; required when in use (a rename: its new code). */
	replacement: string | null;
}

export interface TaxonomyPlan {
	/** Problems of the draft: errors block the save, warnings do not. */
	issues: ConfigIssue[];
	removed: RemovedCode[];
	removedLevels: RemovedLevel[];
	/** Codes in use that stay but whose spine band changes (name, colour or pictogram). */
	restyled: ({ kind: TaxonomyKind; code: string } & CodeUsage)[];
	/** The associated class moves between records and copies. */
	classPerItem: { to: boolean; records: number; conflicts: number } | null;
	/** Copies whose call number starts with a removed code in use: rewritten on save. */
	callNumbers: number;
	/** The draft differs from the saved classification. */
	changed: boolean;
	/** The draft can be saved as it is: changed, no errors, replacements given, no conflicts. */
	ready: boolean;
}

function draftIssues(draft: TaxonomyDraft, configDir: string, dataDir: string): ConfigIssue[] {
	const issues: ConfigIssue[] = [];
	const error = (path: string, message: string): void => {
		issues.push({ level: "error", path, message });
	};
	const genres = new Set(draft.genres.map((g) => g.code));
	for (const code of codesOf(draft).nonfiction) {
		if (genres.has(code)) {
			error("classification.nonfiction", `code "${code}" is used by a genre too`);
		}
	}
	const checkImage = (l: TaxonomyLeaf, path: string): void => {
		if (l.image === null) {
			return;
		}
		if (l.image.startsWith(DRAFT_IMAGE)) {
			if (!stagedPictogramPath(dataDir, l.image.slice(DRAFT_IMAGE.length))) {
				error(`${path}.image`, "the uploaded pictogram has expired: upload it again");
			}
		} else if (!IMAGE_FILE.test(l.image) || !existsSync(join(configDir, IMAGES_DIR, l.image))) {
			// like the labels: a missing file prints the placeholder disc (the library's own
			// pictograms may not be imported yet, step 3.8)
			issues.push({
				level: "warning",
				path: `${path}.image`,
				message: `pictogram "${l.image}" not found in ${IMAGES_DIR}: the placeholder is used`,
			});
		}
	};
	draft.genres.forEach((g, i) => checkImage(g, `classification.genres.${i}`));
	draft.nonfiction.forEach((n, i) => {
		checkImage(n, `classification.nonfiction.${i}`);
		n.children.forEach((c, j) => checkImage(c, `classification.nonfiction.${i}.children.${j}`));
	});
	return issues;
}

/** Copies of the records filed under `code` whose call number starts with it. */
const leadingCallNumber = (code: string): SQL =>
	sql`(item.call_number = ${code} OR substr(item.call_number, 1, ${code.length + 1}) = ${`${code} `})`;

const recordsUnder = (kind: TaxonomyKind, code: string): SQL =>
	kind === "fiction"
		? sql`biblio.kind = 'fiction' AND biblio.genre_code = ${code}`
		: sql`biblio.kind = 'nonfiction' AND biblio.class_code = ${code}`;

/**
 * What saving `draft` would do, without writing anything. `replacements` maps each removed code
 * in use (renames included) to the code of the same kind its records move to.
 */
export function planTaxonomy(
	{ db, config, configDir, dataDir }: ServerContext,
	draft: TaxonomyDraft,
	replacements: Readonly<Record<string, string>> = {},
): TaxonomyPlan {
	const current = taxonomyOf(config);
	const checked = checkSectionDraft(configDir, "classification", sectionOf(draft));
	const issues = [...checked.issues, ...draftIssues(draft, configDir, dataDir)];
	const usage = taxonomyUsage(db);
	const before = codesOf(current);
	const after = codesOf(draft);
	const oldScheme = schemeOf(current);
	const newScheme = schemeOf(draft);

	const removed: RemovedCode[] = [];
	const restyled: TaxonomyPlan["restyled"] = [];
	for (const kind of TAXONOMY_KINDS) {
		for (const code of before[kind]) {
			const used = usage[kind][code] ?? { records: 0, copies: 0 };
			if (!after[kind].includes(code)) {
				const wanted = replacements[code];
				if (wanted !== undefined && !after[kind].includes(wanted)) {
					issues.push({
						level: "error",
						path: "classification",
						message: `"${code}" cannot move to "${wanted}": no such ${kind === "fiction" ? "genre" : "class"}`,
					});
				}
				removed.push({
					kind,
					code,
					label: nodeOf(oldScheme, kind, code)?.label ?? "",
					...used,
					replacement:
						wanted !== undefined && after[kind].includes(wanted) ? wanted : null,
				});
				continue;
			}
			const a = nodeOf(oldScheme, kind, code);
			const b = nodeOf(newScheme, kind, code);
			if (
				used.records > 0 &&
				(a?.label !== b?.label || a?.image !== b?.image || a?.color !== b?.color)
			) {
				restyled.push({ kind, code, ...used });
			}
		}
	}

	let callNumbers = 0;
	for (const r of removed) {
		if (r.records > 0) {
			callNumbers +=
				db
					.select({ n: sql<number>`count(*)` })
					.from(item)
					.innerJoin(biblio, eq(biblio.id, item.biblioId))
					.where(and(recordsUnder(r.kind, r.code), leadingCallNumber(r.code)))
					.get()?.n ?? 0;
		}
	}

	const levelsAfter = draft.readingLevels.map((l) => l.code.trim());
	const removedLevels: RemovedLevel[] = current.readingLevels
		.filter((l) => !levelsAfter.includes(l.code))
		.map((l) => {
			const wanted = replacements[`${LEVEL_KEY}${l.code}`];
			const valid = wanted !== undefined && (wanted === "" || levelsAfter.includes(wanted));
			if (wanted !== undefined && !valid) {
				issues.push({
					level: "error",
					path: "classification.readingLevels",
					message: `"${l.code}" cannot move to "${wanted}": no such reading level`,
				});
			}
			return {
				code: l.code,
				label: l.label,
				...levelUsage(db, l.code),
				replacement: valid ? wanted : null,
			};
		});

	const classPerItem =
		current.classPerItem === draft.classPerItem
			? null
			: {
					to: draft.classPerItem,
					records: recordsWithClass(db, current.classPerItem),
					conflicts: draft.classPerItem ? 0 : classPerItemConflicts(db),
				};
	const changed = JSON.stringify(sectionOf(current)) !== JSON.stringify(sectionOf(draft));
	const ready =
		changed &&
		!issues.some((i) => i.level === "error") &&
		!removed.some((r) => r.records > 0 && r.replacement === null) &&
		!removedLevels.some((r) => r.records + r.copies > 0 && r.replacement === null) &&
		(classPerItem?.conflicts ?? 0) === 0;
	return { issues, removed, removedLevels, restyled, classPerItem, callNumbers, changed, ready };
}

// --- Save -------------------------------------------------------------------------------------

export class TaxonomyNotReadyError extends Error {
	constructor(readonly plan: TaxonomyPlan) {
		super("the taxonomy change cannot be saved as it is");
		this.name = "TaxonomyNotReadyError";
	}
}

export interface TaxonomySaveResult {
	/** Id of the configuration change (history). */
	change: string;
	/** Records moved to a replacement code. */
	records: number;
	/** Call numbers rewritten. */
	callNumbers: number;
	/** Copies whose spine band is to print again. */
	bands: number;
	/** Associated classes moved between records and copies. */
	moved: number;
}

const compactStamp = (now: Date): string =>
	now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

/**
 * Saves the draft: staged pictograms become files, unreferenced ones go, the section is written to
 * its file, and — inside the same configuration change — the records of replaced codes move, their
 * call numbers and spine bands follow, restyled bands are sent to print again when asked, and the
 * associated classes move when `classPerItem` changes. Throws `TaxonomyNotReadyError` (nothing
 * written) when the plan is not ready.
 */
export function saveTaxonomy(
	ctx: ServerContext,
	draft: TaxonomyDraft,
	options: { replacements?: Readonly<Record<string, string>>; reprintRestyled?: boolean },
	actor: AuditActor,
	now = new Date(),
): TaxonomySaveResult {
	const { db, config, configDir, dataDir } = ctx;
	const plan = planTaxonomy(ctx, draft, options.replacements);
	if (!plan.ready) {
		throw new TaxonomyNotReadyError(plan);
	}
	const current = taxonomyOf(config);
	const stamp = compactStamp(now);
	const writes: FileWrite[] = [];
	const staged: string[] = [];
	const named = new Map<string, string>();
	const place = <T extends TaxonomyLeaf>(l: T): T => {
		if (!l.image?.startsWith(DRAFT_IMAGE)) {
			return l;
		}
		const token = l.image.slice(DRAFT_IMAGE.length);
		let name = named.get(token);
		if (name === undefined) {
			name = `${l.code}-${stamp}.png`;
			named.set(token, name);
			const path = stagedPictogramPath(dataDir, token) ?? "";
			writes.push({ path: `${IMAGES_DIR}/${name}`, content: readFileSync(path) });
			staged.push(path);
		}
		return { ...l, image: name };
	};
	const saved: TaxonomyDraft = {
		...draft,
		genres: draft.genres.map(place),
		nonfiction: draft.nonfiction.map((n) => ({ ...place(n), children: n.children.map(place) })),
	};
	const kept = imagesOf(saved);
	for (const name of imagesOf(current)) {
		if (!kept.has(name) && IMAGE_FILE.test(name)) {
			if (existsSync(join(configDir, IMAGES_DIR, name))) {
				writes.push({ path: `${IMAGES_DIR}/${name}`, content: null });
			}
		}
	}
	writes.unshift(sectionWrite(configDir, "classification", sectionOf(saved)));

	const result: TaxonomySaveResult = {
		change: "",
		records: 0,
		callNumbers: 0,
		bands: 0,
		moved: 0,
	};
	const at = now.toISOString();
	const { change } = commitConfigChange(db, configDir, {
		action: "config.classification",
		writes,
		audit: { actor },
		now,
		move: (tx) => {
			const replaced: Record<string, string> = {};
			for (const r of plan.removed) {
				if (r.replacement === null || r.records === 0) {
					continue;
				}
				replaced[r.code] = r.replacement;
				const under = sql`item.biblio_id IN (SELECT biblio.id FROM biblio WHERE ${recordsUnder(r.kind, r.code)})`;
				result.callNumbers += tx.run(
					sql`UPDATE item SET call_number = ${r.replacement} || substr(call_number, ${r.code.length + 1}),
							barcode_label_printed_at = NULL, updated_at = ${at}
							WHERE ${under} AND ${leadingCallNumber(r.code)}`,
				).changes;
				result.bands += tx.run(
					sql`UPDATE item SET spine_label_printed_at = NULL, updated_at = ${at}
							WHERE ${under} AND spine_label_printed_at IS NOT NULL`,
				).changes;
				// counted by the plan: the search index triggers inflate `changes` on biblio
				tx.run(
					r.kind === "fiction"
						? sql`UPDATE biblio SET genre_code = ${r.replacement}, updated_by = ${actor.id}, updated_at = ${at} WHERE ${recordsUnder(r.kind, r.code)}`
						: sql`UPDATE biblio SET class_code = ${r.replacement}, updated_by = ${actor.id}, updated_at = ${at} WHERE ${recordsUnder(r.kind, r.code)}`,
				);
				result.records += r.records;
			}
			for (const r of plan.removedLevels) {
				if (r.replacement === null || r.records + r.copies === 0) {
					continue;
				}
				const to = r.replacement === "" ? null : r.replacement;
				replaced[`${LEVEL_KEY}${r.code}`] = r.replacement;
				result.callNumbers += moveLevelInCallNumbers(tx, r.code, r.replacement, at);
				tx.run(
					sql`UPDATE item SET reading_level = ${to}, updated_at = ${at} WHERE reading_level = ${r.code}`,
				);
				tx.run(
					sql`UPDATE biblio SET reading_level = ${to}, updated_by = ${actor.id}, updated_at = ${at} WHERE reading_level = ${r.code}`,
				);
				result.records += r.records;
			}
			if (options.reprintRestyled) {
				for (const r of plan.restyled) {
					result.bands += tx.run(
						sql`UPDATE item SET spine_label_printed_at = NULL, updated_at = ${at}
								WHERE spine_label_printed_at IS NOT NULL
								  AND item.biblio_id IN (SELECT biblio.id FROM biblio WHERE ${recordsUnder(r.kind, r.code)})`,
					).changes;
				}
			}
			if (plan.classPerItem) {
				result.moved = plan.classPerItem.to
					? moveClassesToItems(tx)
					: moveClassesToRecords(tx);
			}
			const before = codesOf(current);
			const after = codesOf(saved);
			return {
				file: sectionFile(configDir, "classification"),
				added: TAXONOMY_KINDS.flatMap((k) =>
					after[k].filter((c) => !before[k].includes(c)),
				),
				removed: plan.removed.map((r) => r.code),
				replaced,
				records: result.records,
				callNumbers: result.callNumbers,
				bands: result.bands,
				classPerItem: plan.classPerItem?.to,
				moved: result.moved,
			};
		},
	});
	for (const path of staged) {
		rmSync(path, { force: true });
	}
	return { ...result, change: change.id };
}

// --- Preview ----------------------------------------------------------------------------------

export class TaxonomyNodeNotFoundError extends Error {
	constructor(readonly code: string) {
		super(`no genre or class "${code}" in the draft`);
		this.name = "TaxonomyNodeNotFoundError";
	}
}

/**
 * The spine band of a made-up book filed under `code`, as the draft would print it: the template
 * of the default label job (the top cell of a pair), pictograms not saved yet included.
 */
export function previewTaxonomyBand(
	{ config, configDir, dataDir }: Pick<ServerContext, "config" | "configDir" | "dataDir">,
	draft: TaxonomyDraft,
	target: { kind: TaxonomyKind; code: string },
	zoom = 1,
): LabelPreview {
	const draftConfig: AppConfig = { ...config, classification: classificationOf(draft) };
	const node = nodeOf(schemeOf(draft), target.kind, target.code);
	if (!node) {
		throw new TaxonomyNodeNotFoundError(target.code);
	}
	const pictograms = new Map<string, string>();
	if (node.image?.startsWith(DRAFT_IMAGE)) {
		const path = stagedPictogramPath(dataDir, node.image.slice(DRAFT_IMAGE.length));
		pictograms.set(node.code, pictogramUrl(node, path ? { path, mime: "image/png" } : null));
	}
	const kind = config.labels.default === "barcode" ? "spine" : config.labels.default;
	return renderLabelPreview(draftConfig, configDir, config.labels[kind].template, {
		stockId: config.labels[kind].stock,
		zoom,
		item: sampleLabelItem(draftConfig, target.kind, target.code),
		pictograms,
		firstCellOnly: kind === "pair",
	});
}
