// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { groupOf, groupOverdues, slipDate, type OverdueSource } from "./overdues.js";

const labels = { teacher: "Docente", noClass: "Senza classe" };
let next = 0;
/** A synthetic class id: level 3, class "C" → 33. */
const groupIdOf = (level: number, name: string): number => level * 10 + name.charCodeAt(0) - 64;
const loan = (
	lastName: string,
	dueDate: string,
	cls: [number, string] | "teacher" | null,
	firstName = "Anna",
): OverdueSource => ({
	loanId: ++next,
	patronId: next,
	firstName,
	lastName,
	patronType: cls === "teacher" ? "teacher" : "student",
	groupId: Array.isArray(cls) ? groupIdOf(...cls) : null,
	groupName: Array.isArray(cls) ? cls[1] : null,
	levelPosition: Array.isArray(cls) ? cls[0] - 1 : null,
	classLabel: Array.isArray(cls) ? `${String(cls[0])} ${cls[1]}` : null,
	title: `Libro ${next}`,
	author: "Rossi, Mario",
	barcode: `2026-${next}`,
	dueDate,
	lastNoticeAt: null,
});

describe("overdue groups", () => {
	it("groups by class in class order, then students without a class, then teachers", () => {
		const today = "2026-10-20";
		const groups = groupOverdues(
			[
				loan("Verdi", "2026-10-01", "teacher"),
				loan("Neri", "2026-10-01", [5, "B"]),
				loan("Bianchi", "2026-10-01", [1, "A"]),
				loan("Gialli", "2026-10-01", null),
				loan("Rossi", "2026-10-01", [1, "B"]),
				loan("Blu", "2026-10-01", [1, "A"]),
			],
			{ today, minDays: 5, labels },
		);
		expect(groups.map((g) => [g.key, g.label, g.kind])).toEqual([
			["g11", "1 A", "class"],
			["g12", "1 B", "class"],
			["g52", "5 B", "class"],
			["noclass", "Senza classe", "noclass"],
			["teacher", "Docente", "teacher"],
		]);
		// rows by surname
		expect(groups[0]?.rows.map((r) => r.lastName)).toEqual(["Bianchi", "Blu"]);
		expect(groups[0]?.rows[0]?.daysOverdue).toBe(19);
	});

	it("two loans of one patron are two rows, sorted by due date", () => {
		const groups = groupOverdues(
			[
				loan("Verdi", "2026-10-05", "teacher", "Luca"),
				loan("Verdi", "2026-09-30", "teacher", "Luca"),
				loan("Verdi", "2026-10-01", "teacher", "Anna"),
			],
			{ today: "2026-10-20", minDays: 0, labels },
		);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.rows.map((r) => [r.firstName, r.daysOverdue])).toEqual([
			["Anna", 19],
			["Luca", 20],
			["Luca", 15],
		]);
	});

	it("hides loans overdue for fewer than minDays days; 0 means every overdue loan", () => {
		const loans = [
			loan("A", "2026-10-19", [2, "A"]),
			loan("B", "2026-10-16", [2, "A"]),
			loan("C", "2026-10-15", [2, "A"]),
			loan("D", "2026-10-20", [2, "A"]),
			loan("E", "2026-10-25", [2, "A"]),
		];
		const count = (minDays: number): number =>
			groupOverdues(loans, { today: "2026-10-20", minDays, labels }).reduce(
				(n, g) => n + g.rows.length,
				0,
			);
		expect(count(5)).toBe(1);
		expect(count(4)).toBe(2);
		expect(count(0)).toBe(3);
		expect(count(1)).toBe(3);
	});

	it("keeps only the requested groups", () => {
		const groups = groupOverdues(
			[loan("A", "2026-10-01", [3, "A"]), loan("B", "2026-10-01", "teacher")],
			{ today: "2026-10-20", minDays: 5, labels, keys: ["teacher"] },
		);
		expect(groups.map((g) => g.key)).toEqual(["teacher"]);
	});

	it("labels the groups and formats the slip date", () => {
		expect(
			groupOf(
				{ patronType: "student", groupId: 33, groupName: "C", classLabel: "3 C" },
				labels,
			),
		).toEqual({
			key: "g33",
			kind: "class",
			label: "3 C",
		});
		expect(
			groupOf(
				{ patronType: "student", groupId: null, groupName: null, classLabel: null },
				labels,
			),
		).toEqual({ key: "noclass", kind: "noclass", label: "Senza classe" });
		expect(
			groupOf(
				{ patronType: "teacher", groupId: null, groupName: null, classLabel: null },
				labels,
			).key,
		).toBe("teacher");
		// a teacher in a teachers group: that group, under its own name
		expect(
			groupOf(
				{ patronType: "teacher", groupId: 7, groupName: "Docenti", classLabel: "Docenti" },
				labels,
			),
		).toEqual({ key: "g7", kind: "teacher", label: "Docenti" });
		expect(slipDate("2026-09-19")).toBe("19/09/2026");
	});

	it("orders the names in the installation's language (9.41)", () => {
		const loans = [
			loan("Åberg", "2026-10-01", [1, "A"]),
			loan("Zetterberg", "2026-10-01", [1, "A"]),
			loan("Berg", "2026-10-01", [1, "A"]),
		];
		const names = (locale?: string): string[] =>
			groupOverdues(loans, { today: "2026-10-20", minDays: 0, labels, locale })[0]?.rows.map(
				(r) => r.lastName,
			) ?? [];
		expect(names("sv")).toEqual(["Berg", "Zetterberg", "Åberg"]);
		expect(names()).toEqual(["Åberg", "Berg", "Zetterberg"]);
	});
});
