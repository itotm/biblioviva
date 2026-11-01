// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { memoryLimit, performanceOf, serverStart } from "./start.js";

describe("the server's start (steps 9.28–9.29)", () => {
	it("starts with --smol when the profile of the folder asks for it", () => {
		const dir = mkdtempSync(join(tmpdir(), "bv-start-"));
		const command = (s: Parameters<typeof serverStart>[1]): string[] =>
			serverStart("bun", s, "build", {}, null).command;
		try {
			// no configuration yet: small, the default, which saves memory
			expect(command(performanceOf(dir))).toEqual(["bun", "--smol", "build"]);
			writeFileSync(
				join(dir, "config.json"),
				JSON.stringify({ performance: { profile: "large" } }),
			);
			expect(command(performanceOf(dir))).toEqual(["bun", "build"]);
			// a performance.json fragment wins over config.json, an explicit key over the profile
			writeFileSync(join(dir, "performance.json"), JSON.stringify({ profile: "micro" }));
			expect(performanceOf(dir).profile).toBe("micro");
			expect(command({ profile: "micro", smol: false })).toEqual(["bun", "build"]);
			// a broken file: the server will say so; the start takes the default
			writeFileSync(join(dir, "performance.json"), "{ oops");
			expect(performanceOf(dir).profile).toBe("large");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("tells the engine the container's memory, unless already told", () => {
		const files = (map: Record<string, string>) => (path: string) => map[path] ?? null;
		expect(memoryLimit(files({ "/sys/fs/cgroup/memory.max": "268435456\n" }))).toBe(268435456);
		expect(memoryLimit(files({ "/sys/fs/cgroup/memory.max": "max\n" }))).toBeNull();
		expect(
			memoryLimit(files({ "/sys/fs/cgroup/memory/memory.limit_in_bytes": "536870912" })),
		).toBe(536870912);
		// cgroup v1 without a limit writes a huge number
		expect(
			memoryLimit(
				files({ "/sys/fs/cgroup/memory/memory.limit_in_bytes": "9223372036854771712" }),
			),
		).toBeNull();
		expect(memoryLimit(files({}))).toBeNull();
		const env = { PATH: "/bin", CONNECTION_IDLE_TIMEOUT: "60" };
		// three quarters of the limit: the rest for SQLite, the images and the binary
		expect(serverStart("bun", {}, "build", env, 268435456).env).toEqual({
			...env,
			BUN_JSC_forceRAMSize: String(192 * 1024 * 1024),
		});
		expect(serverStart("bun", {}, "build", env, null).env).toBe(env);
		const told = { BUN_JSC_forceRAMSize: "1000", CONNECTION_IDLE_TIMEOUT: "60" };
		expect(serverStart("bun", {}, "build", told, 268435456).env).toBe(told);
	});

	it("keeps a silent connection 120 s, unless told otherwise (step 9.32)", () => {
		// adapter-bun reads CONNECTION_IDLE_TIMEOUT; Bun's own default (10 s) cut slow print sheets
		expect(serverStart("bun", {}, "build", { PATH: "/bin" }, null).env).toEqual({
			PATH: "/bin",
			CONNECTION_IDLE_TIMEOUT: "120",
		});
		const told = { CONNECTION_IDLE_TIMEOUT: "90" };
		expect(serverStart("bun", {}, "build", told, null).env).toBe(told);
	});
});
