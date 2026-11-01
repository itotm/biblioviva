// SPDX-License-Identifier: GPL-3.0-or-later
// Toast notifications (step 3.8b, owner decision): at the bottom right on desktop, at
// the top centre on phones, where the bottom holds the navigation bar and the sticky save bars.
// Zag's toaster has one placement per store, so there are two stores, each rendered by its own
// `Toast.Group` in the root layout, and `toaster` sends every toast to the one that fits the
// viewport at the moment it is shown (the `md` breakpoint of the layout, 48rem).
import { createToaster } from "@skeletonlabs/skeleton-svelte";

type Store = ReturnType<typeof createToaster>;
type Options = Parameters<Store["create"]>[0];

/** 6 s for information; errors stay until closed (they explain what to do next). */
const DURATION = 6000;

export const desktopToaster: Store = createToaster({
	placement: "bottom-end",
	duration: DURATION,
	offsets: "1.5rem",
});
/** Three at most on a phone screen. */
const PHONE_MAX = 3;

export const phoneToaster: Store = createToaster({
	placement: "top",
	duration: DURATION,
	offsets: "0.75rem",
	max: PHONE_MAX,
});

const DESKTOP_QUERY = "(min-width: 48rem)";

/** The store for the current viewport (desktop during SSR, where no toast is ever shown). */
export function activeToaster(): Store {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
		return desktopToaster;
	}
	return window.matchMedia(DESKTOP_QUERY).matches ? desktopToaster : phoneToaster;
}

/**
 * The store that shows the next toast. A full phone stack would queue it behind the older ones,
 * so the answer to what was just done would show late: the oldest toast makes room instead,
 * an error (it stays until closed) only when every toast shown is one.
 */
function nextToaster(): Store {
	const store = activeToaster();
	if (store === phoneToaster) {
		// newest first
		const shown = phoneToaster.getVisibleToasts();
		if (shown.length >= PHONE_MAX) {
			const oldest = shown.findLast((t) => t.type !== "error") ?? shown[shown.length - 1];
			if (oldest?.id !== undefined) {
				phoneToaster.remove(oldest.id);
			}
		}
	}
	return store;
}

export const toaster = {
	success: (data: Options): void => {
		nextToaster().success(data);
	},
	info: (data: Options): void => {
		nextToaster().info(data);
	},
	warning: (data: Options): void => {
		nextToaster().warning(data);
	},
	error: (data: Options): void => {
		nextToaster().error({ duration: Infinity, ...data });
	},
	dismiss: (id?: string): void => {
		desktopToaster.dismiss(id);
		phoneToaster.dismiss(id);
	},
};
