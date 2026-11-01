// SPDX-License-Identifier: GPL-3.0-or-later
// Service errors → HTTP, in one place for the remote functions and the routes: a missing row is a
// 404 naming what is missing, a refusal becomes the answer the page reads, field issues become
// messages of the installation's language, a refused picture the message of its field.
import { error, invalid } from "@sveltejs/kit";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { NotFoundError } from "#lib/server/errors.js";
import { MediaError, type MediaErrorCode } from "#lib/server/images/store.js";
import { megabytes } from "#lib/shared/bytes.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any constructor of an error class
type ErrorClass<E extends Error> = abstract new (...args: any[]) => E;

/** Rethrows a failure for SvelteKit: a `NotFoundError` as a 404 (`<entity> not found`), the rest as it is. */
export function rethrowHttp(e: unknown, notFoundMessage?: string): never {
	if (e instanceof NotFoundError) {
		error(404, notFoundMessage ?? `${e.entity} not found`);
	}
	throw e;
}

function isPromise(value: unknown): value is Promise<unknown> {
	return value instanceof Promise;
}

/** Runs a service call (sync or async); a missing row answers 404 (`rethrowHttp`). */
export function orNotFound<T>(run: () => T, notFoundMessage?: string): T {
	try {
		const out = run();
		if (isPromise(out)) {
			return out.catch((e: unknown) => rethrowHttp(e, notFoundMessage)) as T;
		}
		return out;
	} catch (e) {
		rethrowHttp(e, notFoundMessage);
	}
}

/** A refusal a service call may end with — an error of one of `classes` — and the page's answer to it. */
export interface Refusal<E extends Error, R> {
	readonly classes: readonly ErrorClass<E>[];
	readonly answer: (e: E) => R;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a refusal of any error class
type AnyRefusal = Refusal<any, unknown>;
type AnswerOf<P> = P extends { answer: (e: never) => infer R } ? R : never;

/**
 * The answer `answer` to the errors of `Refused` — one class, or several answered alike —, for
 * `refusing` with several refusals.
 */
export function refusal<E extends Error, R>(
	Refused: ErrorClass<E>,
	answer: (e: E) => R,
): Refusal<E, R>;
export function refusal<const C extends readonly ErrorClass<Error>[], R>(
	Refused: C,
	answer: (e: InstanceType<C[number]>) => R,
): Refusal<InstanceType<C[number]>, R>;
export function refusal(
	Refused: ErrorClass<Error> | readonly ErrorClass<Error>[],
	answer: (e: Error) => unknown,
): Refusal<Error, unknown> {
	return { classes: Array.isArray(Refused) ? Refused : [Refused], answer };
}

/**
 * Runs a service call (sync or async) and turns its refusals into the answer the page reads: an
 * error of `Refused` answered by `answer`, or, with a list of `refusal(...)`, the answer of the
 * first one whose class the error is of; a missing row answers 404, anything else is thrown on.
 */
export function refusing<T, E extends Error, R>(
	run: () => Promise<T>,
	Refused: ErrorClass<E>,
	answer: (e: E) => R | Promise<R>,
): Promise<T | R>;
export function refusing<T, E extends Error, R>(
	run: () => T,
	Refused: ErrorClass<E>,
	answer: (e: E) => R,
): T | R;
export function refusing<T, const P extends readonly AnyRefusal[]>(
	run: () => Promise<T>,
	refusals: P,
): Promise<T | Awaited<AnswerOf<P[number]>>>;
export function refusing<T, const P extends readonly AnyRefusal[]>(
	run: () => T,
	refusals: P,
): T | AnswerOf<P[number]>;
export function refusing(
	run: () => unknown,
	Refused: ErrorClass<Error> | readonly AnyRefusal[],
	answer?: (e: Error) => unknown,
): unknown {
	const refusals: readonly AnyRefusal[] = Array.isArray(Refused)
		? Refused
		: [refusal(Refused as ErrorClass<Error>, answer as (e: Error) => unknown)];
	const handle = (e: unknown): unknown => {
		for (const r of refusals) {
			if (r.classes.some((c) => e instanceof c)) {
				return r.answer(e);
			}
		}
		rethrowHttp(e);
	};
	try {
		const out = run();
		return isPromise(out) ? out.catch(handle) : out;
	} catch (e) {
		return handle(e);
	}
}

/** The usual answer to a refusal with a code: `{ ok: false, code }`. */
export function refusedWithCode<E extends { code: string }>(e: E): { ok: false; code: E["code"] } {
	return { ok: false, code: e.code };
}

/** A field issue of a service (catalogue, patrons) with its message in the installation's language. */
export interface IssueMessage {
	field: string;
	code: string;
	message: string;
}

/** The messages of a service's field issues, from `<area>.errors.<code>`. */
export async function issueMessages(
	area: "catalog" | "patrons",
	issues: readonly { field: string; code: string }[],
): Promise<IssueMessage[]> {
	const locale = requestLocale();
	const out: IssueMessage[] = [];
	for (const i of issues) {
		out.push({
			field: i.field,
			code: i.code,
			message: await tServer(locale, `${area}.errors.${i.code}`),
		});
	}
	return out;
}

type FormIssue = Parameters<typeof invalid>[number];

/**
 * A service's field issues as the issues of its form (`issue`, the form's issue builder), with
 * their messages: each on the field `fieldOf` names, the issue's own field by default.
 */
export async function formIssues(
	area: "catalog" | "patrons",
	issues: readonly { field: string; code: string }[],
	issue: object,
	fieldOf: (field: string) => string = (field) => field,
): Promise<Parameters<typeof invalid>> {
	const fields = issue as Record<string, ((message: string) => FormIssue) | undefined>;
	const out = [];
	for (const i of await issueMessages(area, issues)) {
		out.push(fields[fieldOf(i.field)]?.(i.message));
	}
	return out as Parameters<typeof invalid>;
}

/**
 * Stores the picture of an upload form (a cover, a patron photo, the logo): its bytes go to
 * `store`; a refused picture (`MediaError`) becomes the field's issue `<keyPrefix>.<code>`, with
 * the size limit as `{{maxMb}}`. A missing row answers 404, anything else is thrown on.
 */
export async function storeUploadedMedia<T>(
	file: Blob,
	store: (bytes: Uint8Array) => Promise<T>,
	issue: (message: string) => FormIssue,
	keyPrefix: string,
	maxBytes: number,
): Promise<T> {
	try {
		return await store(new Uint8Array(await file.arrayBuffer()));
	} catch (e) {
		if (e instanceof MediaError) {
			const locale = requestLocale();
			invalid(
				issue(
					await tServer(locale, `${keyPrefix}.${e.code}`, {
						maxMb: megabytes(maxBytes, locale),
					}),
				),
			);
		}
		rethrowHttp(e);
	}
}

/**
 * Stores a picture that a command sent as base64 (`base64Image`); a refused one answers
 * `{ ok: false, error: <MediaError code> }`, a missing row 404.
 */
export function storeMediaData<T>(
	data: string,
	store: (bytes: Uint8Array) => Promise<T>,
): Promise<T | { ok: false; error: MediaErrorCode }> {
	return refusing(
		() => store(new Uint8Array(Buffer.from(data, "base64"))),
		MediaError,
		(e) => ({ ok: false as const, error: e.code }),
	);
}
