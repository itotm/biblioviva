// SPDX-License-Identifier: GPL-3.0-or-later
// The servers of the shot runs: every pass (a language in a window) starts its own copy of the
// built application on a free port and a fresh folder, so the shots that change the data (a
// stocktaking left open, books lent and returned) find the seed as the first pass did, and two
// passes can run side by side without sharing a port or a database.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export interface RunningServer {
	base: string;
	dir: string;
	stop: () => void;
}

function freePort(): Promise<number> {
	return new Promise((resolvePort, reject) => {
		const srv = createServer();
		srv.listen(0, "127.0.0.1", () => {
			const address = srv.address();
			srv.close(() =>
				typeof address === "object" && address
					? resolvePort(address.port)
					: reject(new Error("no address")),
			);
		});
	});
}

/** A fresh folder for one server: removed again by `stop`. */
export function freshDir(label: string): string {
	return mkdtempSync(join(tmpdir(), `bv-docs-${label}-`));
}

/**
 * Starts `bun ./build` on a free port with the given environment on top of the process's own and
 * waits for `/healthz`. The folders are `<dir>/{data,backups,config}`.
 */
export async function startServer(
	dir: string,
	env: Record<string, string | undefined>,
): Promise<RunningServer> {
	const port = await freePort();
	const base = `http://127.0.0.1:${port}`;
	const server: ChildProcess = spawn("bun", ["./build"], {
		env: {
			...process.env,
			...env,
			PORT: String(port),
			HOST: "127.0.0.1",
			DATA_DIR: join(dir, "data"),
			BACKUP_DIR: join(dir, "backups"),
			CONFIG_DIR: join(dir, "config"),
		},
		stdio: "ignore",
	});
	const stop = (): void => {
		server.kill();
		rmSync(dir, { recursive: true, force: true });
	};
	for (let i = 0; i < 150; i++) {
		try {
			const res = await fetch(`${base}/healthz`, {
				headers: { "x-forwarded-proto": "http" },
			});
			if (res.ok) {
				return { base, dir, stop };
			}
		} catch {
			/* not ready yet */
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	stop();
	throw new Error("the shots server did not start");
}

/** The configuration and the deterministic demo data of the e2e setup, in a fresh folder. */
export function seedFolder(dir: string): void {
	mkdirSync(join(dir, "config"), { recursive: true });
	cpSync(resolve("tests/fixtures/e2e/config.json"), join(dir, "config", "config.json"));
	const out = execFileSync("bun", ["run", "scripts/seed.ts", "--if-empty"], {
		encoding: "utf8",
		env: {
			...process.env,
			DATA_DIR: join(dir, "data"),
			CONFIG_DIR: join(dir, "config"),
			DATABASE_PATH: join(dir, "data", "db", "biblioviva.db"),
		},
	});
	if (!/Seeded|Skipped/.test(out)) {
		throw new Error(`the seed said: ${out}`);
	}
}
