// SPDX-License-Identifier: GPL-3.0-or-later
// What a visitor of the public demo sends, replaced by an example on the way in (PLAN.md step
// 9.17, Q121, ADR-035). Every visitor shares the data, so nothing a visitor types or photographs
// may reach another one: free text becomes "Libro demo del …", "DEMO – segnalazione del …",
// names from the fake-name generator; pictures become the placeholder with the date and time.
// What a visitor cannot shape stays: codes from closed lists, dates, numbers, barcodes and card
// numbers (validated by the services), ISBN; a value equal to the stored one is not the visitor's,
// and the values of the mock provider's records are kept, so a lookup still fills a record.
// The services call these functions next to `assertNotDemo`; outside the demo they give back
// what was sent. A save that replaced something marks its request, and the hook answers with
// `X-BiblioViva-Demo-Replaced`, which the browser turns into a notification.
import { AsyncLocalStorage } from "node:async_hooks";
import { fakerIT } from "@faker-js/faker";
import type { AppLocale } from "#lib/i18n/index.js";
import { MOCK_RECORDS } from "#lib/server/metadata/mock.js";
import type { BiblioFormInput, ItemFormInput } from "#lib/shared/catalog-schema.js";
import { formatDateTime } from "#lib/shared/dates.js";
import type { PatronFormInput } from "#lib/shared/patron-schema.js";
import { placeholderPng } from "./placeholder.js";
import { isDemoPublic } from "./public.js";

/** The kinds of example text (i18n `common.demoPublic.example.<kind>`, with `{{when}}`). */
export const DEMO_TEXT_KINDS = [
	"note",
	"comment",
	"book",
	"wish",
	"class",
	"printList",
	"inventory",
	"reason",
	"date",
] as const;
export type DemoTextKind = (typeof DEMO_TEXT_KINDS)[number];

export { DEMO_REPLACED_HEADER } from "#lib/shared/demo.js";

const WHEN = "\u0001";
let texts: { templates: Record<DemoTextKind, string>; locale: string; timezone: string } | null =
	null;

/**
 * Reads the example texts in the installation's language (the hook does it at startup in the
 * demo; the services translate synchronously). `translate` is `tServer` bound to the locale.
 */
export async function prepareDemoTexts(
	locale: AppLocale,
	timezone: string,
	translate: (key: string, params: Record<string, unknown>) => Promise<string>,
): Promise<void> {
	const templates = {} as Record<DemoTextKind, string>;
	for (const kind of DEMO_TEXT_KINDS) {
		templates[kind] = await translate(`common.demoPublic.example.${kind}`, { when: WHEN });
	}
	texts = { templates, locale, timezone };
}

const scope = new AsyncLocalStorage<{ replaced: boolean }>();

/** Runs a request of the demo, telling afterwards whether something it sent was replaced. */
export async function trackDemoRequest<T>(
	run: () => Promise<T>,
): Promise<{ result: T; replaced: boolean }> {
	const state = { replaced: false };
	const result = await scope.run(state, run);
	return { result, replaced: state.replaced };
}

function markReplaced(): void {
	const state = scope.getStore();
	if (state) {
		state.replaced = true;
	}
}

/** The example text of `kind` with the date and time of `now` on the library's clock. */
export function demoExample(kind: DemoTextKind, now = new Date()): string {
	if (!texts) {
		throw new Error("the example texts of the demo are not loaded (prepareDemoTexts)");
	}
	return texts.templates[kind].replace(
		WHEN,
		formatDateTime(now.toISOString(), texts.locale, texts.timezone),
	);
}

const same = (sent: string, stored: string | null | undefined): boolean =>
	sent.trim() === (stored ?? "").trim();

/**
 * One text field as the demo stores it: as sent outside the demo, when empty or when equal to
 * the stored value (or to one of `kept`); otherwise `replacement`.
 */
function replaceText(
	sent: string,
	stored: string | null | undefined,
	replacement: () => string,
	kept?: ReadonlySet<string>,
): string {
	if (!isDemoPublic() || sent.trim() === "" || same(sent, stored) || kept?.has(sent.trim())) {
		return sent;
	}
	markReplaced();
	return replacement();
}

/** Free text of `kind`: "… demo del <data e ora>" in the demo. */
export function demoText(
	kind: DemoTextKind,
	sent: string,
	stored?: string | null,
	now = new Date(),
): string {
	return replaceText(sent, stored, () => demoExample(kind, now));
}

/** A free text the demo empties (email, subtitle…). */
export function demoBlank(sent: string, stored?: string | null): string {
	return replaceText(sent, stored, () => "");
}

/** A value kept only when it has the shape of a code or a number (`pattern`), else emptied. */
function demoShaped(sent: string, stored: string | null | undefined, pattern: RegExp): string {
	return pattern.test(sent.trim()) ? sent : demoBlank(sent, stored);
}

/**
 * A class or group name: a section of one or two letters or digits stays (the "A" of "1 A"),
 * any other becomes "Classe demo del …", numbered when several are made at once.
 */
export function demoGroupName(
	sent: string,
	stored?: string | null,
	now = new Date(),
	number?: number,
): string {
	if (/^[A-Za-z0-9]{1,2}$/.test(sent.trim())) {
		return sent;
	}
	return replaceText(sent, stored, () =>
		number === undefined ? demoExample("class", now) : `${demoExample("class", now)} ${number}`,
	);
}

/** A choice typed by hand that must be one of `allowed` in the demo (a shelf): else none. */
export function demoChoice(sent: string | null, allowed: readonly string[]): string | null {
	if (!isDemoPublic() || sent === null || sent.trim() === "" || allowed.includes(sent.trim())) {
		return sent;
	}
	markReplaced();
	return null;
}

/** The patron form as the demo stores it: fake names, contacts emptied, notes replaced. */
export function demoPatron(
	input: PatronFormInput,
	stored?: {
		firstName: string;
		lastName: string;
		email: string | null;
		externalId: string | null;
		circulationNote: string | null;
		notes: string | null;
	},
	now = new Date(),
): PatronFormInput {
	if (!isDemoPublic()) {
		return input;
	}
	const sameName =
		stored !== undefined &&
		same(input.firstName, stored.firstName) &&
		same(input.lastName, stored.lastName);
	if (!sameName) {
		markReplaced();
	}
	return {
		...input,
		firstName: sameName ? input.firstName : fakerIT.person.firstName(),
		lastName: sameName ? input.lastName : fakerIT.person.lastName(),
		email: demoBlank(input.email, stored?.email),
		externalId: demoBlank(input.externalId, stored?.externalId),
		circulationNote: demoText("comment", input.circulationNote, stored?.circulationNote, now),
		notes: demoText("comment", input.notes, stored?.notes, now),
	};
}

type MockField =
	| "title"
	| "subtitle"
	| "originalTitle"
	| "responsibility"
	| "author"
	| "publisher"
	| "publicationPlace"
	| "physicalDescription"
	| "series"
	| "subjects";

/** The values of the mock provider's records, field by field: a lookup's data stay. */
const MOCK_VALUES: Record<MockField, Set<string>> = (() => {
	const out = {} as Record<MockField, Set<string>>;
	const add = (field: MockField, value: string | null | undefined): void => {
		out[field] ??= new Set();
		if (value) {
			out[field].add(value.trim());
		}
	};
	for (const r of MOCK_RECORDS) {
		add("title", r.title);
		add("subtitle", r.subtitle);
		add("originalTitle", r.originalTitle);
		add("responsibility", r.responsibility);
		add("author", r.author);
		add("publisher", r.publisher);
		add("publicationPlace", r.publicationPlace);
		add("physicalDescription", r.physicalDescription);
		add("series", r.series);
		for (const s of r.subjects) {
			add("subjects", s);
		}
	}
	return out;
})();

const subjectList = (text: string): string[] =>
	text
		.split(/[\n,;]/)
		.map((s) => s.trim())
		.filter(Boolean);

/** Subjects are kept when they are the stored ones or every one is a subject of the mock records. */
function demoSubjects(sent: string, stored: readonly string[] | null | undefined): string {
	const subjects = subjectList(sent);
	const kept =
		subjects.join("\n") === (stored ?? []).join("\n") ||
		subjects.every((s) => MOCK_VALUES.subjects.has(s));
	return kept ? sent : demoBlank(sent, null);
}

/** The record form as the demo stores it ("Libro demo del …" by "AA. VV."; the mock's data kept). */
export function demoBiblio(
	input: BiblioFormInput,
	special: { author: string; publisher: string },
	stored?: Partial<Record<Exclude<keyof BiblioFormInput, "subjects">, string | number | null>> & {
		subjects?: readonly string[] | null;
	},
	now = new Date(),
): BiblioFormInput {
	if (!isDemoPublic()) {
		return input;
	}
	const was = (field: Exclude<keyof BiblioFormInput, "subjects">): string | null => {
		const value = stored?.[field];
		return value === undefined || value === null ? null : String(value);
	};
	const text = (field: Exclude<MockField, "subjects">, replacement: () => string): string =>
		replaceText(input[field], was(field), replacement, MOCK_VALUES[field]);
	return {
		...input,
		title: text("title", () => demoExample("book", now)),
		subtitle: text("subtitle", () => ""),
		originalTitle: text("originalTitle", () => ""),
		responsibility: text("responsibility", () => ""),
		author: text("author", () => special.author),
		publisher: text("publisher", () => special.publisher),
		publicationPlace: text("publicationPlace", () => ""),
		physicalDescription: text("physicalDescription", () => ""),
		series: text("series", () => ""),
		subjects: demoSubjects(input.subjects, stored?.subjects),
		notes: demoText("comment", input.notes, was("notes"), now),
		publicationYear: demoShaped(input.publicationYear, was("publicationYear"), /^\d{4}$/),
		seriesNumber: demoShaped(input.seriesNumber, was("seriesNumber"), /^\d{1,4}$/),
		dewey: demoShaped(input.dewey, was("dewey"), /^\d{3}(\.\d{1,8})?$/),
		issn: demoShaped(input.issn, was("issn"), /^\d{4}-?\d{3}[\dXx]$/),
		ean: demoShaped(input.ean, was("ean"), /^\d{8,14}$/),
	};
}

/**
 * The copy form as the demo stores it: the call number is the one the configured format gives
 * (`suggested`; empty lets the service suggest it), the volume emptied, a note replaced.
 */
export function demoItem(
	input: ItemFormInput,
	suggested: string,
	stored?: { callNumber: string | null; enumeration: string | null; notes: string | null },
	now = new Date(),
): ItemFormInput {
	if (!isDemoPublic()) {
		return input;
	}
	return {
		...input,
		callNumber: replaceText(
			input.callNumber,
			stored?.callNumber,
			() => suggested,
			new Set([suggested]),
		),
		enumeration: demoBlank(input.enumeration, stored?.enumeration),
		notes: demoText("comment", input.notes, stored?.notes, now),
	};
}

/** In the demo, the bytes a visitor sent are dropped for the placeholder; elsewhere they stay. */
export async function demoPicture(sent: Uint8Array, now = new Date()): Promise<Uint8Array> {
	if (!isDemoPublic()) {
		return sent;
	}
	markReplaced();
	return placeholderPng(now, texts?.timezone ?? "UTC");
}

/** A wish as the demo stores it: "Desiderata demo del …", no author or series, its note replaced. */
export function demoWish<
	T extends { title: string; author: string; series: string; seriesNumber: string; note: string },
>(
	input: T,
	stored?: {
		title: string | null;
		author: string | null;
		series: string | null;
		note: string | null;
	},
	now = new Date(),
): T {
	if (!isDemoPublic()) {
		return input;
	}
	const out = {
		...input,
		title: replaceText(input.title, stored?.title, () => "", MOCK_VALUES.title),
		author: replaceText(input.author, stored?.author, () => "", MOCK_VALUES.author),
		series: replaceText(input.series, stored?.series, () => "", MOCK_VALUES.series),
		seriesNumber: demoShaped(input.seriesNumber, null, /^\d{1,4}$/),
		note: demoText("comment", input.note, stored?.note, now),
	};
	// something was asked for: the wish keeps a title, the demo's
	const asked = [input.title, input.author, input.series].some((t) => t.trim() !== "");
	if (asked && out.title.trim() === "" && out.author.trim() === "" && out.series.trim() === "") {
		out.title = demoExample("wish", now);
	} else if (out.title.trim() === "" && input.title.trim() !== "") {
		out.title = demoExample("wish", now);
	}
	return out;
}
