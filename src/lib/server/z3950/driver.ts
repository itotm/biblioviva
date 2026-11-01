// SPDX-License-Identifier: GPL-3.0-or-later
// yaz-client driver (PLAN.md §3.9, Q25): one process per request run from a temp folder under
// `DATA_DIR/tmp` with relative file names (so the container wrapper of ADR-001 works too),
// killed on timeout, at most two at a time. The records come back as raw ISO 2709 bytes.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCommandFile, buildPqf, parseHits, type Z3950Query } from "./query.js";
import type { Z3950Target } from "./targets.js";
import { yazWork } from "#lib/server/runtime/limit.js";

export type Z3950ErrorCode = "unreachable" | "timeout" | "protocol" | "spawn";

export class Z3950Error extends Error {
	constructor(
		readonly code: Z3950ErrorCode,
		message: string,
		readonly stderr = "",
	) {
		super(message);
		this.name = "Z3950Error";
	}
}

export interface Z3950Result {
	hits: number;
	/** ISO 2709 bytes of the records shown (`hits` may be larger than the records returned). */
	records: Uint8Array;
	elapsedMs: number;
}

export interface DriverOptions {
	/** Executable (or wrapper script): `YAZ_CLIENT`, default `yaz-client`. */
	command?: string;
	/** Folder for the per-request temp folders (`DATA_DIR/tmp`). */
	tmpDir: string;
	timeoutMs: number;
	/** Records to show (config `maxRecordsIsbn` / `maxRecordsSearch`). */
	max: number;
	/** Keep the command and output files (debugging with `bun run z3950:test`). */
	keepFiles?: boolean;
}

/** How many yaz processes are running or queued (the concurrency test reads it). */
export function driverLoad(): { running: number; waiting: number } {
	return { running: yazWork.active, waiting: yazWork.waiting };
}

export async function runYaz(
	target: Z3950Target,
	query: Z3950Query,
	options: DriverOptions,
): Promise<Z3950Result> {
	const pqf = buildPqf(query);
	const id = crypto.randomUUID();
	const dir = join(options.tmpDir, `z3950-${id}`);
	mkdirSync(dir, { recursive: true });
	const cmdName = "query.cmd";
	const outName = "records.mrc";
	writeFileSync(join(dir, cmdName), buildCommandFile(target, pqf, options.max));
	const started = performance.now();
	// `yazConcurrency` processes at once, the profile's (step 9.28)
	return yazWork.run(async () => {
		try {
			let proc: ReturnType<typeof Bun.spawn>;
			try {
				proc = Bun.spawn([options.command ?? "yaz-client", "-f", cmdName, "-m", outName], {
					cwd: dir,
					stdin: "ignore",
					stdout: "pipe",
					stderr: "pipe",
					timeout: options.timeoutMs,
					killSignal: "SIGKILL",
				});
			} catch (e) {
				throw new Z3950Error(
					"spawn",
					`cannot start ${options.command ?? "yaz-client"}: ${String(e)}`,
				);
			}
			const [stdout, stderr, exitCode] = await Promise.all([
				new Response(proc.stdout as ReadableStream).text(),
				new Response(proc.stderr as ReadableStream).text(),
				proc.exited,
			]);
			const elapsedMs = Math.round(performance.now() - started);
			if (
				proc.signalCode === "SIGKILL" ||
				(exitCode !== 0 && elapsedMs >= options.timeoutMs)
			) {
				throw new Z3950Error(
					"timeout",
					`yaz-client killed after ${options.timeoutMs} ms`,
					stderr,
				);
			}
			if (
				/Connecting\.\.\.(?!OK)/i.test(stdout) ||
				/connection refused|could not connect|error: (connect|open)/i.test(stdout + stderr)
			) {
				throw new Z3950Error(
					"unreachable",
					`${target.host}:${target.port} not reachable`,
					stderr,
				);
			}
			const hits = parseHits(stdout);
			if (hits === null) {
				throw new Z3950Error(
					"protocol",
					"no search response from the target",
					`${stdout}\n${stderr}`.trim(),
				);
			}
			const outPath = join(dir, outName);
			const records = existsSync(outPath)
				? new Uint8Array(readFileSync(outPath))
				: new Uint8Array();
			return { hits, records, elapsedMs };
		} finally {
			if (!options.keepFiles) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});
}
