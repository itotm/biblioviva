// SPDX-License-Identifier: GPL-3.0-or-later
// The school structure of the configuration as the shared module sees it (Phase 12, 9.41).
import type { AppConfig } from "#lib/server/config/schema.js";
import type { SchoolStructure } from "#lib/shared/school.js";

export function schoolOf(config: AppConfig): SchoolStructure {
	const s = config.school;
	return {
		stages: s.stages.map((st) => ({
			code: st.code,
			name: st.name,
			...(st.classLabel ? { classLabel: st.classLabel } : {}),
		})),
		levels: s.levels.map((l) => ({
			code: l.code,
			label: l.label,
			name: l.name,
			stage: l.stage,
			...(l.next !== undefined ? { next: l.next } : {}),
			...(l.aliases?.length ? { aliases: l.aliases } : {}),
		})),
		classLabel: s.classLabel,
		groupWord: s.groupWord,
		cardClass: s.cardClass,
		locale: config.ui.locale,
		promotion: { withinStage: s.promotionWithinStage, acrossStages: s.promotionAcrossStages },
	};
}
