// SPDX-License-Identifier: GPL-3.0-or-later
// The public demo built at every start (PLAN.md step 9.17, Q119): both volumes emptied and filled
// again as the first-run wizard would with the default preset, the demo data of 9.12 and 12.8
// (seeded with the library's today, so the loans are always current), the demo class picture of
// Q109 and the generic library logo. Nothing a visitor did survives a restart, and the daily exit
// at `DEMO_RESET_AT` makes it every night. A folder without the demo's marker is never emptied: a
// school's installation started with the flag by mistake refuses to start instead.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mirrorConfigUsers } from "#lib/server/auth/index.js";
import { hashPassword } from "#lib/server/auth/password.js";
import { getLoadedConfig, resetConfigCache } from "#lib/server/config/index.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { mirrorConfigTables } from "#lib/server/db/config-mirror.js";
import { closeDb, getDb } from "#lib/server/db/index.js";
import { seedOptionsFromConfig } from "#lib/server/db/seed-config.js";
import { loadSchoolPresets } from "#lib/server/school/presets.js";
import { schoolOf } from "#lib/server/school/structure.js";
import { audit } from "#lib/server/services/audit.js";
import { writeLibraryLogo } from "#lib/server/services/branding.js";
import {
	DEMO_PASSWORD,
	loadDemoData,
	WIZARD_ACCOUNTS,
	wizardPreset,
	writeDemoSetupConfig,
	type WizardAccount,
} from "#lib/server/services/setup.js";
import { DEFAULT_CHECK, DEFAULT_CODE_PRESET } from "#lib/shared/barcodes/presets.js";
import { writeDemoExamples } from "./examples.js";
import { layoutForLocale, stageChoices, wizardGroups } from "#lib/shared/setup-school.js";
import { resolvePerformance } from "#lib/shared/performance.js";

/** The file that marks a folder as the public demo's: only such a folder is emptied. */
export const DEMO_DIR_MARKER = ".biblioviva-public-demo";
/** The generic logo of the demo library (`docs/reference/demo/library-logo.png`). */
export const DEMO_LOGO = "demo/library-logo.png";
/** The name of the demo library and its language. */
export const DEMO_LIBRARY_NAME = "Demo";
const DEMO_LOCALE = "it";

export class NotADemoFolderError extends Error {
	constructor(readonly dir: string) {
		super(
			`${dir} holds files but no ${DEMO_DIR_MARKER}: DEMO_PUBLIC=1 empties its folders at every ` +
				"start, so it refuses to touch what may be a school's installation",
		);
		this.name = "NotADemoFolderError";
	}
}

/** Empties a folder of the demo (its content, not the folder: it may be a mounted volume). */
function emptyDemoFolder(dir: string): void {
	mkdirSync(dir, { recursive: true });
	for (const entry of readdirSync(dir)) {
		rmSync(join(dir, entry), { recursive: true, force: true });
	}
	writeFileSync(join(dir, DEMO_DIR_MARKER), "BiblioViva public demo: emptied at every start\n");
}

/**
 * Builds the public demo in `configDir` and `dataDir` (the folders of `env()`): the configuration
 * of the wizard, the database with the demo data, the logo. Called by `init` before anything
 * else reads the configuration or opens the database.
 */
export async function buildPublicDemo(
	dirs: { configDir: string; dataDir: string },
	now = new Date(),
): Promise<{ patrons: number; biblios: number }> {
	for (const dir of [dirs.configDir, dirs.dataDir]) {
		if (existsSync(dir)) {
			const entries = readdirSync(dir);
			if (entries.length > 0 && !entries.includes(DEMO_DIR_MARKER)) {
				throw new NotADemoFolderError(dir);
			}
		}
	}
	closeDb();
	emptyDemoFolder(dirs.configDir);
	emptyDemoFolder(dirs.dataDir);
	const example = parseConfig(exampleRaw()).config;
	const preset = loadSchoolPresets().find((p) => p.id === example.school.preset);
	if (!preset) {
		throw new Error(`the default school preset ${example.school.preset} is missing`);
	}
	const shown = wizardPreset(preset, DEMO_LOCALE);
	const stages = stageChoices(shown);
	const passwordHashes = {} as Record<WizardAccount, string>;
	for (const account of WIZARD_ACCOUNTS) {
		passwordHashes[account] = await hashPassword(
			DEMO_PASSWORD,
			resolvePerformance(example.performance).argon2MemoryMb,
		);
	}
	writeDemoSetupConfig(dirs.configDir, {
		locale: DEMO_LOCALE,
		theme: example.ui.theme,
		libraryName: DEMO_LIBRARY_NAME,
		school: {
			preset: preset.id,
			stages,
			teacherGroupName: preset.teacherGroup,
			classLabel: preset.school.classLabel,
			readingLevels: preset.readingLevels.length > 0,
			schoolYearStart: shown.schoolYear.start,
			schoolYearLabel: shown.schoolYear.label,
		},
		codes: {
			item: DEFAULT_CODE_PRESET,
			card: DEFAULT_CODE_PRESET,
			check: DEFAULT_CHECK,
			layout: layoutForLocale(DEMO_LOCALE),
		},
		features: { photos: true, covers: true },
		passwordHashes,
	});
	resetConfigCache();
	const config = getLoadedConfig().config;
	const db = getDb();
	mirrorConfigTables(db, config);
	await mirrorConfigUsers(db, config);
	const groups = wizardGroups(schoolOf(config).levels, stages);
	const demo = await loadDemoData(
		db,
		dirs.dataDir,
		{
			photos: config.photos,
			seed: seedOptionsFromConfig(config, { groups }),
			timezone: config.library.timezone,
		},
		now,
	);
	await writeLibraryLogo(dirs.configDir, new Uint8Array(readFileSync(DEMO_LOGO)));
	// the only files its CSV imports accept (Q121)
	writeDemoExamples(db, config, dirs.dataDir);
	audit(db, null, "demo.built", "database", null, { patrons: demo.counts.patrons });
	return { patrons: demo.counts.patrons, biblios: demo.counts.biblios };
}
