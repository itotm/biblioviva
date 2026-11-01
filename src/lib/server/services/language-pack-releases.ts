// SPDX-License-Identifier: GPL-3.0-or-later
// Language packs of the release (PLAN.md step 9.39, ADR-051): the index
// `biblioviva-i18n-index.json` and the zips `biblioviva-i18n-<code>-<version>.zip` that
// `bun run i18n:release` attaches to the GitHub release of the installed version are read from
// the server, and the pack an administrator picks goes through the same check and installation
// as an uploaded zip (`installPack`). Only public files are asked for, with no cookie, no custom
// header and nothing about the school; the name of the file to download comes from the validated
// index, never from the client. The public demo never calls out (`assertNotDemo`).
import * as v from "valibot";
import pkg from "../../../../package.json" with { type: "json" };
import { assertNotDemo } from "#lib/server/demo/public.js";
import { env } from "#lib/server/env.js";
import { sha256, type PackIndexEntry } from "#lib/server/i18n/pack-tools.js";
import { LOCALE_CODE } from "#lib/shared/input-schemas.js";
import { APP_VERSION } from "#lib/shared/version.js";
import { LanguagePackError, MAX_PACK_ZIP_BYTES } from "./language-packs.js";

/** What the server waits for an answer of the release. */
const TIMEOUT_MS = 10_000;
/** The index lists a few dozen packs; anything bigger is not the file it should be. */
const MAX_INDEX_BYTES = 200_000;
const INDEX_FILE = "biblioviva-i18n-index.json";

/** `fetch`, or a stand-in in the tests. */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const entrySchema = v.object({
	code: v.pipe(v.string(), v.regex(LOCALE_CODE)),
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
	nativeName: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
	translation: v.picklist(["machine", "reviewed"]),
	translated: v.pipe(v.number(), v.integer(), v.minValue(0)),
	total: v.pipe(v.number(), v.integer(), v.minValue(0)),
	file: v.pipe(v.string(), v.regex(/^biblioviva-i18n-[\w.-]+\.zip$/)),
	bytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
	sha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
});
const indexSchema = v.object({ packs: v.array(entrySchema) });

/**
 * The folder of the release that matches this version: the GitHub release of the repository of
 * `package.json` (`https://github.com/<owner>/<repo>/releases/download/v<version>`), or
 * `LANGUAGE_PACKS_BASE_URL`.
 */
export function releaseBaseUrl(): string {
	const override = env().LANGUAGE_PACKS_BASE_URL;
	if (override) {
		return override.replace(/\/+$/, "");
	}
	const repo = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(pkg.repository.url);
	if (!repo) {
		throw new LanguagePackError("unavailable", ["repository"]);
	}
	return `https://github.com/${repo[1]}/${repo[2]}/releases/download/v${APP_VERSION}`;
}

/**
 * The page of this version's release on GitHub, where every pack can be downloaded by hand (for
 * an installation without internet, to upload the zip); null when the folder was pointed elsewhere.
 */
export function releasePageUrl(): string | null {
	if (env().LANGUAGE_PACKS_BASE_URL) {
		return null;
	}
	const repo = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(pkg.repository.url);
	return repo ? `https://github.com/${repo[1]}/${repo[2]}/releases/tag/v${APP_VERSION}` : null;
}

/** A public file: no cookie, no header of ours, a time limit; a refusal or a failure is "unavailable". */
async function get(fetcher: Fetcher, url: string): Promise<Response> {
	let response: Response;
	try {
		response = await fetcher(url, {
			credentials: "omit",
			redirect: "follow",
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch {
		throw new LanguagePackError("unavailable");
	}
	if (response.status !== 200) {
		throw new LanguagePackError("unavailable", [String(response.status)]);
	}
	return response;
}

/** The body of a response, read up to `max` bytes (`null` when it is longer). */
async function readLimited(response: Response, max: number): Promise<Uint8Array | null> {
	const declared = Number(response.headers.get("content-length"));
	if (declared > max) {
		await response.body?.cancel().catch(() => undefined);
		return null;
	}
	const reader = response.body?.getReader();
	if (!reader) {
		return new Uint8Array();
	}
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			size += value.byteLength;
			if (size > max) {
				await reader.cancel().catch(() => undefined);
				return null;
			}
			chunks.push(value);
		}
	} catch {
		throw new LanguagePackError("unavailable");
	}
	const out = new Uint8Array(size);
	let at = 0;
	for (const chunk of chunks) {
		out.set(chunk, at);
		at += chunk.byteLength;
	}
	return out;
}

/** The packs the release offers. */
export async function fetchPackIndex(fetcher: Fetcher = fetch): Promise<PackIndexEntry[]> {
	assertNotDemo("languagePacks");
	const response = await get(fetcher, `${releaseBaseUrl()}/${INDEX_FILE}`);
	const body = await readLimited(response, MAX_INDEX_BYTES);
	if (!body) {
		throw new LanguagePackError("unavailable", ["index"]);
	}
	let json: unknown;
	try {
		json = JSON.parse(new TextDecoder().decode(body));
	} catch {
		throw new LanguagePackError("unavailable", ["index"]);
	}
	const parsed = v.safeParse(indexSchema, json);
	if (!parsed.success) {
		throw new LanguagePackError("unavailable", ["index"]);
	}
	return parsed.output.packs;
}

/** The zip of a pack of the index, its SHA-256 checked against the index. */
export async function downloadReleasePack(
	entry: PackIndexEntry,
	fetcher: Fetcher = fetch,
): Promise<Uint8Array> {
	assertNotDemo("languagePacks");
	if (entry.bytes > MAX_PACK_ZIP_BYTES) {
		throw new LanguagePackError("tooLarge");
	}
	const response = await get(fetcher, `${releaseBaseUrl()}/${entry.file}`);
	const zip = await readLimited(response, MAX_PACK_ZIP_BYTES);
	if (!zip) {
		throw new LanguagePackError("tooLarge");
	}
	if ((await sha256(zip)) !== entry.sha256) {
		throw new LanguagePackError("checksum", [entry.code]);
	}
	return zip;
}

export interface ReleasePackView {
	code: string;
	nativeName: string;
	name: string;
	translation: "machine" | "reviewed";
	/** Share of the messages translated, 0–100. */
	percent: number;
	bytes: number;
	installed: boolean;
}

/** The list for the page: the packs of the release, those already installed marked. */
export function releasePacksView(
	index: readonly PackIndexEntry[],
	installedCodes: readonly string[],
): ReleasePackView[] {
	return index.map((e) => ({
		code: e.code,
		nativeName: e.nativeName,
		name: e.name,
		translation: e.translation,
		percent: e.total > 0 ? Math.min(100, Math.floor((e.translated / e.total) * 100)) : 0,
		bytes: e.bytes,
		installed: installedCodes.includes(e.code),
	}));
}
