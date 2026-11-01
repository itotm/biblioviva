// SPDX-License-Identifier: GPL-3.0-or-later
// Export of the audit log grid with the same filters as /admin/audit.
import * as v from "valibot";
import { isoDayOrEmpty, textId } from "#lib/shared/input-schemas.js";
import { listAudit } from "#lib/server/services/audit.js";
import { dayRangeToUtc } from "#lib/shared/dates.js";
import { registerExport } from "../registry.js";
import type { ExportColumn } from "../types.js";

const optionalDate = v.optional(isoDayOrEmpty);

export const auditExportSchema = v.object({
	from: optionalDate,
	to: optionalDate,
	userId: v.optional(v.union([textId, v.literal("")])),
	action: v.optional(v.pipe(v.string(), v.maxLength(80))),
});

export function auditExportColumns(labels: Record<string, string>): ExportColumn[] {
	return [
		{ id: "at", label: labels.when ?? "when", type: "datetime" },
		{ id: "username", label: labels.user ?? "user", type: "string", widthMm: 30 },
		{ id: "action", label: labels.action ?? "action", type: "string", widthMm: 40 },
		{ id: "entity", label: labels.entity ?? "entity", type: "string", widthMm: 30 },
		{ id: "entityId", label: labels.entityId ?? "id", type: "string", widthMm: 25 },
		{ id: "details", label: labels.details ?? "details", type: "string", widthMm: 90 },
	];
}

/** Registers the `audit` export; `labels` returns the localized column headers for the request. */
export function registerAuditExport(
	labels: () => Record<string, string> | Promise<Record<string, string>>,
): void {
	registerExport("audit", {
		permission: "admin",
		schema: auditExportSchema,
		async build(db, params, _user, timezone) {
			const range = dayRangeToUtc(params.from || undefined, params.to || undefined, timezone);
			const { rows } = listAudit(db, {
				fromIso: range.fromIso,
				toIso: range.toIso,
				userId: params.userId ? Number(params.userId) : undefined,
				action: params.action || undefined,
				limit: 1000,
			});
			return {
				name: "audit",
				timezone,
				columns: auditExportColumns(await labels()),
				rows: rows.map((r) => ({
					...r,
					details: r.details ? JSON.stringify(r.details) : "",
				})),
			};
		},
	});
}
