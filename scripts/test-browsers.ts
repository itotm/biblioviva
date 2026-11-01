// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run test:browsers [chromium] [firefox] [webkit]` — the browser tests on every engine
// (owner decision, to be run before 1.0): for each engine, the component tests of the
// `client` Vitest project and the whole Playwright suite on a fresh server and database of its own,
// one engine after the other. The everyday runs (`bun run ci`, `test:e2e`) stay on Chromium.
// WebKit needs Ubuntu's libraries: on a host without them (Fedora, …) its browser runs in
// Playwright's own container image (podman or docker, network of the host) and the tests connect
// to it (`BV_PW_WS`); `BV_PW_WS` set by hand points at a browser served elsewhere.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENGINES = ["chromium", "firefox", "webkit"] as const;
type Engine = (typeof ENGINES)[number];
const asked = process.argv
	.slice(2)
	.filter((a): a is Engine => (ENGINES as readonly string[]).includes(a));
const engines: readonly Engine[] = asked.length > 0 ? asked : ENGINES;
const PORT = 3335;
const CONTAINER = "biblioviva-webkit";

async function run(cmd: string[], env: Record<string, string | undefined> = {}): Promise<number> {
	const merged: Record<string, string> = {};
	for (const [k, v] of Object.entries({ ...process.env, ...env })) {
		if (v !== undefined) {
			merged[k] = v;
		}
	}
	const proc = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit", env: merged });
	return proc.exited;
}

/** True when this host can start the engine's own browser. */
async function launches(engine: Engine): Promise<boolean> {
	const script = `require("@playwright/test").${engine}.launch().then(b => b.close()).then(() => process.exit(0), () => process.exit(1))`;
	return (await run(["node", "-e", script], { DEBUG: undefined })) === 0;
}

function containerTool(): string | null {
	for (const tool of ["podman", "docker"]) {
		if (Bun.which(tool)) {
			return tool;
		}
	}
	return null;
}

/** Playwright's server in its container image, on the host's network; resolves its endpoint. */
async function startContainer(tool: string): Promise<string> {
	const version = (
		JSON.parse(
			readFileSync(join("node_modules", "@playwright", "test", "package.json"), "utf8"),
		) as {
			version: string;
		}
	).version;
	await run([tool, "rm", "-f", CONTAINER]);
	const code = await run([
		tool,
		"run",
		"-d",
		"--rm",
		"--init",
		"--network",
		"host",
		"--name",
		CONTAINER,
		"--user",
		"pwuser",
		"--workdir",
		"/home/pwuser",
		`mcr.microsoft.com/playwright:v${version}-noble`,
		"/bin/sh",
		"-c",
		`npx -y playwright@${version} run-server --port ${PORT} --host 127.0.0.1`,
	]);
	if (code !== 0) {
		throw new Error(`${tool} could not start Playwright's container`);
	}
	// the first start downloads the package: wait for the server to answer
	for (let i = 0; i < 300; i++) {
		try {
			await fetch(`http://127.0.0.1:${PORT}/`);
			return `ws://127.0.0.1:${PORT}/`;
		} catch {
			await Bun.sleep(1000);
		}
	}
	throw new Error("Playwright's server in the container did not answer");
}

interface Outcome {
	engine: Engine;
	unit: number;
	e2e: number;
	summary: string;
}

/**
 * The steps of an engine's end-to-end run, on one server folder: the desktop and phone projects,
 * then the `final` flows whatever they gave (`--no-deps`). Firefox runs its desktop project only:
 * it has no mobile mode (`isMobile`), and the specs take their phone branches from it (in a
 * full run, 20 of its phone failures came from that, none from the app).
 */
function e2eSteps(engine: Engine): { tag: string; args: string[] }[] {
	const projects =
		engine === "firefox"
			? ["--project", "desktop-firefox"]
			: ["--project", `desktop-${engine}`, "--project", `mobile-${engine}`];
	return [
		{ tag: "main", args: projects },
		{ tag: "final", args: ["--project", "final", "--no-deps"] },
	];
}

/** Passed, failed, flaky and skipped tests of an engine's steps (their JSON reports). */
function e2eSummary(engine: Engine): string {
	const total = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
	for (const step of e2eSteps(engine)) {
		const tag = [engine === "chromium" ? "" : engine, step.tag].filter(Boolean).join("-");
		try {
			const stats = (
				JSON.parse(readFileSync(`test-reports/playwright-${tag}-results.json`, "utf8")) as {
					stats: typeof total;
				}
			).stats;
			for (const key of Object.keys(total) as (keyof typeof total)[]) {
				total[key] += stats[key];
			}
		} catch {
			// a step without a report counts nothing
		}
	}
	return `${total.expected} passed, ${total.unexpected} failed, ${total.flaky} flaky, ${total.skipped} skipped`;
}

if (!process.env.E2E_PREBUILT && (await run(["bun", "run", "build"])) !== 0) {
	process.exit(1);
}
const outcomes: Outcome[] = [];
let container = false;
try {
	for (const engine of engines) {
		const env: Record<string, string | undefined> = {
			BV_BROWSER: engine,
			E2E_PREBUILT: "1",
			// every engine gets a fresh server folder and database, shared by its steps
			BV_E2E_RUN_DIR: mkdtempSync(join(tmpdir(), `biblioviva-e2e-${engine}-`)),
		};
		if (engine === "webkit" && !process.env.BV_PW_WS && !(await launches("webkit"))) {
			const tool = containerTool();
			if (!tool) {
				console.error("webkit: this host cannot run it and has neither podman nor docker");
				outcomes.push({ engine, unit: 1, e2e: 1, summary: "not run" });
				continue;
			}
			console.log(`webkit: the browser runs in Playwright's container (${tool})`);
			env.BV_PW_WS = await startContainer(tool);
			container = true;
		}
		console.log(`\n=== ${engine}: component tests ===`);
		const unit = await run(
			["bun", "--bun", "vitest", "run", "--project", "client", "--reporter=default"],
			env,
		);
		console.log(`\n=== ${engine}: end-to-end tests ===`);
		let e2e = 0;
		for (const step of e2eSteps(engine)) {
			// every step runs, whatever the previous ones gave
			const code = await run(["bunx", "playwright", "test", ...step.args], {
				...env,
				BV_REPORT_TAG: step.tag,
			});
			e2e ||= code;
		}
		outcomes.push({ engine, unit, e2e, summary: e2eSummary(engine) });
	}
} finally {
	if (container) {
		await run([containerTool() ?? "podman", "rm", "-f", CONTAINER]);
	}
}

console.log("\ntest:browsers");
for (const o of outcomes) {
	console.log(
		`  ${o.engine.padEnd(9)} components ${o.unit === 0 ? "ok" : "FAILED"} · end-to-end ${o.e2e === 0 ? "ok" : "FAILED"} (${o.summary})`,
	);
}
process.exit(outcomes.every((o) => o.unit === 0 && o.e2e === 0) ? 0 : 1);
