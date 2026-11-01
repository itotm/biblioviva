// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import { envSchema, type Env } from "#lib/server/env.js";
import * as v from "valibot";
import { cacheKey, readCache, writeCache } from "./cache.js";
import { googleBooksUrl } from "./googlebooks.js";
import {
	clearCache,
	dedupe,
	enabledProviders,
	lookupMetadata,
	MetadataError,
	MOCK_FAILING_ISBN,
	MOCK_NO_HITS_ISBN,
	MOCK_RECORDS,
	normalizeQuery,
	PROVIDERS,
	purgeExpiredCache,
	userAgent,
	type BiblioDraft,
	type MetadataProvider,
	type ProviderContext,
} from "./index.js";
import { authorFromList, firstDewey, invertName, yearOf } from "./http.js";
import { openLibrarySearchUrl } from "./openlibrary.js";
import { sbnJsonUrl, splitPublication } from "./sbn-json.js";

const FAKE_YAZ = resolve("tests/helpers/fake-yaz.sh");
const FIXTURES = resolve("tests/fixtures/metadata");
const fixture = (name: string): unknown => JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));

const baseConfig = parseConfig(exampleRaw()).config;
const withProviders = (
	providers: AppConfig["metadata"]["providers"],
	over: Partial<AppConfig["metadata"]> = {},
): AppConfig => ({
	...baseConfig,
	metadata: { ...baseConfig.metadata, providers, ...over },
});
const testEnv = (over: Partial<Env> = {}): Env => ({
	...v.parse(envSchema, {}),
	DATABASE_PATH: ":memory:",
	YAZ_CLIENT: FAKE_YAZ,
	...over,
});

const dirs: string[] = [];
const tmp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-meta-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

/** A fetch stub answering by URL prefix; records the calls. */
function fakeFetch(routes: Record<string, unknown>): { fetch: typeof fetch; calls: string[] } {
	const calls: string[] = [];
	const fetchImpl = (async (input: RequestInfo | URL) => {
		const url =
			typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		calls.push(url);
		for (const [prefix, answer] of Object.entries(routes)) {
			if (url.startsWith(prefix)) {
				if (typeof answer === "function") {
					return (answer as () => Response | Promise<Response>)();
				}
				return Response.json(answer);
			}
		}
		return new Response("not found", { status: 404 });
	}) as typeof fetch;
	return { fetch: fetchImpl, calls };
}

const context = (fetchImpl: typeof fetch, tmpDir = tmp()): Partial<ProviderContext> => ({
	fetch: fetchImpl,
	env: testEnv(),
	tmpDir,
	userAgent: "BiblioViva/test",
});

describe("query normalisation, cache keys and de-duplication", () => {
	it("normalises queries and refuses an empty search", () => {
		expect(normalizeQuery({ kind: "isbn", isbn: "978-88-04-66823-7" })).toEqual({
			kind: "isbn",
			isbn: "9788804668237",
		});
		expect(normalizeQuery({ kind: "search", title: "  harry   potter ", author: "" })).toEqual({
			kind: "search",
			title: "harry potter",
			author: undefined,
			words: undefined,
		});
		expect(() => normalizeQuery({ kind: "search", title: " " })).toThrow(/empty/);
	});

	it("builds one cache key per provider and normalised query", () => {
		expect(cacheKey("sbn", { kind: "isbn", isbn: "9788804668237" })).toBe(
			"v4:sbn:isbn:9788804668237",
		);
		expect(cacheKey("sbn", { kind: "search", title: "Harry", author: "Rowling" })).toBe(
			cacheKey("sbn", { kind: "search", title: "harry ", author: "ROWLING" }),
		);
		expect(cacheKey("sbn", { kind: "search", title: "a" })).not.toBe(
			cacheKey("openlibrary", { kind: "search", title: "a" }),
		);
	});

	it("de-duplicates only identical candidates, keeping the first source", () => {
		const base: BiblioDraft = {
			title: "1984",
			subtitle: null,
			originalTitle: null,
			responsibility: null,
			author: "Orwell, George",
			publisher: "Mondadori",
			publicationPlace: "Milano",
			publicationYear: 2016,
			isbn: "9788804668237",
			issn: null,
			physicalDescription: null,
			series: null,
			seriesNumber: null,
			dewey: null,
			subjects: [],
			sourceId: "1",
			source: "sbn",
		};
		const same = { ...base, source: "openlibrary", sourceId: "OL1M" };
		const other = { ...base, publicationYear: 2019 };
		expect(dedupe([base, same, other])).toEqual([base, other]);
	});

	it("reads, writes, expires and clears cache rows", () => {
		const db = createTestDb();
		const q = { kind: "isbn" as const, isbn: "9788804668237" };
		const t0 = new Date("2026-01-01T00:00:00Z");
		expect(readCache(db, "sbn", q, 30, t0)).toBeNull();
		writeCache(db, "sbn", q, { hits: 1, drafts: [] }, t0);
		expect(readCache(db, "sbn", q, 30, t0)).toEqual({ hits: 1, drafts: [] });
		expect(readCache(db, "sbn", q, 30, new Date("2026-02-15T00:00:00Z"))).toBeNull();
		writeCache(db, "sbn", q, { hits: 2, drafts: [] }, t0);
		expect(readCache(db, "sbn", q, 30, t0)?.hits).toBe(2);
		writeCache(db, "openlibrary", q, { hits: 0, drafts: [] }, t0);
		expect(purgeExpiredCache(db, 30, new Date("2026-02-15T00:00:00Z"))).toBe(2);
		writeCache(db, "sbn", q, { hits: 1, drafts: [] }, t0);
		writeCache(db, "openlibrary", q, { hits: 1, drafts: [] }, t0);
		expect(clearCache(db, "sbn")).toBe(1);
		expect(clearCache(db)).toBe(1);
	});
});

describe("provider selection", () => {
	it("follows metadata.providers in order, without duplicates, and the mock switch", () => {
		expect(
			enabledProviders(withProviders(["openlibrary", "sbn", "openlibrary"]), testEnv()).map(
				(p) => p.id,
			),
		).toEqual(["openlibrary", "sbn"]);
		expect(
			enabledProviders(withProviders(["sbn"]), testEnv({ METADATA_PROVIDER: "mock" })).map(
				(p) => p.id,
			),
		).toEqual(["mock"]);
		expect(userAgent(baseConfig)).toMatch(/^BiblioViva\/\d+\.\d+\.\d+/);
		expect(
			userAgent({
				...baseConfig,
				library: { ...baseConfig.library, contactEmail: "biblio@example.org" },
			}),
		).toMatch(/\(biblio@example\.org\)$/);
	});
});

describe("lookupMetadata (parallel providers)", () => {
	it("queries SBN through the fake yaz-client and caches the answer", async () => {
		const db = createTestDb();
		const ctx = context(fakeFetch({}).fetch);
		const first = await lookupMetadata(
			db,
			{ kind: "isbn", isbn: "9788804668237" },
			{ config: withProviders(["sbn"]), context: ctx },
		);
		expect(first.providers).toHaveLength(1);
		expect(first.providers[0]).toMatchObject({
			provider: "sbn",
			hits: 3,
			cached: false,
			error: null,
		});
		expect(first.candidates.length).toBeGreaterThanOrEqual(1);
		expect(first.candidates[0]).toMatchObject({ title: "1984", source: "sbn" });
		// second call: cache hit, no yaz process (the fake client would take time and leave no trace)
		const second = await lookupMetadata(
			db,
			{ kind: "isbn", isbn: "978-88-04-66823-7" },
			{
				config: withProviders(["sbn"]),
				context: { ...ctx, env: testEnv({ YAZ_CLIENT: "/nonexistent" }) },
			},
		);
		expect(second.providers[0]).toMatchObject({ provider: "sbn", hits: 3, cached: true });
		expect(second.candidates).toEqual(first.candidates);
	});

	it("reports a failing provider next to the others' results and keeps the display order", async () => {
		const db = createTestDb();
		const { fetch: f, calls } = fakeFetch({
			"https://opac.sbn.it/opacmobilegw/": fixture("sbn-json-1984.json"),
			"https://www.googleapis.com/": () => new Response("quota", { status: 429 }),
		});
		const result = await lookupMetadata(
			db,
			{ kind: "isbn", isbn: "9788804668237" },
			{ config: withProviders(["googlebooks", "sbn-json", "sbn"]), context: context(f) },
		);
		expect(result.providers.map((p) => p.provider)).toEqual(["googlebooks", "sbn-json", "sbn"]);
		expect(result.providers[0]).toMatchObject({
			error: { code: "rate_limited" },
			candidates: [],
			hits: null,
		});
		expect(result.providers[1]).toMatchObject({ hits: 3, error: null });
		expect(result.providers[1]?.candidates[0]).toMatchObject({
			title: "1984",
			responsibility: "George Orwell ; traduzione di Stefano Manferlotti",
			author: "Orwell, George",
			publisher: "Mondadori",
			publicationPlace: "Milano",
			publicationYear: 2019,
			isbn: "9788804668237",
			sourceId: "IT\\ICCU\\RMB\\0803390",
			source: "sbn-json",
		});
		expect(result.providers[2]).toMatchObject({ provider: "sbn", hits: 3, error: null });
		// candidates: the most complete first — the full UNIMARC records of SBN before the brief
		// JSON ones (step 9.14); errors never hide results
		expect(result.candidates[0]?.source).toBe("sbn");
		expect(result.candidates.some((c) => c.source === "sbn-json")).toBe(true);
		// the failure is not cached: the next lookup tries Google Books again
		await lookupMetadata(
			db,
			{ kind: "isbn", isbn: "9788804668237" },
			{ config: withProviders(["googlebooks", "sbn-json"]), context: context(f) },
		);
		expect(calls.filter((u) => u.startsWith("https://www.googleapis.com/"))).toHaveLength(2);
		expect(calls.filter((u) => u.startsWith("https://opac.sbn.it/"))).toHaveLength(1);
	});

	it("maps yaz-client failures to metadata errors", async () => {
		const db = createTestDb();
		const ctx = context(fakeFetch({}).fetch);
		const deps = { config: withProviders(["sbn"]), context: ctx };
		const down = await lookupMetadata(db, { kind: "search", title: "DOWN" }, deps);
		expect(down.providers[0]?.error).toMatchObject({ code: "unreachable" });
		const garbage = await lookupMetadata(db, { kind: "search", title: "GARBAGE" }, deps);
		expect(garbage.providers[0]?.error).toMatchObject({ code: "protocol" });
		const missing = await lookupMetadata(
			db,
			{ kind: "search", title: "harry" },
			{
				...deps,
				context: { ...ctx, env: testEnv({ YAZ_CLIENT: "/nonexistent/yaz" }) },
			},
		);
		expect(missing.providers[0]?.error).toMatchObject({ code: "spawn" });
	});

	it("runs the providers concurrently, not one after the other", async () => {
		const db = createTestDb();
		const slow = (id: "openlibrary" | "googlebooks", ms: number): MetadataProvider => ({
			id,
			name: id,
			lookup: async () => {
				await Bun.sleep(ms);
				return { hits: 0, drafts: [] };
			},
		});
		const started = performance.now();
		const result = await lookupMetadata(
			db,
			{ kind: "search", title: "x" },
			{
				config: baseConfig,
				providers: [slow("openlibrary", 300), slow("googlebooks", 300)],
				context: context(fakeFetch({}).fetch),
			},
		);
		expect(performance.now() - started).toBeLessThan(550);
		expect(result.providers.map((p) => p.elapsedMs >= 250)).toEqual([true, true]);
	});

	it("strips control characters from every candidate, cached answers included", async () => {
		const db = createTestDb();
		const marked: MetadataProvider = {
			id: "openlibrary",
			name: "marked",
			lookup: () =>
				Promise.resolve({
					hits: 1,
					drafts: [
						{
							...MOCK_RECORDS[0],
							title: "L'\u0088eco\u0089vandalo",
							subtitle: "perch\u00e9 \u001f",
							subjects: ["A\u0007B"],
						} as BiblioDraft,
					],
				}),
		};
		const deps = {
			config: baseConfig,
			providers: [marked],
			context: context(fakeFetch({}).fetch),
		};
		const first = await lookupMetadata(db, { kind: "isbn", isbn: "9788856694291" }, deps);
		expect(first.providers[0]?.error).toBeNull();
		expect(first.candidates[0]).toMatchObject({
			title: "L'ecovandalo",
			subtitle: "perché",
			subjects: ["AB"],
		});
		const second = await lookupMetadata(db, { kind: "isbn", isbn: "9788856694291" }, deps);
		expect(second.providers[0]?.cached).toBe(true);
		expect(second.candidates[0]?.title).toBe("L'ecovandalo");
	});

	it("maps unexpected exceptions and non-MetadataError failures", async () => {
		const db = createTestDb();
		const broken: MetadataProvider = {
			id: "openlibrary",
			name: "broken",
			lookup: () => Promise.reject(new Error("boom")),
		};
		const result = await lookupMetadata(
			db,
			{ kind: "isbn", isbn: MOCK_FAILING_ISBN },
			{
				config: baseConfig,
				providers: [broken, PROVIDERS.mock],
				context: context(fakeFetch({}).fetch),
			},
		);
		expect(result.providers[0]?.error).toEqual({ code: "protocol", message: "boom" });
		expect(result.providers[1]?.error).toMatchObject({ code: "timeout" });
	});

	it("the mock provider answers by ISBN and by words", async () => {
		const db = createTestDb();
		const deps = {
			config: baseConfig,
			context: {
				...context(fakeFetch({}).fetch),
				env: testEnv({ METADATA_PROVIDER: "mock" }),
			},
		};
		const isbn = await lookupMetadata(db, { kind: "isbn", isbn: "9788804668237" }, deps);
		expect(isbn.providers[0]?.provider).toBe("mock");
		// two records as complete as each other: the most recent first (step 9.14)
		expect(isbn.candidates.map((c) => c.publicationYear)).toEqual([2019, 2016]);
		const none = await lookupMetadata(db, { kind: "isbn", isbn: MOCK_NO_HITS_ISBN }, deps);
		expect(none.candidates).toEqual([]);
		expect(none.providers[0]).toMatchObject({ hits: 0, error: null });
		const search = await lookupMetadata(
			db,
			{ kind: "search", title: "principe", author: "saint" },
			deps,
		);
		expect(search.candidates.map((c) => c.title)).toEqual(["Il piccolo principe"]);
	});
});

describe("HTTP providers (mocked fetch)", () => {
	it("Google Books: URL, mapping, missing key note", async () => {
		expect(googleBooksUrl({ kind: "isbn", isbn: "9788804668237" }, 5, null)).toBe(
			"https://www.googleapis.com/books/v1/volumes?q=isbn%3A9788804668237&country=IT&maxResults=5&printType=books",
		);
		expect(
			googleBooksUrl(
				{ kind: "search", title: "1984", author: "orwell", words: "x" },
				50,
				"K",
			),
		).toContain(
			"q=intitle%3A%221984%22+inauthor%3A%22orwell%22+x&country=IT&maxResults=40&printType=books&key=K",
		);
		const ctx = context(
			fakeFetch({ "https://www.googleapis.com/": fixture("googlebooks-volumes.json") }).fetch,
		);
		const db = createTestDb();
		const result = await lookupMetadata(
			db,
			{ kind: "isbn", isbn: "9788804668237" },
			{ config: withProviders(["googlebooks"]), context: ctx },
		);
		expect(result.providers[0]).toMatchObject({ hits: 2, error: null });
		expect(result.candidates).toHaveLength(2);
		expect(result.candidates[0]).toMatchObject({
			title: "1984",
			author: "Orwell, George",
			publisher: "Mondadori",
			publicationYear: 2016,
			isbn: "9788804668237",
			physicalDescription: "333 p.",
			subjects: ["Fiction"],
			sourceId: "abc123XYZ",
			source: "googlebooks",
		});
		expect(result.candidates[1]).toMatchObject({
			title: "Nineteen Eighty-Four",
			subtitle: "A Novel",
			author: "AA. VV.",
			publisher: "s.n.",
			publicationYear: 2003,
			isbn: null,
		});
	});

	it("Open Library: edition by ISBN with author names, works by search, 404 as no hits", async () => {
		const { fetch: f, calls } = fakeFetch({
			"https://openlibrary.org/isbn/9780140328721.json": fixture("openlibrary-edition.json"),
			"https://openlibrary.org/authors/OL34184A.json": fixture("openlibrary-author.json"),
			"https://openlibrary.org/search.json": fixture("openlibrary-search.json"),
		});
		const db = createTestDb();
		const deps = { config: withProviders(["openlibrary"]), context: context(f) };
		const edition = await lookupMetadata(db, { kind: "isbn", isbn: "9780140328721" }, deps);
		expect(edition.providers[0]).toMatchObject({ hits: 1, error: null });
		expect(edition.candidates[0]).toMatchObject({
			title: "Fantastic Mr. Fox",
			author: "Dahl, Roald",
			publisher: "Puffin",
			publicationYear: 1988,
			isbn: "9780140328721",
			physicalDescription: "96 p.",
			sourceId: "/books/OL7353617M",
			source: "openlibrary",
		});
		const missing = await lookupMetadata(db, { kind: "isbn", isbn: "9788800000017" }, deps);
		expect(missing.providers[0]).toMatchObject({ hits: 0, candidates: [], error: null });
		const search = await lookupMetadata(
			db,
			{ kind: "search", title: "cosmicomiche", author: "calvino" },
			deps,
		);
		expect(search.providers[0]?.hits).toBe(4);
		expect(search.candidates[0]).toMatchObject({
			author: "Calvino, Italo",
			publicationYear: 1965,
			dewey: "853.914",
			isbn: null,
			source: "openlibrary",
		});
		expect(calls.some((u) => u.includes("title=cosmicomiche&author=calvino"))).toBe(true);
		// three author keys whose names cannot be read still mean "many authors"
		const many = await lookupMetadata(
			createTestDb(),
			{ kind: "isbn", isbn: "9788800000000" },
			{
				config: withProviders(["openlibrary"]),
				context: context(
					fakeFetch({
						"https://openlibrary.org/isbn/": {
							title: "Many",
							authors: [
								{ key: "/authors/A" },
								{ key: "/authors/B" },
								{ key: "/authors/C" },
							],
						},
					}).fetch,
				),
			},
		);
		expect(many.candidates[0]).toMatchObject({
			title: "Many",
			author: "AA. VV.",
			publisher: "s.n.",
		});
		const odd = await lookupMetadata(
			createTestDb(),
			{ kind: "search", words: "x" },
			{
				config: withProviders(["openlibrary"]),
				context: context(fakeFetch({ "https://openlibrary.org/search.json": [1] }).fetch),
			},
		);
		expect(odd.providers[0]?.error).toMatchObject({ code: "protocol" });
		expect(openLibrarySearchUrl({ kind: "isbn", isbn: "1" }, 3)).toContain("q=isbn%3A1");
		expect(openLibrarySearchUrl({ kind: "search", words: "w" }, 3)).toContain("&q=w");
	});

	it("maps network failures, timeouts and bad JSON to error codes", async () => {
		const db = createTestDb();
		const cases: [() => Response | Promise<Response>, string][] = [
			[() => Promise.reject(new Error("ECONNREFUSED")), "unreachable"],
			[
				() => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" })),
				"timeout",
			],
			[() => new Response("<html>", { status: 200 }), "protocol"],
			[() => new Response("nope", { status: 500 }), "http"],
			[() => Response.json({ unexpected: true }), "protocol"],
		];
		for (const [answer, code] of cases) {
			const ctx = context(fakeFetch({ "https://opac.sbn.it/": answer }).fetch);
			clearCache(db);
			const result = await lookupMetadata(
				db,
				{ kind: "search", words: "x" },
				{ config: withProviders(["sbn-json"]), context: ctx },
			);
			expect(result.providers[0]?.error?.code, code).toBe(code);
		}
		expect(new MetadataError("http", "m").name).toBe("MetadataError");
	});

	it("sbn-json: URL parameters and publication statement parsing", () => {
		expect(sbnJsonUrl({ kind: "isbn", isbn: "9788804668237" }, 5)).toBe(
			"https://opac.sbn.it/opacmobilegw/search.json?isbn=9788804668237&rows=5",
		);
		expect(sbnJsonUrl({ kind: "search", title: "a b", author: "c", words: "d" }, 20)).toBe(
			"https://opac.sbn.it/opacmobilegw/search.json?title=a+b&author=c&any=d&rows=20",
		);
		expect(splitPublication("Milano : Mondadori, 2019")).toEqual({
			place: "Milano",
			publisher: "Mondadori",
			year: 2019,
		});
		expect(splitPublication("Torino : Einaudi, 1965, stampa 1971")).toEqual({
			place: "Torino",
			publisher: "Einaudi",
			year: 1965,
		});
		expect(splitPublication("[S.l.] : s.n., [2014]")).toEqual({
			place: "S.l.",
			publisher: "s.n.",
			year: 2014,
		});
		expect(splitPublication("Mondadori")).toEqual({
			place: null,
			publisher: "Mondadori",
			year: null,
		});
		expect(splitPublication(null)).toEqual({ place: null, publisher: null, year: null });
	});

	it("text helpers", () => {
		expect(invertName("George Orwell")).toBe("Orwell, George");
		expect(invertName("Antoine de Saint-Exupéry")).toBe("Saint-Exupéry, Antoine de");
		expect(invertName("Orwell, George")).toBe("Orwell, George");
		expect(invertName("Omero")).toBe("Omero");
		expect(authorFromList([], ["Anonimo", "AA. VV."])).toBe("Anonimo");
		expect(authorFromList(["a", "b", "c"], ["Anonimo", "AA. VV."])).toBe("AA. VV.");
		expect(authorFromList(["Rowling, J. K."], [], true)).toBe("Rowling, J. K.");
		expect(yearOf("October 1, 1988")).toBe(1988);
		expect(yearOf(null)).toBeNull();
		expect(yearOf("n.d.")).toBeNull();
		expect(firstDewey(["[Fic]", "823.912"])).toBe("823.912");
		expect(firstDewey(undefined)).toBeNull();
	});
});
