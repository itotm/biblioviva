// SPDX-License-Identifier: GPL-3.0-or-later
// Catalog remote functions (step 3.1): thin wrappers — validate → authorize → service → DTO.
import { command, form, query } from "$app/server";
import { invalid, redirect } from "@sveltejs/kit";
import * as v from "valibot";
import { requireAnyUser, requireUser } from "#lib/server/auth/guard.js";
import { requireFeature } from "#lib/server/features.js";
import { canSeePatrons } from "#lib/server/auth/rbac.js";
import {
	formIssues,
	issueMessages,
	orNotFound,
	refusing,
	rethrowHttp,
	storeMediaData,
	storeUploadedMedia,
} from "#lib/server/http/errors.js";
import { getConfig } from "#lib/server/config/index.js";
import { codeTable } from "#lib/server/barcodes/table.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import {
	coverLog,
	downloadCover,
	previewCover as previewCoverService,
	storeChosenCover,
} from "#lib/server/covers/index.js";
import { deleteCover as deleteCoverService, saveCover } from "#lib/server/services/covers.js";
import {
	BiblioHasItemsError,
	catalogRules,
	type CatalogRules,
	CatalogValidationError,
	classificationOptions,
	createBiblio as createBiblioService,
	deleteBiblio as deleteBiblioService,
	ItemOnLoanError,
	suggestedCallNumber,
	updateBiblio as updateBiblioService,
} from "#lib/server/services/catalog.js";
import {
	addItems as addItemsService,
	deleteItem as deleteItemService,
	setItemStatus as setItemStatusService,
	updateBiblioWithItem,
	updateItem as updateItemService,
} from "#lib/server/services/catalog-items.js";
import {
	seriesNames,
	getBiblio,
	searchBiblios as searchBibliosService,
	catalogDirectHit,
} from "#lib/server/services/catalog-search.js";
import {
	biblioEditSchema,
	biblioFiltersSchema,
	biblioFormSchema,
	ITEM_STATUS_VALUES,
	itemFormSchema,
} from "#lib/shared/catalog-schema.js";
import {
	base64Image,
	dbId as id,
	levelCodeOrEmpty,
	textId,
	uploadedFile,
} from "#lib/shared/input-schemas.js";
import { ISBN13_PATTERN } from "#lib/shared/isbn.js";
import { CATALOG_READERS } from "#lib/shared/permissions.js";

const rules = (): CatalogRules => catalogRules(getConfig());

/** The catalogue grid (steps 3.1, 5.1) with the direct hit of the search text, if any. */
export const searchBiblios = query(biblioFiltersSchema, (filters) => {
	requireAnyUser(CATALOG_READERS);
	const db = getDb();
	return {
		...searchBibliosService(db, filters, rules()),
		hit: filters.q ? catalogDirectHit(db, filters.q, codeTable(getConfig())) : null,
	};
});

export const getBiblioDetail = query(id, (biblioId) => {
	const user = requireAnyUser(CATALOG_READERS);
	const detail = orNotFound(() => getBiblio(getDb(), biblioId, rules()));
	// who has a copy is personal data of a (mostly minor) patron: only the desk and the patron
	// accounts see it; the others see that the copy is on loan and until when (9.13, round 16)
	if (canSeePatrons(user)) {
		return detail;
	}
	return {
		...detail,
		items: detail.items.map((it) =>
			it.loan ? { ...it, loan: { ...it.loan, patronId: 0, patronName: "" } } : it,
		),
	};
});

/** Genres, taxonomy, flags, item types and quick picks for the forms and filters. */
export const getClassificationOptions = query(() => {
	requireAnyUser(CATALOG_READERS);
	return classificationOptions(rules());
});

/** The series already in the catalogue, suggested by the record form (step 9.14). */
export const getSeriesNames = query(() => {
	requireAnyUser(CATALOG_READERS);
	return seriesNames(getDb());
});

/** The call number the item forms propose (§3.17). */
export const suggestCallNumber = query(
	v.object({
		biblioId: id,
		readingLevel: v.optional(v.nullable(levelCodeOrEmpty), null),
	}),
	({ biblioId, readingLevel }) => {
		requireAnyUser(CATALOG_READERS);
		const record = orNotFound(() => getBiblio(getDb(), biblioId, rules()));
		return { callNumber: suggestedCallNumber(rules(), record, readingLevel) };
	},
);

/** Copy fields of the edit form carry an `item` prefix (`callNumber` → `itemCallNumber`). */
const ITEM_FIELD_PREFIXED: Record<string, string> = {
	itemType: "itemType",
	callNumber: "itemCallNumber",
	readingLevel: "itemReadingLevel",
	enumeration: "itemEnumeration",
	acquisitionDate: "itemAcquisitionDate",
	notes: "itemNotes",
	notForLoan: "itemNotForLoan",
};

/**
 * The form field of a service issue: a record field, a copy field with its prefix, or the title
 * (`issue` is a proxy: membership is checked against the schemas, not the object).
 */
function biblioField(field: string): string {
	const prefixed = ITEM_FIELD_PREFIXED[field];
	return field in biblioFormSchema.entries
		? field
		: prefixed && prefixed in biblioEditSchema.entries
			? prefixed
			: "title";
}

export const createBiblio = form(biblioFormSchema, async (input, issue) => {
	const user = requireUser("catalog");
	let biblioId: number;
	try {
		biblioId = createBiblioService(getDb(), input, user, rules());
	} catch (e) {
		if (e instanceof CatalogValidationError) {
			invalid(...(await formIssues("catalog", e.issues, issue, biblioField)));
		}
		throw e;
	}
	redirect(303, `/catalog/${biblioId}`);
});

export const updateBiblio = form(biblioEditSchema, async (raw, issue) => {
	const user = requireUser("catalog");
	const {
		id: rawId,
		itemId,
		itemCallNumber,
		itemReadingLevel,
		itemEnumeration,
		itemAcquisitionDate,
		itemNotes,
		itemNotForLoan,
		...input
	} = raw;
	const biblioId = Number(rawId);
	try {
		if (itemId) {
			updateBiblioWithItem(
				getDb(),
				biblioId,
				input,
				Number(itemId),
				{
					callNumber: itemCallNumber,
					readingLevel: itemReadingLevel,
					enumeration: itemEnumeration,
					acquisitionDate: itemAcquisitionDate,
					notes: itemNotes,
					notForLoan: itemNotForLoan,
				},
				user,
				rules(),
			);
		} else {
			updateBiblioService(getDb(), biblioId, input, user, rules());
		}
	} catch (e) {
		if (e instanceof CatalogValidationError) {
			invalid(...(await formIssues("catalog", e.issues, issue, biblioField)));
		}
		rethrowHttp(e, "biblio not found");
	}
	void getBiblioDetail(biblioId).refresh();
	redirect(303, `/catalog/${biblioId}`);
});

export const deleteBiblio = command(v.object({ id }), ({ id: biblioId }) => {
	const user = requireUser("catalog");
	return refusing(
		() => {
			deleteBiblioService(getDb(), biblioId, user);
			return { ok: true as const };
		},
		BiblioHasItemsError,
		(e) => ({ ok: false as const, error: "hasItems" as const, items: e.items }),
	);
});

const itemInput = v.object({ ...itemFormSchema.entries });

/** "Aggiungi copie": N items at once with sequential barcodes. */
export const addItems = command(
	v.object({
		biblioId: id,
		copies: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
		item: itemInput,
	}),
	async ({ biblioId, copies, item }) => {
		const user = requireUser("catalog");
		return refusing(
			() => {
				const result = addItemsService(getDb(), biblioId, item, copies, user, rules());
				void getBiblioDetail(biblioId).refresh();
				return { ok: true as const, ...result };
			},
			CatalogValidationError,
			async (e) => ({ ok: false as const, issues: await issueMessages("catalog", e.issues) }),
		);
	},
);

export const updateItem = command(
	v.object({ itemId: id, biblioId: id, item: itemInput }),
	async ({ itemId, biblioId, item }) => {
		const user = requireUser("catalog");
		return refusing(
			() => {
				const changed = updateItemService(getDb(), itemId, item, user, rules());
				void getBiblioDetail(biblioId).refresh();
				return { ok: true as const, changed };
			},
			CatalogValidationError,
			async (e) => ({ ok: false as const, issues: await issueMessages("catalog", e.issues) }),
		);
	},
);

/** Status change with a reason (audited); withdrawing a lent copy is refused. */
export const setItemStatus = command(
	v.object({
		itemId: id,
		biblioId: id,
		status: v.picklist(ITEM_STATUS_VALUES),
		reason: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200)), ""),
	}),
	({ itemId, biblioId, status, reason }) => {
		const user = requireUser("catalog");
		return refusing(
			() => {
				setItemStatusService(getDb(), itemId, status, reason || null, user);
				void getBiblioDetail(biblioId).refresh();
				return { ok: true as const };
			},
			ItemOnLoanError,
			() => ({ ok: false as const, error: "onLoan" as const }),
		);
	},
);

/** Deleting a copy that was never lent (a cataloguing mistake). */
export const deleteItem = command(
	v.object({ itemId: id, biblioId: id }),
	({ itemId, biblioId }) => {
		const user = requireUser("catalog");
		return refusing(
			() => {
				deleteItemService(getDb(), itemId, user);
				void getBiblioDetail(biblioId).refresh();
				return { ok: true as const };
			},
			ItemOnLoanError,
			() => ({ ok: false as const, error: "hasLoans" as const }),
		);
	},
);

const coverUploadSchema = v.object({ id: textId, cover: uploadedFile });

/** The straightened cover from `CoverCapture` (step 3.7). */
export const uploadCover = form(coverUploadSchema, async ({ id: rawId, cover }, issue) => {
	const user = requireUser("catalog");
	requireFeature("covers");
	const config = getConfig();
	const biblioId = Number(rawId);
	await storeUploadedMedia(
		cover,
		(bytes) =>
			saveCover(getDb(), env().DATA_DIR, biblioId, bytes, config.covers, user, "photo"),
		issue.cover,
		"catalog.cover.errors",
		config.covers.maxUploadBytes,
	);
	void getBiblioDetail(biblioId).refresh();
	return { ok: true as const };
});

export const deleteCover = command(v.object({ id }), ({ id: biblioId }) => {
	const user = requireUser("catalog");
	requireFeature("covers");
	return orNotFound(() => {
		const removed = deleteCoverService(getDb(), env().DATA_DIR, biblioId, user);
		void getBiblioDetail(biblioId).refresh();
		return { ok: true as const, removed };
	});
});

/**
 * The cover of an ISBN while "Nuovo libro" shows the form (9.13, round 11): nothing is stored
 * until the record is saved (`saveCoverData`).
 */
export const previewCover = command(
	v.object({ isbn: v.pipe(v.string(), v.regex(ISBN13_PATTERN)) }),
	async ({ isbn }) => {
		requireUser("catalog");
		requireFeature("covers");
		const found = await previewCoverService(getDb(), isbn, {
			config: getConfig(),
			onError: coverLog,
		});
		return found
			? {
					ok: true as const,
					provider: found.provider,
					name: found.name,
					dataUrl: `data:${found.mime};base64,${Buffer.from(found.bytes).toString("base64")}`,
				}
			: { ok: false as const };
	},
);

/** The cover chosen in "Nuovo libro" (downloaded or photographed), stored with the new record. */
export const saveCoverData = command(
	v.object({
		id,
		data: base64Image,
		source: v.picklist(["photo", "googlebooks", "amazon", "openlibrary", "mock"]),
	}),
	async ({ id: biblioId, data, source }) => {
		const user = requireUser("catalog");
		requireFeature("covers");
		return storeMediaData(data, async (bytes) => {
			const stored = await storeChosenCover(
				getDb(),
				env().DATA_DIR,
				biblioId,
				{ bytes, source },
				user,
				{ config: getConfig(), onError: coverLog },
			);
			if (!stored.ok) {
				return { ok: false as const, error: "not_found" as const };
			}
			void getBiblioDetail(biblioId).refresh();
			return { ok: true as const };
		});
	},
);

/** "Scarica copertina": the cover chain of 3.7b for the record's ISBN. */
export const fetchCover = command(v.object({ id }), async ({ id: biblioId }) => {
	const user = requireUser("catalog");
	requireFeature("covers");
	const result = await orNotFound(() =>
		downloadCover(getDb(), env().DATA_DIR, biblioId, user, {
			config: getConfig(),
			onError: coverLog,
		}),
	);
	if (result.ok) {
		void getBiblioDetail(biblioId).refresh();
	}
	return result;
});
