// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import { biblio, metadataCache, staffUser } from "#lib/server/db/schema.js";
import { envSchema, resetEnvCache, type Env } from "#lib/server/env.js";
import { catalogRules, createBiblio } from "#lib/server/services/catalog.js";
import * as v from "valibot";
import { amazonUrl } from "./amazon.js";
import { contentUrl, volumesUrl } from "./googlebooks.js";
import {
	COVER_PROVIDERS,
	coverContext,
	downloadCover,
	enabledCoverProviders,
	storeChosenCover,
	findCover,
	type CoverContext,
	type CoverProvider,
} from "./index.js";
import { MOCK_COVER_FILE } from "./mock.js";
import { openLibraryUrl } from "./openlibrary.js";
import type { Db } from "#lib/server/db/client.js";

const baseConfig = parseConfig(exampleRaw()).config;
const cover = new Uint8Array(readFileSync(MOCK_COVER_FILE));
/** A 200 px wide image: narrower than `covers.minWidth` (300). */
const small = await new Bun.Image(cover).resize(200, 300).jpeg().bytes();
/** A 1 × 1 transparent GIF (Amazon's "no image" placeholder). */
const GIF_1X1 = Uint8Array.from(
	atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
	(c) => c.charCodeAt(0),
);
const ISBN = "9788804668237";
const rules = catalogRules(baseConfig);
const testEnv = (over: Partial<Env> = {}): Env => ({
	...v.parse(envSchema, {}),
	DATABASE_PATH: ":memory:",
	...over,
});
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

type Route = Response | (() => Response | Promise<Response>);
function fakeFetch(routes: Record<string, Route>): { fetch: typeof fetch; calls: string[] } {
	const calls: string[] = [];
	const fetchImpl = (async (input: RequestInfo | URL) => {
		const url =
			typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		calls.push(url);
		for (const [prefix, route] of Object.entries(routes)) {
			if (url.startsWith(prefix)) {
				return typeof route === "function" ? route() : route.clone();
			}
		}
		return new Response("not found", { status: 404 });
	}) as typeof fetch;
	return { fetch: fetchImpl, calls };
}
const image = (bytes: Uint8Array, type = "image/jpeg"): Response =>
	new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]), {
		headers: { "content-type": type },
	});
const context = (f: typeof fetch): Partial<CoverContext> => ({
	fetch: f,
	userAgent: "BiblioViva/test",
});
const withProviders = (ids: AppConfig["covers"]["providers"][number]["id"][]): AppConfig => ({
	...baseConfig,
	covers: { ...baseConfig.covers, providers: ids.map((id) => ({ id, enabled: true })) },
});

function setup(): {
	db: Db;
	actor: { id: number };
	make: (isbn: string) => number;
	dataDir: string;
} {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const make = (isbn: string): number =>
		createBiblio(
			db,
			{
				title: "T",
				subtitle: "",
				originalTitle: "",
				responsibility: "",
				author: "Rossi, Mario",
				publisher: "s.n.",
				publicationPlace: "",
				publicationYear: "",
				isbn,
				issn: "",
				ean: "",
				physicalDescription: "",
				series: "",
				seriesNumber: "",
				dewey: "",
				kind: "fiction",
				genreCode: "A",
				classCode: "",
				readingLevel: "",
				subjects: "",
				notes: "",
			},
			actor,
			rules,
		);
	const dataDir = mkdtempSync(join(tmpdir(), "bv-coverchain-"));
	dirs.push(dataDir);
	return { db, actor, make, dataDir };
}

describe("cover providers", () => {
	it("builds the provider URLs", () => {
		expect(volumesUrl(ISBN, "IT", null)).toBe(
			"https://www.googleapis.com/books/v1/volumes?q=isbn%3A9788804668237&country=IT&maxResults=1",
		);
		expect(volumesUrl(ISBN, "IT", "K")).toContain("&key=K");
		expect(contentUrl("abc")).toBe(
			"https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=2",
		);
		expect(amazonUrl("8804668237")).toBe(
			"https://images-na.ssl-images-amazon.com/images/P/8804668237.01._SCLZZZZZZZ_.jpg",
		);
		expect(openLibraryUrl(ISBN)).toBe(
			"https://covers.openlibrary.org/b/isbn/9788804668237-L.jpg?default=false",
		);
	});

	it("Google Books: found through the content endpoint, thumbnail fallback, missing volume", async () => {
		const volume = {
			items: [
				{
					id: "vol1",
					volumeInfo: { imageLinks: { thumbnail: "http://books.google.com/thumb" } },
				},
			],
		};
		const ctx = coverContext(
			baseConfig,
			context(
				fakeFetch({
					"https://www.googleapis.com/": Response.json(volume),
					"https://books.google.com/books/content": image(cover),
				}).fetch,
			),
		);
		expect(await COVER_PROVIDERS.googlebooks.fetch(ISBN, ctx)).toEqual(cover);
		// the large endpoint answers HTML: the https thumbnail is used
		const { fetch: f, calls } = fakeFetch({
			"https://www.googleapis.com/": Response.json(volume),
			"https://books.google.com/books/content": new Response("<html>", {
				headers: { "content-type": "text/html" },
			}),
			"https://books.google.com/thumb": image(cover, "image/png"),
		});
		expect(
			await COVER_PROVIDERS.googlebooks.fetch(ISBN, coverContext(baseConfig, context(f))),
		).toEqual(cover);
		expect(calls[2]).toBe("https://books.google.com/thumb");
		expect(
			await COVER_PROVIDERS.googlebooks.fetch(
				ISBN,
				coverContext(
					baseConfig,
					context(
						fakeFetch({
							"https://www.googleapis.com/": Response.json({ totalItems: 0 }),
						}).fetch,
					),
				),
			),
		).toBeNull();
		await expect(
			COVER_PROVIDERS.googlebooks.fetch(
				ISBN,
				coverContext(
					baseConfig,
					context(
						fakeFetch({
							"https://www.googleapis.com/": new Response("quota", { status: 429 }),
						}).fetch,
					),
				),
			),
		).rejects.toThrow(/429/);
	});

	it("Amazon: ISBN-10 URL, placeholder bytes returned as-is (the chain rejects them), 979 skipped", async () => {
		const { fetch: f, calls } = fakeFetch({
			"https://images-na.ssl-images-amazon.com/": image(GIF_1X1, "image/gif"),
		});
		expect(
			await COVER_PROVIDERS.amazon.fetch(ISBN, coverContext(baseConfig, context(f))),
		).toEqual(GIF_1X1);
		expect(calls[0]).toContain("/P/8804668237.01.");
		expect(
			await COVER_PROVIDERS.amazon.fetch(
				"9791220012349",
				coverContext(baseConfig, context(f)),
			),
		).toBeNull();
	});

	it("Open Library: image, 404 as missing, HTML error page as missing", async () => {
		expect(
			await COVER_PROVIDERS.openlibrary.fetch(
				ISBN,
				coverContext(
					baseConfig,
					context(fakeFetch({ "https://covers.openlibrary.org/": image(cover) }).fetch),
				),
			),
		).toEqual(cover);
		expect(
			await COVER_PROVIDERS.openlibrary.fetch(
				ISBN,
				coverContext(baseConfig, context(fakeFetch({}).fetch)),
			),
		).toBeNull();
		expect(
			await COVER_PROVIDERS.openlibrary.fetch(
				ISBN,
				coverContext(
					baseConfig,
					context(
						fakeFetch({
							"https://covers.openlibrary.org/": new Response("<html>oops</html>", {
								headers: { "content-type": "text/html" },
							}),
						}).fetch,
					),
				),
			),
		).toBeNull();
	});

	it("times out through the abort signal", async () => {
		const slow = (async (_input: RequestInfo | URL, init?: RequestInit) =>
			new Promise<Response>((_, reject) => {
				init?.signal?.addEventListener("abort", () =>
					reject(new DOMException("t", "TimeoutError")),
				);
			})) as typeof fetch;
		await expect(
			COVER_PROVIDERS.openlibrary.fetch(
				ISBN,
				coverContext(baseConfig, { fetch: slow, timeoutMs: 20 }),
			),
		).rejects.toThrow();
	});
});

describe("cover chain", () => {
	it("follows the configured order, skips failures and placeholders, remembers misses", async () => {
		const { db } = setup();
		const { fetch: f, calls } = fakeFetch({
			"https://www.googleapis.com/": new Response("quota", { status: 429 }),
			"https://images-na.ssl-images-amazon.com/": image(GIF_1X1, "image/gif"),
			"https://covers.openlibrary.org/": image(cover),
		});
		const errors: string[] = [];
		const all = withProviders(["googlebooks", "amazon", "openlibrary"]);
		const hit = await findCover(db, ISBN, {
			config: all,
			context: context(f),
			onError: (p) => errors.push(p),
		});
		expect(hit).toMatchObject({ provider: "openlibrary", name: "Open Library" });
		expect(hit?.width).toBe(360);
		expect(errors).toEqual(["googlebooks"]);
		expect(calls.map((u) => new URL(u).host)).toEqual([
			"www.googleapis.com",
			"images-na.ssl-images-amazon.com",
			"covers.openlibrary.org",
		]);
		// the Amazon miss is cached (the Google error is not): next time only two calls
		expect(
			db
				.select()
				.from(metadataCache)
				.all()
				.map((r) => r.key),
		).toEqual([`cover:amazon:${ISBN}`]);
		calls.length = 0;
		await findCover(db, ISBN, { config: all, context: context(f) });
		expect(calls.map((u) => new URL(u).host)).toEqual([
			"www.googleapis.com",
			"covers.openlibrary.org",
		]);
		// an expired miss is retried
		calls.length = 0;
		await findCover(db, ISBN, {
			config: all,
			context: context(f),
			now: () => new Date(Date.now() + 8 * 86_400_000),
		});
		expect(calls).toHaveLength(3);
		// the shipped default: Amazon, Open Library; Google Books present but disabled
		expect(enabledCoverProviders(baseConfig, testEnv()).map((p) => p.id)).toEqual([
			"amazon",
			"openlibrary",
		]);
	});

	it("rejects images narrower than covers.minWidth and makes no call without providers", async () => {
		const { db } = setup();
		const { fetch: f, calls } = fakeFetch({ "https://covers.openlibrary.org/": image(small) });
		expect(
			await findCover(db, ISBN, {
				config: withProviders(["openlibrary"]),
				context: context(f),
			}),
		).toBeNull();
		expect(calls).toHaveLength(1);
		expect(
			await findCover(db, ISBN, { config: withProviders([]), context: context(f) }),
		).toBeNull();
		expect(calls).toHaveLength(1);
		expect(
			enabledCoverProviders(withProviders(["amazon", "openlibrary"]), testEnv()).map(
				(p) => p.id,
			),
		).toEqual(["amazon", "openlibrary"]);
		expect(
			enabledCoverProviders(withProviders([]), testEnv({ METADATA_PROVIDER: "mock" })).map(
				(p) => p.id,
			),
		).toEqual(["mock"]);
	});

	it("downloadCover stores the image with the provider as source", async () => {
		const { db, actor, make, dataDir } = setup();
		const withIsbn = make(ISBN);
		const withoutIsbn = make("");
		const provider: CoverProvider = {
			id: "openlibrary",
			name: "OL",
			fetch: () => Promise.resolve(cover),
		};
		const deps = {
			config: baseConfig,
			providers: [provider],
			context: context(fakeFetch({}).fetch),
		};
		expect(await downloadCover(db, dataDir, withoutIsbn, actor, deps)).toEqual({
			ok: false,
			reason: "no_isbn",
		});
		const result = await downloadCover(db, dataDir, withIsbn, actor, deps);
		expect(result).toEqual({ ok: true, provider: "openlibrary", name: "OL" });
		const row = db.select().from(biblio).where(eq(biblio.id, withIsbn)).get();
		expect(row?.coverSource).toBe("openlibrary");
		expect(existsSync(join(dataDir, row?.coverPath ?? "x"))).toBe(true);
		const none: CoverProvider = { id: "amazon", name: "A", fetch: () => Promise.resolve(null) };
		expect(
			await downloadCover(db, dataDir, make("9780140328721"), actor, {
				...deps,
				providers: [none],
			}),
		).toEqual({ ok: false, reason: "not_found" });
		await expect(downloadCover(db, dataDir, 999, actor, deps)).rejects.toThrow(/999/);
		// the mock provider serves the fixture cover
		expect(await COVER_PROVIDERS.mock.fetch(ISBN, coverContext(baseConfig))).toEqual(cover);
		expect(
			await COVER_PROVIDERS.mock.fetch("9788800000017", coverContext(baseConfig)),
		).toBeNull();
	});

	it("storeChosenCover keeps the browser's bytes, never in the public demo (fetched again or the placeholder)", async () => {
		const { db, actor, make, dataDir } = setup();
		const provider: CoverProvider = {
			id: "openlibrary",
			name: "OL",
			fetch: () => Promise.resolve(cover),
		};
		const deps = {
			config: baseConfig,
			providers: [provider],
			context: context(fakeFetch({}).fetch),
		};
		const sourceOf = (id: number): string | null | undefined =>
			db.select().from(biblio).where(eq(biblio.id, id)).get()?.coverSource;
		const first = make("");
		expect(
			await storeChosenCover(
				db,
				dataDir,
				first,
				{ bytes: cover, source: "amazon" },
				actor,
				deps,
			),
		).toEqual({ ok: true });
		expect(sourceOf(first)).toBe("amazon");
		// the records exist before the demo's rules apply to what is sent
		const second = make(ISBN);
		const third = make("9780140328721");
		const saved = process.env.DEMO_PUBLIC;
		process.env.DEMO_PUBLIC = "1";
		resetEnvCache();
		try {
			// a browser naming a provider: the server fetches the provider's cover itself
			expect(
				await storeChosenCover(
					db,
					dataDir,
					second,
					{ bytes: small, source: "mock" },
					actor,
					deps,
				),
			).toEqual({ ok: true });
			expect(sourceOf(second)).toBe("openlibrary");
			// a photo becomes the demo's placeholder
			expect(
				await storeChosenCover(
					db,
					dataDir,
					third,
					{ bytes: cover, source: "photo" },
					actor,
					deps,
				),
			).toEqual({ ok: true });
			expect(sourceOf(third)).toBe("photo");
		} finally {
			if (saved === undefined) {
				delete process.env.DEMO_PUBLIC;
			} else {
				process.env.DEMO_PUBLIC = saved;
			}
			resetEnvCache();
		}
	});
});
