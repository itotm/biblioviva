// SPDX-License-Identifier: GPL-3.0-or-later
// The basic local-network mode (PLAN.md step 8.8): without the Tailscale sidecar, a second listener
// on `LAN_PORT` stands in for it. adapter-bun takes the scheme from `x-forwarded-proto` and assumes
// https when the header is missing, so a browser on plain http would get a `Secure` cookie it drops
// and a 403 from the CSRF check on every form. The front forwards each request to the app on the
// loopback with the headers the sidecar would add — scheme http, the host the browser asked for,
// the client's address — replacing whatever the client sent in them.
import { CONNECTION_IDLE_TIMEOUT_S } from "#lib/shared/performance.js";

export interface LanFront {
	port: number;
	stop(): Promise<void>;
}

/** The request headers for the app: the client's, with the forwarded ones set by the front. */
export function lanForwardHeaders(headers: Headers, host: string, clientAddress: string): Headers {
	const out = new Headers(headers);
	out.set("x-forwarded-proto", "http");
	out.set("x-forwarded-host", host);
	out.set("x-forwarded-for", clientAddress);
	return out;
}

/**
 * Listens on `port` (all interfaces) and forwards to `target` (the app, e.g.
 * `http://127.0.0.1:3000`). Bodies stream both ways; redirects and compressed answers go back to
 * the browser untouched. A connection is closed after `idleTimeout` seconds without traffic, as
 * the app's own (`CONNECTION_IDLE_TIMEOUT`, 120 by default, step 9.32): a print sheet that waits
 * its turn or renders slowly is not cut by the front.
 */
export function startLanFront(options: {
	port: number;
	target: string;
	hostname?: string;
	idleTimeout?: number;
}): LanFront {
	const target = new URL(options.target);
	const server = Bun.serve({
		port: options.port,
		hostname: options.hostname ?? "0.0.0.0",
		idleTimeout: options.idleTimeout ?? CONNECTION_IDLE_TIMEOUT_S,
		async fetch(request, srv) {
			const url = new URL(request.url);
			const upstream = new URL(url.pathname + url.search, target);
			const hasBody = request.method !== "GET" && request.method !== "HEAD";
			try {
				const response = await fetch(upstream, {
					method: request.method,
					headers: lanForwardHeaders(
						request.headers,
						request.headers.get("host") ?? url.host,
						srv.requestIP(request)?.address ?? "unknown",
					),
					body: hasBody ? request.body : undefined,
					redirect: "manual",
					decompress: false,
				});
				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: response.headers,
				});
			} catch {
				return new Response("BiblioViva is starting or unavailable", { status: 502 });
			}
		},
	});
	return {
		port: server.port ?? options.port,
		stop: () => server.stop(),
	};
}
