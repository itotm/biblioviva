// SPDX-License-Identifier: GPL-3.0-or-later
// The one way a service changes the configuration folder (PLAN.md Phase 11): the files written as
// one change of the history (`applyConfigChange`: atomic, whole folder validated, configuration
// reloaded), and inside it, in one database transaction, the data that moves with the change, the
// guards — nothing in use by the catalogue or the patrons taken away, no template named that does
// not exist — and the audit row. A guard that refuses rolls the transaction back and puts the
// files back: the change leaves no trace.
import { ConfigError, loadConfig, type LoadedConfig } from "#lib/server/config/load.js";
import type { ConfigIssue } from "#lib/server/config/validate.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { issueLines } from "#lib/shared/config-issues.js";
import { audit, type AuditActor } from "./audit.js";
import { applyConfigChange, type ConfigChange, type FileWrite } from "./config-edit.js";
import { ConfigInUseError, referenceProblems, type ReferenceProblem } from "./config-references.js";
import { templateGuard } from "./template-refs.js";

type Json = Record<string, unknown>;

export interface ConfigCommit {
	/** The change's name in the history, and the audit action unless `audit.action` says otherwise. */
	action: string;
	writes: readonly FileWrite[];
	/**
	 * Database changes that go with the files, run first in the transaction of the guards (which
	 * then see them); the object it returns, if any, is added to the audit details.
	 */
	move?: (tx: DbOrTx, after: LoadedConfig) => unknown;
	/** The audit row (`change` is added); null when the caller audits the whole operation itself. */
	audit: {
		actor: AuditActor | null;
		details?: Json;
		action?: string;
		entity?: string;
	} | null;
	/** The error thrown when the change takes away something in use (`ConfigInUseError` by default). */
	inUse?: (problems: ReferenceProblem[]) => Error;
	now?: Date;
}

/** Writes a configuration change with every guard; returns the change and the reloaded configuration. */
export function commitConfigChange(
	db: DbOrTx,
	configDir: string,
	commit: ConfigCommit,
): { change: ConfigChange; loaded: LoadedConfig } {
	const now = commit.now ?? new Date();
	const before = loadConfig(configDir).config;
	const templates = templateGuard(configDir, before);
	return applyConfigChange(configDir, commit.action, commit.writes, now, (after, id) => {
		db.transaction((tx) => {
			const result = commit.move?.(tx, after);
			const moved = typeof result === "object" && result !== null ? result : {};
			const problems = referenceProblems(tx, before, after.config);
			if (problems.length > 0) {
				throw commit.inUse?.(problems) ?? new ConfigInUseError(problems);
			}
			templates(after);
			if (commit.audit) {
				audit(
					tx,
					commit.audit.actor,
					commit.audit.action ?? commit.action,
					commit.audit.entity ?? "config",
					null,
					{ change: id, ...commit.audit.details, ...moved },
					now,
				);
			}
		});
	});
}

/**
 * Why a configuration change did not happen, the one answer of every page that changes the
 * configuration: the errors of the folder it would leave (never its warnings), what it would take
 * away while in use, and what the flow adds (`X`: the plan of a change that needs answers, the
 * check of an archive, the code of a refusal).
 */
export type ConfigFailure<X extends object = object> = X & {
	ok: false;
	issues: ConfigIssue[];
	inUse: ReferenceProblem[];
};

/**
 * The errors of a refused change, those `failureOf` answers (`refusal(configRefused(), …)`): a
 * function, since config-references and this module import each other through the taxonomy.
 */
export const configRefused = (): readonly [typeof ConfigError, typeof ConfigInUseError] => [
	ConfigError,
	ConfigInUseError,
];

const errorsOf = (issues: readonly ConfigIssue[]): ConfigIssue[] =>
	issues.filter((i) => i.level === "error");

/** A refusal of the flow itself (a plan that needs answers, …): its extras and its errors. */
export function failureWith<X extends object>(
	extra: X,
	issues: readonly ConfigIssue[] = [],
): ConfigFailure<X> {
	return { ...extra, ok: false, issues: errorsOf(issues), inUse: [] };
}

/**
 * The answer to a refused change — the folder would be invalid (`ConfigError`) or would take
 * away something in use (`ConfigInUseError`) —, with the flow's extras; any other error is
 * thrown again.
 */
export function failureOf<X extends object = object>(e: unknown, extra?: X): ConfigFailure<X> {
	const more = extra ?? ({} as X);
	if (e instanceof ConfigError) {
		return failureWith(more, e.issues);
	}
	if (e instanceof ConfigInUseError) {
		return { ...failureWith(more), inUse: e.problems };
	}
	throw e;
}

/** A refused change as lines of text: the errors, then what is still in use. */
export function failureLines(failure: ConfigFailure): string[] {
	return [
		...issueLines(failure.issues),
		...failure.inUse.map((p) => `${p.kind} ${p.code} (${p.count})`),
	];
}
