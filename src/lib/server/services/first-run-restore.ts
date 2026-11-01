// SPDX-License-Identifier: GPL-3.0-or-later
// Restore from the first-run wizard (PLAN.md step 9.43): instead of answering the wizard, the
// operator uploads an archive of "Esporta tutto" and the installation becomes that library — the
// configuration (with its accounts), the data and the pictures — in one go. It is the restore of
// Amministrazione → Backup (`full-restore.ts`, every part of the archive) behind two more
// guards: only while the setup mode holds (no configuration completed yet), and an archive that
// can carry a whole library (the settings of the library, its accounts and the interface, and the
// patrons and the catalogue), from the same or an older version. Checked first like every import
// (§3.22): the archive is staged and checked, the operator sees what it holds, and only then is it
// applied.
import { loadConfig } from "#lib/server/config/load.js";
import { ensureConfigDirDefaults } from "#lib/server/config/index.js";
import { mirrorConfigUsers } from "#lib/server/auth/config-users.js";
import { stagedDir } from "#lib/server/archive/staging.js";
import type { ServerContext } from "#lib/server/context.js";
import { ServiceError } from "#lib/server/errors.js";
import type { PartId } from "#lib/shared/archive-parts.js";
import { APP_VERSION } from "#lib/shared/version.js";
import { join } from "node:path";
import {
	applyRestore,
	checkRestore,
	discardRestore,
	stageUploadedRestore,
	type RestoreCheck,
} from "./full-restore.js";
import { isSetupMode } from "./setup.js";

type FirstRunContext = Pick<ServerContext, "db" | "configDir" | "dataDir">;

/** The parts an archive must hold to be a whole library: the settings that carry the accounts, and the data. */
export const FIRST_RUN_REQUIRED_PARTS: readonly PartId[] = [
	"section:ui",
	"section:security",
	"section:library",
	"data:patrons",
	"data:catalog",
];

export type FirstRunRestoreProblem =
	/** A configuration already exists: the restore is the one of Amministrazione → Backup. */
	| "not_setup"
	/** The archive was written by a newer BiblioViva. */
	| "newer_version"
	/** The archive lacks parts of a whole library (`detail`: the part ids, comma-separated). */
	| "missing_parts"
	/** The archive's configuration is one whose first-run wizard was never completed. */
	| "unfinished_setup"
	/** The check found problems (`detail`: the first one). */
	| "not_ready";

/** An archive refused for the first-run restore (an unreadable one is an `ArchiveReadError`). */
export class FirstRunRestoreError extends ServiceError<FirstRunRestoreProblem> {
	constructor(
		code: FirstRunRestoreProblem,
		readonly detail = "",
	) {
		super(code, `first-run restore: ${code}${detail ? ` (${detail})` : ""}`);
		this.name = "FirstRunRestoreError";
	}
}

/** What the operator sees before the restore: where the archive comes from and what it holds. */
export interface FirstRunCheck {
	token: string;
	source: { createdAt: string | null; version: string | null; library: string | null };
	/** Rows of each data part in the archive. */
	counts: Record<string, number>;
	photos: number;
	covers: number;
	/** The active accounts of the archive's configuration: the ones that can log in afterwards. */
	accounts: string[];
}

/** The numbers of a `major.minor.patch` version, or null for any other text. */
function versionNumbers(version: string): [number, number, number] | null {
	const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** The archive was written by a version newer than this one (an unreadable version is not newer). */
export function isNewerVersion(archive: string | null, current = APP_VERSION): boolean {
	const a = archive ? versionNumbers(archive) : null;
	const c = versionNumbers(current);
	if (!a || !c) {
		return false;
	}
	for (let i = 0; i < 3; i++) {
		if ((a[i] ?? 0) !== (c[i] ?? 0)) {
			return (a[i] ?? 0) > (c[i] ?? 0);
		}
	}
	return false;
}

/** The restore at first run is for an installation whose wizard has not been completed. */
function assertSetupMode(configDir: string): void {
	if (!isSetupMode(loadConfig(configDir))) {
		throw new FirstRunRestoreError("not_setup");
	}
}

/** The first problem of a check that is not ready, in one line for the message. */
function firstProblem(check: RestoreCheck): string {
	const issue = check.config?.issues.find((i) => i.level === "error");
	if (issue) {
		return `${issue.file ? `${issue.file} · ` : ""}${issue.path}: ${issue.message}`;
	}
	const gap = check.data.gaps[0];
	if (gap) {
		return `${gap.rows} ${gap.part} → ${gap.needs}`;
	}
	if (check.data.schema.length > 0) {
		return check.data.schema.join(", ");
	}
	const inUse = check.config?.inUse[0];
	return inUse ? `${inUse.kind} ${inUse.code}` : "";
}

/** Checks a staged archive for the first-run restore; returns the check and what the operator sees. */
async function verify(
	ctx: FirstRunContext,
	token: string,
): Promise<{ check: RestoreCheck; view: FirstRunCheck }> {
	const check = await checkRestore(ctx, token);
	if (isNewerVersion(check.source.version)) {
		throw new FirstRunRestoreError("newer_version", check.source.version ?? "");
	}
	const missing = FIRST_RUN_REQUIRED_PARTS.filter((p) => !check.available.includes(p));
	if (missing.length > 0) {
		throw new FirstRunRestoreError("missing_parts", missing.join(", "));
	}
	if (!check.ready) {
		throw new FirstRunRestoreError("not_ready", firstProblem(check));
	}
	// the configuration the restore would leave, written aside by the check
	const candidate = join(stagedDir(ctx.dataDir, "restore", token) ?? "", "candidate");
	const { config } = loadConfig(candidate);
	if (!config.ui.setupCompleted) {
		throw new FirstRunRestoreError("unfinished_setup");
	}
	return {
		check,
		view: {
			token,
			source: {
				createdAt: check.source.createdAt,
				version: check.source.version,
				library: check.source.library,
			},
			counts: Object.fromEntries(
				Object.entries(check.data.counts).map(([part, n]) => [part, n?.archive ?? 0]),
			),
			photos: check.data.photos,
			covers: check.data.covers,
			accounts: config.security.users.filter((u) => u.active).map((u) => u.username),
		},
	};
}

/**
 * First half: an archive uploaded from the wizard (at most `MAX_UPLOAD_BYTES`) staged and checked;
 * nothing is written to the library. Throws `FirstRunRestoreError` when the wizard was completed
 * or the archive cannot be a whole library, `ArchiveReadError` when the file is not a safe
 * BiblioViva archive; whatever was staged is dropped on a refusal.
 */
export async function checkFirstRunRestore(
	ctx: FirstRunContext,
	bytes: Uint8Array,
): Promise<FirstRunCheck> {
	assertSetupMode(ctx.configDir);
	// the shipped layout of the folder (classification, stocks…) the archive's parts are laid over
	ensureConfigDirDefaults(ctx.configDir);
	const token = await stageUploadedRestore(ctx.dataDir, bytes, "archivio.zip");
	try {
		return (await verify(ctx, token)).view;
	} catch (e) {
		discardRestore(ctx.dataDir, token);
		throw e;
	}
}

/**
 * Second half: the checked archive restored whole — the data and the pictures replaced, the
 * configuration written as one change, the accounts of the archive mirrored so that they can log
 * in. Returns their names. The configuration now holds `ui.setupCompleted`: the wizard is closed.
 */
export async function applyFirstRunRestore(
	ctx: FirstRunContext,
	token: string,
	now = new Date(),
): Promise<{ accounts: string[] }> {
	assertSetupMode(ctx.configDir);
	const { check, view } = await verify(ctx, token);
	await applyRestore(ctx, token, check.selected, null, now);
	await mirrorConfigUsers(ctx.db, loadConfig(ctx.configDir).config);
	return { accounts: view.accounts };
}

/** Drops a staged archive the operator did not restore. */
export function discardFirstRunRestore(dataDir: string, token: string): void {
	discardRestore(dataDir, token);
}
