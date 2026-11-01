// SPDX-License-Identifier: GPL-3.0-or-later
// "Avanza di classe" (step 7.1): the preview, the backup of step 1 and the run. Permission `admin`.
import { command, query } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { refusedWithCode, refusing } from "#lib/server/http/errors.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { serverContext } from "#lib/server/context.js";
import { createBackup } from "#lib/server/services/backup.js";
import {
	applyRollover,
	RolloverError,
	rolloverPreview,
	type RolloverDecisions,
} from "#lib/server/services/rollover.js";
import { dbId, levelCode, textId } from "#lib/shared/input-schemas.js";

export const getRolloverPreview = query(() => {
	requireUser("admin");
	const config = getConfig();
	return rolloverPreview(getDb(), config);
});

/** Step 1: a fresh backup of the database, required by the run. */
export const rolloverBackup = command(() => {
	requireUser("admin");
	return createBackup(getDb(), getConfig().library.timezone);
});

export const runRollover = command(
	v.object({
		decisions: v.record(
			textId,
			v.object({
				repeat: v.optional(v.boolean()),
				keep: v.optional(v.boolean()),
				group: v.optional(dbId),
				/** The choice taken where the path splits (9.41); null: leaves the school. */
				next: v.optional(v.nullable(levelCode)),
			}),
		),
		backup: v.pipe(v.string(), v.maxLength(80)),
		confirmRecent: v.boolean(),
	}),
	(input) => {
		const user = requireUser("admin");
		const decisions: RolloverDecisions = Object.fromEntries(
			Object.entries(input.decisions).map(([id, d]) => [Number(id), d]),
		);
		return refusing(
			() => {
				const result = applyRollover(
					serverContext(),
					{ decisions, backup: input.backup, confirmRecent: input.confirmRecent },
					user,
				);
				void getRolloverPreview().refresh();
				return { ok: true as const, ...result };
			},
			RolloverError,
			refusedWithCode,
		);
	},
);
