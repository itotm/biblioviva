// SPDX-License-Identifier: GPL-3.0-or-later
// Labels of the special overdue groups (step 4.6) in the library's language: the teachers' group
// ("Docente" on the printed notices) and students without a class.
import { requestLocale, tServer } from "#lib/i18n/server.js";
import type { GroupLabels } from "#lib/server/services/overdues.js";

export async function overdueGroupLabels(): Promise<GroupLabels> {
	const locale = requestLocale();
	return {
		teacher: await tServer(locale, "circulation.overdues.teacherGroup"),
		noClass: await tServer(locale, "circulation.overdues.noClassGroup"),
	};
}
