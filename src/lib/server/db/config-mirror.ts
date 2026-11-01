// SPDX-License-Identifier: GPL-3.0-or-later
// Lists of the configuration that SQL needs to see (Phase 12): the reading levels and the levels of
// the school in their order, and the class label template, mirrored into small tables at startup
// and on every reload of the configuration, so the reports (plain SQL on a read-only connection)
// and the view `patron_class` can order and label them. The configuration stays the source of
// truth; the tables are rewritten as a whole.
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Db } from "./client.js";
import { readingLevel, schoolLevel, schoolSetting } from "./schema.js";
import { nextLevel, templateOf } from "#lib/shared/school.js";
import { schoolOf } from "#lib/server/school/structure.js";

export function mirrorConfigTables(db: Db, config: AppConfig): void {
	db.transaction((tx) => {
		tx.delete(readingLevel).run();
		config.classification.readingLevels.forEach((l, position) => {
			tx.insert(readingLevel).values({ code: l.code, position, label: l.label }).run();
		});
		const school = schoolOf(config);
		tx.delete(schoolLevel).run();
		school.levels.forEach((l, position) => {
			tx.insert(schoolLevel)
				.values({
					code: l.code,
					position,
					label: l.label,
					name: l.name,
					stage: l.stage,
					nextCode: nextLevel(school, l.code),
					classLabel: templateOf(school, l.code),
				})
				.run();
		});
		tx.delete(schoolSetting).run();
		tx.insert(schoolSetting).values({ key: "class_label", value: school.classLabel }).run();
		// how the school year is named (9.41): reports show `2026` instead of `2026/2027`
		tx.insert(schoolSetting)
			.values({ key: "school_year_label", value: config.library.schoolYearLabel })
			.run();
	});
}
