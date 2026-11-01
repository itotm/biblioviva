// SPDX-License-Identifier: GPL-3.0-or-later
// The pictures of the first-run wizard (docs/shots.ts, `wizard: true`): they need a server without
// configuration, so this spec starts its own on a fresh folder, as tests/e2e/setup-wizard.spec.ts
// does, and walks the steps in order.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PNG_DIR, SHOTS } from "../../docs/shots.js";
import { waitForHydration } from "../e2e/helpers/hydration.js";

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const srv = createServer();
		srv.listen(0, "127.0.0.1", () => {
			const address = srv.address();
			srv.close(() =>
				typeof address === "object" && address
					? resolve(address.port)
					: reject(new Error("no address")),
			);
		});
	});
}

async function startServer(dir: string): Promise<{ server: ChildProcess; base: string }> {
	const port = await freePort();
	const base = `http://127.0.0.1:${port}`;
	const server = spawn("bun", ["./build"], {
		env: {
			...process.env,
			PORT: String(port),
			HOST: "127.0.0.1",
			PROTOCOL_HEADER: "x-forwarded-proto",
			DATA_DIR: join(dir, "data"),
			BACKUP_DIR: join(dir, "backups"),
			CONFIG_DIR: join(dir, "config"),
			METADATA_PROVIDER: "mock",
			DEMO: "",
			ALLOW_LANG_OVERRIDE: "",
			DEV_UI: "",
		},
		stdio: "ignore",
	});
	for (let i = 0; i < 100; i++) {
		try {
			const res = await fetch(`${base}/healthz`, {
				headers: { "x-forwarded-proto": "http" },
			});
			if (res.ok) {
				return { server, base };
			}
		} catch {
			/* not ready yet */
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	server.kill();
	throw new Error("wizard server did not start");
}

let server: ChildProcess | undefined;
let dir = "";
let base = "";

test.describe.serial("wizard pictures", () => {
	test.beforeAll(async () => {
		dir = mkdtempSync(join(tmpdir(), "bv-docs-wizard-"));
		({ server, base } = await startServer(dir));
	});
	test.afterAll(() => {
		server?.kill();
		rmSync(dir, { recursive: true, force: true });
	});

	test("every step of the wizard", async ({ page }) => {
		test.setTimeout(240_000);
		await page.goto(`${base}/`);
		await expect(page).toHaveURL(/\/setup/);
		await waitForHydration(page);
		const failures: string[] = [];
		for (const shot of SHOTS.filter((s) => s.wizard)) {
			try {
				await shot.steps?.(page);
				await page.evaluate(() => document.fonts.ready);
				await page.waitForTimeout(250);
				const file = join(PNG_DIR, "it", `${shot.name}.png`);
				mkdirSync(join(file, ".."), { recursive: true });
				await page.screenshot({ path: file, animations: "disabled", caret: "hide" });
			} catch (error) {
				failures.push(`${shot.name}: ${String(error).split("\n")[0]}`);
			}
		}
		expect(failures).toEqual([]);
	});
});
