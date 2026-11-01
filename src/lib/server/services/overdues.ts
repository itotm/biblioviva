// SPDX-License-Identifier: GPL-3.0-or-later
// Overdue notices (PLAN.md step 4.6, §3.12, Appendix H): the overdue loans grouped as the library
// hands them out — one group per class in class order (Phase 12: the class is a group of the
// database, ordered by level then name), students without a class after them, each teachers group
// last (Q102) — with the calendar days of delay counted from the print date. Pure: the rows come
// from `loan-lists.ts`, the labels of the special groups from the caller (i18n).
import { daysBetween } from "#lib/shared/calendar-core.js";
import { collatorFor } from "#lib/shared/collation.js";
import { compareClassKeys, type ClassOrderKey } from "#lib/shared/school.js";

export interface OverdueSource {
	loanId: number;
	patronId: number;
	firstName: string;
	lastName: string;
	patronType: string;
	/** The patron's class now (the notice goes to today's class, Q95). */
	groupId: number | null;
	groupName: string | null;
	levelPosition: number | null;
	classLabel: string | null;
	title: string;
	author: string;
	barcode: string;
	dueDate: string;
	/** Instant of the last "Segna solleciti stampati" for this loan, if any. */
	lastNoticeAt: string | null;
}

export interface OverdueRow extends OverdueSource {
	daysOverdue: number;
}

export type OverdueGroupKind = "class" | "noclass" | "teacher";

export interface OverdueGroup {
	/** Stable key for filters and route parameters: `g12` (a group), `noclass`, `teacher`. */
	key: string;
	kind: OverdueGroupKind;
	label: string;
	rows: OverdueRow[];
}

export interface GroupLabels {
	teacher: string;
	noClass: string;
}

/** The group of a patron: the class for students, the teachers group for teachers. */
export function groupOf(
	p: Pick<OverdueSource, "patronType" | "groupId" | "groupName" | "classLabel">,
	labels: GroupLabels,
): Omit<OverdueGroup, "rows"> {
	if (p.patronType === "teacher") {
		return p.groupId === null
			? { key: "teacher", kind: "teacher", label: labels.teacher }
			: {
					key: `g${String(p.groupId)}`,
					kind: "teacher",
					label: p.groupName ?? labels.teacher,
				};
	}
	if (p.groupId !== null) {
		return { key: `g${String(p.groupId)}`, kind: "class", label: p.classLabel ?? "" };
	}
	return { key: "noclass", kind: "noclass", label: labels.noClass };
}

const GROUP_KIND: Record<OverdueGroupKind, ClassOrderKey["kind"]> = {
	class: "students",
	noclass: null,
	teacher: "teachers",
};

/** The class order of the school (`compareClassKeys`), the classes by their label. */
function compareGroups(a: OverdueGroup, b: OverdueGroup, locale?: string): number {
	const key = (g: OverdueGroup): ClassOrderKey => ({
		kind: GROUP_KIND[g.kind],
		position: g.rows[0]?.levelPosition ?? 0,
		name: g.label,
	});
	return compareClassKeys(key(a), key(b), locale);
}

/** By surname and name in the installation's language (9.41), then by due date. */
function compareRows(a: OverdueRow, b: OverdueRow, locale?: string): number {
	const names = collatorFor(locale);
	return (
		names.compare(a.lastName, b.lastName) ||
		names.compare(a.firstName, b.firstName) ||
		a.dueDate.localeCompare(b.dueDate) ||
		a.loanId - b.loanId
	);
}

/**
 * Groups the loans overdue on `today` by at least `minDays` calendar days (`0` = every overdue
 * loan). A patron with two overdue books has two rows. `keys` keeps only the given groups.
 */
export function groupOverdues(
	loans: readonly OverdueSource[],
	options: {
		today: string;
		minDays: number;
		labels: GroupLabels;
		keys?: readonly string[];
		/** `ui.locale`: the order of the names (Italian when left out). */
		locale?: string;
	},
): OverdueGroup[] {
	const threshold = Math.max(1, options.minDays);
	const groups = new Map<string, OverdueGroup>();
	for (const loan of loans) {
		const daysOverdue = daysBetween(loan.dueDate, options.today);
		if (daysOverdue < threshold) {
			continue;
		}
		const g = groupOf(loan, options.labels);
		if (options.keys && !options.keys.includes(g.key)) {
			continue;
		}
		const group = groups.get(g.key) ?? { ...g, rows: [] };
		group.rows.push({ ...loan, daysOverdue });
		groups.set(g.key, group);
	}
	const sorted = [...groups.values()];
	for (const g of sorted) {
		g.rows.sort((a, b) => compareRows(a, b, options.locale));
	}
	return sorted.sort((a, b) => compareGroups(a, b, options.locale));
}

/** `dd/MM/yyyy` of a `YYYY-MM-DD` date, as on the library's printed notices. */
export function slipDate(iso: string): string {
	const [y, m, d] = iso.split("-");
	return `${d}/${m}/${y}`;
}
