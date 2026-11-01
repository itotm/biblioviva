// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { parseIso2709 } from "#lib/server/marc/iso2709.js";
import { driverLoad, runYaz, Z3950Error } from "./driver.js";
import { buildCommandFile, buildPqf, parseHits, pqfTerm } from "./query.js";
import { z3950Target } from "./targets.js";
import { getConfig } from "#lib/server/config/index.js";
import { resolvePerformance } from "#lib/shared/performance.js";

const config = parseConfig(exampleRaw()).config;
const target = z3950Target(config);
const FAKE = resolve("tests/helpers/fake-yaz.sh");
const dirs: string[] = [];
const tmp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-z3950-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});
const options = (
	tmpDir: string,
	over: Partial<{ timeoutMs: number; max: number; command: string }> = {},
): { timeoutMs: number; max: number; command: string; tmpDir: string } => ({
	command: FAKE,
	tmpDir,
	timeoutMs: 5000,
	max: 5,
	...over,
});

describe("query builder", () => {
	it("builds PQF and the command file of Appendix D", () => {
		expect(pqfTerm('Cosmicòmiche "vol. 1"\n')).toBe("Cosmicomiche vol. 1");
		// both forms of a 978 ISBN: SBN indexes older books by their ISBN-10 only
		expect(buildPqf({ kind: "isbn", isbn: "9788804668237" })).toBe(
			"@or @attr 1=7 9788804668237 @attr 1=7 8804668237",
		);
		expect(buildPqf({ kind: "isbn", isbn: "8804490624" })).toBe(
			"@or @attr 1=7 8804490624 @attr 1=7 9788804490623",
		);
		expect(buildPqf({ kind: "isbn", isbn: "9791234567896" })).toBe("@attr 1=7 9791234567896");
		expect(buildPqf({ kind: "search", title: "cosmicomiche" })).toBe(
			'@attr 1=4 @attr 5=1 "cosmicomiche"',
		);
		expect(buildPqf({ kind: "search", title: "harry potter", author: "rowling" })).toBe(
			'@and @attr 1=4 @attr 5=1 "harry potter" @attr 1=1003 "rowling"',
		);
		expect(buildPqf({ kind: "search", title: "a", author: "b", words: "c" })).toBe(
			'@and @attr 1=4 @attr 5=1 "a" @and @attr 1=1003 "b" @attr 1=1016 "c"',
		);
		expect(() => buildPqf({ kind: "search", title: "  " })).toThrow(/empty/);
		const cmd = buildCommandFile(target, "@attr 1=7 9788804668237", 3);
		expect(cmd.split("\n")).toEqual([
			"open tcp:opac.sbn.it:2100/nopac",
			"charset - utf-8 utf-8",
			"format unimarc",
			"elements F",
			"find @attr 1=7 9788804668237",
			"show 1+1",
			"show 2+1",
			"show 3+1",
			"quit",
			"",
		]);
		// a value that reached it without the schema (the connection test) cannot add a command
		for (const field of ["host", "database", "charset", "elements"] as const) {
			expect(() =>
				buildCommandFile({ ...target, [field]: "x\nquit" }, "@attr 1=7 1", 1),
			).toThrow(/Z39\.50/);
		}
		expect(() => buildCommandFile(target, "@attr 1=7 1\nquit", 1)).toThrow(/Z39\.50/);
		expect(parseHits("Search was a success.\nNumber of hits: 3, setno 1\n")).toBe(3);
		expect(parseHits("Sent searchRequest.")).toBeNull();
		expect(z3950Target(config).name).toBe("OPAC SBN");
		expect(() => z3950Target(config, "nope")).toThrow(/not configured/);
	});
});

describe("yaz driver (fake client)", () => {
	it("runs the client in a temp folder, parses the hits, reads the records and cleans up", async () => {
		const tmpDir = tmp();
		const result = await runYaz(
			target,
			{ kind: "isbn", isbn: "9788804668237" },
			options(tmpDir),
		);
		expect(result.hits).toBe(3);
		expect(parseIso2709(result.records).length).toBeGreaterThanOrEqual(3);
		expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
		expect(readdirSync(tmpDir)).toEqual([]);
		const none = await runYaz(target, { kind: "isbn", isbn: "9780000000002" }, options(tmpDir));
		expect(none).toMatchObject({ hits: 0 });
		expect(none.records).toHaveLength(0);
		// keepFiles leaves the folder for inspection
		await runYaz(
			target,
			{ kind: "search", title: "harry" },
			{ ...options(tmpDir), keepFiles: true },
		);
		expect(readdirSync(tmpDir).some((d) => d.startsWith("z3950-"))).toBe(true);
	});

	it("kills a client that does not answer within the timeout", async () => {
		const tmpDir = tmp();
		const started = performance.now();
		await expect(
			runYaz(target, { kind: "search", title: "SLOW" }, options(tmpDir, { timeoutMs: 1000 })),
		).rejects.toMatchObject({ code: "timeout" });
		expect(performance.now() - started).toBeLessThan(5000);
		expect(readdirSync(tmpDir)).toEqual([]);
	});

	it("reports unreachable targets, protocol failures and a missing executable", async () => {
		const tmpDir = tmp();
		await expect(
			runYaz(target, { kind: "search", title: "DOWN" }, options(tmpDir)),
		).rejects.toMatchObject({ code: "unreachable" });
		await expect(
			runYaz(target, { kind: "search", title: "GARBAGE" }, options(tmpDir)),
		).rejects.toMatchObject({ code: "protocol" });
		const missing = runYaz(
			target,
			{ kind: "isbn", isbn: "9788804668237" },
			options(tmpDir, { command: "/nonexistent/yaz" }),
		);
		await expect(missing).rejects.toBeInstanceOf(Z3950Error);
		await expect(missing).rejects.toMatchObject({ code: "spawn" });
	});

	it("runs at most the profile's clients at a time (yazConcurrency, step 9.28)", async () => {
		const tmpDir = tmp();
		let peak = 0;
		let queued = 0;
		const sampler = setInterval(() => {
			const load = driverLoad();
			peak = Math.max(peak, load.running);
			queued = Math.max(queued, load.waiting);
		}, 20);
		const jobs = Array.from({ length: 4 }, () =>
			runYaz(target, { kind: "search", title: "WAIT" }, options(tmpDir)),
		);
		const results = await Promise.all(jobs);
		clearInterval(sampler);
		expect(peak).toBe(resolvePerformance(getConfig().performance).yazConcurrency);
		expect(queued).toBeGreaterThanOrEqual(1);
		expect(results.every((r) => r.hits === 0)).toBe(true);
		expect(driverLoad()).toEqual({ running: 0, waiting: 0 });
	});
});

// Live check against OPAC SBN: `Z3950_LIVE=1 YAZ_CLIENT=scripts/yaz-client.sh bun run test`.
describe.skipIf(process.env.Z3950_LIVE !== "1")("yaz driver (live SBN)", () => {
	it("fetches 1984 by ISBN", async () => {
		const tmpDir = tmp();
		const result = await runYaz(
			target,
			{ kind: "isbn", isbn: "9788804668237" },
			{
				command: resolve(process.env.YAZ_CLIENT ?? "yaz-client"),
				tmpDir,
				timeoutMs: 20_000,
				max: 3,
			},
		);
		expect(result.hits).toBeGreaterThan(0);
		const titles = parseIso2709(result.records).map((r) => JSON.stringify(r.fields));
		expect(titles.some((t) => t.includes("1984"))).toBe(true);
	}, 30_000);
});
