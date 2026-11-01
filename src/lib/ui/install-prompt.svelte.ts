// SPDX-License-Identifier: GPL-3.0-or-later
// "Aggiungi alla schermata Home" (step 9.9): Chromium offers the installation of the app with the
// `beforeinstallprompt` event, fired once when the page loads; the root layout listens from the
// start and the dashboard shows the hint on phones while the offer stands. Firefox for Android
// (Fennec too) has no such event: it installs from its own menu, so there the hint explains where
// (9.13, round 9). "Non ora" is remembered in this browser only.

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "biblioviva.install-dismissed";

/** Firefox on Android, not already opened from the Home screen icon. */
export function installsFromMenu(target: Window): boolean {
	const ua = target.navigator.userAgent;
	const standalone = target.matchMedia?.("(display-mode: standalone)").matches ?? false;
	return /Android/i.test(ua) && ua.includes("Firefox/") && !standalone;
}

class InstallPrompt {
	#event = $state<BeforeInstallPromptEvent | null>(null);
	#dismissed = $state(false);
	#fromMenu = $state(false);

	/** True while the browser offers the installation and the operator has not declined it. */
	get available(): boolean {
		return (this.#event !== null || this.#fromMenu) && !this.#dismissed;
	}

	/** The browser installs from its own menu only: the hint explains instead of a button. */
	get fromMenu(): boolean {
		return this.#fromMenu && this.#event === null;
	}

	/** Starts listening; returns the function that stops. */
	listen(target: Window = window): () => void {
		try {
			this.#dismissed = target.localStorage.getItem(DISMISSED_KEY) === "1";
		} catch {
			// storage blocked: the hint simply comes back next time
		}
		const offer = (e: Event): void => {
			// the browser's own mini bar is replaced by the hint on the dashboard
			e.preventDefault();
			this.#event = e as BeforeInstallPromptEvent;
		};
		this.#fromMenu = installsFromMenu(target);
		const installed = (): void => {
			this.#event = null;
			this.#fromMenu = false;
		};
		target.addEventListener("beforeinstallprompt", offer);
		target.addEventListener("appinstalled", installed);
		return () => {
			target.removeEventListener("beforeinstallprompt", offer);
			target.removeEventListener("appinstalled", installed);
		};
	}

	/** Opens the browser's installation dialog; the offer can be used once. */
	async install(): Promise<boolean> {
		const event = this.#event;
		if (!event) {
			return false;
		}
		this.#event = null;
		await event.prompt();
		return (await event.userChoice).outcome === "accepted";
	}

	dismiss(target: Window = window): void {
		this.#dismissed = true;
		try {
			target.localStorage.setItem(DISMISSED_KEY, "1");
		} catch {
			// not remembered: nothing else to do
		}
	}
}

export const installPrompt = new InstallPrompt();
export type { InstallPrompt };
