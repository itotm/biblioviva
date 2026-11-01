// SPDX-License-Identifier: GPL-3.0-or-later
// The server's start (steps 9.28–9.29), the container's entry point: reads the hardware profile
// from CONFIG_DIR (`performance` in config.json, a performance.json fragment over it) and the
// container's memory limit, then replaces itself (execve) with the server built in `./build` —
// with `bun --smol` when the profile asks for it, and `BUN_JSC_forceRAMSize` set to three quarters
// of the limit, so the engine sizes its heap after the container and not after the host's whole
// RAM, leaving the rest to what is not JavaScript (SQLite, images, the binary's pages), and
// `CONNECTION_IDLE_TIMEOUT` to 120 s when missing (9.32). Reading the files is all it does: the
// server validates the configuration at its start, as always.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	CONNECTION_IDLE_TIMEOUT_S,
	resolvePerformance,
	type PerformanceSettings,
} from "#lib/shared/performance.js";

function readJson(path: string): Record<string, unknown> | null {
	try {
		return existsSync(path)
			? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>)
			: null;
	} catch {
		return null; // the server reports a broken file
	}
}

/** The `performance` section as the folder writes it: the fragment over config.json. */
export function performanceOf(configDir: string): PerformanceSettings {
	const base = (readJson(join(configDir, "config.json"))?.performance ??
		{}) as PerformanceSettings;
	const fragment = (readJson(join(configDir, "performance.json")) ?? {}) as PerformanceSettings;
	return { ...base, ...fragment };
}

/** Above this a cgroup v1 limit means "no limit" (the kernel writes a huge number). */
const NO_LIMIT = 2 ** 50;
const CGROUP_FILES = [
	"/sys/fs/cgroup/memory.max", // cgroup v2: a number or "max"
	"/sys/fs/cgroup/memory/memory.limit_in_bytes", // cgroup v1
];

/** The container's memory limit in bytes, or null without one. */
export function memoryLimit(read: (path: string) => string | null = readText): number | null {
	for (const file of CGROUP_FILES) {
		const text = read(file)?.trim();
		if (text && /^\d+$/.test(text)) {
			const bytes = Number(text);
			return bytes > 0 && bytes < NO_LIMIT ? bytes : null;
		}
	}
	return null;
}

function readText(path: string): string | null {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return null;
	}
}

/** The share of the container's memory the engine is told it has (measured in 9.29). */
const HEAP_SHARE = 0.75;

/**
 * The command and the environment that start the server: the idle timeout of the connections
 * (`CONNECTION_IDLE_TIMEOUT`, read by adapter-bun) is 120 s unless already set, as in the image,
 * so a slow print sheet is not cut outside the container either (9.32).
 */
export function serverStart(
	execPath: string,
	settings: PerformanceSettings,
	build: string,
	env: Record<string, string | undefined>,
	limit: number | null,
): { command: string[]; env: Record<string, string | undefined> } {
	const command = resolvePerformance(settings).smol
		? [execPath, "--smol", build]
		: [execPath, build];
	const extra: Record<string, string> = {};
	if (limit !== null && env.BUN_JSC_forceRAMSize === undefined) {
		extra.BUN_JSC_forceRAMSize = String(Math.floor(limit * HEAP_SHARE));
	}
	if (env.CONNECTION_IDLE_TIMEOUT === undefined) {
		extra.CONNECTION_IDLE_TIMEOUT = String(CONNECTION_IDLE_TIMEOUT_S);
	}
	return { command, env: Object.keys(extra).length > 0 ? { ...env, ...extra } : env };
}

if (import.meta.main) {
	const build = resolve(process.argv[2] ?? "./build");
	const start = serverStart(
		process.execPath,
		performanceOf(process.env.CONFIG_DIR ?? "/config"),
		build,
		process.env,
		memoryLimit(),
	);
	if (process.execve) {
		process.execve(process.execPath, start.command, start.env);
	}
	// a runtime without execve: the server in this process, without these settings
	await import(join(build, "index.js"));
}
