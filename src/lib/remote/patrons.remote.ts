// SPDX-License-Identifier: GPL-3.0-or-later
// Patron remote functions (step 2.1): thin wrappers — validate → authorize → service → DTO.
import { command, form, query } from "$app/server";
import { invalid, redirect } from "@sveltejs/kit";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { requireFeature } from "#lib/server/features.js";
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
import { getDb } from "#lib/server/db/index.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import { env } from "#lib/server/env.js";
import { recordCardsPrinted } from "#lib/server/services/cards.js";
import { deletePatronPhoto, savePatronPhoto } from "#lib/server/services/media.js";
import { frameCountOfPatron } from "#lib/server/services/class-sheets.js";
import { censusLists, setMembers } from "#lib/server/services/patron-sets.js";
import {
	createPatron as createPatronService,
	getPatron,
	PatronValidationError,
	reassignCard as reassignCardService,
	updatePatron as updatePatronService,
	updatePatronNotes as updatePatronNotesService,
	patronRules,
	type PatronRules,
} from "#lib/server/services/patrons.js";
import {
	searchPatrons as searchPatronsService,
	quickSearchPatrons,
} from "#lib/server/services/patron-search.js";
import { censusGroups, classOptions } from "#lib/server/services/patron-census.js";
import { patronHistory } from "#lib/server/services/loan-lists.js";
import {
	removePatronNow,
	removePatronsNow,
	PatronHasOpenLoansError,
} from "#lib/server/services/anonymize.js";
import {
	patronEditSchema,
	patronFiltersSchema,
	patronFormSchema,
} from "#lib/shared/patron-schema.js";
import {
	base64Image,
	dbId,
	dbIds,
	levelCodeOrEmpty,
	patronSetSchema,
	textId,
	uploadedFile,
} from "#lib/shared/input-schemas.js";

/** A selection of the grid. */
const selection = v.pipe(dbIds(500), v.minLength(1));

function rules(): PatronRules {
	return patronRules(getConfig());
}

function today(): string {
	return libraryToday(getConfig());
}

/** Patron quick search for the census (step 5.2): ≤ 20 patrons by name. */
export const quickFindPatrons = query(v.pipe(v.string(), v.maxLength(60)), (q) => {
	requireUser("patrons");
	return quickSearchPatrons(getDb(), q, { locale: getConfig().ui.locale });
});

export const searchPatrons = query(patronFiltersSchema, (filters) => {
	requireUser("patrons");
	return {
		...searchPatronsService(getDb(), filters, today(), getConfig().ui.locale),
		options: classOptions(getDb(), rules().school),
	};
});

/** The choices of the list filters, shown before any search (9.13, round 3). */
export const getPatronFilterOptions = query(() => {
	requireUser("patrons");
	return classOptions(getDb(), rules().school);
});

export const getPatronDetail = query(dbId, (id) => {
	requireUser("patrons");
	// the class pictures where the patron was chosen go with them (Phase 13, Q106)
	return orNotFound(() => ({
		...getPatron(getDb(), id, today()),
		classSheets: frameCountOfPatron(getDb(), id),
	}));
});

export const createPatron = form(patronFormSchema, async (data, issue) => {
	const user = requireUser("patrons");
	let id: number;
	try {
		id = createPatronService(getDb(), data, user, rules());
	} catch (e) {
		if (e instanceof PatronValidationError) {
			invalid(...(await formIssues("patrons", e.issues, issue)));
		}
		throw e;
	}
	// the page stores the photo taken with the form (9.13, round 11), then opens the patron
	return { id };
});

/** The photo taken while creating a patron, stored once the patron exists (9.13, round 11). */
export const savePhotoData = command(
	v.object({
		id: dbId,
		data: base64Image,
	}),
	async ({ id, data }) => {
		const user = requireUser("patrons");
		requireFeature("photos");
		return storeMediaData(data, async (bytes) => {
			await savePatronPhoto(getDb(), env().DATA_DIR, id, bytes, getConfig().photos, user);
			return { ok: true as const };
		});
	},
);

export const updatePatron = form(patronEditSchema, async ({ id, ...data }, issue) => {
	const user = requireUser("patrons");
	try {
		updatePatronService(getDb(), Number(id), data, user, rules());
	} catch (e) {
		if (e instanceof PatronValidationError) {
			invalid(...(await formIssues("patrons", e.issues, issue)));
		}
		rethrowHttp(e);
	}
	redirect(303, `/patrons/${id}`);
});

/** The history tab (step 2.7): every loan of the patron, newest first. */
export const getPatronHistory = query(dbId, (id) => {
	requireUser("patrons");
	return orNotFound(() => ({
		rows: patronHistory(getDb(), id, today(), getConfig().library.schoolYearLabel),
	}));
});

export const updatePatronNotes = command(
	v.object({
		id: dbId,
		circulationNote: v.pipe(v.string(), v.trim(), v.maxLength(500)),
		notes: v.pipe(v.string(), v.trim(), v.maxLength(2000)),
	}),
	({ id, circulationNote, notes }) => {
		const user = requireUser("patrons");
		return orNotFound(() => {
			const changed = updatePatronNotesService(getDb(), id, { circulationNote, notes }, user);
			void getPatronDetail(id).refresh();
			return { ok: true as const, changed };
		});
	},
);

/**
 * "Rimuovi studente/docente" (steps 2.7/2.9): immediate, irreversible anonymization. Needs the
 * `anonymize` permission; refused while the patron has open loans.
 */
export const removePatron = command(v.object({ id: dbId }), async ({ id }) => {
	const user = requireUser("anonymize");
	return refusing(
		async () => {
			const removed = await removePatronNow(getDb(), env().DATA_DIR, id, user);
			void getPatronDetail(id).refresh();
			return { ok: true as const, removed };
		},
		PatronHasOpenLoansError,
		(e) => ({ ok: false as const, error: "openLoans" as const, openLoans: e.openLoans }),
	);
});

/** Multi-selection of the grid (step 2.9): every patron in its own savepoint, kept ones reported. */
export const removePatrons = command(v.object({ ids: selection }), async ({ ids }) => {
	const user = requireUser("anonymize");
	const result = await removePatronsNow(getDb(), env().DATA_DIR, ids, user);
	return { ok: true as const, ...result };
});

export const reassignCard = command(v.object({ id: dbId }), ({ id }) => {
	const user = requireUser("patrons");
	return orNotFound(() => {
		const cardNumber = reassignCardService(getDb(), id, user, rules());
		void getPatronDetail(id).refresh();
		return { ok: true as const, cardNumber };
	});
});

const photoUploadSchema = v.object({ id: textId, photo: uploadedFile });

export const uploadPhoto = form(photoUploadSchema, async ({ id, photo }, issue) => {
	const user = requireUser("patrons");
	requireFeature("photos");
	const config = getConfig();
	await storeUploadedMedia(
		photo,
		(bytes) => savePatronPhoto(getDb(), env().DATA_DIR, Number(id), bytes, config.photos, user),
		issue.photo,
		"patrons.photo.errors",
		config.photos.maxUploadBytes,
	);
	void getPatronDetail(Number(id)).refresh();
	return { ok: true as const };
});

export const deletePhoto = command(v.object({ id: dbId }), ({ id }) => {
	const user = requireUser("patrons");
	requireFeature("photos");
	return orNotFound(() => {
		const removed = deletePatronPhoto(getDb(), env().DATA_DIR, id, user);
		void getPatronDetail(id).refresh();
		return { ok: true as const, removed };
	});
});

/**
 * The census's first step (Q108): every class and every patron print list with its photo
 * progress; the page offers those with someone still without a photo.
 */
export const getCensusGroups = query(() => {
	requireUser("patrons");
	requireFeature("photos");
	const school = rules().school;
	return {
		groups: censusGroups(getDb(), school),
		lists: censusLists(getDb()),
		options: classOptions(getDb(), school),
	};
});

/** The patrons of a class (`group: null`: those without one) or of a patron list. */
export const getCensusList = query(patronSetSchema, (set) => {
	requireUser("patrons");
	requireFeature("photos");
	return setMembers(getDb(), set);
});

/** "Nuovo utente" inside the census: name + group, the photo follows through `uploadPhoto`. */
export const quickAddPatron = command(
	v.object({
		firstName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
		lastName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
		patronType: v.picklist(["student", "teacher"]),
		/** The census class: the patron joins it (with its level when it hosts one only). */
		groupId: dbId,
		levelCode: v.optional(levelCodeOrEmpty, ""),
	}),
	async (input) => {
		const user = requireUser("patrons");
		return refusing(
			() => {
				const id = createPatronService(
					getDb(),
					{
						patronType: input.patronType,
						firstName: input.firstName,
						lastName: input.lastName,
						levelCode: input.levelCode,
						groupId: String(input.groupId),
						groupName: "",
						cardNumber: "",
						externalId: "",
						email: "",
						circulationNote: "",
						notes: "",
					},
					user,
					rules(),
				);
				void getCensusGroups().refresh();
				void getCensusList({ group: input.groupId }).refresh();
				return { ok: true as const, id };
			},
			PatronValidationError,
			async (e) => ({
				ok: false as const,
				messages: (await issueMessages("patrons", e.issues)).map((i) => i.message),
			}),
		);
	},
);

/** "Segna come stampate" after a card print job. */
export const markCardsPrinted = command(v.object({ ids: selection }), ({ ids }) => {
	const user = requireUser("patrons");
	const changed = recordCardsPrinted(getDb(), ids, user);
	for (const id of ids) {
		void getPatronDetail(id).refresh();
	}
	return { ok: true as const, changed };
});
