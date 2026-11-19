// SPDX-License-Identifier: GPL-3.0-or-later
// The checklist of an installation (step 8.7, `/admin/setup`): what the server finds out about
// itself, as data the page writes in words. Every item has findings, each with its own state; the
// item takes the worst of them, so one line can be amber while another of the same item is green.

export const CHECK_STATES = ["ok", "warning", "error"] as const;
/** A green, an amber or a red check. */
export type CheckState = (typeof CHECK_STATES)[number];

export const CHECK_IDS = ["config", "address", "profile", "accounts", "backup"] as const;
export type CheckId = (typeof CHECK_IDS)[number];

/**
 * One thing found: `key` names its text (`admin.checklist.findings.<item>.<key>`), `params` fill it
 * (a key ending in `At` holds an instant the page writes as date and time), `lines` are verbatim
 * details (the loader's own messages).
 */
export interface CheckFinding {
	state: CheckState;
	key: string;
	params?: Record<string, string | number>;
	lines?: string[];
}

export interface CheckItem {
	id: CheckId;
	state: CheckState;
	findings: CheckFinding[];
}

/**
 * Every finding that is not green, as `<item>.<key>`: the page links the guide of each one (the table
 * `CHECKLIST_HELP` of `#lib/ui/help-checklist.ts`), and the service tests check this list against what the
 * service really reports.
 */
export const PROBLEM_FINDINGS = [
	"config.invalid",
	"config.example",
	"config.warnings",
	"address.lan",
	"address.plainHttp",
	"profile.weaker",
	"accounts.example",
	"accounts.plain",
	"backup.folder",
	"backup.scheduleInvalid",
	"backup.notScheduled",
	"backup.none",
	"backup.late",
	"backup.stale",
	"backup.offsiteNone",
	"backup.offsiteError",
	"backup.offsiteStale",
] as const;

/** The whole checklist of one request. */
export interface InstallCheck {
	/** The worst state of the items: green only when every item is. */
	state: CheckState;
	items: CheckItem[];
	/** The camera can start here: a secure page (HTTPS) or this computer itself. */
	cameraAvailable: boolean;
	/** The address is plain HTTP on the local network (the basic mode of step 8.8). */
	lanMode: boolean;
}

const RANK: Record<CheckState, number> = { ok: 0, warning: 1, error: 2 };

/** The worst of some states (`ok` for none). */
export function worstState(states: readonly CheckState[]): CheckState {
	return states.reduce<CheckState>((a, b) => (RANK[b] > RANK[a] ? b : a), "ok");
}
