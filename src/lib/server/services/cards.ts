// SPDX-License-Identifier: GPL-3.0-or-later
// Printing patron cards (PLAN.md §3.12, step 2.5): the patrons of a selection with what their card
// shows, the print job (each patron type's template, the cards of each template on sheets of their
// own) and the printed flag. Templates in `card-templates.ts`, sheets in `card-sheets.ts`.
import { and, asc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { ServerContext } from "#lib/server/context.js";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { patron, patronClass, schoolLevel } from "#lib/server/db/schema.js";
import { assertDemoPrintSheets } from "#lib/server/demo/public.js";
import { breaks } from "#lib/server/runtime/breaks.js";
import { fileDataUrl, imageMimeOf } from "#lib/server/templates/data-url.js";
import type { CardLayout } from "#lib/shared/card-layout.js";
import {
	cardGeometry,
	checkedCardGeometry,
	sheetHtml,
	type CardGeometry,
	type CardSheetGroup,
} from "./card-sheets.js";
import {
	buildCardContext,
	loadCardTemplate,
	renderCard,
	templateNameFor,
	type CardPatron,
	type LoadedCardTemplate,
	type RenderedCard,
} from "./card-templates.js";
import { audit, type AuditActor } from "./audit.js";
import type { WordSource } from "#lib/server/i18n/print-words.js";
import { featureOn } from "#lib/server/features.js";
import { patronPhotoFile } from "./media.js";

/** The patrons matching `where` with what their card shows, in surname order. */
export function patronCardRows(db: DbOrTx, where: SQL | undefined): CardPatron[] {
	return db
		.select({
			id: patron.id,
			firstName: patron.firstName,
			lastName: patron.lastName,
			cardNumber: patron.cardNumber,
			patronType: patron.patronType,
			classLabel: patronClass.classLabel,
			levelLabel: patronClass.levelLabel,
			levelName: schoolLevel.name,
			groupName: patronClass.groupName,
			photoPath: patron.photoPath,
			status: patron.status,
		})
		.from(patron)
		.leftJoin(patronClass, eq(patronClass.patronId, patron.id))
		.leftJoin(schoolLevel, eq(schoolLevel.code, patron.levelCode))
		.where(where)
		.orderBy(asc(patron.searchName))
		.all()
		.map((r) => ({
			...r,
			classLabel: r.classLabel ?? "",
			levelLabel: r.levelLabel ?? "",
			levelName: r.levelName ?? "",
			groupName: r.groupName ?? "",
		}));
}

/** The patron's photo as a data URL for the card, or null when there is none or photos are off (9.38). */
export function cardPhoto(db: Db, dataDir: string, patronId: number): string | null {
	if (!featureOn("photos")) {
		return null;
	}
	const file = patronPhotoFile(db, dataDir, patronId, "main");
	return file ? fileDataUrl(file, imageMimeOf(file) ?? "image/webp") : null;
}

export interface CardSelection {
	ids?: number[];
	/** One class (or teachers group), Phase 12. */
	groupId?: number;
	/** Every pupil of a level. */
	levelCode?: string;
	/** Only patrons whose card was never printed. */
	missingCard?: boolean;
	patronType?: "student" | "teacher";
}

/** Patrons to print, in surname order; anonymized patrons and those without a number are skipped. */
export function selectPatronsForCards(db: Db, selection: CardSelection): CardPatron[] {
	const conditions: (SQL | undefined)[] = [ne(patron.status, "anonymized")];
	if (selection.ids && selection.ids.length > 0) {
		conditions.push(inArray(patron.id, selection.ids));
	}
	if (selection.groupId !== undefined) {
		conditions.push(eq(patron.classGroupId, selection.groupId));
	}
	if (selection.levelCode) {
		conditions.push(eq(patron.levelCode, selection.levelCode));
	}
	if (selection.patronType) {
		conditions.push(eq(patron.patronType, selection.patronType));
	}
	if (selection.missingCard) {
		conditions.push(isNull(patron.cardPrintedAt));
	}
	if (
		!selection.ids &&
		selection.groupId === undefined &&
		!selection.levelCode &&
		!selection.patronType &&
		!selection.missingCard
	) {
		return [];
	}
	return patronCardRows(db, and(...conditions));
}

export interface CardsJob {
	html: string;
	count: number;
	skipped: number[];
	/** The templates of the cards printed, in the order of their sheets. */
	templates: string[];
}

/**
 * Renders the sheet for a selection. `templateName` overrides the configured template; otherwise
 * each patron type takes its own, and the cards of each template are printed on sheets of that
 * template's geometry (one group after the other, in the order of their first card). Patrons
 * without a card number are skipped (and reported) rather than printed blank. The cards are
 * rendered with breaks, as the labels: a sheet of every pupil no longer holds the server.
 */
export async function renderCardsSheet(
	{ db, config, configDir, dataDir }: ServerContext,
	selection: CardSelection,
	options: {
		templateName?: string;
		title?: string;
		builtinRoot?: string;
		now?: Date;
		/** Print in this id order (print lists) instead of surname order. */
		orderedIds?: readonly number[];
		/** Side by side or on both sides of the sheet (chosen at every print, 9.27). */
		layout?: CardLayout;
		/** Work before giving the turn to other requests (`breaks`); tests use 0. */
		breakAfterMs?: number;
		/** The words of the installation's language (Italian when left out). */
		words?: WordSource;
	} = {},
): Promise<CardsJob> {
	let patrons = selectPatronsForCards(db, selection);
	if (options.orderedIds) {
		const rank = new Map(options.orderedIds.map((id, i) => [id, i]));
		patrons = [...patrons].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
	}
	const templates = new Map<string, LoadedCardTemplate>();
	const templateOf = (p: CardPatron): LoadedCardTemplate => {
		const name = options.templateName ?? templateNameFor(config, p.patronType);
		let template = templates.get(name);
		if (!template) {
			template = loadCardTemplate(name, configDir, options.builtinRoot);
			templates.set(name, template);
		}
		return template;
	};
	// the cards of each template on sheets of their own, in the order of their first card
	const groups = new Map<
		string,
		{ template: LoadedCardTemplate; geometry: CardGeometry; patrons: CardPatron[] }
	>();
	const skipped: number[] = [];
	for (const p of patrons) {
		if (!p.cardNumber) {
			skipped.push(p.id);
			continue;
		}
		const template = templateOf(p);
		let group = groups.get(template.folder.name);
		if (!group) {
			group = {
				template,
				geometry: checkedCardGeometry(config, template, options.layout),
				patrons: [],
			};
			groups.set(template.folder.name, group);
		}
		group.patrons.push(p);
	}
	// the public demo stops a big job before it is rendered: the sheets of every template
	assertDemoPrintSheets(
		[...groups.values()].reduce(
			(n, g) => n + Math.ceil(g.patrons.length / Math.max(1, g.geometry.perPage)),
			0,
		),
	);
	const pause = breaks(options.breakAfterMs);
	const sheets: CardSheetGroup[] = [];
	for (const { template, geometry, patrons: members } of groups.values()) {
		const cards: RenderedCard[] = [];
		for (const p of members) {
			await pause();
			const photo = config.cards.showPhoto ? cardPhoto(db, dataDir, p.id) : null;
			cards.push(
				renderCard(
					template,
					buildCardContext(p, config, template.meta, photo, options.now, options.words),
					p.id,
				),
			);
		}
		sheets.push({ cards, meta: template.meta, geometry });
	}
	if (sheets.length === 0) {
		sheets.push({
			cards: [],
			meta: undefined,
			geometry: cardGeometry(config, undefined, options.layout),
		});
	}
	return {
		html: sheetHtml(options.title ?? "Tessere", sheets, config),
		count: sheets.reduce((n, g) => n + g.cards.length, 0),
		skipped,
		templates: [...groups.keys()],
	};
}

/** Marks the cards as printed (`card_printed_at`) after a print job. */
export function markCardsPrinted(db: DbOrTx, ids: number[], now = new Date()): number {
	if (ids.length === 0) {
		return 0;
	}
	return db
		.update(patron)
		.set({ cardPrintedAt: now.toISOString(), updatedAt: now.toISOString() })
		.where(and(inArray(patron.id, ids), sql`${patron.status} <> 'anonymized'`))
		.run().changes;
}

/** "Segna come stampate" after a card print job: the printed flags and their audit row. */
export function recordCardsPrinted(
	db: Db,
	ids: number[],
	actor: AuditActor,
	now = new Date(),
): number {
	return db.transaction((tx) => {
		const changed = markCardsPrinted(tx, ids, now);
		audit(tx, actor, "patron.cards_printed", "patron", null, { count: changed }, now);
		return changed;
	});
}

/**
 * "Segna come stampate" for the cards of a class printed from Stampe → Classi (9.42): the patrons
 * the print page prints for `group=<id>` (those with a card number), flagged with their audit row.
 */
export function recordGroupCardsPrinted(
	db: Db,
	groupId: number,
	actor: AuditActor,
	now = new Date(),
): number {
	const ids = selectPatronsForCards(db, { groupId })
		.filter((p) => p.cardNumber)
		.map((p) => p.id);
	return recordCardsPrinted(db, ids, actor, now);
}
