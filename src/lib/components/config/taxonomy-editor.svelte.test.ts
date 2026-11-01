// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { TaxonomyDraft } from "#lib/shared/taxonomy.js";
import { TaxonomyEditor } from "./taxonomy-editor.svelte.js";

const leaf = (code: string, label = code): TaxonomyDraft["genres"][number] => ({
	code,
	label,
	image: null,
	color: null,
});

const saved = (): TaxonomyDraft => ({
	readingLevels: [{ code: "1", label: "1ª" }],
	fictionByClass: true,
	classPerItem: false,
	genres: [leaf("A"), leaf("B"), leaf("C")],
	nonfiction: [
		{ ...leaf("500", "Scienze"), color: "#35bfef", children: [leaf("510"), leaf("590")] },
		{ ...leaf("700", "Arte"), children: [leaf("780")] },
		{ ...leaf("900", "Storia"), children: [] },
	],
	deweyMap: [
		{ prefix: "59", code: "590" },
		{ prefix: "7", code: "700" },
	],
	callNumber: {
		fiction: "{{genre}} {{author3}}",
		fictionWithClass: "{{genre}} {{class}} {{author3}}",
		nonfiction: "{{code}} {{author3}}",
	},
});

const keyOf = (editor: TaxonomyEditor, code: string): string => {
	const place = editor.findCode("fiction", code) ?? editor.findCode("nonfiction", code) ?? null;
	if (!place) {
		throw new Error(`no node ${code}`);
	}
	return place.node.key;
};

describe("TaxonomyEditor", () => {
	it("loads the saved taxonomy unchanged, and renames follow the codes", () => {
		const editor = new TaxonomyEditor(saved());
		expect(editor.draft).toEqual(saved());
		expect(editor.dirty).toBe(false);
		expect(editor.invalid).toBe(false);
		const b = editor.findCode("fiction", "B");
		if (!b) {
			throw new Error("no B");
		}
		b.node.code = "B2";
		expect(editor.dirty).toBe(true);
		expect(editor.renames).toEqual({ B: "B2" });
		// a renamed class keeps its Dewey rows
		const cls = editor.findCode("nonfiction", "590");
		if (!cls) {
			throw new Error("no 590");
		}
		cls.node.code = "591";
		expect(editor.draft.deweyMap[0]).toEqual({ prefix: "59", code: "591" });
		editor.reset(saved());
		expect(editor.dirty).toBe(false);
	});

	it("reports empty, malformed and repeated codes, empty names and Dewey rows", () => {
		const editor = new TaxonomyEditor(saved());
		const added = editor.addGenre();
		expect(editor.selected).toBe(added.key);
		expect(editor.problems[added.key]).toEqual(["codeRequired", "labelRequired"]);
		added.code = "a b";
		expect(editor.problems[added.key]).toContain("codeFormat");
		added.code = "510";
		added.label = "Doppio";
		expect(editor.problems[added.key]).toEqual(["codeTaken"]);
		added.code = "Z";
		added.color = "red";
		expect(editor.problems[added.key]).toEqual(["colorFormat"]);
		added.color = "#ff0000";
		expect(editor.invalid).toBe(false);
		editor.addDewey();
		expect(editor.deweyIssues[2]).toEqual(["prefixFormat"]);
		const row = editor.deweyMap[2];
		if (row) {
			row.prefix = "59";
		}
		expect(editor.deweyIssues[2]).toEqual(["prefixTaken"]);
		editor.removeDewey(row?.key ?? "");
		editor.callNumber.fiction = " ";
		expect(editor.invalid).toBe(true);
	});

	it("reorders with the arrows and by drag and drop", () => {
		const editor = new TaxonomyEditor(saved());
		editor.move(keyOf(editor, "A"), 1);
		expect(editor.draft.genres.map((g) => g.code)).toEqual(["B", "A", "C"]);
		editor.move(keyOf(editor, "B"), -1);
		expect(editor.draft.genres.map((g) => g.code)).toEqual(["B", "A", "C"]);
		editor.drop(keyOf(editor, "C"), keyOf(editor, "B"));
		expect(editor.draft.genres.map((g) => g.code)).toEqual(["C", "B", "A"]);
		editor.drop(keyOf(editor, "C"), keyOf(editor, "A"), true);
		expect(editor.draft.genres.map((g) => g.code)).toEqual(["B", "A", "C"]);
		// a genre never lands among the classes, a class never among the subclasses
		editor.drop(keyOf(editor, "A"), keyOf(editor, "500"));
		editor.drop(keyOf(editor, "900"), keyOf(editor, "510"));
		expect(editor.draft.genres.map((g) => g.code)).toEqual(["B", "A", "C"]);
		expect(editor.draft.nonfiction.map((n) => n.code)).toEqual(["500", "700", "900"]);
		// a subclass moves among the subclasses of another class, or to the end of a class
		editor.drop(keyOf(editor, "590"), keyOf(editor, "780"));
		expect(editor.draft.nonfiction[1]?.children.map((c) => c.code)).toEqual(["590", "780"]);
		editor.drop(keyOf(editor, "590"), keyOf(editor, "900"));
		expect(editor.draft.nonfiction[2]?.children.map((c) => c.code)).toEqual(["590"]);
		editor.drop(keyOf(editor, "900"), keyOf(editor, "500"));
		expect(editor.draft.nonfiction.map((n) => n.code)).toEqual(["900", "500", "700"]);
	});

	it("moves classes between the levels and removes nodes, keeping at least one", () => {
		const editor = new TaxonomyEditor(saved());
		editor.reparent(keyOf(editor, "510"), null);
		expect(editor.draft.nonfiction.map((n) => n.code)).toEqual(["500", "700", "900", "510"]);
		editor.reparent(keyOf(editor, "510"), keyOf(editor, "900"));
		expect(editor.draft.nonfiction[2]?.children.map((c) => c.code)).toEqual(["510"]);
		// two levels at most: a class with subclasses stays at the top
		editor.reparent(keyOf(editor, "700"), keyOf(editor, "500"));
		expect(editor.draft.nonfiction.map((n) => n.code)).toEqual(["500", "700", "900"]);

		editor.selected = keyOf(editor, "780");
		editor.remove(keyOf(editor, "700"));
		expect(editor.selected).toBeNull();
		expect(editor.draft.nonfiction.map((n) => n.code)).toEqual(["500", "900"]);
		const sub = editor.addClass(keyOf(editor, "900"));
		expect(editor.find(sub.key)?.parent?.code).toBe("900");
		editor.remove(keyOf(editor, "A"));
		editor.remove(keyOf(editor, "B"));
		expect(editor.canRemove(keyOf(editor, "C"))).toBe(false);
		editor.remove(keyOf(editor, "C"));
		expect(editor.draft.genres.map((g) => g.code)).toEqual(["C"]);
	});
});
