// SPDX-License-Identifier: GPL-3.0-or-later
// Audit log queries for /admin/audit (permission `admin`).
import { query } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { auditFilterOptions, listAudit } from "#lib/server/services/audit.js";
import { dayRangeToUtc } from "#lib/shared/dates.js";
import { dbId, isoDay } from "#lib/shared/input-schemas.js";

const auditFiltersSchema = v.object({
	from: v.optional(isoDay),
	to: v.optional(isoDay),
	userId: v.optional(dbId),
	action: v.optional(v.pipe(v.string(), v.maxLength(80))),
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000)), 200),
	offset: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
});

export const getAudit = query(auditFiltersSchema, (filters) => {
	requireUser("admin");
	const timezone = getConfig().library.timezone;
	const range = dayRangeToUtc(filters.from, filters.to, timezone);
	const result = listAudit(getDb(), {
		fromIso: range.fromIso,
		toIso: range.toIso,
		userId: filters.userId,
		action: filters.action || undefined,
		limit: filters.limit,
		offset: filters.offset,
	});
	return result;
});

export const getAuditOptions = query(() => {
	requireUser("admin");
	return auditFilterOptions(getDb());
});
