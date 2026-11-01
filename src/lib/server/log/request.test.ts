// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "#lib/server/env.js";
import { isQuiet, logRequest, remoteName, remoteOutcome, safeQuery } from "./request.js";

afterEach(() => {
	vi.unstubAllEnvs();
	resetEnvCache();
	vi.restoreAllMocks();
});

describe("request log", () => {
	it("keeps the noise and the personal data out", () => {
		expect(isQuiet("/_app/immutable/chunks/a.js")).toBe(true);
		expect(isQuiet("/healthz")).toBe(true);
		expect(isQuiet("/catalog")).toBe(false);
		expect(safeQuery(new URL("https://x/patrons?q=Rossi&ids=1,2"))).toEqual({
			q: "<5 chars>",
			ids: "1,2",
		});
		expect(safeQuery(new URL("https://x/catalog"))).toBeUndefined();
		expect(remoteName("/_app/remote/1p9kxmo/login")).toBe("login");
		expect(remoteName("/catalog")).toBeNull();
	});

	it("tells errors, redirects and refused forms apart", () => {
		expect(remoteOutcome(JSON.stringify({ type: "error", error: { message: "x" } }))).toEqual({
			outcome: "error",
			error: { message: "x" },
		});
		expect(
			remoteOutcome(JSON.stringify({ type: "result", data: '[{"redirect":1},"/"]' })),
		).toEqual({ outcome: "redirect" });
		expect(
			remoteOutcome(JSON.stringify({ type: "result", data: '[{"_":1},{"issues":2}]' })),
		).toEqual({ outcome: "issues" });
		expect(remoteOutcome(JSON.stringify({ type: "result", data: "[1]" }))).toEqual({});
		expect(remoteOutcome("not json")).toEqual({});
	});

	it("writes one line per request in debug mode only", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const line = {
			method: "POST",
			url: new URL("https://x/_app/remote/abc/fastAdd"),
			status: 200,
			ms: 12,
			user: "catalogo",
			route: null,
			response: new Response(JSON.stringify({ type: "result", data: '[{"issues":1}]' })),
		};
		vi.stubEnv("LOG_LEVEL", "info");
		resetEnvCache();
		await logRequest(line);
		expect(warn).not.toHaveBeenCalled();
		vi.stubEnv("LOG_LEVEL", "debug");
		resetEnvCache();
		await logRequest(line);
		await logRequest({ ...line, url: new URL("https://x/healthz") });
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0]?.[0]).toContain("[debug] http POST remote:fastAdd");
		expect(warn.mock.calls[0]?.[0]).toContain('"outcome":"issues"');
	});
});
