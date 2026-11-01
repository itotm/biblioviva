// SPDX-License-Identifier: GPL-3.0-or-later
// Audit log (PLAN.md step 1.7): who (account) did what to which entity, never personal data.
// Every mutating service calls `audit()` inside its own transaction.
import { and, count, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { subMonths } from "date-fns";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { auditLog, staffUser } from "#lib/server/db/schema.js";

/** Detail keys that would carry personal data: dropped before the row is written (privacy §3.15). */
export const FORBIDDEN_DETAIL_KEYS = new Set([
	"firstName",
	"lastName",
	"first_name",
	"last_name",
	"name",
	"fullName",
	"displayName",
	"photo",
	"photoPath",
	"photo_path",
	"cardNumber",
	"card_number",
	"email",
	"phone",
	"birthDate",
	"birth_date",
	"note",
	"notes",
	"circulationNote",
	"circulation_note",
	"password",
	"passwordHash",
	"token",
]);

const MAX_STRING = 200;

export type AuditDetails = Record<string, unknown>;

/** Removes forbidden keys (at any depth) and truncates long strings. */
export function sanitizeDetails(details: AuditDetails | undefined): AuditDetails | null {
	if (!details) {
		return null;
	}
	const clean = (value: unknown): unknown => {
		if (typeof value === "string") {
			return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
		}
		if (Array.isArray(value)) {
			return value.map(clean);
		}
		if (value && typeof value === "object") {
			const out: AuditDetails = {};
			for (const [k, v] of Object.entries(value as AuditDetails)) {
				if (FORBIDDEN_DETAIL_KEYS.has(k)) {
					continue;
				}
				out[k] = clean(v);
			}
			return out;
		}
		return value;
	};
	return clean(details) as AuditDetails;
}

export interface AuditActor {
	id: number;
}

/**
 * Writes one audit row. `actor` is `null` for system actions (startup, retention, config reload).
 * `action` is `<area>.<verb>` (e.g. `auth.login`, `patron.anonymize`), `entity` a table name.
 */
export function audit(
	db: DbOrTx,
	actor: AuditActor | null,
	action: string,
	entity: string,
	entityId: string | number | null = null,
	details?: AuditDetails,
	now = new Date(),
): number {
	const row = db
		.insert(auditLog)
		.values({
			at: now.toISOString(),
			userId: actor?.id ?? null,
			action,
			entity,
			entityId: entityId === null ? null : String(entityId),
			details: sanitizeDetails(details),
		})
		.returning({ id: auditLog.id })
		.get();
	return row.id;
}

export interface AuditFilters {
	/** ISO date `YYYY-MM-DD` (inclusive) in the library time zone, already converted to UTC instants by the caller. */
	fromIso?: string;
	toIso?: string;
	userId?: number;
	action?: string;
	entity?: string;
	limit?: number;
	offset?: number;
}

export interface AuditRow {
	id: number;
	at: string;
	userId: number | null;
	username: string | null;
	action: string;
	entity: string;
	entityId: string | null;
	details: AuditDetails | null;
}

export function listAudit(db: Db, filters: AuditFilters = {}): { rows: AuditRow[]; total: number } {
	const where = and(
		filters.fromIso ? gte(auditLog.at, filters.fromIso) : undefined,
		filters.toIso ? lte(auditLog.at, filters.toIso) : undefined,
		filters.userId !== undefined ? eq(auditLog.userId, filters.userId) : undefined,
		filters.action ? eq(auditLog.action, filters.action) : undefined,
		filters.entity ? eq(auditLog.entity, filters.entity) : undefined,
	);
	const rows = db
		.select({
			id: auditLog.id,
			at: auditLog.at,
			userId: auditLog.userId,
			username: staffUser.username,
			action: auditLog.action,
			entity: auditLog.entity,
			entityId: auditLog.entityId,
			details: auditLog.details,
		})
		.from(auditLog)
		.leftJoin(staffUser, eq(staffUser.id, auditLog.userId))
		.where(where)
		.orderBy(desc(auditLog.at), desc(auditLog.id))
		.limit(Math.min(filters.limit ?? 200, 1000))
		.offset(filters.offset ?? 0)
		.all();
	const total = db.select({ n: count() }).from(auditLog).where(where).get()?.n ?? 0;
	return { rows: rows.map((r) => ({ ...r, details: r.details ?? null })), total };
}

/** Distinct actions and the accounts that appear in the log, for the filter controls. */
export function auditFilterOptions(db: Db): {
	actions: string[];
	users: { id: number; username: string }[];
} {
	const actions = db
		.selectDistinct({ action: auditLog.action })
		.from(auditLog)
		.orderBy(auditLog.action)
		.all()
		.map((r) => r.action);
	const users = db
		.select({ id: staffUser.id, username: staffUser.username })
		.from(staffUser)
		.where(
			sql`${staffUser.id} in (select distinct user_id from audit_log where user_id is not null)`,
		)
		.orderBy(staffUser.username)
		.all();
	return { actions, users };
}

/** Deletes rows older than `retentionMonths` (privacy.auditRetentionMonths, Q39). Returns the count. */
export function purgeAudit(db: Db, retentionMonths: number, now = new Date()): number {
	const cutoff = subMonths(now, retentionMonths).toISOString();
	const result = db.delete(auditLog).where(lt(auditLog.at, cutoff)).run();
	return result.changes;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Runs the retention purge now and then once a day. Returns a stop function.
 * The interval is unref'd so it never keeps the process alive.
 */
export function installAuditRetention(
	getDb: () => Db,
	getMonths: () => number,
	log: (msg: string) => void = console.warn,
): () => void {
	const run = (): void => {
		try {
			const deleted = purgeAudit(getDb(), getMonths());
			if (deleted > 0) {
				log(`audit retention: ${deleted} rows older than ${getMonths()} months deleted`);
			}
		} catch (e) {
			log(`audit retention failed: ${(e as Error).message}`);
		}
	};
	run();
	const timer = setInterval(run, DAY_MS);
	(timer as { unref?: () => void }).unref?.();
	return () => clearInterval(timer);
}
