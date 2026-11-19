// SPDX-License-Identifier: GPL-3.0-or-later
// The fixtures of the shot runs (docs/shots.ts): the language and the window of a pass are options
// of its Playwright project; the server of a pass is started once for its worker (a fresh folder
// with the demo data), the shared accounts log in once, and every test opens its page on that
// server with the storage state of the shot's account.
import { join } from "node:path";
import { test as base } from "@playwright/test";
import type { ShotAccount } from "../../docs/shots.js";
import { ACCOUNTS } from "../../docs/shots.js";
import type { ShotLang, Window } from "../../docs/shot-windows.js";
import config from "../../playwright.config.js";
import { LoginPage } from "../e2e/pages/login.page.js";
import { freshDir, seedFolder, startServer } from "./server.js";

export interface ShotOptions {
	/** The language the interface is switched to (`?lang=`). */
	shotLang: ShotLang;
	/** The window of the project (its viewport and scale come from the project's `use`). */
	shotWindow: Window;
	/** The account of the shot's describe block. */
	shotAccount: ShotAccount;
}

/** The pass's server: where it listens and the storage state file of each shared account. */
export interface ShotServer {
	base: string;
	states: Record<string, string>;
}

export const optionsTest = base.extend<ShotOptions>({
	shotLang: ["it", { option: true }],
	shotWindow: ["computer", { option: true }],
	shotAccount: ["admin", { option: true }],
});

/** The environment the e2e web server runs with, minus its fixed ports and folders. */
function appEnv(): Record<string, string | undefined> {
	const web = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
	const { LAN_PORT: _lan, PORT: _port, ...env } = web?.env ?? {};
	return env;
}

export const test = optionsTest.extend<object, { shotServer: ShotServer }>({
	shotServer: [
		async ({ browser }, use) => {
			const dir = freshDir("shots");
			seedFolder(dir);
			const server = await startServer(dir, appEnv());
			const states: Record<string, string> = {};
			try {
				const context = await browser.newContext({
					baseURL: server.base,
					extraHTTPHeaders: config.use?.extraHTTPHeaders ?? {},
					locale: "it-IT",
				});
				for (const [account, password] of Object.entries(ACCOUNTS)) {
					const page = await context.newPage();
					const login = new LoginPage(page);
					await login.goto();
					await login.loginAs(account, password);
					await page.waitForURL((url) => !url.pathname.startsWith("/login"));
					states[account] = join(dir, `state-${account}.json`);
					await context.storageState({ path: states[account] });
					await context.clearCookies();
					await page.close();
				}
				await context.close();
				await use({ base: server.base, states });
			} finally {
				server.stop();
			}
		},
		{ scope: "worker", timeout: 300_000 },
	],
	baseURL: async ({ shotServer }, use) => {
		await use(shotServer.base);
	},
	storageState: async ({ shotServer, shotAccount }, use) => {
		await use(
			shotAccount === "anonymous"
				? { cookies: [], origins: [] }
				: (shotServer.states[shotAccount] ?? ""),
		);
	},
});
