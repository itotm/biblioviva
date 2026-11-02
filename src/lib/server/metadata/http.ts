// SPDX-License-Identifier: GPL-3.0-or-later
// Small helpers shared by the HTTP providers: a JSON GET with timeout, identifying User-Agent and
// error mapping, plus the text normalisations the JSON sources need.
import { MetadataError, type ProviderContext } from "./types.js";
import { invertAuthorName } from "#lib/shared/author-name.js";

export async function fetchJson(
	ctx: ProviderContext,
	url: string,
	headers: Record<string, string> = {},
): Promise<unknown> {
	let response: Response;
	try {
		response = await ctx.fetch(url, {
			headers: { accept: "application/json", "user-agent": ctx.userAgent, ...headers },
			signal: AbortSignal.timeout(ctx.config.metadata.timeoutMs),
			redirect: "follow",
		});
	} catch (e) {
		const name = e instanceof Error ? e.name : "";
		if (name === "TimeoutError" || name === "AbortError") {
			throw new MetadataError("timeout", `${url} did not answer in time`);
		}
		throw new MetadataError("unreachable", `${url} not reachable`, String(e));
	}
	if (response.status === 429) {
		throw new MetadataError("rate_limited", `${url} rate limited`);
	}
	if (!response.ok) {
		throw new MetadataError("http", `${url} answered ${response.status}`);
	}
	try {
		return await response.json();
	} catch (e) {
		throw new MetadataError("protocol", `${url} did not return JSON`, String(e));
	}
}

/** Collapses whitespace; keeps the ISBD spacing around ` : ` and ` ; ` used by the JSON sources. */
export const clean = (s: string): string =>
	s
		// eslint-disable-next-line no-control-regex -- the markers are control characters by design
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
		.replace(/\s+/g, " ")
		.replace(/\s+,/g, ",")
		.trim();

/** The catalogue writes personal names as `Surname, Name`; web sources use the natural order. */
export function invertName(natural: string): string {
	return invertAuthorName(clean(natural));
}

export function yearOf(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined) {
		return null;
	}
	const m = /(1[5-9]\d{2}|20\d{2})/.exec(String(value));
	return m ? Number(m[1]) : null;
}

/** First numeric Dewey number in a list of classification strings (`"[Fic]"` is skipped). */
export function firstDewey(values: readonly string[] | undefined): string | null {
	for (const v of values ?? []) {
		const m = /^\s*(\d{1,3}(?:\.\d+)?)/.exec(v);
		if (m?.[1]) {
			return m[1];
		}
	}
	return null;
}

/** `Rowling, J. K.` / `Orwell, George` and a list of names → author per the catalogue rules. */
export function authorFromList(
	names: readonly string[],
	specialAuthors: readonly string[],
	inverted = false,
): string {
	const list = names.map(clean).filter(Boolean);
	if (list.length === 0) {
		return specialAuthors[0] ?? "Anonimo";
	}
	if (list.length >= 3) {
		return specialAuthors[1] ?? "AA. VV.";
	}
	const first = list[0] ?? "";
	return inverted ? first : invertName(first);
}

export function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

export function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.trim() !== "" ? clean(value) : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
