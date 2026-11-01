// SPDX-License-Identifier: GPL-3.0-or-later
// What report parameters are checked against (step 6.1): today and the school year in the
// library's zone, the levels and stages of the school and the item types of the configuration.
import { tServer } from "#lib/i18n/server.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import { catalogRules } from "#lib/server/services/catalog.js";
import type { Decorations } from "./decorate.js";
import { schoolYearStartDate } from "#lib/shared/school-year.js";
import type { ReportContext } from "./run.js";

export function reportContext(config: AppConfig, now = new Date()): ReportContext {
	const today = libraryToday(config, now);
	return {
		today,
		schoolYearStart: schoolYearStartDate(today, config.library.schoolYearStart),
		levels: config.school.levels.map((l) => l.code),
		stages: config.school.stages.map((s) => s.code),
		itemTypes: config.library.itemTypes.map((t) => t.code),
		classificationCodes: [
			...config.classification.genres.map((g) => g.code),
			...config.classification.nonfiction.flatMap((n) => [
				n.code,
				...(n.children ?? []).map((c) => c.code),
			]),
		],
	};
}

const STATUS_KEYS: Record<string, string> = {
	available: "available",
	lost: "lost",
	damaged: "damaged",
	in_repair: "inRepair",
	withdrawn: "withdrawn",
};

/** The labels coded report columns are shown with, in the installation's language. */
export async function reportDecorations(config: AppConfig, locale: string): Promise<Decorations> {
	const t = (key: string): Promise<string> => tServer(locale, key);
	const itemStatuses: Record<string, string> = {};
	for (const [status, key] of Object.entries(STATUS_KEYS)) {
		itemStatuses[status] = await t(`common.statuses.item.${key}`);
	}
	return {
		locale,
		scheme: catalogRules(config).scheme,
		itemTypes: Object.fromEntries(config.library.itemTypes.map((i) => [i.code, i.label])),
		patronTypes: {
			student: await t("patrons.types.student"),
			teacher: await t("patrons.types.teacher"),
		},
		itemStatuses,
		levels: Object.fromEntries(config.school.levels.map((l) => [l.code, l.label])),
		stages: Object.fromEntries(config.school.stages.map((st) => [st.code, st.name])),
		kinds: {
			fiction: await t("catalog.kinds.fiction"),
			nonfiction: await t("catalog.kinds.nonfiction"),
		},
		teachers: await t("reports.special.teachers"),
		unclassified: await t("catalog.toClassify.label"),
		total: await t("reports.special.total"),
		yes: await t("common.words.yes"),
		no: await t("common.words.no"),
	};
}
