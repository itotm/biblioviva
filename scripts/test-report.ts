// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run test:report`: one page, `test-reports/index.html`, that sums up the last test runs and
// links their HTML reports (ADR-021): Vitest (with the coverage in its Coverage tab, also linked
// on its own) and Playwright. `bun run ci` writes it at the end, pass or fail. Every report is a
// self-contained file and opens from disk.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const REPORTS_DIR = "test-reports";
/** The line coverage gate of `vite.config.ts` (PLAN.md §7). */
export const LINE_TARGET = 95;

export interface Counts {
	passed: number;
	failed: number;
	skipped: number;
	flaky: number;
}

export interface SuiteSummary {
	title: string;
	/** Report page relative to `test-reports/`, null when it was not produced. */
	href: string | null;
	finishedAt: string | null;
	total: Counts;
	/** Counts per group: Vitest project, Playwright project. */
	groups: Record<string, Counts>;
}

export interface CoverageFile {
	file: string;
	pct: number;
	uncovered: number;
}

export interface CoverageSummary {
	href: string | null;
	lines: number;
	branches: number;
	functions: number;
	/** Files under the line target, most uncovered lines first. */
	below: CoverageFile[];
}

const zero = (): Counts => ({ passed: 0, failed: 0, skipped: 0, flaky: 0 });

function add(
	total: Counts,
	groups: Record<string, Counts>,
	group: string,
	key: keyof Counts,
): void {
	total[key] += 1;
	const counts = groups[group] ?? zero();
	counts[key] += 1;
	groups[group] = counts;
}

interface VitestJson {
	startTime?: number;
	testResults?: {
		name: string;
		endTime?: number;
		assertionResults?: { status: string }[];
	}[];
}

/** Vitest's JSON reporter: component tests (`*.svelte.test.ts`, `*.browser.test.ts`) apart. */
export function summarizeVitest(json: VitestJson, href: string | null): SuiteSummary {
	const total = zero();
	const groups: Record<string, Counts> = {};
	let finished = 0;
	for (const file of json.testResults ?? []) {
		const group = /\.(svelte|browser)\.(test|spec)\.ts$/.test(file.name)
			? "client (browser)"
			: "server";
		groups[group] ??= zero();
		finished = Math.max(finished, file.endTime ?? 0);
		for (const test of file.assertionResults ?? []) {
			const key: keyof Counts =
				test.status === "passed"
					? "passed"
					: test.status === "failed"
						? "failed"
						: "skipped";
			add(total, groups, group, key);
		}
	}
	return {
		title: "Unit and component tests (Vitest)",
		href,
		finishedAt: finished > 0 ? new Date(finished).toISOString() : null,
		total,
		groups,
	};
}

interface PlaywrightSuite {
	suites?: PlaywrightSuite[];
	specs?: { tests?: { projectName: string; status: string }[] }[];
}

interface PlaywrightJson {
	stats?: { startTime?: string; duration?: number };
	suites?: PlaywrightSuite[];
}

/** Playwright's JSON reporter, one group per project. */
export function summarizePlaywright(json: PlaywrightJson, href: string | null): SuiteSummary {
	const total = zero();
	const groups: Record<string, Counts> = {};
	const walk = (suite: PlaywrightSuite): void => {
		for (const spec of suite.specs ?? []) {
			for (const test of spec.tests ?? []) {
				const key: keyof Counts =
					test.status === "expected"
						? "passed"
						: test.status === "unexpected"
							? "failed"
							: test.status === "flaky"
								? "flaky"
								: "skipped";
				add(total, groups, test.projectName, key);
			}
		}
		suite.suites?.forEach(walk);
	};
	json.suites?.forEach(walk);
	const start = json.stats?.startTime ? Date.parse(json.stats.startTime) : NaN;
	return {
		title: "End-to-end tests (Playwright)",
		href,
		finishedAt: Number.isNaN(start)
			? null
			: new Date(start + (json.stats?.duration ?? 0)).toISOString(),
		total,
		groups,
	};
}

interface CoverageMetric {
	total: number;
	covered: number;
	pct: number;
}

interface CoverageFileJson {
	lines: CoverageMetric;
	branches: CoverageMetric;
	functions: CoverageMetric;
}

type CoverageJson = Record<string, CoverageFileJson>;

/** Istanbul's `json-summary`: the totals and the files under the line target. */
export function summarizeCoverage(
	json: CoverageJson,
	href: string | null,
	root: string,
): CoverageSummary {
	const below = Object.entries(json)
		// files with no executable lines (types only) report 0 %: nothing to cover
		.filter(([file, m]) => file !== "total" && m.lines.total > 0 && m.lines.pct < LINE_TARGET)
		.map(([file, m]) => ({
			file: file.startsWith(root) ? file.slice(root.length).replace(/^\//, "") : file,
			pct: m.lines.pct,
			uncovered: m.lines.total - m.lines.covered,
		}))
		.sort((a, b) => b.uncovered - a.uncovered || a.file.localeCompare(b.file));
	return {
		href,
		lines: json.total?.lines.pct ?? 0,
		branches: json.total?.branches.pct ?? 0,
		functions: json.total?.functions.pct ?? 0,
		below,
	};
}

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escape = (s: string): string => s.replace(/[&<>"]/g, (c) => ENTITIES[c] ?? c);

function countsCells(c: Counts): string {
	return [
		`<td class="num">${c.passed + c.failed + c.flaky + c.skipped}</td>`,
		`<td class="num ok">${c.passed}</td>`,
		`<td class="num ${c.failed > 0 ? "bad" : ""}">${c.failed}</td>`,
		`<td class="num ${c.flaky > 0 ? "warn" : ""}">${c.flaky}</td>`,
		`<td class="num">${c.skipped}</td>`,
	].join("");
}

function suiteSection(s: SuiteSummary | null, title: string): string {
	if (!s) {
		return `<section><h2>${escape(title)}</h2><p class="muted">No results: the suite has not run yet.</p></section>`;
	}
	const status =
		s.total.failed > 0
			? `<span class="badge bad">✗ ${s.total.failed} failed</span>`
			: `<span class="badge ok">✓ passed</span>`;
	const rows = Object.entries(s.groups)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, c]) => `<tr><th scope="row">${escape(name)}</th>${countsCells(c)}</tr>`)
		.join("");
	return `<section>
<h2>${escape(s.title)} ${status}</h2>
<p class="muted">${s.finishedAt ? `Finished ${escape(s.finishedAt.replace("T", " ").slice(0, 19))} UTC. ` : ""}${s.href ? `<a href="${escape(s.href)}">Open the full report →</a>` : "No HTML report."}</p>
<table>
<thead><tr><th></th><th>Tests</th><th>Passed</th><th>Failed</th><th>Flaky</th><th>Skipped</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><th scope="row">Total</th>${countsCells(s.total)}</tr></tfoot>
</table>
</section>`;
}

function coverageSection(c: CoverageSummary | null): string {
	if (!c) {
		return `<section><h2>Coverage</h2><p class="muted">No coverage summary: run <code>bun run test</code>.</p></section>`;
	}
	const gate = c.lines >= LINE_TARGET ? "ok" : "bad";
	const below =
		c.below.length === 0
			? `<p>Every file reaches ${LINE_TARGET} % of lines.</p>`
			: `<table><thead><tr><th>File under ${LINE_TARGET} % of lines</th><th>Lines</th><th>Uncovered</th></tr></thead><tbody>${c.below
					.map(
						(f) =>
							`<tr><td><code>${escape(f.file)}</code></td><td class="num">${f.pct.toFixed(1)} %</td><td class="num">${f.uncovered}</td></tr>`,
					)
					.join("")}</tbody></table>`;
	return `<section>
<h2>Coverage (services and shared code) <span class="badge ${gate}">${c.lines.toFixed(2)} % of lines</span></h2>
<p class="muted">Gate: ${LINE_TARGET} % of lines. Branches ${c.branches.toFixed(2)} %, functions ${c.functions.toFixed(2)} %. ${c.href ? `<a href="${escape(c.href)}">Open the coverage report →</a>` : ""}</p>
${below}
</section>`;
}

export function renderIndex(
	vitest: SuiteSummary | null,
	playwright: SuiteSummary | null,
	coverage: CoverageSummary | null,
	generatedAt: Date,
): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BiblioViva tests</title>
<style>
:root { --ok: #15803d; --bad: #b91c1c; --warn: #b45309; --muted: #57534e; --line: #e7e5e4; }
body { margin: 0; padding: 24px 16px; background: #fafaf9; color: #1c1917; font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 960px; margin: 0 auto; }
h1 { font-size: 1.6rem; margin: 0 0 4px; }
h2 { font-size: 1.15rem; margin: 0 0 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
section { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 16px; margin-top: 16px; overflow-x: auto; }
table { border-collapse: collapse; width: 100%; margin-top: 8px; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--line); }
thead th { font-size: .85rem; color: var(--muted); font-weight: 600; }
tfoot th, tfoot td { font-weight: 700; border-bottom: 0; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.ok { color: var(--ok); } .bad { color: var(--bad); } .warn { color: var(--warn); }
.muted { color: var(--muted); margin: 0; }
.badge { font-size: .85rem; font-weight: 600; padding: 2px 10px; border-radius: 999px; border: 1px solid currentColor; }
a { color: #1d4ed8; }
code { font-size: .9em; }
</style>
</head>
<body>
<main>
<h1>BiblioViva tests</h1>
<p class="muted">Page written ${escape(generatedAt.toISOString().replace("T", " ").slice(0, 19))} UTC from the last runs of <code>bun run test</code> and <code>bun run test:e2e</code>.</p>
${suiteSection(vitest, "Unit and component tests (Vitest)")}
${suiteSection(playwright, "End-to-end tests (Playwright)")}
${coverageSection(coverage)}
</main>
</body>
</html>
`;
}

function readJson<T>(path: string): T | null {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return null;
	}
}

/** Writes `test-reports/index.html` from whatever the last runs left; returns its path. */
export function writeIndex(dir = REPORTS_DIR, root = process.cwd()): string {
	const link = (page: string): string | null => (existsSync(join(dir, page)) ? page : null);
	const vitest = readJson<VitestJson>(join(dir, "vitest-results.json"));
	const playwright = readJson<PlaywrightJson>(join(dir, "playwright-results.json"));
	const coverage = readJson<CoverageJson>(
		join(dir, "vitest", "coverage", "coverage-summary.json"),
	);
	const html = renderIndex(
		vitest && summarizeVitest(vitest, link("vitest/index.html")),
		playwright && summarizePlaywright(playwright, link("playwright/index.html")),
		coverage && summarizeCoverage(coverage, link("vitest/coverage/index.html"), root),
		new Date(),
	);
	const path = join(dir, "index.html");
	writeFileSync(path, html);
	return path;
}

if (import.meta.main) {
	if (!existsSync(REPORTS_DIR)) {
		console.error(
			`No ${REPORTS_DIR}/ yet: run bun run test, bun run test:e2e or bun run ci first.`,
		);
		process.exit(1);
	}
	console.log(`Test reports: ${join(process.cwd(), writeIndex())}`);
}
