// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from "vitest";
import { installPrompt, installsFromMenu } from "./install-prompt.svelte.js";

function offer(outcome: "accepted" | "dismissed"): Event & { prompt: () => Promise<void> } {
	const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
		prompt: vi.fn(() => Promise.resolve()),
		userChoice: Promise.resolve({ outcome }),
	});
	window.dispatchEvent(event);
	return event;
}

describe("install prompt", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("keeps the browser's offer, opens it once and forgets it after use", async () => {
		localStorage.clear();
		const stop = installPrompt.listen();
		expect(installPrompt.available).toBe(false);
		const event = offer("accepted");
		expect(event.defaultPrevented).toBe(true);
		expect(installPrompt.available).toBe(true);
		expect(await installPrompt.install()).toBe(true);
		expect(event.prompt).toHaveBeenCalledOnce();
		expect(installPrompt.available).toBe(false);
		expect(await installPrompt.install()).toBe(false);
		// installed from the browser's menu: the hint goes away
		offer("dismissed");
		window.dispatchEvent(new Event("appinstalled"));
		expect(installPrompt.available).toBe(false);
		stop();
	});

	it("remembers 'Non ora' in this browser", () => {
		const stop = installPrompt.listen();
		offer("dismissed");
		installPrompt.dismiss();
		expect(installPrompt.available).toBe(false);
		expect(localStorage.getItem("biblioviva.install-dismissed")).toBe("1");
		stop();
		const again = installPrompt.listen();
		offer("dismissed");
		expect(installPrompt.available).toBe(false);
		again();
	});

	it("explains the menu on Firefox for Android, where there is no offer event", () => {
		const fake = (userAgent: string, standalone = false): Window => {
			const events = new EventTarget();
			return Object.assign(events, {
				navigator: { userAgent },
				matchMedia: () => ({ matches: standalone }),
				localStorage: window.localStorage,
			}) as unknown as Window;
		};
		const fennec = "Mozilla/5.0 (Android 15; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0";
		const chrome = "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/141.0 Mobile";
		expect(installsFromMenu(fake(fennec))).toBe(true);
		expect(installsFromMenu(fake(fennec, true))).toBe(false);
		expect(installsFromMenu(fake(chrome))).toBe(false);
		expect(installsFromMenu(fake("Mozilla/5.0 (X11; Linux x86_64) Firefox/143.0"))).toBe(false);

		// forget the offer left by the tests above
		const reset = installPrompt.listen();
		window.dispatchEvent(new Event("appinstalled"));
		reset();

		const target = fake(fennec);
		const stop = installPrompt.listen(target);
		expect(installPrompt.available).toBe(true);
		expect(installPrompt.fromMenu).toBe(true);
		target.dispatchEvent(new Event("appinstalled"));
		expect(installPrompt.available).toBe(false);
		stop();
	});
});
