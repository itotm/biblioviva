// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-bun";
import { sveltekit } from "@sveltejs/kit/vite";

/**
 * The engine of the browser tests: Chromium, or the one `bun run test:browsers` asks for
 * (`BV_BROWSER=firefox|webkit`, owner decision).
 */
const browserEngine =
	(["firefox", "webkit"] as const).find((e) => e === process.env.BV_BROWSER) ?? "chromium";

export default defineConfig({
	// no source maps for the server bundle (ADR-020): they would map to the intermediate
	// .svelte-kit output, not to src/, and the bundle is not minified, so a stack trace already
	// points to readable code that exists in the container (SvelteKit turns them on unless told)
	build: { sourcemap: false },
	// the time of the build: the public demo shows it as its version (`#lib/shared/version.ts`)
	define: { __BUILT_AT__: JSON.stringify(new Date().toISOString()) },
	plugins: [
		tailwindcss(),
		// a self-contained server bundle (ADR-020): adapter-bun 1.0 leaves the packages under
		// `dependencies` external, but the image has no node_modules, so every package is bundled;
		// a build-only plugin that runs before the adapter's, which reads `ssr.noExternal`
		{
			name: "biblioviva:bundle-server-dependencies",
			apply: "build",
			config: () => ({ ssr: { noExternal: [/./] } }),
		},
		sveltekit({
			compilerOptions: {
				// Runes mode for project files only; third-party components may still be legacy.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
				experimental: { async: true },
			},
			adapter: adapter({ precompress: true }),
			// The app is served at the root: `resolve()` returns absolute paths ("/patrons/7"), in
			// server-rendered pages too, instead of paths relative to the current page.
			paths: { relative: false },
			experimental: { remoteFunctions: true },
			// only small route style sheets travel inside the page (today the 55 bytes of
			// Table.svelte): the limit is each CSS file's raw length, so the app's style sheet
			// (~290 KB raw, 21 KB brotli) stays a linked file, on purpose: cached for a year
			// (`immutable`) and, over HTTPS, precached by the service worker, instead of adding
			// ~30 KB to every page (step 9.2)
			inlineStyleThreshold: 32_768,
			// Same-origin only: the public origin comes from the proxy headers at runtime (ADR-007).
			csrf: { trustedOrigins: [] },
			// Content Security Policy (PLAN.md §3.15, step 9.1): everything from this origin; scripts with
			// SvelteKit's nonce, WebAssembly for the barcode reader and OpenCV, and `unsafe-eval` because
			// the official OpenCV.js build compiles its bindings with `new Function` (ADR-016); inline
			// styles (Svelte style attributes, the printed previews in sandboxed frames); images as data
			// URLs (previews, barcodes) and blobs (camera captures); nothing may frame the app.
			csp: {
				mode: "auto",
				directives: {
					"default-src": ["self"],
					"script-src": ["self", "wasm-unsafe-eval", "unsafe-eval"],
					"style-src": ["self", "unsafe-inline"],
					"img-src": ["self", "data:", "blob:"],
					"font-src": ["self", "data:"],
					// no data: on purpose: OpenCV.js first tries fetch() on the wasm embedded in its file
					// as a data: URL; blocked (one console violation), it decodes the base64 itself,
					// which Chromium does faster than fetch(data:) (ADR-022)
					"connect-src": ["self"],
					"media-src": ["self", "blob:"],
					"worker-src": ["self", "blob:"],
					"frame-src": ["self"],
					"object-src": ["none"],
					"base-uri": ["self"],
					"form-action": ["self"],
					"frame-ancestors": ["self"],
				},
			},
		}),
	],
	test: {
		expect: { requireAssertions: true },
		// HTML reports under test-reports/ (ADR-021): `bun run ci` links them from one index page
		reporters: [
			"default",
			// one self-contained file: it opens from disk, with no server
			["html", { outputDir: "test-reports/vitest", singleFile: true }],
			["json", { outputFile: "test-reports/vitest-results.json" }],
		],
		// Unit tests run under the Bun runtime (`bun --bun vitest`) so `bun:sqlite` is available (ADR-005).
		coverage: {
			provider: "v8",
			include: ["src/lib/server/**", "src/lib/shared/**"],
			exclude: [
				"**/*.test.ts",
				"**/*.d.ts",
				"src/lib/server/db/seed.ts",
				"src/lib/server/db/schema.ts", // declarative; exercised by every db test through the migrations
				"src/lib/server/startup.ts", // the start of the server (the `init` hook): every end-to-end run
			],
			reporter: ["text-summary", "html", "json-summary"],
			// inside the Vitest report, whose Coverage tab shows it (no second copy)
			reportsDirectory: "test-reports/vitest/coverage",
			thresholds: { lines: 95 },
		},
		projects: [
			{
				extends: "./vite.config.ts",
				test: {
					name: "client",
					browser: {
						enabled: true,
						provider: playwright({
							// fake camera for the CameraCapture / scanner component tests
							launchOptions:
								browserEngine === "firefox"
									? {
											firefoxUserPrefs: {
												"media.navigator.streams.fake": true,
												"media.navigator.permission.disabled": true,
											},
										}
									: browserEngine === "chromium"
										? {
												args: [
													"--use-fake-ui-for-media-stream",
													"--use-fake-device-for-media-stream",
												],
											}
										: {},
							// WebKit in Playwright's container on a host it does not support
							...(process.env.BV_PW_WS
								? { connectOptions: { wsEndpoint: process.env.BV_PW_WS } }
								: {}),
						}),
						instances: [{ browser: browserEngine, headless: true }],
					},
					include: [
						"src/**/*.svelte.{test,spec}.{js,ts}",
						"src/**/*.browser.{test,spec}.{js,ts}",
					],
					exclude: ["src/lib/server/**"],
				},
			},
			{
				extends: "./vite.config.ts",
				test: {
					name: "server",
					environment: "node",
					include: [
						"src/lib/server/**/*.{test,spec}.ts",
						"src/lib/shared/**/*.{test,spec}.ts",
						"src/lib/i18n/**/*.{test,spec}.ts",
						"src/lib/remote/**/*.{test,spec}.ts",
						"src/lib/admin/**/*.{test,spec}.ts",
						"src/lib/ui/**/*.{test,spec}.ts",
						"src/lib/vision/**/*.test.ts",
						"src/lib/scanner/**/*.test.ts",
						"tests/*.test.ts",
						"scripts/**/*.{test,spec}.ts",
					],
					// component and browser tests run in the client project
					exclude: [
						"**/node_modules/**",
						"src/**/*.svelte.{test,spec}.{js,ts}",
						"src/**/*.browser.{test,spec}.{js,ts}",
					],
					setupFiles: ["tests/helpers/setup.ts"],
				},
			},
		],
	},
});
