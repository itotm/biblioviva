// SPDX-License-Identifier: GPL-3.0-or-later
import { clientAddress } from "#lib/server/auth/client-address.js";
import { demoRequestAllowed } from "#lib/server/demo/limits.js";
import { demoRefusalResponse, type RefusalPage } from "#lib/server/demo/refusal.js";
import { DEMO_REPLACED_HEADER, trackDemoRequest } from "#lib/server/demo/content.js";
import { DemoBlockedError, isDemoPublic } from "#lib/server/demo/public.js";
import { isRedirect, redirect } from "@sveltejs/kit";
import type { Handle, HandleServerError, ServerInit } from "@sveltejs/kit/hooks";
import { startServer } from "#lib/server/startup.js";
import { dev } from "$app/env";
import { resolveLocale, tServer } from "#lib/i18n/server.js";
import { SESSION_COOKIE, resolveSession } from "#lib/server/auth/index.js";
import { getLoadedConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { debugLog } from "#lib/server/log/debug.js";
import { logRequest } from "#lib/server/log/request.js";
import { heavyResponse, isHeavyRequest } from "#lib/server/runtime/heavy.js";
import { isSetupMode } from "#lib/server/services/setup.js";

/** Routes reachable without a session (PLAN.md §3.15). */
const PUBLIC_PREFIXES = [
	"/login",
	"/healthz",
	"/setup",
	"/_app/",
	"/manifest.webmanifest",
	"/service-worker.js",
];

function isPublic(pathname: string): boolean {
	if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
		return true;
	}
	// The style guide is reachable in development and in the test build only.
	return pathname.startsWith("/dev/") && (dev || env().DEV_UI === "1");
}

const SECURITY_HEADERS: Record<string, string> = {
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "same-origin",
	"X-Frame-Options": "SAMEORIGIN",
	"Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
};

/** One year, this host only: the tailnet name is the only one the app answers on. */
const HSTS = "max-age=31536000";

/** Runs once before the first request (`#lib/server/startup.ts`). */
export const init: ServerInit = startServer;

/**
 * Every request through `serve`, timed for the diagnostic log (9.13, round 12): with
 * `LOG_LEVEL=debug` one line per request, redirects included. Print sheets and exports wait their
 * turn for a slot of the heavy jobs and hold it until their answer has been sent (9.32).
 */
export const handle: Handle = async (input) => {
	const { event } = input;
	const started = performance.now();
	const line = (status: number, response?: Response): Promise<void> =>
		logRequest({
			method: event.request.method,
			url: event.url,
			status,
			ms: Math.round(performance.now() - started),
			user: event.locals.user?.username ?? null,
			route: event.route.id,
			response,
		});
	try {
		const response = isHeavyRequest(event.url.pathname)
			? await heavyResponse(event.request.method, () => serve(input))
			: await serve(input);
		await line(response.status, response);
		return response;
	} catch (e) {
		await line(isRedirect(e) ? e.status : 500);
		throw e;
	}
};

/**
 * Errors while serving: an unexpected one is printed as SvelteKit would; with `LOG_LEVEL=debug`
 * every kind (404s, refused validations, `error()` helpers) gets a line with where it happened.
 */
export const handleError: HandleServerError = async ({ kind, error, event }) => {
	// the guard of the public demo says what is off and why, in the visitor's language
	if (error instanceof DemoBlockedError) {
		const message = await tServer(
			event.locals.locale,
			`common.demoPublic.blocked.${error.feature}`,
		);
		// a refusal, not a failure: `serve` answers it as a 403 (a page of its own, or the
		// notification of a remote function)
		event.locals.demoBlocked = message;
		return { message, demo: true };
	}
	if (kind === "unknown") {
		console.error(error);
	}
	debugLog("error", `${event.request.method} ${event.url.pathname}`, {
		kind,
		route: event.route.id,
		// an Error with its stack; the body of `error()` or a framework error as it is
		error: error instanceof Error ? (error.stack ?? error.message) : error,
	});
};

const serve: Handle = async ({ event, resolve }) => {
	const loaded = getLoadedConfig();
	const config = loaded.config;
	// The wizard runs until config.json exists with `ui.setupCompleted`; it may switch language.
	event.locals.setupMode = isSetupMode(loaded);
	event.locals.locale = resolveLocale(event, event.locals.setupMode);
	const db = getDb();
	const resolved = resolveSession(
		db,
		event.cookies.get(SESSION_COOKIE),
		config.security.roles,
		config.security.sessionDays,
	);
	event.locals.user = resolved?.user ?? null;

	const { pathname } = event.url;
	// the public demo: a ceiling per address on writes and heavy requests (9.17)
	if (
		isDemoPublic() &&
		!demoRequestAllowed(clientAddress(event), { method: event.request.method, pathname })
	) {
		return demoRefusalResponse(
			429,
			{ remote: event.isRemoteRequest, accept: event.request.headers.get("Accept") ?? "" },
			await tServer(event.locals.locale, "common.demoPublic.tooMany"),
			await refusalPage(event.locals.locale, "busyTitle"),
		);
	}
	if (
		event.locals.setupMode &&
		!pathname.startsWith("/setup") &&
		!pathname.startsWith("/healthz") &&
		!pathname.startsWith("/_app/") &&
		pathname !== "/manifest.webmanifest"
	) {
		redirect(303, "/setup");
	}
	if (!event.locals.user && !isPublic(pathname)) {
		// images are embedded, never navigated to: a redirect to the login page would be misleading
		if (pathname.startsWith("/media/")) {
			return new Response("unauthorized", { status: 401 });
		}
		if (event.request.method !== "GET") {
			redirect(303, "/login");
		}
		redirect(303, `/login?redirectTo=${encodeURIComponent(pathname + event.url.search)}`);
	}

	const render = (): Promise<Response> =>
		resolve(event, {
			transformPageChunk: ({ html }) =>
				html.replace(
					'<html lang="it" data-theme="ocean"',
					`<html lang="${event.locals.locale}" data-theme="${config.ui.theme}"`,
				),
		});
	// the public demo says when it replaced what the visitor sent (Q121): the browser notifies
	let response: Response;
	if (isDemoPublic()) {
		const tracked = await trackDemoRequest(render);
		response = tracked.result;
		if (tracked.replaced) {
			response.headers.set(DEMO_REPLACED_HEADER, "1");
		}
	} else {
		response = await render();
	}
	// what the demo's guard refused while serving: a 403 with what is off, never a "500" (the data
	// of a page's navigation stays SvelteKit's, its error page shows the message)
	if (event.locals.demoBlocked && !event.isDataRequest) {
		response = demoRefusalResponse(
			403,
			{ remote: event.isRemoteRequest, accept: event.request.headers.get("Accept") ?? "" },
			event.locals.demoBlocked,
			await refusalPage(event.locals.locale, "title"),
		);
	}
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(name)) {
			response.headers.set(name, value);
		}
	}
	// the public demo is never indexed (robots.txt says so too)
	if (isDemoPublic()) {
		response.headers.set("X-Robots-Tag", "noindex, nofollow");
	}
	// an SVG (pictograms, placeholders, barcodes, template images) opened on its own runs nothing
	if (
		response.headers.get("Content-Type")?.startsWith("image/svg+xml") &&
		!response.headers.has("Content-Security-Policy")
	) {
		response.headers.set(
			"Content-Security-Policy",
			"default-src 'none'; style-src 'unsafe-inline'; sandbox",
		);
	}
	const compressed = compress(event.request, response);
	// served over HTTPS by the Tailscale sidecar (step 8.4): browsers keep to HTTPS for this name;
	// the scheme comes from the proxy's X-Forwarded-Proto (PROTOCOL_HEADER, ADR-007)
	if (event.url.protocol === "https:" && !compressed.headers.has("Strict-Transport-Security")) {
		compressed.headers.set("Strict-Transport-Security", HSTS);
	}
	return compressed;
};

/** The words of the demo's page of a refusal, in the installation's language. */
async function refusalPage(
	locale: App.Locals["locale"],
	title: "title" | "busyTitle",
): Promise<RefusalPage> {
	return {
		lang: locale,
		title: await tServer(locale, `common.demoPublic.refused.${title}`),
		back: await tServer(locale, "common.demoPublic.refused.back"),
	};
}

/** Dynamic responses worth compressing: pages, data, SVG barcodes, CSV exports (9.2). */
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg\+xml|application\/javascript)/;

/**
 * Gzip for what SvelteKit renders (the static assets are precompressed by the adapter): the pages
 * carry their dictionaries and would otherwise travel at full size over the school Wi-Fi.
 */
function compress(request: Request, response: Response): Response {
	const type = response.headers.get("Content-Type") ?? "";
	const length = Number(response.headers.get("Content-Length") ?? "-1");
	if (
		!response.body ||
		response.headers.has("Content-Encoding") ||
		!COMPRESSIBLE.test(type) ||
		(length >= 0 && length < 1024) ||
		!/\bgzip\b/.test(request.headers.get("Accept-Encoding") ?? "")
	) {
		return response;
	}
	const headers = new Headers(response.headers);
	headers.set("Content-Encoding", "gzip");
	headers.delete("Content-Length");
	headers.append("Vary", "Accept-Encoding");
	return new Response(response.body.pipeThrough(new CompressionStream("gzip")), {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
