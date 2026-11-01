// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	byCloseness,
	closeness,
	corrections,
	editDistance,
	maxEdits,
	searchWords,
	wordDistance,
} from "./fuzzy.js";

describe("fuzzy words (9.24)", () => {
	it("allows no mistake under four letters or in articles, one up to six letters, two from seven", () => {
		expect(maxEdits("il")).toBe(0);
		expect(maxEdits("ros")).toBe(0);
		expect(maxEdits("rosa")).toBe(1);
		expect(maxEdits("poter")).toBe(1);
		expect(maxEdits("princi")).toBe(1);
		expect(maxEdits("principie")).toBe(2);
		expect(maxEdits("della")).toBe(0);
		expect(maxEdits("nella")).toBe(0);
	});

	it("counts insertions, deletions, changes and two swapped letters as one each", () => {
		expect(editDistance("potter", "potter", 2)).toBe(0);
		expect(editDistance("poter", "potter", 2)).toBe(1);
		expect(editDistance("pasacl", "pascal", 2)).toBe(1);
		expect(editDistance("calvno", "calvino", 2)).toBe(1);
		expect(editDistance("principie", "principe", 2)).toBe(1);
		expect(editDistance("cosmicomice", "cosmicomiche", 2)).toBe(1);
		expect(editDistance("lcua", "luca", 1)).toBe(1);
		expect(editDistance("abc", "cab", 2)).toBe(2);
		// past the limit the answer is only "more than max"
		expect(editDistance("harry", "zebra", 1)).toBe(2);
		expect(editDistance("a", "abcdef", 2)).toBe(3);
		expect(editDistance("", "ab", 2)).toBe(2);
	});

	it("matches a prefix as the exact search does, and a mistake within the limit", () => {
		expect(wordDistance("princ", "principe")).toBe(0);
		expect(wordDistance("rosii", "rossi")).toBe(1);
		expect(wordDistance("ros", "rossi")).toBe(0);
		expect(wordDistance("ros", "russo")).toBeNull();
		expect(wordDistance("hary", "harry")).toBe(1);
		expect(wordDistance("bianchi", "neri")).toBeNull();
	});

	it("finds the corrections of a word in a vocabulary, the closest first", () => {
		const vocabulary = ["potter", "pottery", "poster", "porter", "harry", "piccolo", "poter"];
		expect(corrections("poter", vocabulary).map((c) => c.term)).toEqual([
			"porter",
			"poster",
			"potter",
		]);
		expect(corrections("hary", vocabulary)).toEqual([{ term: "harry", distance: 1 }]);
		expect(corrections("il", vocabulary)).toEqual([]);
		expect(corrections("piccolo", vocabulary)).toEqual([]);
	});

	it("scores a record by the words found, then the mistakes, and needs a long word", () => {
		const words = searchWords("Hary Poter e la pietra");
		expect(words).toEqual(["hary", "poter", "e", "la", "pietra"]);
		const all = closeness(words, searchWords("Harry Potter e la pietra filosofale"));
		const some = closeness(words, searchWords("Harry e le avventure"));
		expect(all).toEqual({ words: 5, mistakes: 2 });
		expect(some).toEqual({ words: 2, mistakes: 1 });
		expect([some!, all!].sort(byCloseness)).toEqual([all, some]);
		// short words alone never make a record close
		expect(closeness(["la", "e"], ["la", "e", "luna"])).toBeNull();
		expect(closeness(words, ["cucina", "italiana"])).toBeNull();
	});
});
