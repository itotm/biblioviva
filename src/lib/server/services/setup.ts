// SPDX-License-Identifier: GPL-3.0-or-later
// First-run wizard (PLAN.md step 1.11): setup mode, the answers written as the first change of the
// configuration, the classes or the demo data, the demo data marker.
import {
	loadSchoolPresets,
	localizePreset,
	presetName,
	sortPresets,
	type SchoolPreset,
	type Translate,
} from "#lib/server/school/presets.js";
import type { SchoolYearLabel } from "#lib/shared/school-year.js";
import { DEFAULT_CHECK, DEFAULT_CODE_PRESET } from "#lib/shared/barcodes/presets.js";
import {
	layoutForLocale,
	wizardCodeFormats,
	wizardReadingLevels,
	type CodeChoice,
	type StageChoice,
	type WizardPreset,
} from "#lib/shared/setup-school.js";
import { defaultWeekStart } from "#lib/shared/calendar-core.js";
import type { AppLocale } from "#lib/i18n/index.js";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { count } from "drizzle-orm";
import { mirrorConfigUsers } from "#lib/server/auth/config-users.js";
import { hashPassword } from "#lib/server/auth/password.js";
import { ConfigError, ensureConfigDirDefaults } from "#lib/server/config/index.js";
import {
	EXAMPLE_CONFIG_PATH,
	loadConfig,
	readJsonFile,
	validateFolderWith,
	type LoadedConfig,
} from "#lib/server/config/load.js";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { classGroup, classGroupLevel, patron } from "#lib/server/db/schema.js";
import { seedOptionsFromConfig } from "#lib/server/db/seed-config.js";
import { writeAtomic } from "#lib/server/runtime/fs.js";
import { schoolOf } from "#lib/server/school/structure.js";
import { resolvePerformance } from "#lib/shared/performance.js";
import { wizardGroups } from "#lib/shared/setup-school.js";
import { audit } from "./audit.js";
import { todayIn } from "#lib/shared/dates.js";
import { createGroups, defaultTeacherGroup } from "./class-groups.js";
import { commitConfigChange } from "./config-commit.js";
import { checkDraftFiles, draftWrites, keyDrafts } from "./config-edit.js";
import { seedDatabase, type SeedOptions, type SeedSummary } from "#lib/server/db/seed.js";
import { seedPatronPhotos } from "#lib/server/db/seed-photos.js";
import type { PhotoSettings } from "#lib/server/services/media.js";
import type { ThemeName } from "#lib/shared/theme-palette.js";

/** The wizard runs while config.json is missing or `ui.setupCompleted` is false. */
export function isSetupMode(loaded: LoadedConfig): boolean {
	return loaded.source === "example" || !loaded.config.ui.setupCompleted;
}

/** The accounts created by the wizard (username → role of the example configuration). */
export const WIZARD_ACCOUNTS = ["admin", "prestiti", "catalogo", "tessere", "report"] as const;

/** With the demo data every account gets this password, easy to type while trying the app (9.13). */
export const DEMO_PASSWORD = "biblioviva";
export type WizardAccount = (typeof WIZARD_ACCOUNTS)[number];

/** The "Scuola" step (12.8): the preset and what the operator changed in it. */
export interface SchoolChoice {
	/** A preset of `config/school-presets/` (Phase 12). */
	preset: string;
	/** The classes to make per stage (names, one per level or one hosting every level). */
	stages: StageChoice[];
	teacherGroupName: string;
	/** `{level}` and `{group}` (`{level} {group}` → `3 B`). */
	classLabel: string;
	/** Fiction shelved by reading level (Q96): the preset's levels, or one per level. */
	readingLevels: boolean;
	/** The school year: its first day (`MM-DD`) and its name (9.41), proposed by the preset. */
	schoolYearStart: string;
	schoolYearLabel: SchoolYearLabel;
}

export interface SetupInput {
	locale: AppLocale;
	theme: ThemeName;
	libraryName: string;
	school: SchoolChoice;
	/** The "Codici" step (12.8): the format pair, the check character, the scanners' keyboard. */
	codes: CodeChoice;
	/** Patron photos and book covers at all (the "Biblioteca" step, 9.38): both on by default. */
	features: { photos: boolean; covers: boolean };
	/** argon2id hashes, one per wizard account. */
	passwordHashes: Record<WizardAccount, string>;
}

export class UnknownPresetError extends Error {
	constructor(readonly id: string) {
		super(`unknown school preset: ${id}`);
		this.name = "UnknownPresetError";
	}
}

/** A preset as the wizard shows it, its name (and the generic one's words) in the installation's language. */
export function wizardPreset(preset: SchoolPreset, locale: string, t?: Translate): WizardPreset {
	const p = localizePreset(preset, t);
	return {
		id: p.id,
		name: presetName(p, locale),
		country: p.country,
		stages: p.school.stages,
		levels: p.school.levels,
		classLabel: p.school.classLabel,
		groupWord: p.school.groupWord,
		groups: p.groups,
		mixedGroups: p.mixedGroups,
		teacherGroup: p.teacherGroup,
		readingLevels: p.readingLevels,
		schoolYear: p.schoolYear ?? { start: "09-01", label: "span" },
	};
}

export function setupDefaults(
	loaded: LoadedConfig,
	t?: Translate,
	/** The wizard's language (`?lang=`): the presets' names and order. */
	locale = loaded.config.ui.locale,
): {
	locale: string;
	theme: ThemeName;
	libraryName: string;
	schoolPreset: string;
	presets: WizardPreset[];
	codes: CodeChoice;
} {
	const c = loaded.config;
	return {
		locale: c.ui.locale,
		theme: c.ui.theme,
		libraryName: loaded.source === "example" ? "" : c.library.name,
		schoolPreset: c.school.preset,
		presets: sortPresets(loadSchoolPresets(), locale).map((p) => wizardPreset(p, locale, t)),
		codes: {
			item: DEFAULT_CODE_PRESET,
			card: DEFAULT_CODE_PRESET,
			check: DEFAULT_CHECK,
			layout:
				loaded.source === "example"
					? layoutForLocale(c.ui.locale)
					: c.barcodes.keyboardLayout,
		},
	};
}

type Json = Record<string, unknown>;

/**
 * The files the wizard writes, as drafts by relative path: its answers set as keys, each in the
 * file that defines it (a `<section>.json` fragment or config.json), config.json started from the
 * existing one (setup not completed yet) or from the shipped example (its `_comment` keys kept as
 * documentation). The shipped folder layout is copied into `configDir` first.
 */
export function setupDrafts(
	configDir: string,
	input: SetupInput,
	t?: Translate,
): Record<string, Json> {
	const found = loadSchoolPresets().find((p) => p.id === input.school.preset);
	if (!found) {
		throw new UnknownPresetError(input.school.preset);
	}
	const preset = localizePreset(found, t);
	// the fragments (classification.json, labels/stocks) take part in the configuration
	ensureConfigDirDefaults(configDir);
	const loaded = existsSync(join(configDir, "config.json"))
		? loadConfig(configDir)
		: validateFolderWith(configDir, readJsonFile(EXAMPLE_CONFIG_PATH), EXAMPLE_CONFIG_PATH);
	const config = loaded.config;
	// the school section is the preset's, the operator's labels on top (keys of before removed)
	const school: Json = {
		preset: preset.id,
		...preset.school,
		classLabel: input.school.classLabel,
		teacherGroupName: input.school.teacherGroupName,
	};
	const patch: Record<string, unknown> = {};
	for (const path of loaded.origins.keys()) {
		const key = /^school\.([^._][^.]*)$/.exec(path)?.[1];
		if (key && !(key in school)) {
			patch[path] = undefined;
		}
	}
	for (const [key, value] of Object.entries(school)) {
		patch[`school.${key}`] = value;
	}
	// the code formats (12.8), keeping the legacy shapes of the folder when they stay unconfusable
	const { formats } = wizardCodeFormats(
		input.codes,
		{ item: config.barcodes.item.legacy, card: config.barcodes.patron.legacy },
		config.barcodes.plainMaxLength,
	);
	const exampleUsers = (readJsonFile(EXAMPLE_CONFIG_PATH).security as Json).users as Json[];
	const levels = wizardReadingLevels(
		wizardPreset(preset, input.locale, t),
		input.school.readingLevels,
	);
	Object.assign(patch, {
		"library.name": input.libraryName,
		"library.schoolYearStart": input.school.schoolYearStart,
		"library.schoolYearLabel": input.school.schoolYearLabel,
		"photos.enabled": input.features.photos,
		"covers.enabled": input.features.covers,
		// the week starts as the chosen language expects; changeable later in the configuration
		"library.weekStart": defaultWeekStart(input.locale),
		"barcodes.item.format": formats.item.current,
		"barcodes.item.legacy": formats.item.legacy,
		"barcodes.item.retired": undefined,
		"barcodes.patron.format": formats.card.current,
		"barcodes.patron.legacy": formats.card.legacy,
		"barcodes.patron.retired": undefined,
		"barcodes.plainMaxLength": formats.plainMaxLength,
		"barcodes.keyboardLayout": input.codes.layout,
		"ui.locale": input.locale,
		"ui.theme": input.theme,
		"ui.setupCompleted": true,
		"security.users": WIZARD_ACCOUNTS.map((username) => {
			const template = exampleUsers.find((u) => u.username === username) ?? {};
			const user: Json = {
				...template,
				username,
				passwordHash: input.passwordHashes[username],
				active: true,
			};
			delete user.password;
			return user;
		}),
		// the reading levels of the preset (step 12.6), in the classification's own file
		"classification.readingLevels": levels,
		"classification.fictionByClass": levels.length > 0,
	});
	return keyDrafts(configDir, loaded, patch);
}

/**
 * Writes the wizard's answers as the first change of the history (validated with the whole
 * folder, put back when refused); returns the configuration reloaded from it.
 */
export function writeSetupConfig(
	db: DbOrTx,
	configDir: string,
	input: SetupInput,
	t?: Translate,
): LoadedConfig {
	return commitConfigChange(db, configDir, {
		action: "config.setup",
		writes: draftWrites(setupDrafts(configDir, input, t)),
		// audited by `completeSetup` with the rest of the wizard
		audit: null,
	}).loaded;
}

/**
 * The wizard's answers written for the public demo, rebuilt at every start (9.17): the same files,
 * validated first and written atomically, without the history the demo never keeps.
 */
export function writeDemoSetupConfig(configDir: string, input: SetupInput, t?: Translate): void {
	const drafts = setupDrafts(configDir, input, t);
	const checked = checkDraftFiles(configDir, drafts);
	if (checked.config === null) {
		throw new ConfigError("the demo configuration is not valid", checked.issues);
	}
	for (const [path, doc] of Object.entries(drafts)) {
		writeAtomic(join(configDir, path), `${JSON.stringify(doc, null, "\t")}\n`);
	}
}

/** What the wizard sends: its answers, the passwords in clear (hashed here), the demo data choice. */
export interface CompleteSetupInput extends Omit<SetupInput, "passwordHashes"> {
	passwords: Record<WizardAccount, string>;
	/** Load the demo data (only into a database without patrons). */
	demo: boolean;
}

const patronCount = (db: DbOrTx): number => db.select({ n: count() }).from(patron).get()?.n ?? 0;

/**
 * Completes the first-run wizard: the passwords hashed, the configuration written and reloaded
 * (one change of the history), the accounts mirrored, then the classes chosen in the "Scuola" step
 * made by the demo data or left empty (12.8) — never in a database that already has patrons — and
 * the audit. Returns what the demo data made, or null.
 */
export async function completeSetup(
	db: Db,
	dirs: { configDir: string; dataDir: string },
	input: CompleteSetupInput,
	/** The installation's dictionary: the generic preset's words (`serverTranslator`). */
	t?: Translate,
): Promise<{ demo: SeedSummary | null }> {
	const memory = resolvePerformance(loadConfig(dirs.configDir).config.performance).argon2MemoryMb;
	const passwordHashes = {} as Record<WizardAccount, string>;
	for (const account of WIZARD_ACCOUNTS) {
		passwordHashes[account] = await hashPassword(input.passwords[account], memory);
	}
	const loaded = writeSetupConfig(
		db,
		dirs.configDir,
		{
			locale: input.locale,
			theme: input.theme,
			libraryName: input.libraryName,
			school: input.school,
			codes: input.codes,
			features: input.features,
			passwordHashes,
		},
		t,
	);
	// the reload listeners refresh i18n and reschedule backups; the accounts are mirrored here
	const config = loaded.config;
	await mirrorConfigUsers(db, config);
	const school = schoolOf(config);
	const groups = wizardGroups(school.levels, input.school.stages);
	const hasPatrons = patronCount(db) > 0;
	const demo =
		input.demo && !hasPatrons
			? await loadDemoData(db, dirs.dataDir, {
					photos: config.photos,
					seed: seedOptionsFromConfig(config, { groups }),
					timezone: config.library.timezone,
				})
			: null;
	if (!demo && !hasPatrons) {
		if (groups.length > 0) {
			createGroups(
				db,
				school,
				groups.map((g) => ({ kind: "students" as const, ...g })),
				null,
			);
		}
		defaultTeacherGroup(db, config.school.teacherGroupName);
	}
	audit(db, null, "setup.completed", "config", null, {
		path: loaded.path,
		locale: input.locale,
		theme: input.theme,
		schoolPreset: input.school.preset,
		classes: groups.length,
		codes: `${input.codes.item}+${input.codes.card}/${input.codes.check}`,
		photos: input.features.photos,
		covers: input.features.covers,
		demo: demo !== null,
	});
	return { demo: demo?.counts ?? null };
}

export const DEMO_MARKER = "demo-data.json";

export interface DemoInfo {
	loadedAt: string;
	counts: SeedSummary;
}

export function readDemoInfo(dataDir: string): DemoInfo | null {
	const path = join(dataDir, DEMO_MARKER);
	if (!existsSync(path)) {
		return null;
	}
	try {
		return JSON.parse(readFileSync(path, "utf8")) as DemoInfo;
	} catch {
		return null;
	}
}

/**
 * Seeds synthetic data (unless the database already has patrons), gives about half of the patrons
 * a demo photo stored with the configured photo settings, and writes the marker.
 */
export async function loadDemoData(
	db: Db,
	dataDir: string,
	settings: {
		photos: PhotoSettings & { enabled: boolean };
		/** What to generate: the configuration's school, classes, formats (`seedOptionsFromConfig`, 12.8). */
		seed: SeedOptions;
		/** `library.timezone`: the day the synthetic loans are dated from (UTC when left out). */
		timezone?: string;
	},
	now = new Date(),
	photosDir?: string,
): Promise<DemoInfo> {
	const existing = patronCount(db);
	let counts: SeedSummary;
	if (existing > 0) {
		counts = {
			patrons: existing,
			biblios: 0,
			items: 0,
			loans: 0,
			openLoans: 0,
			overdueLoans: 0,
		};
	} else {
		counts = seedDatabase(db, {
			...settings.seed,
			today: todayIn(settings.timezone ?? "UTC", now),
		});
		// no demo photos where photos are switched off (9.38)
		if (settings.photos.enabled) {
			await seedPatronPhotos(db, dataDir, settings.photos, photosDir);
		}
	}
	const info: DemoInfo = { loadedAt: now.toISOString(), counts };
	mkdirSync(dataDir, { recursive: true });
	writeFileSync(join(dataDir, DEMO_MARKER), `${JSON.stringify(info, null, "\t")}\n`);
	return info;
}

/** The classes of the school (and the teachers group), kept across the removal of the demo data. */
export interface SchoolClassesSnapshot {
	groups: (typeof classGroup.$inferSelect)[];
	levels: (typeof classGroupLevel.$inferSelect)[];
}

/**
 * Reads the classes and the teachers group, with their ids, before the demo database is removed:
 * they are school configuration chosen in the wizard, not demo content (9.42).
 */
export function snapshotSchoolClasses(db: DbOrTx): SchoolClassesSnapshot {
	return {
		groups: db.select().from(classGroup).orderBy(classGroup.id).all(),
		levels: db.select().from(classGroupLevel).all(),
	};
}

/** Writes the classes back, with the same ids, into the fresh database. */
export function restoreSchoolClasses(db: Db, snapshot: SchoolClassesSnapshot): void {
	db.transaction((tx) => {
		for (const group of snapshot.groups) {
			tx.insert(classGroup).values(group).run();
		}
		for (const level of snapshot.levels) {
			tx.insert(classGroupLevel).values(level).run();
		}
	});
}

/**
 * Removes the demo database and uploads. The caller must have closed the database first and
 * reopens it afterwards (migrations + config accounts). Returns what was removed.
 */
export function removeDemoData(dataDir: string, databasePath: string): string[] {
	const removed: string[] = [];
	for (const suffix of ["", "-wal", "-shm"]) {
		const p = databasePath + suffix;
		if (existsSync(p)) {
			rmSync(p, { force: true });
			removed.push(p);
		}
	}
	for (const folder of ["uploads", "imports"]) {
		const p = join(dataDir, folder);
		if (existsSync(p)) {
			rmSync(p, { recursive: true, force: true });
			removed.push(p);
		}
	}
	const marker = join(dataDir, DEMO_MARKER);
	if (existsSync(marker)) {
		rmSync(marker, { force: true });
		removed.push(marker);
	}
	return removed;
}
