// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run ci` on a developer machine: the independent checks (lint, UI audit, unit tests, and the
// type check followed by the build and its check) run side by side, then the end-to-end suite
// starts on the build just made instead of building again. Each task's output is shown when it ends, the failed ones in
// full. GitHub's workflow runs the same steps one by one (`.github/workflows/ci.yml`). At the end,
// pass or fail, `test-reports/index.html` sums up the runs and links their HTML reports (ADR-021).
import { writeIndex } from "./test-report.js";

const started = performance.now();

interface Task {
	name: string;
	cmd: string[];
	env?: Record<string, string>;
}

async function run(task: Task): Promise<{ task: Task; ok: boolean; out: string; ms: number }> {
	const t0 = performance.now();
	const proc = Bun.spawn(task.cmd, {
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, ...task.env, FORCE_COLOR: "1" },
	});
	const [out, err] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { task, ok: proc.exitCode === 0, out: out + err, ms: performance.now() - t0 };
}

function report(r: Awaited<ReturnType<typeof run>>): void {
	const secs = (r.ms / 1000).toFixed(0);
	console.log(`\n${r.ok ? "✓" : "✗"} ${r.task.name} (${secs} s)`);
	const lines = r.out.trimEnd().split("\n");
	// a passing task shows its last lines (the summary), a failing one everything
	console.log((r.ok ? lines.slice(-6) : lines).join("\n"));
}

const first: Task[] = [
	{ name: "lint", cmd: ["bun", "run", "lint"] },
	{ name: "ui:audit", cmd: ["bun", "run", "ui:audit"] },
	// every language pack of `i18n-packs/` valid, as the app checks a pack when it loads it
	{ name: "i18n:status", cmd: ["bun", "run", "i18n:status"] },
	{ name: "test", cmd: ["bun", "run", "test"] },
	// the type check and the build both regenerate `.svelte-kit`: one after the other
	{
		name: "check + build",
		cmd: ["sh", "-c", "bun run check && bun run build && bun run scripts/check-build.ts"],
	},
];
const results = await Promise.all(first.map(run));
results.forEach(report);
if (results.some((r) => !r.ok)) {
	console.error(`\nci: failed before the end-to-end tests (reports: ${writeIndex()})`);
	process.exit(1);
}

const e2e = await run({
	name: "test:e2e",
	cmd: ["bun", "run", "test:e2e"],
	env: { E2E_PREBUILT: "1" },
});
report(e2e);
const total = ((performance.now() - started) / 1000).toFixed(0);
console.log(`\nci: ${e2e.ok ? "green" : "failed"} in ${total} s (reports: ${writeIndex()})`);
process.exit(e2e.ok ? 0 : 1);
