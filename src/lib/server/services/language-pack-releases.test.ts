// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "#lib/server/env.js";
import { buildPackZip, sha256, type PackIndexEntry } from "#lib/server/i18n/pack-tools.js";
import { DemoBlockedError } from "#lib/server/demo/public.js";
import { APP_VERSION } from "#lib/shared/version.js";
import {
	downloadReleasePack,
	fetchPackIndex,
	releaseBaseUrl,
	releasePageUrl,
	releasePacksView,
	type Fetcher,
} from "./language-pack-releases.js";
import { LanguagePackError, MAX_PACK_ZIP_BYTES } from "./language-packs.js";

const saved = {
	LANGUAGE_PACKS_BASE_URL: process.env.LANGUAGE_PACKS_BASE_URL,
	DEMO_PUBLIC: process.env.DEMO_PUBLIC,
};
beforeEach(() => {
	delete process.env.LANGUAGE_PACKS_BASE_URL;
	delete process.env.DEMO_PUBLIC;
	resetEnvCache();
});
afterEach(() => {
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	resetEnvCache();
});

const zip = buildPackZip("de", { "pack.json": '{"name":"German","nativeName":"Deutsch"}' });

async function entry(over: Partial<PackIndexEntry> = {}): Promise<PackIndexEntry> {
	return {
		code: "de",
		name: "German",
		nativeName: "Deutsch",
		translation: "machine",
		translated: 90,
		total: 120,
		file: `biblioviva-i18n-de-${APP_VERSION}.zip`,
		bytes: zip.byteLength,
		sha256: await sha256(zip),
		...over,
	};
}

/** A fetcher that answers by URL and keeps what it was asked. */
function server(files: Record<string, Uint8Array | string | number>): {
	fetcher: Fetcher;
	calls: { url: string; init?: RequestInit }[];
} {
	const calls: { url: string; init?: RequestInit }[] = [];
	const fetcher: Fetcher = (url, init) => {
		calls.push({ url, init });
		const file = files[url.slice(url.lastIndexOf("/") + 1)];
		if (file === undefined) {
			return Promise.resolve(new Response("nothing", { status: 404 }));
		}
		if (typeof file === "number") {
			return Promise.resolve(new Response("x", { status: file }));
		}
		return Promise.resolve(new Response(file.slice() as BodyInit, { status: 200 }));
	};
	return { fetcher, calls };
}

async function failure(run: () => Promise<unknown>): Promise<LanguagePackError> {
	try {
		await run();
	} catch (e) {
		expect(e).toBeInstanceOf(LanguagePackError);
		return e as LanguagePackError;
	}
	throw new Error("did not fail");
}

describe("releaseBaseUrl", () => {
	it("is the GitHub release of this version, from the repository of package.json", () => {
		expect(releaseBaseUrl()).toBe(
			`https://github.com/itotm/biblioviva/releases/download/v${APP_VERSION}`,
		);
	});

	it("can be pointed elsewhere, a trailing slash dropped", () => {
		process.env.LANGUAGE_PACKS_BASE_URL = "http://127.0.0.1:9999/packs/";
		resetEnvCache();
		expect(releaseBaseUrl()).toBe("http://127.0.0.1:9999/packs");
	});
});

describe("releasePageUrl", () => {
	it("is the page of this version's release, nothing when the folder is pointed elsewhere", () => {
		expect(releasePageUrl()).toBe(
			`https://github.com/itotm/biblioviva/releases/tag/v${APP_VERSION}`,
		);
		process.env.LANGUAGE_PACKS_BASE_URL = "http://127.0.0.1:9999/packs";
		resetEnvCache();
		expect(releasePageUrl()).toBeNull();
	});
});

describe("fetchPackIndex", () => {
	it("reads the index of the release, asking for a public file only", async () => {
		const { fetcher, calls } = server({
			"biblioviva-i18n-index.json": JSON.stringify({
				version: APP_VERSION,
				packs: [await entry()],
			}),
		});
		const index = await fetchPackIndex(fetcher);
		expect(index.map((e) => e.code)).toEqual(["de"]);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(
			`https://github.com/itotm/biblioviva/releases/download/v${APP_VERSION}/biblioviva-i18n-index.json`,
		);
		expect(calls[0]?.init?.credentials).toBe("omit");
		expect(calls[0]?.init?.headers).toBeUndefined();
		expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("is unavailable on a 404 or another status", async () => {
		expect((await failure(() => fetchPackIndex(server({}).fetcher))).code).toBe("unavailable");
		const odd = server({ "biblioviva-i18n-index.json": 500 });
		expect((await failure(() => fetchPackIndex(odd.fetcher))).code).toBe("unavailable");
	});

	it("is unavailable when the network fails or times out", async () => {
		const down: Fetcher = () => Promise.reject(new TypeError("fetch failed"));
		expect((await failure(() => fetchPackIndex(down))).code).toBe("unavailable");
	});

	it("is unavailable when the body is not JSON, not an index, or too big", async () => {
		for (const body of [
			"<html>",
			"{}",
			JSON.stringify({ packs: [{ ...(await entry()), sha256: "abc" }] }),
			JSON.stringify({ packs: [{ ...(await entry()), code: "German" }] }),
			JSON.stringify({ packs: [{ ...(await entry()), bytes: 1.5 }] }),
			JSON.stringify({ packs: [{ ...(await entry()), translation: "other" }] }),
			// a name with a path in it
			JSON.stringify({
				packs: [{ ...(await entry()), file: "../../etc/biblioviva-i18n-x.zip" }],
			}),
			JSON.stringify({ packs: [{ ...(await entry()), file: "evil/biblioviva-i18n-x.zip" }] }),
			JSON.stringify({ packs: [{ ...(await entry()), file: "biblioviva-i18n-x.exe" }] }),
			" ".repeat(250_000),
		]) {
			const { fetcher } = server({ "biblioviva-i18n-index.json": body });
			expect((await failure(() => fetchPackIndex(fetcher))).code).toBe("unavailable");
		}
	});

	it("is refused in the public demo, before any call", async () => {
		process.env.DEMO_PUBLIC = "1";
		resetEnvCache();
		const { fetcher, calls } = server({});
		await expect(fetchPackIndex(fetcher)).rejects.toBeInstanceOf(DemoBlockedError);
		await expect(downloadReleasePack(await entry(), fetcher)).rejects.toBeInstanceOf(
			DemoBlockedError,
		);
		expect(calls).toHaveLength(0);
	});
});

describe("downloadReleasePack", () => {
	it("downloads the file named by the index and checks its SHA-256", async () => {
		const e = await entry();
		const { fetcher, calls } = server({ [e.file]: zip });
		const got = await downloadReleasePack(e, fetcher);
		expect(Buffer.from(got).equals(Buffer.from(zip))).toBe(true);
		expect(calls[0]?.url.endsWith(`/${e.file}`)).toBe(true);
		expect(calls[0]?.init?.credentials).toBe("omit");
	});

	it("refuses a file that does not match the checksum", async () => {
		const e = await entry({ sha256: "0".repeat(64) });
		const { fetcher } = server({ [e.file]: zip });
		const err = await failure(() => downloadReleasePack(e, fetcher));
		expect(err.code).toBe("checksum");
	});

	it("is unavailable when the file is missing or the network fails", async () => {
		const e = await entry();
		expect((await failure(() => downloadReleasePack(e, server({}).fetcher))).code).toBe(
			"unavailable",
		);
		const down: Fetcher = () => Promise.reject(new Error("offline"));
		expect((await failure(() => downloadReleasePack(e, down))).code).toBe("unavailable");
	});

	it("is unavailable when the stream breaks half way", async () => {
		const e = await entry();
		const broken: Fetcher = () =>
			Promise.resolve(
				new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(new Uint8Array([1, 2, 3]));
							controller.error(new Error("reset"));
						},
					}),
					{ status: 200 },
				),
			);
		expect((await failure(() => downloadReleasePack(e, broken))).code).toBe("unavailable");
	});

	it("refuses a body over the limit, however the index describes it", async () => {
		const big = new Uint8Array(MAX_PACK_ZIP_BYTES + 1);
		const e = await entry({ bytes: 100, sha256: await sha256(big) });
		// streamed without a length
		const streamed: Fetcher = () =>
			Promise.resolve(
				new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(big);
							controller.close();
						},
					}),
					{ status: 200 },
				),
			);
		expect((await failure(() => downloadReleasePack(e, streamed))).code).toBe("tooLarge");
		// announced by Content-Length
		const announced: Fetcher = () =>
			Promise.resolve(
				new Response("x", {
					status: 200,
					headers: { "content-length": String(MAX_PACK_ZIP_BYTES + 1) },
				}),
			);
		expect((await failure(() => downloadReleasePack(e, announced))).code).toBe("tooLarge");
	});

	it("refuses an entry that already says it is too large, without asking for it", async () => {
		const e = await entry({ bytes: MAX_PACK_ZIP_BYTES + 1 });
		const { fetcher, calls } = server({ [e.file]: zip });
		expect((await failure(() => downloadReleasePack(e, fetcher))).code).toBe("tooLarge");
		expect(calls).toHaveLength(0);
	});

	it("takes an empty body as a bad checksum", async () => {
		const e = await entry();
		const empty: Fetcher = () => Promise.resolve(new Response(null, { status: 200 }));
		expect((await failure(() => downloadReleasePack(e, empty))).code).toBe("checksum");
	});
});

describe("releasePacksView", () => {
	it("lists the packs with the share translated and the installed ones marked", async () => {
		const rows = releasePacksView(
			[
				await entry(),
				await entry({
					code: "fr",
					nativeName: "Français",
					translated: 120,
					translation: "reviewed",
				}),
				await entry({ code: "pl", translated: 0, total: 0 }),
			],
			["fr", "it"],
		);
		expect(rows.map((r) => [r.code, r.percent, r.installed, r.translation])).toEqual([
			["de", 75, false, "machine"],
			["fr", 100, true, "reviewed"],
			["pl", 0, false, "machine"],
		]);
		expect(rows[0]).toMatchObject({
			nativeName: "Deutsch",
			name: "German",
			bytes: zip.byteLength,
		});
	});
});
