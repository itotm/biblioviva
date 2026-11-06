// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	author3,
	callNumberChoice,
	callNumberRest,
	callNumberScheme,
	CALL_NUMBER_ENDS,
	CALL_NUMBER_ORDERS,
	classCodesUnder,
	computeCallNumber,
	isFreeScheme,
	readCallNumber,
	schemeUses,
	title3,
	classificationOf,
	classOf,
	genreOf,
	splitCallNumber,
	suggestCallNumber,
	suggestClassFromDewey,
	type CallNumberScheme,
	type ClassificationScheme,
} from "./classification.js";

const scheme: ClassificationScheme = {
	fictionByClass: true,
	classPerItem: false,
	readingLevels: ["1", "2", "3", "4", "5"].map((code) => ({ code, label: `${code}ª` })),
	genres: [
		{ code: "A", label: "Romanzi", image: "A.png", color: "#e8231b" },
		{ code: "B", label: "Storici" },
	],
	nonfiction: [
		{
			code: "500",
			label: "Scienze",
			image: "500.png",
			color: "#0d47a1",
			children: [
				{ code: "590", label: "Animali" },
				{ code: "520", label: "Astronomia", image: "520.png" },
			],
		},
		{ code: "MMM", label: "Multimedia" },
	],
	callNumber: {
		fiction: "{{genre}} {{author3}}",
		fictionWithClass: "{{genre}} {{class}} {{author3}}",
		nonfiction: "{{code}} {{author3}}",
		text: "author3",
	},
	deweyMap: [
		{ prefix: "5", code: "500" },
		{ prefix: "59", code: "590" },
		{ prefix: "52", code: "520" },
		{ prefix: "7", code: "700" },
	],
};

describe("classification scheme", () => {
	it("suggests the local class from a Dewey number, longest prefix first", () => {
		expect(suggestClassFromDewey(scheme, "598.2")).toBe("590");
		expect(suggestClassFromDewey(scheme, "523")).toBe("520");
		expect(suggestClassFromDewey(scheme, "550")).toBe("500");
		// mapped to a code missing from the taxonomy → no suggestion
		expect(suggestClassFromDewey(scheme, "780")).toBeNull();
		expect(suggestClassFromDewey(scheme, "853.914")).toBeNull();
		expect(suggestClassFromDewey(scheme, null)).toBeNull();
		expect(suggestClassFromDewey(scheme, "[Fic]")).toBeNull();
		expect(suggestClassFromDewey({ ...scheme, deweyMap: undefined }, "598")).toBeNull();
	});

	it("resolves genres and classes, children inheriting image and colour", () => {
		expect(genreOf(scheme, "A")).toMatchObject({
			label: "Romanzi",
			image: "A.png",
			kind: "fiction",
		});
		expect(genreOf(scheme, "B")?.image).toBeNull();
		expect(genreOf(scheme, "Z")).toBeNull();
		expect(classOf(scheme, "590")).toEqual({
			code: "590",
			label: "Animali",
			image: "500.png",
			color: "#0d47a1",
			parent: "500",
			kind: "nonfiction",
		});
		expect(classOf(scheme, "520")?.image).toBe("520.png");
		expect(classOf(scheme, "MMM")).toMatchObject({ image: null, parent: null });
		expect(classOf(scheme, "999")).toBeNull();
		expect(classCodesUnder(scheme, "500")).toEqual(["500", "590", "520"]);
		expect(classCodesUnder(scheme, "590")).toEqual(["590"]);
		expect(
			classificationOf(scheme, { kind: "fiction", genreCode: "A", classCode: null })?.code,
		).toBe("A");
		expect(
			classificationOf(scheme, { kind: "nonfiction", genreCode: null, classCode: "590" })
				?.label,
		).toBe("Animali");
		expect(
			classificationOf(scheme, { kind: "fiction", genreCode: null, classCode: null }),
		).toBeNull();
	});

	it("builds the author cutter and the call numbers of the shelves", () => {
		expect(author3("Delitto, Anna")).toBe("DEL");
		expect(author3("Rossi Marco")).toBe("ROS");
		expect(author3("Éluard, Paul")).toBe("ELU");
		expect(author3("AA. VV.")).toBe("AA");
		expect(author3("")).toBe("");
		const base = { author: "Delitto, Anna", title: "il gatto" };
		expect(
			suggestCallNumber(scheme, {
				kind: "fiction",
				genreCode: "B",
				classCode: null,
				readingLevel: "4",
				...base,
			}),
		).toBe("B 4 DEL");
		expect(
			suggestCallNumber(scheme, {
				kind: "fiction",
				genreCode: "B",
				classCode: null,
				readingLevel: null,
				...base,
			}),
		).toBe("B DEL");
		expect(
			suggestCallNumber(scheme, {
				kind: "nonfiction",
				genreCode: null,
				classCode: "590",
				readingLevel: null,
				author: "Rossi",
				title: "x",
			}),
		).toBe("590 ROS");
		const custom = {
			...scheme,
			callNumber: { ...scheme.callNumber, fiction: "{{genre}} {{title1}} {{author3}}" },
		};
		expect(
			suggestCallNumber(custom, {
				kind: "fiction",
				genreCode: "A",
				classCode: null,
				readingLevel: null,
				...base,
			}),
		).toBe("A I DEL");
		expect(splitCallNumber("B 4 DEL")).toEqual({ head: "B 4", rest: "DEL" });
		expect(splitCallNumber("590 ROS")).toEqual({ head: "590", rest: "ROS" });
		expect(splitCallNumber("DEL")).toEqual({ head: "", rest: "DEL" });
	});
});

describe("the segnatura computed from a scheme (Q143)", () => {
	const book = {
		kind: "fiction",
		genreCode: "B",
		classCode: null,
		author: "Delitto, Anna",
		title: "La casa",
	} as const;
	const of = (
		order: (typeof CALL_NUMBER_ORDERS)[number],
		end: (typeof CALL_NUMBER_ENDS)[number],
	): { callNumber: CallNumberScheme } => ({
		callNumber: callNumberScheme(order, end),
	});

	it("follows the order and the end chosen, with the shelf part as head", () => {
		expect(
			computeCallNumber(of("genreLevel", "author"), { ...book, readingLevel: "4" }),
		).toEqual({
			full: "B 4 DEL",
			head: "B 4",
		});
		expect(
			computeCallNumber(of("levelGenre", "author"), { ...book, readingLevel: "4" }),
		).toEqual({
			full: "4 B DEL",
			head: "4 B",
		});
		expect(computeCallNumber(of("genre", "author"), { ...book, readingLevel: "4" })).toEqual({
			full: "B DEL",
			head: "B",
		});
		expect(computeCallNumber(of("genreLevel", "none"), { ...book, readingLevel: "4" })).toEqual(
			{
				full: "B 4",
				head: "B 4",
			},
		);
		expect(
			computeCallNumber(of("genreLevel", "author"), { ...book, readingLevel: null }),
		).toEqual({
			full: "B DEL",
			head: "B",
		});
		expect(
			computeCallNumber(of("genreLevel", "author"), {
				...book,
				kind: "nonfiction",
				genreCode: null,
				classCode: "590",
				readingLevel: null,
				author: "Rossi, Anna",
			}),
		).toEqual({ full: "590 ROS", head: "590" });
	});

	it("has none for a record to classify", () => {
		expect(
			computeCallNumber(of("genreLevel", "author"), {
				...book,
				kind: null,
				readingLevel: null,
			}),
		).toBeNull();
	});

	it("takes the title's text, or its proposal while it has none", () => {
		const scheme = of("genreLevel", "text");
		expect(computeCallNumber(scheme, { ...book, readingLevel: "4", text: null })?.full).toBe(
			"B 4 DEL",
		);
		expect(computeCallNumber(scheme, { ...book, readingLevel: "4", text: "DELI" })?.full).toBe(
			"B 4 DELI",
		);
		expect(computeCallNumber(scheme, { ...book, readingLevel: "4", text: "" })?.full).toBe(
			"B 4",
		);
		// the author's initials of the computed end cannot be changed by a text
		expect(
			computeCallNumber(of("genreLevel", "author"), { ...book, readingLevel: "4", text: "X" })
				?.full,
		).toBe("B 4 DEL");
	});

	it("keeps the copy's text in the free scheme, its last word as the rest", () => {
		const scheme = of("free", "author");
		expect(isFreeScheme(scheme.callNumber)).toBe(true);
		expect(schemeUses(scheme, "copytext")).toBe(true);
		expect(schemeUses(scheme, "text")).toBe(false);
		expect(
			computeCallNumber(scheme, { ...book, readingLevel: null, copyText: "R 12 ROD" }),
		).toEqual({ full: "R 12 ROD", head: "R 12" });
		expect(
			computeCallNumber(scheme, { ...book, readingLevel: null, copyText: null }),
		).toBeNull();
	});

	it("recognises the order and end of saved patterns, null for hand-written ones", () => {
		for (const order of CALL_NUMBER_ORDERS) {
			for (const end of CALL_NUMBER_ENDS) {
				const choice = callNumberChoice(callNumberScheme(order, end));
				expect(choice?.order).toBe(order);
				if (order !== "free") {
					expect(choice?.end).toBe(end);
				}
			}
		}
		expect(
			callNumberChoice({
				...callNumberScheme("genreLevel", "author"),
				fiction: "{{title1}}",
			}),
		).toBeNull();
	});

	it("reads the written parts back from a whole segnatura", () => {
		const parts = { ...book, readingLevel: "4" };
		expect(readCallNumber(of("genreLevel", "text"), parts, "B 4 DELI")).toEqual({
			text: "DELI",
		});
		expect(readCallNumber(of("genreLevel", "text"), parts, "B 4")).toEqual({ text: "" });
		expect(readCallNumber(of("genreLevel", "text"), parts, "A 4 DEL")).toEqual({});
		expect(readCallNumber(of("free", "author"), parts, " R  12 ")).toEqual({
			copyText: "R 12",
		});
		expect(
			readCallNumber(
				{
					callNumber: {
						...callNumberScheme("genreLevel", "author"),
						fictionWithClass: "{{genre}} {{class}} {{copytext}}",
					},
				},
				parts,
				"B 4 SALA2",
			),
		).toEqual({ copyText: "SALA2" });
	});

	it("gives the rest under the head", () => {
		expect(callNumberRest("B 4 DEL", "B 4")).toBe("DEL");
		expect(callNumberRest("B 4", "B 4")).toBe("");
		expect(callNumberRest("ROD", "")).toBe("ROD");
	});
});

describe("the initials of a book without a real author (Q143)", () => {
	const rules = {
		callNumber: callNumberScheme("genreLevel", "author"),
		specialAuthors: ["Anonimo", "AA. VV."],
	};
	const parts = {
		kind: "nonfiction",
		genreCode: null,
		classCode: "030",
		readingLevel: null,
		title: "Enciclopedia dei ragazzi",
	} as const;

	it("takes the title's initials, past an article", () => {
		expect(computeCallNumber(rules, { ...parts, author: "Anonimo" })?.full).toBe("030 ENC");
		expect(computeCallNumber(rules, { ...parts, author: "aa. vv." })?.full).toBe("030 ENC");
		expect(title3("Il gatto con gli stivali")).toBe("GAT");
		expect(title3("L'isola del tesoro")).toBe("ISO");
		expect(title3("Le")).toBe("LE");
		expect(computeCallNumber(rules, { ...parts, author: "Rossi, Anna" })?.full).toBe("030 ROS");
	});
});
