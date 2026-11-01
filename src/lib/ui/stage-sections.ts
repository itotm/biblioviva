// SPDX-License-Identifier: GPL-3.0-or-later
// The classes of a school of several stages, stage by stage (12.9): the census and Stampe show
// them so. One stage (or none) is one untitled section; the classes of no known stage come last.

export interface StageSection<G> {
	key: string;
	/** Empty for the single section of a school of one stage. */
	title: string;
	groups: G[];
}

export function stageSections<G extends { stage: string | null }>(
	groups: readonly G[],
	stages: readonly { code: string; name: string }[],
	othersTitle: string,
): StageSection<G>[] {
	if (stages.length < 2) {
		return groups.length > 0 ? [{ key: "all", title: "", groups: [...groups] }] : [];
	}
	const known = new Set(stages.map((st) => st.code));
	return [
		...stages.map((st) => ({
			key: st.code,
			title: st.name,
			groups: groups.filter((g) => g.stage === st.code),
		})),
		{
			key: "others",
			title: othersTitle,
			groups: groups.filter((g) => g.stage === null || !known.has(g.stage)),
		},
	].filter((section) => section.groups.length > 0);
}
