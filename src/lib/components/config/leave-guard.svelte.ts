// SPDX-License-Identifier: GPL-3.0-or-later
// "Uscire senza salvare?" for the configuration editors (Phase 11): while `dirty()` holds, a
// navigation inside the app is held back and `open` asks; reloading or closing the tab gets the
// browser's own question. Create it while the page component initialises.
import { beforeNavigate, goto } from "$app/navigation";
import { appHref } from "#lib/ui/href.js";

export class LeaveGuard {
	/** The confirmation is showing. */
	open = $state(false);
	#to: URL | null = null;
	#leaving = false;

	constructor(dirty: () => boolean) {
		beforeNavigate(({ cancel, to, willUnload }) => {
			if (this.#leaving || !dirty()) {
				return;
			}
			cancel();
			if (!willUnload && to) {
				this.#to = to.url;
				this.open = true;
			}
		});
	}

	/** Leaves anyway, dropping the changes. */
	async leave(): Promise<void> {
		this.#leaving = true;
		if (this.#to) {
			await goto(appHref(this.#to));
		}
	}

	stay(): void {
		this.#to = null;
	}
}
