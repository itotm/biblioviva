// SPDX-License-Identifier: GPL-3.0-or-later
// Lazy loader of the vendored OpenCV.js build (`vendor/opencv.js`: the official 5.0.0 build, the
// `js/bin/opencv.js` of the GitHub release archive `opencv-5.0.0-docs.zip`, ~16.2 MB; not the file
// on docs.opencv.org/5.0, which is a pre-release snapshot; PLAN.md step 3.7, Q6, ADR-022). Imported
// as a hashed asset, so the adapter serves it precompressed (~3.3 MB brotli) with an immutable
// cache header. The file is fetched as a stream so the UI can show the progress, then evaluated
// once through a script element. Nothing here runs unless a cover-capture page asks for it.
import type * as CvTypes from "@techstark/opencv-js";
import opencvUrl from "./vendor/opencv.js?url";

export type CvModule = typeof CvTypes;

/** Hashed asset URL (`_app/immutable/assets/…`): served precompressed with an immutable cache header. */
export const OPENCV_URL: string = opencvUrl;

export interface LoadProgress {
	loaded: number;
	total: number | null;
}

interface CvGlobal {
	cv?: CvModule | Promise<CvModule> | { onRuntimeInitialized?: () => void };
}

/**
 * The Emscripten module carries a `then` method (a thenable) whose callback resolves with the
 * module itself: passing it through a promise resolution therefore loops forever. It is removed
 * once the runtime is ready so the module can be returned from async functions.
 */
function detach(cv: CvModule): CvModule {
	const thenable = cv as unknown as { then?: unknown };
	if (typeof thenable.then === "function") {
		delete thenable.then;
	}
	return cv;
}

let loading: Promise<CvModule> | null = null;

/** True when OpenCV has already been evaluated in this page. */
export function isOpenCvLoaded(): boolean {
	const g = globalThis as CvGlobal;
	return typeof g.cv === "object" && g.cv !== null && "Mat" in g.cv;
}

/** Streams the file once so the UI can show the progress; the browser cache then feeds the script tag. */
async function warmCache(
	url: string,
	onProgress?: (p: LoadProgress) => void,
	fetchImpl: typeof fetch = fetch,
): Promise<void> {
	const response = await fetchImpl(url);
	if (!response.ok || !response.body) {
		throw new Error(`opencv: ${url} answered ${response.status}`);
	}
	// with a compressed transfer the content-length is the compressed size: the total is unknown
	const header = response.headers.get("content-length");
	const total = header && !response.headers.get("content-encoding") ? Number(header) : null;
	const reader = response.body.getReader();
	let loaded = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		loaded += value.byteLength;
		onProgress?.({ loaded, total });
	}
}

const READY_POLL_MS = 30;
const READY_TIMEOUT_MS = 120_000;

/**
 * Evaluates the build through a script element pointing at the (now cached) asset URL and waits
 * for the runtime. The official build sets its own `onRuntimeInitialized` at load time (it
 * installs OpenCV's deep-copy fix of `Mat.clone`); a callback assigned afterwards would be called
 * but would replace that initializer, so readiness is polled on `cv.Mat` instead (a blob URL
 * would not initialise the runtime at all, hence the two-step download).
 */
function evaluate(url: string): Promise<CvModule> {
	return new Promise((resolve, reject) => {
		const g = globalThis as CvGlobal;
		const script = document.createElement("script");
		script.src = url;
		script.async = true;
		script.onerror = () => {
			script.remove();
			reject(new Error("opencv: script failed to load"));
		};
		script.onload = () => {
			const cv = g.cv;
			if (!cv) {
				reject(new Error("opencv: global cv missing after load"));
				return;
			}
			if (cv instanceof Promise) {
				cv.then(resolve, reject);
				return;
			}
			const started = Date.now();
			const poll = (): void => {
				if (isOpenCvLoaded()) {
					resolve(detach(g.cv as CvModule));
				} else if (Date.now() - started > READY_TIMEOUT_MS) {
					reject(new Error("opencv: runtime did not initialise"));
				} else {
					setTimeout(poll, READY_POLL_MS);
				}
			};
			poll();
		};
		document.head.appendChild(script);
	});
}

/**
 * Loads OpenCV.js once per page and returns the module; concurrent callers share the download.
 * `onProgress` receives the bytes fetched so far (and the total when the server sends it).
 */
export function loadOpenCv(
	onProgress?: (p: LoadProgress) => void,
	options: { url?: string; fetch?: typeof fetch } = {},
): Promise<CvModule> {
	if (isOpenCvLoaded()) {
		return Promise.resolve(detach((globalThis as CvGlobal).cv as CvModule));
	}
	const url = options.url ?? OPENCV_URL;
	loading ??= warmCache(url, onProgress, options.fetch)
		.then(() => evaluate(url))
		.catch((e: unknown) => {
			loading = null;
			throw e;
		});
	return loading;
}

/** Formats a byte count as MB with one decimal for the progress message. */
export function megabytes(bytes: number): string {
	return (bytes / 1_000_000).toFixed(1);
}
