// SPDX-License-Identifier: GPL-3.0-or-later
// Batch operations on copies (PLAN.md step 3.10): the copies of the records selected in the
// catalogue (the lists of Stampe only print, owner).
// `planBatch` is the validate phase of §3.22 (what changes, what cannot and why, nothing written);
// `applyBatch` re-plans and writes every change in one transaction with one audit row per copy.
// Records selected in the grid can also be reclassified together (`planReclassify` / `applyReclassify`).
import { LEAVING_STATUSES } from "#lib/shared/copy-status.js";
import { ServiceError } from "#lib/server/errors.js";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, item, loan } from "#lib/server/db/schema.js";
import {
	ITEM_STATUS_VALUES,
	type BiblioKind,
	type ItemStatus,
} from "#lib/shared/catalog-schema.js";
import { classOf, genreOf } from "#lib/shared/classification.js";
import { demoText } from "#lib/server/demo/content.js";
import { audit, type AuditActor } from "./audit.js";
import { suggestedCallNumber, validateBiblio, type CatalogRules } from "./catalog.js";

export type BatchOperation =
	| { kind: "status"; status: ItemStatus; reason: string }
	| { kind: "itemType"; itemType: string }
	| { kind: "notForLoan"; notForLoan: boolean }
	| { kind: "readingLevel"; readingLevel: string | null }
	| { kind: "acquisitionDate"; acquisitionDate: string };

export type BatchExclusion = "onLoan" | "unchanged" | "notFound" | "notAllowed";

export interface BatchPlanRow {
	itemId: number;
	barcode: string;
	title: string;
	from: string;
	to: string;
	exclusion: BatchExclusion | null;
}

export interface BatchPlan {
	rows: BatchPlanRow[];
	/** Copies that change. */
	changes: number;
	excluded: Record<BatchExclusion, number>;
}

export class BatchOperationError extends ServiceError {
	constructor(
		override readonly code:
			| "reasonRequired"
			| "itemTypeUnknown"
			| "readingLevelNotAllowed"
			| "readingLevelOutOfRange"
			| "dateInvalid"
			| "statusUnknown"
			| "classificationUnknown",
	) {
		super(code, `batch operation: ${code}`);
		this.name = "BatchOperationError";
	}
}

/** Statuses that take a copy out of circulation: never applied to a copy on loan. */
const LEAVING = LEAVING_STATUSES;

/** Checks the operation itself against the configuration (before looking at any copy). */
export function checkOperation(op: BatchOperation, rules: CatalogRules): void {
	switch (op.kind) {
		case "status":
			if (!ITEM_STATUS_VALUES.includes(op.status)) {
				throw new BatchOperationError("statusUnknown");
			}
			if (LEAVING.has(op.status) && op.reason.trim() === "") {
				throw new BatchOperationError("reasonRequired");
			}
			return;
		case "itemType":
			if (!rules.itemTypes.some((t) => t.code === op.itemType)) {
				throw new BatchOperationError("itemTypeUnknown");
			}
			return;
		case "readingLevel":
			if (!rules.scheme.classPerItem || !rules.scheme.fictionByClass) {
				throw new BatchOperationError("readingLevelNotAllowed");
			}
			if (
				op.readingLevel !== null &&
				!rules.scheme.readingLevels.some((l) => l.code === op.readingLevel)
			) {
				throw new BatchOperationError("readingLevelOutOfRange");
			}
			return;
		case "acquisitionDate":
			if (!/^\d{4}-\d{2}-\d{2}$/.test(op.acquisitionDate)) {
				throw new BatchOperationError("dateInvalid");
			}
			return;
		case "notForLoan":
			return;
	}
}

interface Current {
	id: number;
	barcode: string;
	title: string;
	kind: string | null;
	status: string;
	itemType: string;
	notForLoan: number;
	readingLevel: string | null;
	acquisitionDate: string | null;
	onLoan: boolean;
}

function currentOf(db: DbOrTx, itemIds: readonly number[]): Map<number, Current> {
	const out = new Map<number, Current>();
	if (itemIds.length === 0) {
		return out;
	}
	const open = new Set(
		db
			.select({ itemId: loan.itemId })
			.from(loan)
			.where(and(isNull(loan.returnedAt), inArray(loan.itemId, [...itemIds])))
			.all()
			.map((l) => l.itemId),
	);
	for (const r of db
		.select({
			id: item.id,
			barcode: item.barcode,
			title: biblio.title,
			kind: biblio.kind,
			status: item.status,
			itemType: item.itemType,
			notForLoan: item.notForLoan,
			readingLevel: item.readingLevel,
			acquisitionDate: item.acquisitionDate,
		})
		.from(item)
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(inArray(item.id, [...itemIds]))
		.all()) {
		out.set(r.id, { ...r, onLoan: open.has(r.id) });
	}
	return out;
}

/** The new value an operation writes, as text. */
function targetOf(op: BatchOperation): string {
	switch (op.kind) {
		case "status":
			return op.status;
		case "itemType":
			return op.itemType;
		case "notForLoan":
			return op.notForLoan ? "1" : "0";
		case "readingLevel":
			return op.readingLevel ?? "";
		case "acquisitionDate":
			return op.acquisitionDate;
	}
}

/** The current value of the field the operation changes, and the new one, as text. */
function valuesOf(c: Current, op: BatchOperation): { from: string; to: string } {
	switch (op.kind) {
		case "status":
			return { from: c.status, to: op.status };
		case "itemType":
			return { from: c.itemType, to: op.itemType };
		case "notForLoan":
			return { from: c.notForLoan ? "1" : "0", to: op.notForLoan ? "1" : "0" };
		case "readingLevel":
			return {
				from: c.readingLevel ?? "",
				to: op.readingLevel ?? "",
			};
		case "acquisitionDate":
			return { from: c.acquisitionDate ?? "", to: op.acquisitionDate };
	}
}

/** The validate phase: every copy with its change or the reason it stays as it is. */
export function planBatch(
	db: DbOrTx,
	itemIds: readonly number[],
	op: BatchOperation,
	rules: CatalogRules,
): BatchPlan {
	checkOperation(op, rules);
	const unique = [...new Set(itemIds)];
	const current = currentOf(db, unique);
	const excluded: Record<BatchExclusion, number> = {
		onLoan: 0,
		unchanged: 0,
		notFound: 0,
		notAllowed: 0,
	};
	const rows = unique.map((id): BatchPlanRow => {
		const c = current.get(id);
		if (!c) {
			excluded.notFound++;
			return { itemId: id, barcode: "", title: "", from: "", to: "", exclusion: "notFound" };
		}
		const { from, to } = valuesOf(c, op);
		let exclusion: BatchExclusion | null = null;
		if (from === to) {
			exclusion = "unchanged";
		} else if (op.kind === "status" && LEAVING.has(op.status) && c.onLoan) {
			exclusion = "onLoan";
		} else if (op.kind === "readingLevel" && c.kind !== "fiction") {
			exclusion = "notAllowed";
		}
		if (exclusion) {
			excluded[exclusion]++;
		}
		return { itemId: id, barcode: c.barcode, title: c.title, from, to, exclusion };
	});
	return { rows, changes: rows.filter((r) => r.exclusion === null).length, excluded };
}

export interface BatchResult extends BatchPlan {
	changed: number;
}

/** Plans again inside the transaction and writes every change, one audit row per copy plus a summary. */
export function applyBatch(
	db: Db,
	itemIds: readonly number[],
	op: BatchOperation,
	rules: CatalogRules,
	actor: AuditActor,
	options: { now?: Date } = {},
): BatchResult {
	const now = options.now ?? new Date();
	return db.transaction((tx) => {
		const plan = planBatch(tx, itemIds, op, rules);
		const changing = plan.rows.filter((r) => r.exclusion === null);
		for (const row of changing) {
			const stamp = now.toISOString();
			switch (op.kind) {
				case "status":
					tx.update(item)
						.set({ status: op.status, updatedAt: stamp })
						.where(eq(item.id, row.itemId))
						.run();
					audit(
						tx,
						actor,
						"item.status",
						"item",
						row.itemId,
						{
							from: row.from,
							to: op.status,
							reason: demoText("reason", op.reason.trim(), null, now) || undefined,
							batch: true,
						},
						now,
					);
					continue;
				case "itemType":
					tx.update(item)
						.set({ itemType: op.itemType, updatedAt: stamp })
						.where(eq(item.id, row.itemId))
						.run();
					break;
				case "notForLoan":
					tx.update(item)
						.set({ notForLoan: op.notForLoan ? 1 : 0, updatedAt: stamp })
						.where(eq(item.id, row.itemId))
						.run();
					break;
				case "readingLevel":
					tx.update(item)
						.set({ readingLevel: op.readingLevel, updatedAt: stamp })
						.where(eq(item.id, row.itemId))
						.run();
					break;
				case "acquisitionDate":
					tx.update(item)
						.set({ acquisitionDate: op.acquisitionDate, updatedAt: stamp })
						.where(eq(item.id, row.itemId))
						.run();
					break;
			}
			audit(
				tx,
				actor,
				"item.update",
				"item",
				row.itemId,
				{ changed: [op.kind], batch: true },
				now,
			);
		}
		audit(
			tx,
			actor,
			"item.batch",
			"item",
			null,
			{ operation: op.kind, value: targetOf(op), changed: changing.length, ...plan.excluded },
			now,
		);
		return { ...plan, changed: changing.length };
	});
}

// --- Reclassification of records ---------------------------------------------------------------

export interface Reclassification {
	kind: BiblioKind;
	genreCode: string;
	classCode: string;
	/** Associated class of the record ('' = none); ignored when `classPerItem` is on. */
	readingLevel: string;
	/** Rewrite the copies' call numbers from the configured patterns. */
	resuggestCallNumbers: boolean;
}

export interface ReclassifyPlanRow {
	biblioId: number;
	title: string;
	from: string;
	to: string;
	copies: number;
	exclusion: "unchanged" | "notFound" | null;
}

function labelOf(r: {
	kind: string | null;
	genreCode: string | null;
	classCode: string | null;
	readingLevel: string | null;
}): string {
	// a record still to classify (step 9.21) has no code yet
	const code = r.kind === "fiction" ? (r.genreCode ?? "") : (r.classCode ?? "");
	return [code, r.readingLevel ?? ""].filter((x) => x !== "").join(" ");
}

export function planReclassify(
	db: DbOrTx,
	biblioIds: readonly number[],
	target: Reclassification,
	rules: CatalogRules,
): { rows: ReclassifyPlanRow[]; changes: number } {
	const { scheme } = rules;
	if (
		target.kind === "fiction"
			? !genreOf(scheme, target.genreCode)
			: !classOf(scheme, target.classCode)
	) {
		throw new BatchOperationError("classificationUnknown");
	}
	const readingLevel =
		target.kind === "fiction" && !scheme.classPerItem ? target.readingLevel : "";
	const unique = [...new Set(biblioIds)];
	const records = unique.length
		? db.select().from(biblio).where(inArray(biblio.id, unique)).all()
		: [];
	const copies = new Map<number, number>();
	for (const i of unique.length
		? db
				.select({ biblioId: item.biblioId })
				.from(item)
				.where(inArray(item.biblioId, unique))
				.all()
		: []) {
		copies.set(i.biblioId, (copies.get(i.biblioId) ?? 0) + 1);
	}
	const toLabel = labelOf({
		kind: target.kind,
		genreCode: target.genreCode,
		classCode: target.classCode,
		readingLevel: readingLevel === "" ? null : readingLevel,
	});
	const rows = unique.map((id): ReclassifyPlanRow => {
		const r = records.find((x) => x.id === id);
		if (!r) {
			return {
				biblioId: id,
				title: "",
				from: "",
				to: toLabel,
				copies: 0,
				exclusion: "notFound",
			};
		}
		const from = labelOf(r);
		return {
			biblioId: id,
			title: r.title,
			from,
			to: toLabel,
			copies: copies.get(id) ?? 0,
			exclusion:
				from === toLabel && r.kind === target.kind && !target.resuggestCallNumbers
					? "unchanged"
					: null,
		};
	});
	return { rows, changes: rows.filter((r) => r.exclusion === null).length };
}

/** Writes the new classification of every record (validated like the form) in one transaction. */
export function applyReclassify(
	db: Db,
	biblioIds: readonly number[],
	target: Reclassification,
	rules: CatalogRules,
	actor: AuditActor,
	now = new Date(),
): { changed: number; callNumbers: number } {
	return db.transaction((tx) => {
		const plan = planReclassify(tx, biblioIds, target, rules);
		let callNumbers = 0;
		for (const row of plan.rows.filter((r) => r.exclusion === null)) {
			const r = tx.select().from(biblio).where(eq(biblio.id, row.biblioId)).get();
			if (!r) {
				continue;
			}
			const data = validateBiblio(
				{
					title: r.title,
					subtitle: r.subtitle ?? "",
					originalTitle: r.originalTitle ?? "",
					responsibility: r.responsibility ?? "",
					author: r.author,
					publisher: r.publisher,
					publicationPlace: r.publicationPlace ?? "",
					publicationYear: r.publicationYear === null ? "" : String(r.publicationYear),
					isbn: r.isbn ?? "",
					issn: r.issn ?? "",
					ean: r.ean ?? "",
					physicalDescription: r.physicalDescription ?? "",
					series: r.series ?? "",
					seriesNumber: r.seriesNumber ?? "",
					dewey: r.dewey ?? "",
					kind: target.kind,
					genreCode: target.kind === "fiction" ? target.genreCode : "",
					classCode: target.kind === "nonfiction" ? target.classCode : "",
					readingLevel:
						target.kind === "fiction" && !rules.scheme.classPerItem
							? target.readingLevel
							: "",
					subjects: r.subjects.join("\n"),
					notes: r.notes ?? "",
				},
				rules,
				now,
			);
			tx.update(biblio)
				.set({
					kind: data.kind,
					genreCode: data.genreCode,
					classCode: data.classCode,
					readingLevel: data.readingLevel,
					updatedBy: actor.id,
					updatedAt: now.toISOString(),
				})
				.where(eq(biblio.id, r.id))
				.run();
			audit(
				tx,
				actor,
				"biblio.update",
				"biblio",
				r.id,
				{ changed: ["classification"], from: row.from, to: row.to, batch: true },
				now,
			);
			// the spine band shows the classification: it has to be printed again; so does the
			// barcode label when the call number changes
			const record = { ...r, ...data };
			for (const it of tx.select().from(item).where(eq(item.biblioId, r.id)).all()) {
				const callNumber = target.resuggestCallNumbers
					? suggestedCallNumber(rules, record, it.readingLevel)
					: it.callNumber;
				const newCall = callNumber !== it.callNumber;
				tx.update(item)
					.set({
						callNumber,
						spineLabelPrintedAt: null,
						barcodeLabelPrintedAt: newCall ? null : it.barcodeLabelPrintedAt,
						updatedAt: now.toISOString(),
					})
					.where(eq(item.id, it.id))
					.run();
				if (newCall) {
					callNumbers++;
				}
			}
		}
		return { changed: plan.changes, callNumbers };
	});
}
