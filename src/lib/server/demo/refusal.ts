// SPDX-License-Identifier: GPL-3.0-or-later
// How the public demo answers what it refuses (9.17): a feature off (403) or too many requests
// (429). A refusal is not a failure of the server, so it never shows as one: a remote function
// gets SvelteKit's error shape marked `demo` (the page shows it as a notification); a page opened
// on its own (a print sheet or a download in a tab of its own) gets a small page of the app with
// what is off and a way back; anything else gets the plain text.

export interface RefusalPage {
	lang: string;
	title: string;
	/** The label of the link back to the app. */
	back: string;
}

export interface RefusedRequest {
	/** `event.isRemoteRequest`: its `event.url` is the page's, not the remote function's. */
	remote: boolean;
	/** The request's `Accept` header. */
	accept: string;
}

const esc = (s: string): string =>
	s.replace(
		/[&<>"]/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
	);

/** Lucide's `triangle-alert`, the icon of the app's warnings. */
const WARNING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

/** The page of a refusal: light, self-contained (no script, no outside file), a link home. */
export function refusalHtml(message: string, page: RefusalPage): string {
	return `<!doctype html>
<html lang="${esc(page.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${esc(page.title)}</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:#f1f5f9;color:#0f172a;font:16px/1.5 system-ui,sans-serif}
main{max-width:30rem;background:#fff;border:2px solid #b45309;border-radius:16px;padding:24px;box-shadow:0 4px 16px rgb(15 23 42/.08)}
.icon{color:#b45309}h1{margin:8px 0;font-size:1.5rem;line-height:1.25}p{margin:0 0 20px}
a{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:12px;background:#1d4ed8;color:#fff;font-weight:600;text-decoration:none}
a:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
</style></head>
<body><main><div class="icon">${WARNING_ICON}</div><h1>${esc(page.title)}</h1><p>${esc(message)}</p><a href="/">${esc(page.back)}</a></main></body></html>`;
}

/** The answer to a refused request, in the form its sender reads. */
export function demoRefusalResponse(
	status: 403 | 429,
	request: RefusedRequest,
	message: string,
	page: RefusalPage,
): Response {
	const headers: Record<string, string> = { "Cache-Control": "no-store" };
	if (status === 429) {
		headers["Retry-After"] = "60";
	}
	if (request.remote) {
		return Response.json(
			{ type: "error", error: { message, demo: true } },
			{ status, headers },
		);
	}
	if (request.accept.includes("text/html")) {
		return new Response(refusalHtml(message, page), {
			status,
			headers: {
				...headers,
				"Content-Type": "text/html; charset=utf-8",
				"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
			},
		});
	}
	return new Response(message, {
		status,
		headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
	});
}
