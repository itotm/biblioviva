// SPDX-License-Identifier: GPL-3.0-or-later
// The pieces of input that the remote functions, the configuration schema and the domain schemas
// share (pure Valibot, for the server and the pages): one rule for each, so a form, its remote
// function and config.json can never disagree on what a code, a date or an id is.
import * as v from "valibot";

/** A row id of the database: an integer from 1. */
export const dbId = v.pipe(v.number(), v.integer(), v.minValue(1));

/** Up to `max` row ids (a selection of the grid, the entries of a list). */
export function dbIds(
	max: number,
): v.SchemaWithPipe<
	readonly [v.ArraySchema<typeof dbId, undefined>, v.MaxLengthAction<number[], number, undefined>]
> {
	return v.pipe(v.array(dbId), v.maxLength(max));
}

/** A row id as a form field or a query parameter carries it: digits. */
export const textId = v.pipe(v.string(), v.regex(/^\d+$/));

/**
 * A file of a form. Bun's FormData hands over a Blob (not a File instance): any Blob is
 * accepted, typed as File for the form field.
 */
export const uploadedFile = v.custom<File>((value) => value instanceof Blob, "file expected");

/** A day of the calendar, `YYYY-MM-DD`. */
export const isoDay = v.pipe(v.string(), v.isoDate());
/** A day, or `""` for none (an empty filter). */
export const isoDayOrEmpty = v.union([isoDay, v.literal("")]);

/** A level of the school or a reading level: up to 8 letters, digits or dashes (`3`, `1-2`, `A1`). */
export const LEVEL_CODE = /^[A-Za-z0-9-]{1,8}$/;
export const levelCode = v.pipe(v.string(), v.regex(LEVEL_CODE));
/** A level, or `""` for none. */
export const levelCodeOrEmpty = v.union([levelCode, v.literal("")]);

/**
 * A code of the configuration (an item type, a stage, a genre, a role, a template or stock in a
 * print job): up to 32 letters, digits, dots, dashes or underscores.
 */
export const CONFIG_CODE = /^[A-Za-z0-9._-]{1,32}$/;
export const configCode = v.pipe(v.string(), v.regex(CONFIG_CODE));
/** A code, or `""` for none. */
export const configCodeOrEmpty = v.union([configCode, v.literal("")]);

/**
 * A code of a draft of the configuration (item types, their replacements, their loan rules):
 * loose on purpose, the plan or the configuration check holds it to `configCode` and explains
 * what is wrong.
 */
export const draftCode = v.pipe(v.string(), v.maxLength(64));

/**
 * The id the admin types for an entry of the configuration (a Z39.50 catalogue, a label stock,
 * a role): a configuration code that starts with a letter or digit and has no dots.
 */
export const ENTRY_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
export const entryId = v.pipe(v.string(), v.regex(ENTRY_ID));

/** A language of the interface: a built-in one or a language pack (`it`, `de`, `pt-BR`). */
export const LOCALE_CODE = /^[a-z]{2,3}(-[A-Z]{2})?$/;
export const localeCode = v.pipe(v.string(), v.regex(LOCALE_CODE));

/**
 * A scanned or typed barcode, card number or ISBN, as it comes from the reader: trimmed, any
 * case. Recognising it (`normalizeScan`, `recognise` of `#lib/shared/scan.ts`) is the service's.
 */
export const scannedCode = v.pipe(v.string(), v.trim(), v.maxLength(64));

/** A picture sent by a command as base64, without the `data:` prefix (at most about 12 MB). */
export const base64Image = v.pipe(
	v.string(),
	v.maxLength(16_000_000),
	v.regex(/^[A-Za-z0-9+/=]+$/),
);

/** The id of a staged import file (`#lib/server/imports/uploads.ts`). */
export const UPLOAD_ID = /^[a-f0-9-]{8,64}$/;
export const uploadId = v.pipe(v.string(), v.regex(UPLOAD_ID));

/** The patrons of a class (`group: null`: those without one) or of a patron list. */
export const patronSetSchema = v.union([
	v.object({ group: v.nullable(dbId) }),
	v.object({ list: dbId }),
]);

/** A class or a patron list, never the patrons without a class (who have no class pictures). */
export const groupOrListSchema = v.union([v.object({ group: dbId }), v.object({ list: dbId })]);
