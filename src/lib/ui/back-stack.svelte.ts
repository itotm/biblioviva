// SPDX-License-Identifier: GPL-3.0-or-later
// The pages the operator came through inside the app (9.13, round 1). The back button of a page
// returns to where the operator came from, as the browser's Back would, and names it; only a page
// opened directly (a bookmark, a reload, a link from outside) falls back to its parent page. This
// is the rule of Android's navigation principles: inside the app, Up and Back behave the same;
// from a deep link, Up follows a synthetic stack of parents.
// The shell feeds it from SvelteKit's navigation hooks: `leave` before a navigation with the page
// being left, `arrive` after it. The stack mirrors the browser history of this visit: a link or a
// `goto` pushes the page left, going back pops, a full load starts afresh.
import type { ResolvedPathname } from "$app/types";

export interface BackEntry {
	href: ResolvedPathname;
	title: string;
}

/** "Catalogo · BiblioViva" → "Catalogo": the page's own name, without the app's. */
export function pageName(documentTitle: string): string {
	return documentTitle.split(" · ")[0]?.trim() ?? "";
}

export class BackStack {
	#entries = $state<BackEntry[]>([]);
	#leaving: BackEntry | null = null;

	/** The page before this one in this visit, or null when the page was opened directly. */
	get previous(): BackEntry | null {
		return this.#entries.at(-1) ?? null;
	}

	leave(href: ResolvedPathname, documentTitle: string): void {
		this.#leaving = { href, title: pageName(documentTitle) };
	}

	/**
	 * `type` and `delta` are SvelteKit's: `enter` is a full load, `popstate` a move in the history
	 * (`delta` -1 for Back), `link`, `goto` and `form` add an entry.
	 */
	arrive(type: string, delta?: number): void {
		const left = this.#leaving;
		this.#leaving = null;
		if (type === "enter") {
			this.#entries = [];
			return;
		}
		if (type === "popstate" && (delta ?? -1) < 0) {
			this.#entries = this.#entries.slice(
				0,
				Math.max(0, this.#entries.length + (delta ?? -1)),
			);
			return;
		}
		if (left) {
			this.#entries = [...this.#entries, left];
		}
	}
}

export const backStack = new BackStack();
