// SPDX-License-Identifier: GPL-3.0-or-later
// The service worker (step 9.9): it keeps the application shell — the built chunks, the styles,
// the barcode reader's WASM, OpenCV.js and the static files — in a cache named after the build, so
// the phone flows (census, stocktaking, fast add, cover capture) start fast on the school Wi-Fi and
// the shell survives short offline moments. It never answers anything else: pages, page data,
// remote functions, exports, photos and covers always come from the server (they need the session
// and must never be stored on a device). A new build installs a new cache and drops the old one;
// the files whose name carries their content hash (`immutable`: OpenCV.js, the barcode reader's
// WASM, every chunk that did not change) are copied from the previous cache instead of being
// downloaded again, so an update only fetches what really changed (9.13, round 18: before, every
// update downloaded the whole shell, OpenCV's 10 MB included).
import { version } from "$app/env";
import { assets, immutable } from "$app/manifest";
import { self } from "$app/service-worker";

const sw = self;

const CACHE = `biblioviva-${version}`;
// paths relative to the base: made absolute once, as the fetch handler compares pathnames
const SHELL = [...immutable, ...assets.filter((a) => a.path !== "robots.txt")].map(
	(f) => new URL(f.path, sw.location.href).pathname,
);
const SHELL_SET = new Set(SHELL);
const IMMUTABLE = new Set(immutable.map((f) => new URL(f.path, sw.location.href).pathname));

/** The same file in a cache of an earlier build, when its name guarantees the same content. */
async function previous(path: string, old: readonly string[]): Promise<Response | undefined> {
	if (!IMMUTABLE.has(path)) {
		return undefined;
	}
	for (const name of old) {
		const hit = await (await caches.open(name)).match(path);
		if (hit) {
			return hit;
		}
	}
	return undefined;
}

async function fill(): Promise<void> {
	const cache = await caches.open(CACHE);
	const old = (await caches.keys()).filter((k) => k !== CACHE && k.startsWith("biblioviva-"));
	await Promise.all(
		SHELL.map(async (path) => {
			const hit = await previous(path, old);
			await (hit ? cache.put(path, hit) : cache.add(path));
		}),
	);
}

sw.addEventListener("install", (event) => {
	event.waitUntil(fill().then(() => sw.skipWaiting()));
});

sw.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
			),
	);
});

sw.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);
	if (
		event.request.method !== "GET" ||
		url.origin !== sw.location.origin ||
		!SHELL_SET.has(url.pathname)
	) {
		// not part of the shell: the browser goes to the server as if there were no worker
		return;
	}
	event.respondWith(
		caches
			.open(CACHE)
			.then((cache) => cache.match(url.pathname).then((hit) => hit ?? fetch(event.request))),
	);
});
