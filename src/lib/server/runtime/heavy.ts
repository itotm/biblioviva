// SPDX-License-Identifier: GPL-3.0-or-later
// The heavy requests (step 9.32): print sheets and exports wait their turn for a slot of
// `heavyWork` (`performance.heavyConcurrency`), taken by the server hook for every request of
// `HEAVY_REQUEST`, so no route has to remember it. The slot is held until the answer has been sent
// — a streamed archive or a large sheet keeps its memory until its last byte — and given back when
// the body ends, fails or is cancelled (the browser went away), or at once when there is no body.
import { heavyWork, type Limiter } from "./limit.js";

/**
 * The downloads that read much of the database or the uploads: exports (`/export/<table>`, the
 * administrator's exports, the archives) and print sheets (`/print/…`). The data of the exports
 * page is not one.
 */
export const HEAVY_REQUEST =
	/^\/(export|print)\/|^\/admin\/(exports\/(?!__data\.json$)|backups\/export$|config\/export$)/;

export function isHeavyRequest(pathname: string): boolean {
	return HEAVY_REQUEST.test(pathname);
}

/** `body` read through, calling `release` once when it ends, fails or is cancelled. */
export function releasedWhenRead(
	body: ReadableStream<Uint8Array>,
	release: () => void,
): ReadableStream<Uint8Array> {
	const reader = body.getReader();
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					release();
					controller.close();
				} else {
					controller.enqueue(value);
				}
			} catch (e) {
				release();
				controller.error(e);
			}
		},
		async cancel(reason) {
			release();
			await reader.cancel(reason);
		},
	});
}

/**
 * Answers `job` in a slot of `limiter` (`heavyWork`): a thrown error or redirect gives the slot
 * back at once, an answer with a body holds it until the body has been read (a HEAD request sends
 * none).
 */
export async function heavyResponse(
	method: string,
	job: () => Response | Promise<Response>,
	limiter: Limiter = heavyWork,
): Promise<Response> {
	const release = await limiter.acquire();
	let response: Response;
	try {
		response = await job();
	} catch (e) {
		release();
		throw e;
	}
	if (!response.body || method === "HEAD") {
		release();
		return response;
	}
	return new Response(releasedWhenRead(response.body, release), {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}
