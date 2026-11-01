// SPDX-License-Identifier: GPL-3.0-or-later
// The draft of a block of a settings page (Phase 11): the values as the block holds them, compared
// with what was loaded or last saved (a JSON snapshot) to tell whether anything changed, the
// "saving" state of its Save button and the server's whole answer when it refused the save.
// Nothing leaves the page until "Salva"; "Annulla modifiche" loads the saved values again.
import { issueLines, joinIssues, type IssueText } from "#lib/shared/config-issues.js";
import { toaster } from "#lib/ui/toaster.js";

/** What a refused change would take away while in use (`ReferenceProblem` of the server). */
export interface InUseProblem {
	kind: "classification" | "itemType" | "level" | "readingLevel";
	code: string;
	count: number;
}

/** A refused save as the server answers it (`ConfigFailure`), with the extras of its flow. */
export interface DraftRefusal {
	ok: false;
	issues: readonly IssueText[];
	inUse?: readonly InUseProblem[];
}

/** What a save command answers. */
export type DraftSaveResult = { ok: true } | DraftRefusal;

/**
 * A refused save as the block shows it: the problems as lines, what is in use, and the rest of
 * the answer (a plan, the code of a refusal).
 */
export type DraftFailure<F extends DraftRefusal = DraftRefusal> = Omit<
	F,
	"ok" | "issues" | "inUse"
> & {
	issues: string[];
	inUse: InUseProblem[];
};

/** The toast of a save that went through: a title, or made from the answer. */
type SavedToast<R> = string | ((result: R) => { title: string; description?: string });

export class DraftEditor<T, F extends DraftRefusal = DraftRefusal> {
	/** A save is running: the buttons wait. */
	saving = $state(false);
	/** What the server answered when it refused the last save, or null. */
	failure = $state<DraftFailure<F> | null>(null);
	/** The problems of the refusal as one line (`path: message; …`), or null when it has none. */
	readonly problem: string | null;
	/** Something differs from what was loaded or saved (never before the first load). */
	readonly dirty: boolean;
	#saved = $state("");
	readonly #draft: () => T;

	/** `draft` reads the value the block would save. */
	constructor(draft: () => T) {
		this.#draft = draft;
		this.dirty = $derived(this.#saved !== "" && JSON.stringify(this.#draft()) !== this.#saved);
		this.problem = $derived(
			this.failure && this.failure.issues.length > 0 ? joinIssues(this.failure.issues) : null,
		);
	}

	/** The draft as it is now is what the configuration holds (after a load or a save). */
	mark(): void {
		this.#saved = JSON.stringify(this.#draft());
	}

	/** Loads the block once its data arrives (`ready`). Call it while the component initialises. */
	loadWhenReady(ready: () => boolean, load: () => void): void {
		let loaded = false;
		$effect(() => {
			if (ready() && !loaded) {
				loaded = true;
				load();
			}
		});
	}

	/** Keeps a refusal, the server's or one the block finds before sending (a plan's errors). */
	fail(refusal: F): void {
		const { ok: _ok, issues, inUse, ...rest } = refusal;
		this.failure = {
			...rest,
			issues: issueLines(issues),
			inUse: [...(inUse ?? [])],
		};
	}

	/**
	 * Runs a save: on success the draft becomes the saved state, the toast `saved` is shown and
	 * `after` runs; otherwise the refusal is kept in `failure`.
	 */
	async save<R extends { ok: true } | F>(
		send: () => Promise<R>,
		saved: SavedToast<Extract<R, { ok: true }>>,
		after?: (result: Extract<R, { ok: true }>) => unknown,
	): Promise<void> {
		this.saving = true;
		this.failure = null;
		try {
			const result = await send();
			if (result.ok) {
				const done = result as Extract<R, { ok: true }>;
				this.mark();
				toaster.success(typeof saved === "string" ? { title: saved } : saved(done));
				await after?.(done);
			} else {
				this.fail(result as F);
			}
		} finally {
			this.saving = false;
		}
	}
}
