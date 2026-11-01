// SPDX-License-Identifier: GPL-3.0-or-later
// The school (Phase 12, Q94–Q102): its structure in the configuration (stages and levels, edited
// on the "Scuola" settings page, a preset as a starting point) and its classes in the database
// (Configurazione → Classi). Permission `admin` (Q99): whoever manages patrons only picks a class.
import { command, query } from "$app/server";
import * as v from "valibot";
import { configCode, dbId, levelCode } from "#lib/shared/input-schemas.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { refusal, refusedWithCode, refusing } from "#lib/server/http/errors.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { serverContext } from "#lib/server/context.js";
import { nextLevelSchema } from "#lib/server/config/schema.js";
import {
	loadSchoolPresets,
	localizePreset,
	presetName,
	sortPresets,
} from "#lib/server/school/presets.js";
import { serverTranslator } from "#lib/i18n/server.js";
import { schoolOf } from "#lib/server/school/structure.js";
import {
	archiveGroup,
	createGroups,
	GroupError,
	listGroups,
	restoreGroup,
	updateGroup,
} from "#lib/server/services/class-groups.js";
import {
	configRefused,
	failureOf,
	failureWith,
	type ConfigFailure,
} from "#lib/server/services/config-commit.js";
import {
	SchoolNotReadyError,
	saveSchoolStructure as saveSchoolStructureService,
	type SchoolPlan,
} from "#lib/server/services/school-structure.js";
import { groupLabel } from "#lib/shared/school.js";
import { getConfigHistory, getConfigOverview, getConfigSection } from "./config.remote.js";

const name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120));
const shortLabel = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(20));
const template = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40));

// --- Structure (configuration) -----------------------------------------------------------------

export const getSchoolStructure = query(async () => {
	requireUser("admin");
	const config = getConfig();
	const t = await serverTranslator(config.ui.locale);
	const school = config.school;
	return {
		preset: school.preset,
		stages: school.stages,
		levels: school.levels,
		classLabel: school.classLabel,
		presets: sortPresets(loadSchoolPresets(), config.ui.locale).map((found) => {
			const p = localizePreset(found, t);
			return {
				id: p.id,
				name: presetName(p, config.ui.locale),
				country: p.country,
				stages: p.school.stages,
				levels: p.school.levels,
			};
		}),
		/** Levels in use (pupils or classes): the editor marks them, the save refuses to drop them. */
		used: [
			...new Set(
				listGroups(getDb(), schoolOf(config), { archived: false }).flatMap((g) => g.levels),
			),
		],
	};
});

/** A refused save; `plan`: removed years still in use without a replacement, where they go. */
type StructureFailure = ConfigFailure<{ plan: SchoolPlan | null }>;

export const saveSchoolStructure = command(
	v.object({
		preset: v.pipe(v.string(), v.maxLength(40)),
		stages: v.pipe(
			v.array(v.object({ code: configCode, name, classLabel: v.optional(template) })),
			v.minLength(1),
			v.maxLength(10),
		),
		levels: v.pipe(
			v.array(
				v.object({
					code: levelCode,
					label: shortLabel,
					name,
					stage: configCode,
					next: v.optional(nextLevelSchema),
					aliases: v.optional(
						v.pipe(
							v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40))),
							v.maxLength(10),
						),
					),
				}),
			),
			v.minLength(1),
			v.maxLength(40),
		),
		/** Removed year → the year its pupils and classes move to (12.9). */
		moves: v.optional(v.record(levelCode, levelCode), {}),
	}),
	(input): ({ ok: true } & { pupils: number; classes: number }) | StructureFailure => {
		const user = requireUser("admin");
		const { moves, ...draft } = input;
		return refusing(() => {
			const moved = saveSchoolStructureService(serverContext(), draft, moves, user);
			void getSchoolStructure().refresh();
			void getClassGroups().refresh();
			void getConfigSection("school").refresh();
			void getConfigOverview().refresh();
			void getConfigHistory().refresh();
			return { ok: true as const, pupils: moved.pupils, classes: moved.classes };
		}, [
			refusal(SchoolNotReadyError, (e) => failureWith({ plan: e.plan })),
			refusal(configRefused(), (e) => failureOf(e, { plan: null })),
		]);
	},
);

// --- Classes (database) ------------------------------------------------------------------------

export const getClassGroups = query(() => {
	requireUser("admin");
	const config = getConfig();
	const school = schoolOf(config);
	return {
		groups: listGroups(getDb(), school, { archived: true }).map((g) => ({
			...g,
			label: groupLabel(school, g),
		})),
		levels: school.levels.map((l) => ({
			code: l.code,
			label: l.label,
			name: l.name,
			stage: l.stage,
		})),
		stages: school.stages,
		classLabel: school.classLabel,
		groupWord: school.groupWord,
		teacherGroupName: config.school.teacherGroupName,
	};
});

const groupInput = v.object({
	kind: v.picklist(["students", "teachers"]),
	name: v.pipe(v.string(), v.maxLength(60)),
	levels: v.pipe(v.array(levelCode), v.maxLength(40)),
	stage: v.optional(v.nullable(configCode)),
	notes: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(500)))),
});

type GroupResult<T> = ({ ok: true } & T) | { ok: false; code: GroupError["code"] };

function run<T extends object>(fn: () => T): GroupResult<T> {
	return refusing(
		() => {
			const out = fn();
			void getClassGroups().refresh();
			return { ok: true as const, ...out };
		},
		GroupError,
		refusedWithCode,
	);
}

/** One class or many at once ("da 1 A a 5 D"): all or none. */
export const createClassGroups = command(
	v.object({ groups: v.pipe(v.array(groupInput), v.minLength(1), v.maxLength(200)) }),
	({ groups }) => {
		const user = requireUser("admin");
		const school = schoolOf(getConfig());
		return run(() => ({ ids: createGroups(getDb(), school, groups, user) }));
	},
);

export const updateClassGroup = command(
	v.object({ id: dbId, group: groupInput }),
	({ id, group }) => {
		const user = requireUser("admin");
		const school = schoolOf(getConfig());
		return run(() => {
			updateGroup(getDb(), school, id, group, user);
			return {};
		});
	},
);

export const archiveClassGroup = command(dbId, (id) => {
	const user = requireUser("admin");
	return run(() => {
		archiveGroup(getDb(), id, user);
		return {};
	});
});

export const restoreClassGroup = command(dbId, (id) => {
	const user = requireUser("admin");
	const school = schoolOf(getConfig());
	return run(() => {
		restoreGroup(getDb(), school, id, user);
		return {};
	});
});
