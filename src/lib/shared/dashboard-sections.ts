// SPDX-License-Identifier: GPL-3.0-or-later
// The sections of the dashboard that can be switched off for the installation (`ui.dashboard`,
// step 11.15), in page order: the quick actions come first.
export const DASHBOARD_SECTIONS = [
	"quickActions",
	"tiles",
	"inventory",
	"installHint",
	"upcomingDates",
	"dueThisWeek",
	"todayActivity",
] as const;
export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];
export type DashboardSections = Readonly<Record<DashboardSection, boolean>>;

/** Every section on: the default of a new installation. */
export const ALL_SECTIONS: DashboardSections = Object.fromEntries(
	DASHBOARD_SECTIONS.map((s) => [s, true]),
) as Record<DashboardSection, boolean>;
