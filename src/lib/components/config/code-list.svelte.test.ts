// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { CodeListEditor } from "./code-list.svelte.js";

describe("CodeListEditor", () => {
	it("tracks renames, checks the codes and edits the list", () => {
		const editor = new CodeListEditor(/^[A-Z0-9]{1,8}$/, false);
		editor.load([{ code: "A" }, { code: "B" }]);
		expect(editor.renames).toEqual({});
		expect(editor.draft).toEqual([
			{ code: "A", label: "A", flag: false },
			{ code: "B", label: "B", flag: false },
		]);
		const [a] = editor.rows;
		if (a) {
			a.code = "1A";
		}
		expect(editor.renames).toEqual({ A: "1A" });
		editor.add();
		const added = editor.rows[2];
		expect(editor.problems[added?.key ?? ""]).toEqual(["codeRequired"]);
		if (added) {
			added.code = "b";
		}
		expect(editor.problems[added?.key ?? ""]).toEqual(["codeFormat"]);
		if (added) {
			added.code = "B";
		}
		expect(editor.problems[added?.key ?? ""]).toEqual(["codeTaken"]);
		expect(editor.invalid).toBe(true);
		editor.remove(added?.key ?? "");
		editor.move(editor.rows[1]?.key ?? "", -1);
		expect(editor.draft.map((d) => d.code)).toEqual(["B", "1A"]);
		editor.move(editor.rows[0]?.key ?? "", -1);
		expect(editor.draft.map((d) => d.code)).toEqual(["B", "1A"]);
		editor.remove(editor.rows[0]?.key ?? "");
		editor.remove(editor.rows[0]?.key ?? "");
		expect(editor.rows).toHaveLength(1);
		expect(editor.invalid).toBe(false);
	});

	it("checks the names when the list has them", () => {
		const editor = new CodeListEditor(/^[a-z]{1,8}$/, true);
		editor.load([{ code: "libro", label: "Libro", flag: false }]);
		const [row] = editor.rows;
		if (row) {
			row.label = " ";
			row.flag = true;
		}
		expect(editor.problems[row?.key ?? ""]).toEqual(["labelRequired"]);
		expect(editor.draft).toEqual([{ code: "libro", label: "", flag: true }]);
	});
});
