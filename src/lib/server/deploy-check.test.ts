// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { checkDeployment } from "./deploy-check.js";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function fakeServer(options: { hsts: boolean; healthy?: boolean; setup?: boolean }): Fetch {
	return (input: string) => {
		const path = new URL(input).pathname;
		if (path === "/healthz") {
			return Promise.resolve(
				Response.json({
					status: options.healthy === false ? "error" : "ok",
					version: "1.0.0",
					db: "ok",
				}),
			);
		}
		if (path === "/login") {
			const headers: Record<string, string> = {
				"x-content-type-options": "nosniff",
				"x-frame-options": "SAMEORIGIN",
			};
			if (options.hsts) {
				headers["strict-transport-security"] = "max-age=31536000";
			}
			return Promise.resolve(new Response("<form method=post></form>", { headers }));
		}
		return Promise.resolve(
			new Response(null, {
				status: 303,
				headers: { location: options.setup ? "/setup" : "/login?redirectTo=%2F" },
			}),
		);
	};
}

describe("deployment check", () => {
	it("passes a healthy HTTPS deployment", async () => {
		const checks = await checkDeployment(
			"https://biblioviva.tail1234.ts.net/",
			fakeServer({ hsts: true }),
		);
		expect(checks.map((c) => [c.name, c.ok])).toEqual([
			["https", true],
			["reachable", true],
			["health", true],
			["login page", true],
			["hsts", true],
			["security headers", true],
			["anonymous visit", true],
		]);
	});

	it("flags plain HTTP, a missing HSTS header, an unhealthy database, the wizard", async () => {
		const plain = await checkDeployment("http://pi.local:3000", fakeServer({ hsts: false }));
		expect(plain.find((c) => c.name === "https")?.ok).toBe(false);
		expect(plain.find((c) => c.name === "hsts")?.ok).toBe(true);
		const noHsts = await checkDeployment(
			"https://x.ts.net",
			fakeServer({ hsts: false, healthy: false, setup: true }),
		);
		expect(noHsts.find((c) => c.name === "hsts")).toMatchObject({ ok: false });
		expect(noHsts.find((c) => c.name === "health")?.ok).toBe(false);
		expect(noHsts.find((c) => c.name === "anonymous visit")?.detail).toContain(
			"first-run wizard",
		);
	});

	it("reports an unreachable host (or a certificate the client refuses)", async () => {
		const checks = await checkDeployment("https://x.ts.net", () =>
			Promise.reject(new Error("certificate has expired")),
		);
		expect(checks.at(-1)).toMatchObject({ name: "reachable", ok: false });
		expect(checks.at(-1)?.detail).toContain("certificate has expired");
	});
});
