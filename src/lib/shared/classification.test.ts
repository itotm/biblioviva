// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	author3,
	classCodesUnder,
	classificationOf,
	classOf,
	genreOf,
	splitCallNumber,
	suggestCallNumber,
	suggestClassFromDewey,
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
