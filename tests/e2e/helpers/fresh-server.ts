// SPDX-License-Identifier: GPL-3.0-or-later
// A built server of its own on fresh folders (no configuration yet): the first-run wizard runs
// once per installation, so the specs that go through it start their own.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";

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

/** Starts `bun ./build` on the folders of `dir` and waits until it answers; returns it and its address. */
export async function startFreshServer(
	dir: string,
	extraEnv: Record<string, string> = {},
): Promise<{ server: ChildProcess; base: string }> {
	const port = await freePort();
	const url = `http://127.0.0.1:${port}`;
	const child = spawn("bun", ["./build"], {
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
			// the size of a library's archive, as the container allows (docker/Dockerfile)
			BODY_SIZE_LIMIT: "32M",
			...extraEnv,
		},
		stdio: "ignore",
	});
	for (let i = 0; i < 100; i++) {
		try {
			const res = await fetch(`${url}/healthz`, {
				headers: { "x-forwarded-proto": "http" },
			});
			if (res.ok) {
				return { server: child, base: url };
			}
		} catch {
			/* not ready yet */
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	child.kill();
	throw new Error("fresh server did not start");
}
