// SPDX-License-Identifier: GPL-3.0-or-later
// First-run wizard (step 1.11): completes the configuration; demo data management for admins.
import { serverTranslator } from "#lib/i18n/server.js";
import { assertNotDemo } from "#lib/server/demo/public.js";
import { command } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { configCode, localeCode } from "#lib/shared/input-schemas.js";
import { mirrorConfigUsers } from "#lib/server/auth/config-users.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { MIN_PASSWORD_LENGTH } from "#lib/server/auth/password.js";
import { requireSetupMode } from "#lib/server/auth/setup-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { closeDb, getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { audit } from "#lib/server/services/audit.js";
import {
	completeSetup as completeSetupService,
	DEMO_PASSWORD,
	removeDemoData,
	restoreSchoolClasses,
	snapshotSchoolClasses,
} from "#lib/server/services/setup.js";
import { CHECK_ALGORITHMS } from "#lib/shared/barcodes/check.js";
import { KEYBOARD_LAYOUTS } from "#lib/shared/barcodes/layouts.js";
import { CODE_PRESETS } from "#lib/shared/barcodes/presets.js";
import { SCHOOL_YEAR_LABELS } from "#lib/shared/school-year.js";
import { isAvailableLocale } from "#lib/server/i18n/registry.js";
import { THEMES } from "#lib/shared/theme-palette.js";

const password = v.pipe(v.string(), v.minLength(MIN_PASSWORD_LENGTH), v.maxLength(256));

const setupSchema = v.object({
	locale: localeCode,
	theme: v.picklist(THEMES),
	libraryName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
	school: v.object({
		preset: v.pipe(v.string(), v.regex(/^[A-Za-z0-9._-]{1,40}$/)),
		stages: v.pipe(
			v.array(
				v.object({
					code: configCode,
					mode: v.picklist(["perLevel", "mixed"]),
					names: v.pipe(
						v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40))),
						v.maxLength(26),
					),
				}),
			),
			v.maxLength(10),
		),
		teacherGroupName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
		classLabel: v.pipe(v.string(), v.maxLength(40), v.includes("{group}")),
		readingLevels: v.boolean(),
		schoolYearStart: v.pipe(v.string(), v.regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)),
		schoolYearLabel: v.picklist(SCHOOL_YEAR_LABELS),
	}),
	features: v.object({ photos: v.boolean(), covers: v.boolean() }),
	codes: v.object({
		item: v.picklist(CODE_PRESETS),
		card: v.picklist(CODE_PRESETS),
		check: v.picklist(CHECK_ALGORITHMS),
		layout: v.picklist(KEYBOARD_LAYOUTS),
	}),
	passwords: v.object({
		admin: password,
		prestiti: password,
		catalogo: password,
		tessere: password,
		report: password,
	}),
	demo: v.boolean(),
});

export const completeSetup = command(setupSchema, async (input) => {
	requireSetupMode();
	if (!(await isAvailableLocale(input.locale))) {
		error(400, "unknown locale");
	}
	const { demo } = await completeSetupService(
		getDb(),
		{ configDir: env().CONFIG_DIR, dataDir: env().DATA_DIR },
		input,
		await serverTranslator(input.locale),
	);
	return { ok: true as const, demo };
});

/**
 * Admin action "Svuota dati dimostrativi": resets database and uploads, then recreates the schema.
 * The file is replaced (the patrons, books, loans, pictures, history of the demo all go with it);
 * the classes and the teachers group of the wizard are read first and written into the new file,
 * with their ids (9.42). The accounts keep the demo password until it is changed: the answer
 * carries it for the message.
 */
export const clearDemoData = command(async () => {
	const user = requireUser("admin");
	// the public demo keeps its data until the nightly reset (9.17)
	assertNotDemo("demoData");
	const dataDir = env().DATA_DIR;
	const classes = snapshotSchoolClasses(getDb());
	closeDb();
	const removed = removeDemoData(dataDir, env().DATABASE_PATH);
	const db = getDb(); // fresh file, migrations applied
	restoreSchoolClasses(db, classes);
	await mirrorConfigUsers(db, getConfig());
	audit(db, null, "demo.cleared", "database", null, {
		by: user.username,
		removed: removed.length,
		classes: classes.groups.length,
	});
	return {
		ok: true as const,
		removed: removed.length,
		classes: classes.groups.length,
		password: DEMO_PASSWORD,
	};
});
