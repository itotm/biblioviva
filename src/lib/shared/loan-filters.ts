// SPDX-License-Identifier: GPL-3.0-or-later
// Filters of the loans grid (step 4.6), shared by the remote query and the export: every value is
// a string, as in the export URL; empty means "all".
import * as v from "valibot";

export const loanFiltersSchema = v.object({
	q: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(60)), ""),
	/** The patron's class (a group id, Phase 12). */
	group: v.optional(v.union([v.literal(""), v.pipe(v.string(), v.regex(/^\d{1,9}$/))]), ""),
	patronType: v.optional(v.picklist(["", "student", "teacher"]), ""),
	overdue: v.optional(v.picklist(["", "1"]), ""),
});

export type LoanFiltersInput = v.InferOutput<typeof loanFiltersSchema>;

export interface ParsedLoanFilters {
	q?: string;
	groupId?: number;
	patronType?: "student" | "teacher";
	overdueOnly?: boolean;
}

export function toLoanFilters(input: LoanFiltersInput): ParsedLoanFilters {
	return {
		q: input.q || undefined,
		groupId: input.group ? Number(input.group) : undefined,
		patronType: input.patronType || undefined,
		overdueOnly: input.overdue === "1",
	};
}
