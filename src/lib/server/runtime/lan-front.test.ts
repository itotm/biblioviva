// SPDX-License-Identifier: GPL-3.0-or-later
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { lanForwardHeaders, startLanFront, type LanFront } from "./lan-front.js";

describe("lanForwardHeaders", () => {
	it("sets the forwarded headers over the client's own", () => {
		const out = lanForwardHeaders(
			new Headers({
				"x-forwarded-proto": "https",
				"x-forwarded-for": "1.2.3.4",
				cookie: "bv_session=t",
			}),
			"192.168.1.20:8080",
			"192.168.1.35",
		);
		expect(out.get("x-forwarded-proto")).toBe("http");
		expect(out.get("x-forwarded-host")).toBe("192.168.1.20:8080");
		expect(out.get("x-forwarded-for")).toBe("192.168.1.35");
		expect(out.get("cookie")).toBe("bv_session=t");
	});
});

describe("startLanFront", () => {
	let app: ReturnType<typeof Bun.serve>;
	let front: LanFront;
	const zipped = gzipSync("compressed answer");

	beforeAll(() => {
		// a stand-in for the app: echoes what it received
		app = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			async fetch(request) {
				const url = new URL(request.url);
				if (url.pathname === "/moved") {
					return new Response(null, { status: 303, headers: { location: "/" } });
				}
				if (url.pathname === "/zipped") {
					return new Response(zipped, {
						headers: { "content-encoding": "gzip", "content-type": "text/plain" },
					});
				}
				return Response.json({
					method: request.method,
					path: url.pathname + url.search,
					proto: request.headers.get("x-forwarded-proto"),
					host: request.headers.get("x-forwarded-host"),
					for: request.headers.get("x-forwarded-for"),
					body: await request.text(),
				});
			},
		});
		front = startLanFront({
			port: 0,
			hostname: "127.0.0.1",
			target: `http://127.0.0.1:${String(app.port)}`,
		});
	});

	afterAll(async () => {
		await front.stop();
		await app.stop();
	});

	it("forwards requests with the forwarded headers the sidecar would add", async () => {
		const base = `http://127.0.0.1:${String(front.port)}`;
		const got = (await (
			await fetch(`${base}/login?x=1`, {
				method: "POST",
				body: "username=admin",
				headers: { "x-forwarded-proto": "https", "x-forwarded-for": "6.6.6.6" },
			})
		).json()) as Record<string, string>;
		expect(got).toEqual({
			method: "POST",
			path: "/login?x=1",
			proto: "http",
			host: `127.0.0.1:${String(front.port)}`,
			for: "127.0.0.1",
			body: "username=admin",
		});
	});

	it("passes redirects and compressed answers back untouched", async () => {
		const base = `http://127.0.0.1:${String(front.port)}`;
		const moved = await fetch(`${base}/moved`, { redirect: "manual" });
		expect(moved.status).toBe(303);
		expect(moved.headers.get("location")).toBe("/");
		const z = await fetch(`${base}/zipped`, { decompress: false });
		expect(z.headers.get("content-encoding")).toBe("gzip");
		expect(new Uint8Array(await z.arrayBuffer())).toEqual(new Uint8Array(zipped));
	});

	it("keeps a silent connection as long as the app does (step 9.32)", async () => {
		const serve = vi.spyOn(Bun, "serve");
		const fronts = [
			startLanFront({ port: 0, hostname: "127.0.0.1", target: "http://127.0.0.1:1" }),
			startLanFront({
				port: 0,
				hostname: "127.0.0.1",
				target: "http://127.0.0.1:1",
				idleTimeout: 200,
			}),
		];
		try {
			// 120 s by default (Bun's own 10 s cut slow print sheets), else CONNECTION_IDLE_TIMEOUT
			expect(serve.mock.calls.map(([options]) => options.idleTimeout)).toEqual([120, 200]);
		} finally {
			serve.mockRestore();
			await Promise.all(fronts.map((f) => f.stop()));
		}
	});

	it("answers 502 while the app is not listening", async () => {
		const orphan = startLanFront({
			port: 0,
			hostname: "127.0.0.1",
			target: "http://127.0.0.1:1",
		});
		try {
			const r = await fetch(`http://127.0.0.1:${String(orphan.port)}/`);
			expect(r.status).toBe(502);
		} finally {
			await orphan.stop();
		}
	});
});
