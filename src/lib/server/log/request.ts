// SPDX-License-Identifier: GPL-3.0-or-later
// The request line of the diagnostic log (9.13, round 12): with `LOG_LEVEL=debug` every request
// the app serves is one line — account, method, path, the remote function called, status, time,
// and for remote functions whether the answer was an error, a redirect or a form with issues — so
// the first tries can be followed step by step. Query strings may carry names (a search box),
// so only their keys are written, with the values of a few that never do.
import { debugEnabled, debugLog } from "./debug.js";

/** Paths that would only add noise: static files, the health check, the PWA files. */
const QUIET = [
	/^\/_app\/immutable\//,
	/^\/_app\/version\.json$/,
	/^\/healthz$/,
	/^\/service-worker\.js$/,
	/^\/manifest\.webmanifest$/,
	/^\/(favicon|apple-touch-icon|icon-)[^/]*$/,
	/^\/robots\.txt$/,
];

/** Query keys whose values are codes, ids or choices, never personal data. */
const SAFE_KEYS = new Set([
	"ids",
	"list",
	"stock",
	"kind",
	"template",
	"format",
	"series",
	"redirectTo",
	"v",
	"page",
	"sort",
	"type",
]);

export function isQuiet(pathname: string): boolean {
	return QUIET.some((r) => r.test(pathname));
}

/** `?q=…&ids=1,2` → `{ q: "…", ids: "1,2" }` with the unsafe values hidden. */
export function safeQuery(url: URL): Record<string, string> | undefined {
	const out: Record<string, string> = {};
	for (const [key, value] of url.searchParams) {
		// remote queries carry their argument in `payload`: it can hold a search text
		out[key] = SAFE_KEYS.has(key) ? value.slice(0, 120) : `<${String(value.length)} chars>`;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

/** `/_app/remote/<hash>/<name>` → `<name>` (the remote function's export name). */
export function remoteName(pathname: string): string | null {
	const m = /^\/_app\/remote\/[^/]+\/([^/?]+)/.exec(pathname);
	return m?.[1] ?? null;
}

/**
 * What a remote function answered, without its data: `error` (with the message), `redirect`, or
 * `issues` for a form refused field by field; nothing for a plain result.
 */
export function remoteOutcome(body: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(body) as { type?: string; data?: string; error?: unknown };
		if (parsed.type === "error") {
			return { outcome: "error", error: parsed.error };
		}
		if (typeof parsed.data === "string") {
			if (parsed.data.includes('"redirect"')) {
				return { outcome: "redirect" };
			}
			if (parsed.data.includes('"issues"')) {
				return { outcome: "issues" };
			}
		}
		return {};
	} catch {
		return {};
	}
}

export interface RequestLine {
	method: string;
	url: URL;
	status: number;
	ms: number;
	user: string | null;
	route: string | null;
	/** The response, read only for remote functions (cloned). */
	response?: Response;
}

export async function logRequest(line: RequestLine): Promise<void> {
	if (!debugEnabled() || isQuiet(line.url.pathname)) {
		return;
	}
	const remote = remoteName(line.url.pathname);
	let outcome: Record<string, unknown> = {};
	if (remote && line.response) {
		outcome = remoteOutcome(await line.response.clone().text());
	}
	debugLog("http", `${line.method} ${remote ? `remote:${remote}` : line.url.pathname}`, {
		status: line.status,
		ms: line.ms,
		user: line.user,
		route: remote ? undefined : (line.route ?? undefined),
		query: remote ? undefined : safeQuery(line.url),
		...outcome,
	});
}
