// SPDX-License-Identifier: GPL-3.0-or-later
// Class pictures of the photo census (PLAN.md Phase 13, step 13.2): thin wrappers — validate →
// authorize (`patrons`, like the census) → service → DTO. The frames are found in the browser; the
// server keeps the picture, straightens the frames and saves the chosen photos.
import { command, form, query } from "$app/server";
import { error, invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { megabytes } from "#lib/shared/bytes.js";
import { dbId, groupOrListSchema, uploadedFile } from "#lib/shared/input-schemas.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { requireFeature } from "#lib/server/features.js";
import { refusing } from "#lib/server/http/errors.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import {
	addFrame,
	assignFrame,
	deleteFrame,
	deleteSheet,
	getSheet,
	ignoreFrame,
	listSheets,
	moveFrame,
	planSave,
	saveSheet,
	setFrames,
	setSheetKind,
	sheetCandidates,
	SheetError,
	uploadSheet,
	type SheetErrorCode,
	type SheetSettings,
} from "#lib/server/services/class-sheets.js";
import { setLabel, type PatronSet } from "#lib/server/services/patron-sets.js";
import { schoolOf } from "#lib/server/school/structure.js";
import type { Corners } from "#lib/server/images/warp.js";
import { SHEET_KINDS } from "#lib/shared/sheet-frames.js";

const pointSchema = v.object({
	x: v.pipe(v.number(), v.finite()),
	y: v.pipe(v.number(), v.finite()),
});
const cornersSchema = v.pipe(v.array(pointSchema), v.length(4));

function settings(): SheetSettings {
	const photos = getConfig().photos;
	return { ...photos, sheet: photos.sheet };
}

/** A refusal the page explains (`census.sheet.errors.<code>`), with the frame or count it names. */
interface Refusal {
	ok: false;
	code: SheetErrorCode;
	message: string;
	detail: SheetError["detail"];
}

async function refusal(e: SheetError): Promise<Refusal> {
	const limits = settings().sheet;
	const locale = requestLocale();
	return {
		ok: false,
		code: e.code,
		detail: e.detail,
		message: await tServer(locale, `patrons.census.sheet.errors.${e.code}`, {
			position: e.detail.position ?? 0,
			count: e.detail.count ?? 0,
			maxMb: megabytes(limits.maxUploadBytes, locale),
			maxFrames: limits.maxFrames,
		}),
	};
}

/** Runs a change and turns a refusal of the service into a message; a missing picture is a 404. */
async function attempt<T>(run: () => T | Promise<T>): Promise<{ ok: true; value: T } | Refusal> {
	return refusing(
		async () => ({ ok: true as const, value: await run() }),
		SheetError,
		(e) => {
			if (e.code === "not_found") {
				error(404, "class picture not found");
			}
			return refusal(e);
		},
	);
}

/** The pictures of a class or list, newest first. */
export const getClassSheets = query(groupOrListSchema, (set) => {
	requireUser("patrons");
	requireFeature("photos");
	return listSheets(getDb(), set);
});

/**
 * One picture for its page: frames, the members of its class or list for the drop-downs, who
 * already holds which frame, the save summary, and the limits the browser's detection uses.
 */
export const getClassSheet = query(dbId, (id) => {
	requireUser("patrons");
	requireFeature("photos");
	try {
		const db = getDb();
		const sheet = getSheet(db, id);
		const limits = settings().sheet;
		return {
			sheet,
			label: setLabel(db, sheet.set, schoolOf(getConfig())),
			...sheetCandidates(db, id),
			plan: planSave(db, id),
			detection: {
				minAspect: limits.minAspect,
				maxAspect: limits.maxAspect,
				maxFrames: limits.maxFrames,
			},
		};
	} catch (e) {
		if (e instanceof SheetError) {
			error(404, "class picture not found");
		}
		throw e;
	}
});

/**
 * After a change of a picture: its page, and the list of its class or list (the counts of
 * "Da un'immagine con più foto"), so the census never shows a stale picture.
 */
function refreshSheet(id: number): void {
	void getClassSheet(id).refresh();
	try {
		refreshSheets(getSheet(getDb(), id).set);
	} catch (e) {
		if (!(e instanceof SheetError)) {
			throw e;
		}
	}
}

function refreshSheets(set: PatronSet): void {
	void getClassSheets(set as v.InferOutput<typeof groupOrListSchema>).refresh();
}

const uploadSchema = v.object({
	target: v.pipe(v.string(), v.regex(/^(group|list):\d{1,9}$/)),
	picture: uploadedFile,
	/** The kind the picture starts as (the demo's sample of a scan, 9.26); a photo by default. */
	kind: v.optional(v.picklist(SHEET_KINDS)),
});

/** "Carica immagine": the browser sends the picture upright and scaled; the server keeps it. */
export const uploadClassSheet = form(
	uploadSchema,
	async ({ target, picture, kind: sheetKind }, issue) => {
		const user = requireUser("patrons");
		requireFeature("photos");
		const [kind, value] = target.split(":");
		const set: PatronSet = kind === "list" ? { list: Number(value) } : { group: Number(value) };
		try {
			const bytes = new Uint8Array(await picture.arrayBuffer());
			const sheet = await uploadSheet(getDb(), env().DATA_DIR, set, bytes, settings(), user, {
				kind: sheetKind ?? "photo",
			});
			refreshSheets(set);
			return { id: sheet.id };
		} catch (e) {
			if (e instanceof SheetError) {
				invalid(issue.picture((await refusal(e)).message));
			}
			throw e;
		}
	},
);

/** The frames the browser found, in reading order (first time, or again while none is used). */
export const setSheetFrames = command(
	v.object({
		id: dbId,
		frames: v.pipe(v.array(cornersSchema), v.maxLength(200)),
		replace: v.optional(v.boolean(), false),
	}),
	async ({ id, frames, replace }) => {
		requireUser("patrons");
		requireFeature("photos");
		const result = await attempt(() =>
			setFrames(getDb(), env().DATA_DIR, id, frames as Corners[], settings(), new Date(), {
				replace,
			}),
		);
		refreshSheet(id);
		return result;
	},
);

/** A frame the operator drew. */
export const addSheetFrame = command(
	v.object({ id: dbId, corners: cornersSchema }),
	async ({ id, corners }) => {
		requireUser("patrons");
		requireFeature("photos");
		const result = await attempt(() =>
			addFrame(getDb(), env().DATA_DIR, id, corners as Corners, settings()),
		);
		refreshSheet(id);
		return result;
	},
);

/** New corners for a frame (the crop is made again). */
export const moveSheetFrame = command(
	v.object({ id: dbId, frame: dbId, corners: cornersSchema }),
	async ({ id, frame, corners }) => {
		requireUser("patrons");
		requireFeature("photos");
		const result = await attempt(() =>
			moveFrame(getDb(), env().DATA_DIR, frame, corners as Corners, settings()),
		);
		refreshSheet(id);
		return result;
	},
);

/** "Foto" or "Scansione": on a scan the open frames become turned rectangles. */
export const setClassSheetKind = command(
	v.object({ id: dbId, kind: v.picklist(SHEET_KINDS) }),
	async ({ id, kind }) => {
		requireUser("patrons");
		requireFeature("photos");
		const result = await attempt(() =>
			setSheetKind(getDb(), env().DATA_DIR, id, kind, settings()),
		);
		refreshSheet(id);
		return result;
	},
);

/** Removes a frame that is not a photo. */
export const deleteSheetFrame = command(
	v.object({ id: dbId, frame: dbId }),
	async ({ id, frame }) => {
		requireUser("patrons");
		requireFeature("photos");
		const result = await attempt(() => deleteFrame(getDb(), env().DATA_DIR, frame));
		refreshSheet(id);
		return result;
	},
);

/** The patron chosen for a frame (a draft), or none. */
export const assignSheetFrame = command(
	v.object({ id: dbId, frame: dbId, patron: v.nullable(dbId) }),
	async ({ id, frame, patron }) => {
		requireUser("patrons");
		requireFeature("photos");
		const result = await attempt(() => assignFrame(getDb(), frame, patron));
		refreshSheet(id);
		return result;
	},
);

/** "Ignora" (or back to a frame waiting for its patron). */
export const ignoreSheetFrame = command(
	v.object({ id: dbId, frame: dbId, ignored: v.boolean() }),
	async ({ id, frame, ignored }) => {
		requireUser("patrons");
		requireFeature("photos");
		const result = await attempt(() => ignoreFrame(getDb(), frame, ignored));
		refreshSheet(id);
		return result;
	},
);

/** "Salva le foto": all the chosen photos at once, after the summary (replacements confirmed). */
export const saveClassSheet = command(
	v.object({ id: dbId, confirmReplace: v.boolean() }),
	async ({ id, confirmReplace }) => {
		const user = requireUser("patrons");
		requireFeature("photos");
		const result = await attempt(() =>
			saveSheet(getDb(), env().DATA_DIR, id, getConfig().photos, user, { confirmReplace }),
		);
		refreshSheet(id);
		return result;
	},
);

/** "Elimina immagine": the picture and its frames; the photos already saved stay. */
export const deleteClassSheet = command(dbId, async (id) => {
	const user = requireUser("patrons");
	requireFeature("photos");
	return attempt(() => {
		const db = getDb();
		const { set } = getSheet(db, id);
		deleteSheet(db, env().DATA_DIR, id, user);
		refreshSheets(set);
	});
});
