// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";
import { cpSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Playwright runs under Node (PLAN.md Q37). Chromium is the browser of every run; "mobile" is the
// same Chromium at a phone-sized viewport (Q77). `BV_BROWSER=firefox|webkit` runs the same suite on
// another engine (`bun run test:browsers` runs all three before 1.0, owner decision):
// projects `desktop-<engine>` and `mobile-<engine>`, no visual comparison (the baselines are
// Chromium's), reports beside Chromium's. `BV_PW_WS` connects to a browser served elsewhere (WebKit
// in Playwright's container on a host it does not support). The app under test boots on a fresh temporary
// DATA_DIR (seeded by the server on first run, step 1.2) so specs never touch real data.
// One run directory per test run, shared by the runner and its worker processes through the
// environment (this file is evaluated in every worker).
process.env.BV_E2E_RUN_DIR ??= mkdtempSync(join(tmpdir(), "biblioviva-e2e-"));
const runDir = process.env.BV_E2E_RUN_DIR;
mkdirSync(join(runDir, "config"), { recursive: true });
// Copied once by the runner: workers evaluate this file too and must not race on the same file.
const fixtureConfig = join(runDir, "config", "config.json");
if (!existsSync(fixtureConfig)) {
	cpSync(resolve("tests/fixtures/e2e/config.json"), fixtureConfig);
}
export const STORAGE_STATE = join(runDir, "storage-state.json");
const fixtureVideo = resolve("tests/fixtures/video/barcodes.mjpeg");
const chromiumArgs = [
	"--use-fake-device-for-media-stream",
	"--use-fake-ui-for-media-stream",
	...(existsSync(fixtureVideo) ? [`--use-file-for-fake-video-capture=${fixtureVideo}`] : []),
];
const ENGINES = ["chromium", "firefox", "webkit"] as const;
type Engine = (typeof ENGINES)[number];
const engine: Engine = ENGINES.find((e) => e === process.env.BV_BROWSER) ?? "chromium";
const device = {
	chromium: devices["Desktop Chrome"],
	firefox: devices["Desktop Firefox"],
	webkit: devices["Desktop Safari"],
}[engine];
/** A camera without asking: Chromium plays the fixture video, Firefox shows its own test pattern. */
const engineLaunch = {
	chromium: { args: chromiumArgs },
	firefox: {
		firefoxUserPrefs: {
			"media.navigator.streams.fake": true,
			"media.navigator.permission.disabled": true,
		},
	},
	webkit: {},
}[engine];
const remote = process.env.BV_PW_WS ? { connectOptions: { wsEndpoint: process.env.BV_PW_WS } } : {};
// `bun run test:browsers` runs an engine in several steps, each with its report (`BV_REPORT_TAG`)
const reportTag = [engine === "chromium" ? "" : engine, process.env.BV_REPORT_TAG ?? ""]
	.filter(Boolean)
	.join("-");
const reports = reportTag ? `test-reports/playwright-${reportTag}` : "test-reports/playwright";

export default defineConfig({
	testDir: "tests/e2e",
	testMatch: ["**/*.spec.ts", "**/*.setup.ts"],
	fullyParallel: false,
	retries: process.env.CI ? 1 : 0,
	// GitHub's runners have little memory: one worker there; locally the default (half the cores)
	...(process.env.CI ? { workers: 1 } : {}),
	// the print baselines depend on the fonts of the machine that made them: a
	// runner with other fonts cannot match them, so GitHub skips the visual comparisons
	ignoreSnapshots: process.env.GITHUB_ACTIONS === "true" || engine !== "chromium",
	// the long desk and print flows run next to every other spec (two projects in parallel): the
	// default 30 s is too tight on a busy machine
	timeout: 60_000,
	// HTML report under test-reports/ (ADR-021), linked with the unit test reports by `bun run ci`
	reporter: [
		["list"],
		["html", { open: "never", outputFolder: reports }],
		["json", { outputFile: `${reports}-results.json` }],
	],
	snapshotPathTemplate: "tests/snapshots/{projectName}/{testFilePath}/{arg}{ext}",
	expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
	webServer: {
		// `bun run ci` builds once beforehand, next to the other checks (E2E_PREBUILT=1)
		command: process.env.E2E_PREBUILT ? "bun ./build" : "bun run build && bun ./build",
		env: {
			DEV_UI: "1",
			ALLOW_LANG_OVERRIDE: "1",
			PORT: "3000",
			// adapter-bun derives the origin from the proxy headers (production: Tailscale serve);
			// the test server is plain http, so the browser sends the header itself (see `use`).
			PROTOCOL_HEADER: "x-forwarded-proto",
			// as behind the Tailscale sidecar (step 8.4): the client address comes from the proxy
			ADDRESS_HEADER: "x-forwarded-for",
			XFF_DEPTH: "1",
			// the basic local-network mode (step 8.8) in front of the same server: lan.spec.ts
			LAN_PORT: "3001",
			DATA_DIR: join(runDir, "data"),
			BACKUP_DIR: join(runDir, "backups"),
			CONFIG_DIR: join(runDir, "config"),
			METADATA_PROVIDER: "mock",
			// the list of language packs (9.39) is read from the release on GitHub: the tests
			// never go out, a closed local port answers "unavailable" at once
			LANGUAGE_PACKS_BASE_URL: "http://127.0.0.1:9",
			BODY_SIZE_LIMIT: "16M",
		},
		port: 3000,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
	},
	use: {
		baseURL: "http://localhost:3000",
		// what tailscaled adds in production (the scheme is http here, see PROTOCOL_HEADER)
		extraHTTPHeaders: { "x-forwarded-proto": "http", "x-forwarded-for": "100.101.102.103" },
		locale: "it-IT",
		timezoneId: "Europe/Rome",
		trace: "on-first-retry",
		video: "on-first-retry",
		...remote,
		launchOptions: {
			...engineLaunch,
			// fixed fonts and rendering (tests/fixtures/fontconfig): the desktop's own font settings
			// must not change the print baselines
			env: {
				...process.env,
				FONTCONFIG_FILE: resolve("tests/fixtures/fontconfig/fonts.conf"),
			},
		},
		// the service worker (step 9.9) is tested on its own in pwa.spec.ts; elsewhere every
		// request goes to the server as the tests expect
		serviceWorkers: "block",
	},
	projects: [
		{ name: "setup", testMatch: /auth\.setup\.ts/ },
		{
			name: `desktop-${engine}`,
			testMatch: "**/*.spec.ts",
			testIgnore: "**/*.final.spec.ts",
			dependencies: ["setup"],
			use: {
				...device,
				viewport: { width: 1280, height: 800 },
				storageState: STORAGE_STATE,
			},
		},
		{
			name: `mobile-${engine}`,
			testMatch: "**/*.spec.ts",
			testIgnore: "**/*.final.spec.ts",
			// Firefox has no mobile mode (`isMobile`): `bun run test:browsers` runs its desktop project only
			dependencies: ["setup"],
			use: {
				...device,
				viewport: { width: 412, height: 915 },
				deviceScaleFactor: 2,
				...(engine === "firefox" ? {} : { isMobile: true }),
				hasTouch: true,
				storageState: STORAGE_STATE,
			},
		},
		// flows that change every patron of the shared test database (the class upgrade) run
		// last, once, after both projects are done
		{
			name: "final",
			testMatch: "**/*.final.spec.ts",
			// one file at a time: the backup restore and the stocktaking close touch the same tables
			workers: 1,
			dependencies: [`desktop-${engine}`, `mobile-${engine}`],
			use: {
				...device,
				viewport: { width: 1280, height: 800 },
				storageState: STORAGE_STATE,
			},
		},
	],
});
