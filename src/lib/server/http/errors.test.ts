// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import { NotFoundError, ServiceError } from "#lib/server/errors.js";

vi.mock("#lib/i18n/server.js", () => ({
	requestLocale: () => "it",
	tServer: (locale: string, key: string) => Promise.resolve(`${locale}:${key}`),
}));

const { formIssues, issueMessages, orNotFound, refusal, refusedWithCode, refusing, rethrowHttp } =
	await import("./errors.js");

class ShelfNotFoundError extends NotFoundError {
	constructor(readonly id: number) {
		super("shelf", `shelf ${String(id)} not found`);
	}
}

class FullShelfError extends ServiceError<"full" | "closed"> {}

class BentShelfError extends Error {
	readonly bend = 3;
}

class WetShelfError extends Error {
	readonly water = true;
}

function httpOf(fn: () => unknown): { status?: number; body?: { message?: string } } {
	try {
		fn();
		return {};
	} catch (e) {
		return e as { status?: number; body?: { message?: string } };
	}
}

describe("service errors to HTTP", () => {
	it("answers a missing row with a 404 naming what is missing, anything else as it is", () => {
		expect(httpOf(() => rethrowHttp(new ShelfNotFoundError(3)))).toMatchObject({
			status: 404,
			body: { message: "shelf not found" },
		});
		expect(
			httpOf(() => rethrowHttp(new ShelfNotFoundError(3), "biblio not found")),
		).toMatchObject({ status: 404, body: { message: "biblio not found" } });
		const other = new Error("boom");
		expect(() => rethrowHttp(other)).toThrow(other);
		expect(new ShelfNotFoundError(3).message).toBe("shelf 3 not found");
		expect(new NotFoundError("note").message).toBe("note not found");
	});

	it("runs a call, sync or async, a missing row answered 404", async () => {
		expect(orNotFound(() => 7)).toBe(7);
		expect(
			httpOf(() =>
				orNotFound(() => {
					throw new ShelfNotFoundError(1);
				}),
			).status,
		).toBe(404);
		await expect(orNotFound(() => Promise.resolve("ok"))).resolves.toBe("ok");
		await expect(
			orNotFound(() => Promise.reject(new ShelfNotFoundError(1))),
		).rejects.toMatchObject({ status: 404 });
	});

	it("turns a refusal into the page's answer, sync or async", async () => {
		const full = (): never => {
			throw new FullShelfError("full");
		};
		expect(refusing(full, FullShelfError, refusedWithCode)).toEqual({
			ok: false,
			code: "full",
		});
		expect(refusing(() => "done", FullShelfError, refusedWithCode)).toBe("done");
		await expect(
			refusing(
				() => Promise.reject(new FullShelfError("closed")),
				FullShelfError,
				refusedWithCode,
			),
		).resolves.toEqual({ ok: false, code: "closed" });
		// other errors: a missing row is still a 404, the rest goes on
		expect(
			httpOf(() =>
				refusing(
					() => {
						throw new ShelfNotFoundError(2);
					},
					FullShelfError,
					refusedWithCode,
				),
			).status,
		).toBe(404);
		expect(() =>
			refusing(
				() => {
					throw new TypeError("bug");
				},
				FullShelfError,
				refusedWithCode,
			),
		).toThrow(TypeError);
		expect(new FullShelfError("full").message).toBe("full");
	});

	it("answers each of several refusals its own way, the first that matches", async () => {
		const throwing =
			(e: Error): (() => never) =>
			() => {
				throw e;
			};
		const refusals = [
			refusal(FullShelfError, refusedWithCode),
			refusal([BentShelfError, WetShelfError], (e) => ({
				ok: false as const,
				why: e.message,
			})),
			refusal(Error, () => ({ ok: false as const, why: "any" })),
		] as const;
		const answer: { ok: true } | { ok: false; code: string } | { ok: false; why: string } =
			refusing(() => ({ ok: true as const }), refusals);
		expect(answer).toEqual({ ok: true });
		expect(refusing(throwing(new FullShelfError("closed")), refusals)).toEqual({
			ok: false,
			code: "closed",
		});
		expect(refusing(throwing(new BentShelfError("bent")), refusals)).toEqual({
			ok: false,
			why: "bent",
		});
		expect(refusing(throwing(new WetShelfError("wet")), refusals)).toEqual({
			ok: false,
			why: "wet",
		});
		// the first refusal that matches answers, even a broader one listed later
		expect(refusing(throwing(new TypeError("bug")), refusals)).toEqual({
			ok: false,
			why: "any",
		});
		const later: Promise<number | { ok: false; code: string }> = refusing(
			() => Promise.reject(new FullShelfError("full")),
			[refusal(FullShelfError, (e) => Promise.resolve(refusedWithCode(e)))],
		);
		await expect(later).resolves.toEqual({ ok: false, code: "full" });
		// what none of them names: a missing row is a 404, the rest goes on
		const few = [refusal(FullShelfError, refusedWithCode)];
		expect(httpOf(() => refusing(throwing(new ShelfNotFoundError(4)), few)).status).toBe(404);
		expect(() => refusing(throwing(new RangeError("bug")), few)).toThrow(RangeError);
		await expect(refusing(() => Promise.reject(new RangeError("late")), few)).rejects.toThrow(
			"late",
		);
	});

	it("gives field issues their messages in the installation's language", async () => {
		await expect(
			issueMessages("catalog", [{ field: "isbn", code: "isbnInvalid" }]),
		).resolves.toEqual([
			{ field: "isbn", code: "isbnInvalid", message: "it:catalog.errors.isbnInvalid" },
		]);
	});

	it("puts each field issue on its form field, renamed by the form", async () => {
		// the issue builder of a form: a proxy answering every field name
		const issue = new Proxy(
			{},
			{ get: (_target, field) => (message: string) => ({ field, message }) },
		);
		const issues = [
			{ field: "title", code: "required" },
			{ field: "callNumber", code: "tooLong" },
		];
		await expect(formIssues("patrons", issues, issue)).resolves.toEqual([
			{ field: "title", message: "it:patrons.errors.required" },
			{ field: "callNumber", message: "it:patrons.errors.tooLong" },
		]);
		await expect(
			formIssues("catalog", issues, issue, (field) =>
				field === "callNumber" ? "itemCallNumber" : field,
			),
		).resolves.toEqual([
			{ field: "title", message: "it:catalog.errors.required" },
			{ field: "itemCallNumber", message: "it:catalog.errors.tooLong" },
		]);
	});
});

const { storeMediaData, storeUploadedMedia } = await import("./errors.js");
const { MediaError } = await import("#lib/server/images/store.js");

describe("stored pictures", () => {
	const refuse = (): Promise<never> => Promise.reject(new MediaError("too_large"));

	it("gives a refused upload the message of its field", async () => {
		const field = (message: string): { message: string; path: string[] } => ({
			message,
			path: ["photo"],
		});
		const file = new Blob([new Uint8Array([1, 2, 3])]);
		await expect(
			storeUploadedMedia(file, (bytes) => Promise.resolve(bytes.length), field, "x", 1),
		).resolves.toBe(3);
		await expect(
			storeUploadedMedia(file, refuse, field, "patrons.photo.errors", 5_000_000),
		).rejects.toMatchObject({
			issues: [{ message: "it:patrons.photo.errors.too_large", path: ["photo"] }],
		});
		await expect(
			storeUploadedMedia(
				file,
				() => Promise.reject(new ShelfNotFoundError(4)),
				field,
				"x",
				1,
			),
		).rejects.toMatchObject({ status: 404 });
	});

	it("decodes a picture sent as base64 and answers its refusal", async () => {
		await expect(
			storeMediaData("AQID", (bytes) => Promise.resolve(Array.from(bytes))),
		).resolves.toEqual([1, 2, 3]);
		await expect(storeMediaData("AQID", refuse)).resolves.toEqual({
			ok: false,
			error: "too_large",
		});
	});
});
