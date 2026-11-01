// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { browserLanguage, languageCookie } from "./demo-language.js";

describe("languageCookie", () => {
	it("is shared on biblioviva.org and its subdomains, for a year", () => {
		expect(languageCookie("en", "demo.biblioviva.org", true)).toBe(
			"bv_lang=en; path=/; max-age=31536000; samesite=lax; domain=biblioviva.org; secure",
		);
		expect(languageCookie("it", "biblioviva.org", true)).toContain("domain=biblioviva.org");
	});

	it("stays on its own host anywhere else", () => {
		expect(languageCookie("it", "localhost", false)).toBe(
			"bv_lang=it; path=/; max-age=31536000; samesite=lax",
		);
		expect(languageCookie("it", "notbiblioviva.org", true)).not.toContain("domain=");
	});
});

describe("browserLanguage", () => {
	const available = ["en", "it"];

	it("takes the first available language, by weight then order", () => {
		expect(browserLanguage("it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7", available)).toBe("it");
		expect(browserLanguage("de-DE,de;q=0.9,en;q=0.8,it;q=0.7", available)).toBe("en");
		expect(browserLanguage("it;q=0.5, en;q=0.8", available)).toBe("en");
		expect(browserLanguage("fr, it, en", available)).toBe("it");
	});

	it("matches a region to its language and a language to a regional code", () => {
		expect(browserLanguage("en-GB", available)).toBe("en");
		expect(browserLanguage("pt", ["en", "pt-BR"])).toBe("pt-BR");
		expect(browserLanguage("pt-BR", ["en", "pt-PT", "pt-BR"])).toBe("pt-BR");
	});

	it("is null without a header or an available language", () => {
		expect(browserLanguage(null, available)).toBeNull();
		expect(browserLanguage("", available)).toBeNull();
		expect(browserLanguage("de, fr;q=0.5, *", available)).toBeNull();
		expect(browserLanguage("en;q=0", available)).toBeNull();
	});
});
