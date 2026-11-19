// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { blankToNull, escapeLike, normalizeSearchText } from "./text.js";

describe("normalizeSearchText", () => {
	it("strips diacritics, case and punctuation", () => {
		expect(normalizeSearchText("D'Angelo  Müller")).toBe("d angelo muller");
		expect(normalizeSearchText("  Città ")).toBe("citta");
	});

	it("keeps the Latin results as they were", () => {
		const cases: [string, string][] = [
			["José Núñez", "jose nunez"],
			["Mohamed Al-Ṣāliḥ", "mohamed al salih"],
			["De Luca, Mario", "de luca mario"],
			["Éluard", "eluard"],
			["O'Brien-Smith", "o brien smith"],
			["Łukasz Ørsted", "łukasz ørsted"],
			["Straße 12/B", "straße 12 b"],
		];
		for (const [input, expected] of cases) {
			expect(normalizeSearchText(input)).toBe(expected);
		}
	});

	it("keeps Arabic words whole and unifies their variants", () => {
		expect(normalizeSearchText("إبراهيم")).toBe("ابراهيم");
		expect(normalizeSearchText("أحمد")).toBe(normalizeSearchText("احمد"));
		expect(normalizeSearchText("كِتَابُ الأَطْفَالِ")).toBe("كتاب الاطفال");
		expect(normalizeSearchText("كـتـاب")).toBe("كتاب");
		expect(normalizeSearchText("مدرسة")).toBe("مدرسه");
		expect(normalizeSearchText("علىٰ")).toBe("علي");
		expect(normalizeSearchText("کتاب")).toBe("كتاب");
		expect(normalizeSearchText("فارسی")).toBe("فارسي");
		expect(normalizeSearchText("ٱلله")).toBe("الله");
		expect(normalizeSearchText("صف ٣ و ۴")).toBe("صف 3 و 4");
	});

	it("keeps Hebrew words whole without their points", () => {
		expect(normalizeSearchText("שָׁלוֹם עֲלֵיכֶם")).toBe("שלום עליכם");
	});

	it("keeps Cyrillic, Greek and Asian names whole", () => {
		expect(normalizeSearchText("Достоевский, Фёдор")).toBe("достоевскии федор");
		expect(normalizeSearchText("Καζαντζάκης")).toBe("καζαντζακησ");
		expect(normalizeSearchText("ΟΔΟΣ")).toBe(normalizeSearchText("οδοσ"));
		expect(normalizeSearchText("村上春樹")).toBe("村上春樹");
		expect(normalizeSearchText("한강")).toBe("한강");
		expect(normalizeSearchText("ばか")).toBe("ばか");
		expect(normalizeSearchText("ムラカミ")).toBe("ムラカミ");
	});
});

describe("escapeLike", () => {
	it("makes the wildcards and the escape character match themselves", () => {
		expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
		expect(escapeLike("2026-C0001")).toBe("2026-C0001");
	});
});

describe("blankToNull", () => {
	it("trims a field and stores nothing for a blank one", () => {
		expect(blankToNull("  Rossi ")).toBe("Rossi");
		expect(blankToNull("   ")).toBeNull();
		expect(blankToNull("")).toBeNull();
	});
});
