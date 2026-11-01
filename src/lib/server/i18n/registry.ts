// SPDX-License-Identifier: GPL-3.0-or-later
// The languages an installation can use (step 1.14): the built-in dictionaries of the bundle
// (English first) plus the valid packs found under `CONFIG_DIR/i18n`. Packs are discovered once
// and again after a configuration reload; problems are logged once per discovery.
import { DEFAULT_LOCALE, LOCALES, localeDisplayName, NAMESPACES } from "#lib/i18n/index.js";
import { env } from "#lib/server/env.js";
import {
	describeProblem,
	discoverPacks,
	writeBuiltInPack,
	type Dictionaries,
	type PackInfo,
} from "./packs.js";

export interface LocaleOption {
	code: string;
	/** Name shown in pickers (the language's own name). */
	name: string;
	builtIn: boolean;
}

const builtIn = new Map<string, Promise<Dictionaries>>();

/** The bundled dictionaries of a built-in locale (loaded once). */
export function builtInDictionaries(locale: string): Promise<Dictionaries> {
	let loading = builtIn.get(locale);
	if (!loading) {
		loading = (async () => {
			const out = {} as Dictionaries;
			for (const ns of NAMESPACES) {
				out[ns] = (
					(await import(`../../i18n/${locale}/${ns}.json`)) as {
						default: Record<string, unknown>;
					}
				).default;
			}
			return out;
		})();
		builtIn.set(locale, loading);
	}
	return loading;
}

let packs: PackInfo[] | null = null;
let packsDir: string | null = null;
let logger: (msg: string) => void = console.warn;

/** Discovers (or returns the cached) packs of `configDir`; logs the problems once. */
export async function loadPacks(configDir = env().CONFIG_DIR): Promise<PackInfo[]> {
	if (packs && packsDir === configDir) {
		return packs;
	}
	const english = await builtInDictionaries(DEFAULT_LOCALE);
	const found = discoverPacks(configDir, english);
	for (const pack of found) {
		for (const p of pack.problems) {
			logger(describeProblem(pack.code, p));
		}
		if (!pack.valid) {
			logger(`[i18n] pack "${pack.code}" is not offered until its errors are fixed`);
		}
	}
	packs = found;
	packsDir = configDir;
	return found;
}

/** Forget the discovered packs (configuration reload, tests). */
export function invalidatePacks(): void {
	packs = null;
	packsDir = null;
}

export function setPackLogger(log: (msg: string) => void): void {
	logger = log;
}

/** Built-in locales (English first) followed by the valid packs, for the wizard and Administration. */
export async function availableLocales(configDir = env().CONFIG_DIR): Promise<LocaleOption[]> {
	const found = await loadPacks(configDir);
	return [
		...LOCALES.map((code) => ({ code, name: localeDisplayName(code), builtIn: true })),
		...found
			.filter((p) => p.valid && p.meta)
			.map((p) => ({ code: p.code, name: p.meta?.nativeName ?? p.code, builtIn: false })),
	];
}

export async function isAvailableLocale(
	code: unknown,
	configDir = env().CONFIG_DIR,
): Promise<boolean> {
	if (typeof code !== "string") {
		return false;
	}
	if ((LOCALES as readonly string[]).includes(code)) {
		return true;
	}
	return (await loadPacks(configDir)).some((p) => p.valid && p.code === code);
}

/** The codes of `isKnownLocale`, built in first: the languages a visitor of the public demo can pick. */
export function knownLocales(): string[] {
	return [...LOCALES, ...(packs ?? []).filter((p) => p.valid && p.meta).map((p) => p.code)];
}

/** Synchronous view for request handling: only what has been discovered so far. */
export function isKnownLocale(code: unknown): boolean {
	return (
		typeof code === "string" &&
		((LOCALES as readonly string[]).includes(code) ||
			(packs?.some((p) => p.valid && p.code === code) ?? false))
	);
}

/** The pack's dictionaries in the shape `createI18n(translations)` expects, or null. */
export function packTranslations(code: string): Record<string, Record<string, unknown>> | null {
	const pack = packs?.find((p) => p.valid && p.code === code);
	return pack?.dictionaries ? { [code]: pack.dictionaries } : null;
}

/**
 * First run: the shipped Italian (and English, as the reference) are written under
 * `CONFIG_DIR/i18n/` as packs to clone; existing files are never overwritten. Both codes stay
 * built in, so these folders are examples, not the source of truth.
 */
export async function installDefaultPacks(configDir = env().CONFIG_DIR): Promise<string[]> {
	const written: string[] = [];
	const meta: Record<string, { name: string; nativeName: string }> = {
		en: { name: "English", nativeName: "English" },
		it: { name: "Italian", nativeName: "Italiano" },
	};
	for (const locale of LOCALES) {
		const m = meta[locale] ?? { name: locale, nativeName: localeDisplayName(locale) };
		const files = writeBuiltInPack(configDir, locale, await builtInDictionaries(locale), {
			...m,
			appVersion: "",
		});
		written.push(...files.map((f) => `${locale}/${f}`));
	}
	return written;
}
