// SPDX-License-Identifier: GPL-3.0-or-later
// The linear merge of `@sveltekit-i18n/base` (ADR-019): adding a dictionary merges its dot-notation
// keys one by one instead of copying the whole table at every key. Quadratic, an instance built from
// a few thousand keys — every page request on the server, every page load in the browser — took
// tens of milliseconds on a PC and far more on a Raspberry Pi or a phone.
import { describe, expect, it } from "vitest";
import { createI18n } from "./index.js";

function dictionary(keys: number): Record<string, Record<string, string>> {
	const common: Record<string, string> = {};
	for (let i = 0; i < keys; i++) {
		common[`key${String(i)}`] = `testo ${String(i)}`;
	}
	return { common };
}

describe("i18n dictionaries", () => {
	it("builds an instance from 20 000 keys in linear time", async () => {
		const started = performance.now();
		const i18n = createI18n({ it: dictionary(20_000) }, false);
		await i18n.loadTranslations("it", "/");
		// quadratic, this took seconds; linear, a few milliseconds
		expect(performance.now() - started).toBeLessThan(500);
		expect(i18n.t("common.key19999")).toBe("testo 19999");
	});
});
