// SPDX-License-Identifier: GPL-3.0-or-later
// The pure parts of `bun run site:check` (scripts/site-check-lib.ts): how a page is read and what the
// comparisons between the languages, the labels and the links report.
import { describe, expect, it } from "vitest";
import {
	anchorList,
	boldSpans,
	checkBoldLabels,
	checkFigureNames,
	checkLinks,
	checkParity,
	figureMarkers,
	headingAnchors,
	headings,
	labelMatcher,
	links,
	maskFences,
	normalizeLabel,
	orderedLists,
	problemAnchors,
	type DocFile,
} from "./site-check-lib.ts";

const doc = (lang: string, rel: string, text: string): DocFile => ({
	path: `docs/${lang}/${rel}`,
	lang,
	rel,
	text,
});

describe("reading a page", () => {
	it("blanks code blocks without moving anything", () => {
		const text = "a\n```sh\n# not a heading\n```\n# Heading\n";
		const masked = maskFences(text);
		expect(masked).toHaveLength(text.length);
		expect(headings(text)).toEqual([{ level: 1, text: "Heading", line: 5 }]);
	});

	it("keeps a longer fence open until a fence as long closes it", () => {
		const text = "````md\n```\n# inside\n```\n````\n## Out\n";
		expect(headings(text).map((h) => h.text)).toEqual(["Out"]);
	});

	it("reads the headings as a reader sees them, and numbers the repeated anchors", () => {
		const text =
			"# Un `comando` **forte**\n## [Link](x.md) e altro\n## Passo\n## Passo\n### L'ISBN: errato?\n";
		expect(headings(text).map((h) => h.text)).toEqual([
			"Un comando forte",
			"Link e altro",
			"Passo",
			"Passo",
			"L'ISBN: errato?",
		]);
		expect([...headingAnchors(text)]).toEqual([
			"un-comando-forte",
			"link-e-altro",
			"passo",
			"passo-1",
			"lisbn-errato",
		]);
		expect(anchorList(text)[3]?.anchor).toBe("passo-1");
	});

	it("ignores headings in comments", () => {
		expect(headings("<!--\n# hidden\n-->\n# Seen\n").map((h) => h.text)).toEqual(["Seen"]);
	});

	it("counts the steps of every list, nested lists apart", () => {
		const text = [
			"# T",
			"",
			"1. one",
			"1. two",
			"   - a bullet",
			"   1. nested",
			"1. three",
			"",
			"Text.",
			"",
			"1. again",
			"",
			"1. loosely",
		].join("\n");
		expect(orderedLists(text)).toEqual([
			{ line: 3, items: 3 },
			{ line: 6, items: 1 },
			{ line: 11, items: 2 },
		]);
	});

	it("does not count numbers in code, and splits lists at a variant marker", () => {
		const text =
			"```\n1. no\n```\n<!-- variant: a -->\n1. x\n<!-- /variant -->\n<!-- variant: b -->\n1. y\n1. z\n<!-- /variant -->\n";
		expect(orderedLists(text).map((l) => l.items)).toEqual([1, 2]);
	});

	it("finds figure markers with their caption, also over two lines, but not in code", () => {
		const text = [
			"<!-- figure: area/one | A caption -->",
			"<!--  screenshot: tailscale/dns |",
			"  Two lines -->",
			"<!-- figure: area/bare -->",
			"```md",
			"<!-- figure: area/code | no -->",
			"```",
		].join("\n");
		expect(figureMarkers(text)).toEqual([
			{ kind: "figure", name: "area/one", caption: "A caption", line: 1 },
			{ kind: "screenshot", name: "tailscale/dns", caption: "Two lines", line: 2 },
			{ kind: "figure", name: "area/bare", caption: undefined, line: 4 },
		]);
	});

	it("finds bold texts over a line break and a quotation, with code kept", () => {
		const text = [
			"Premere **Salva** e **Presta a `<nome>`**.",
			"",
			"> cambiare **Stampa su",
			"> entrambi i lati** subito.",
			"",
			"`**not bold**` e ```**no**```",
			"```",
			"**in a block**",
			"```",
			"<!-- **in a comment** -->",
		].join("\n");
		expect(boldSpans(text).map((b) => [b.text, b.line])).toEqual([
			["Salva", 1],
			["Presta a `<nome>`", 1],
			["Stampa su entrambi i lati", 3],
		]);
	});

	it("knows the label that opens a variant block", () => {
		const text =
			"<!-- variant: lan -->\n**Con la rete locale**\n\n1. Passo con **Salva**.\n<!-- /variant -->\n";
		expect(boldSpans(text).map((b) => [b.text, b.variantLabel])).toEqual([
			["Con la rete locale", true],
			["Salva", false],
		]);
	});

	it("finds the internal links with their line, not the external ones nor those in code", () => {
		const text = [
			"[a](other.md#x) and [b](https://example.org) and `[c](no.md)`",
			'![img](pic.png) [d](<spaced name.md>) [e](#here "title")',
			"[f](mailto:a@b.c)",
		].join("\n");
		expect(links(text)).toEqual([
			{ href: "other.md#x", line: 1 },
			{ href: "spaced name.md", line: 2 },
			{ href: "#here", line: 2 },
		]);
	});
});

describe("labels of the interface", () => {
	it("normalizes quotes, white space and the end of a label", () => {
		expect(normalizeLabel("  L’ISBN \n  letto: ")).toBe("L'ISBN letto");
		expect(normalizeLabel("Cerca…")).toBe("Cerca");
		expect(normalizeLabel("Presta a `<nome>`.")).toBe("Presta a <nome>");
	});

	it("matches a dictionary text exactly, case included", () => {
		const is = labelMatcher(["Salva", "Annulla ultimo", "Cerca…"]);
		expect(is("Salva")).toBe(true);
		expect(is("Salva:")).toBe(true);
		expect(is("Cerca")).toBe(true);
		expect(is("salva")).toBe(false);
		expect(is("Salvataggio")).toBe(false);
	});

	it("lets a placeholder stand for anything, and expands the plural forms", () => {
		const is = labelMatcher([
			"Stampa tessere {{classLabel}}",
			"Password (almeno {{min}} caratteri)",
			"{{count}} {{count:plural; one:copia; other:copie;}}",
			"Nuove {{count:plural; one:{{count}} copia; other:{{count}} copie;}}",
			"{{a}} {{b}}",
		]);
		expect(is("Stampa tessere 3 B")).toBe(true);
		expect(is("Stampa tessere")).toBe(true);
		expect(is("Password (almeno 8 caratteri)")).toBe(true);
		expect(is("Nuove 2 copie")).toBe(true);
		expect(is("Nuove 1 copia")).toBe(true);
		// a text that is only placeholders and a plural word would match everything
		expect(is("qualsiasi cosa")).toBe(false);
	});

	it("accepts a count after a label, as a tab shows it", () => {
		const is = labelMatcher(["Prestiti in corso"]);
		expect(is("Prestiti in corso (N)")).toBe(true);
		expect(is("Prestiti in corso (3)")).toBe(true);
		expect(is("Prestiti in corso (tanti)")).toBe(false);
	});

	it("reports a bold text that is not a label, except the exceptions and variant labels", () => {
		const is = labelMatcher(["Salva", "Annulla"]);
		const file = doc(
			"it",
			"manual/guides/x.md",
			[
				"Premere **Salva**, poi **Salvaa**.",
				"È **molto importante** e **Altro**.",
				"<!-- variant: a -->",
				"**Con Tailscale**",
				"<!-- /variant -->",
			].join("\n"),
		);
		const problems = checkBoldLabels([file], () => is, [
			{ text: "molto importante", why: "emphasis" },
			{ text: "Altro", lang: "en", why: "another language" },
			{ text: "Salvaa", file: "other/", why: "another folder" },
		]);
		expect(problems.map((p) => [p.line, p.message.split("»")[0]])).toEqual([
			[1, "bold «Salvaa"],
			[2, "bold «Altro"],
		]);
		expect(problems[0]?.file).toBe("docs/it/manual/guides/x.md");
	});
});

describe("figure markers", () => {
	it("must name a picture of the shot list", () => {
		const files = [
			doc(
				"it",
				"a.md",
				"<!-- figure: circulation/ok | ok -->\n<!-- figure: nope/x | x -->\n<!-- figure: | x -->",
			),
		];
		const problems = checkFigureNames(files, new Set(["circulation/ok"]));
		expect(problems.map((p) => [p.line, p.message])).toEqual([
			[2, "«nope/x» is not in the shot list (docs/shots.ts)"],
			[3, "a figure marker without a name"],
		]);
	});
});

describe("the languages mirror each other", () => {
	const page = (steps: number, extra = ""): string =>
		`# Title\n\n## Procedura\n\n${Array.from({ length: steps }, () => "1. step").join("\n")}\n\n<!-- figure: a/b | c -->\n${extra}`;

	it("accepts pages that match", () => {
		const files = [doc("it", "p.md", page(3)), doc("en", "p.md", page(3))];
		expect(checkParity(files, ["it", "en"])).toEqual([]);
	});

	it("reports a page that exists in one language only", () => {
		const problems = checkParity([doc("it", "p.md", page(1))], ["it", "en"]);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toMatchObject({ check: "parity", file: "docs/en/p.md" });
		expect(problems[0]?.message).toContain("docs/it/p.md");
	});

	it("reports another number or level of headings, where it begins", () => {
		const files = [doc("it", "p.md", page(1)), doc("en", "p.md", page(1, "\n## Extra\n"))];
		const [problem, ...rest] = checkParity(files, ["it", "en"]);
		expect(rest).toEqual([]);
		expect(problem).toMatchObject({ check: "headings", file: "docs/en/p.md" });
		expect(problem?.message).toContain("heading 3");
		const level = checkParity(
			[doc("it", "p.md", "# T\n## A\n"), doc("en", "p.md", "# T\n### A\n")],
			["it", "en"],
		);
		expect(level[0]?.message).toContain("## «A»");
	});

	it("reports another number of steps", () => {
		const files = [doc("it", "p.md", page(3)), doc("en", "p.md", page(2))];
		const [problem, ...rest] = checkParity(files, ["it", "en"]);
		expect(rest).toEqual([]);
		expect(problem).toMatchObject({ check: "steps", file: "docs/en/p.md", line: 5 });
		expect(problem?.message).toContain("it 3 steps");
		expect(problem?.message).toContain("en 2");
	});

	it("reports the same steps split into other lists", () => {
		const a = "# T\n\n1. a\n1. b\n\ntext\n\n1. c\n";
		const b = "# T\n\n1. a\n\ntext\n\n1. b\n1. c\n";
		const problems = checkParity([doc("it", "p.md", a), doc("en", "p.md", b)], ["it", "en"]);
		expect(problems.map((p) => p.check)).toEqual(["steps"]);
	});

	it("reports other figures, in the other order too", () => {
		const a = "# T\n<!-- figure: a/one | x -->\n<!-- figure: a/two | y -->\n";
		const b = "# T\n<!-- figure: a/two | y -->\n<!-- figure: a/one | x -->\n";
		const problems = checkParity([doc("it", "p.md", a), doc("en", "p.md", b)], ["it", "en"]);
		expect(problems.map((p) => [p.check, p.file, p.line])).toEqual([
			["figures", "docs/en/p.md", 2],
		]);
		const fewer = checkParity(
			[doc("it", "p.md", a), doc("en", "p.md", "# T\n<!-- figure: a/one | x -->\n")],
			["it", "en"],
		);
		expect(fewer[0]?.message).toContain("en has none");
	});
});

describe("links", () => {
	it("reports a missing file and a missing heading", () => {
		const target = { exists: true, anchors: new Set(["here"]) };
		const file = doc(
			"it",
			"a.md",
			"[ok](b.md#here) [no file](gone.md) [no heading](b.md#away) [self](#top) [dir](../x) [enc](b.md#h%C3%A8re)",
		);
		const problems = checkLinks([file], (_f, path) => {
			if (path === "gone.md") {
				return { exists: false, anchors: null };
			}
			if (path === "../x") {
				return { exists: true, anchors: null };
			}
			if (path === "") {
				return { exists: true, anchors: new Set() };
			}
			return target;
		});
		expect(problems.map((p) => p.message)).toEqual([
			"the link «gone.md» points to a file that does not exist",
			"the link «b.md#away» points to a heading that does not exist",
			"the link «#top» points to a heading that does not exist",
			"the link «b.md#h%C3%A8re» points to a heading that does not exist",
		]);
	});
});

describe("the boxes of the problems", () => {
	const text = [
		"# Page",
		"## Procedura",
		"### Not a problem",
		"## Possibili problemi",
		"### Il libro è già in catalogo",
		"### L'ISBN errato",
		"## Pagine correlate",
		"### Sub",
	].join("\n");

	it("are the ### of the section Possibili problemi", () => {
		expect(problemAnchors(text, false, new Set())).toEqual([
			{ anchor: "il-libro-è-già-in-catalogo", line: 5 },
			{ anchor: "lisbn-errato", line: 6 },
		]);
	});

	it("are the ## of the page of problems, but the related pages", () => {
		expect(
			problemAnchors(
				"# P\n## One\n## Two\n## Related pages\n",
				true,
				new Set(["related pages"]),
			),
		).toEqual([
			{ anchor: "one", line: 2 },
			{ anchor: "two", line: 3 },
		]);
	});
});
