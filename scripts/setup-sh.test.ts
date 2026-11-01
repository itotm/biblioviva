// SPDX-License-Identifier: GPL-3.0-or-later
// setup.sh (PLAN.md step 8.7) run by bash with stand-ins for docker, sudo, curl and the computer's
// commands on PATH: the folder it writes, the commands it runs and what it prints.
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("setup.sh");
const REPO = resolve(".");

/** Each stand-in appends its arguments to the log and answers as the real command would. */
const STUBS: Record<string, string> = {
	docker: `
echo "docker $*" >> "$STUB_LOG"
if [ "$STUB_NO_DOCKER" = 1 ]; then exit 127; fi
case "$*" in
	"compose version") exit 0 ;;
	*"tailscale status --json"*)
		if [ "$STUB_NO_CERT" = 1 ]; then echo '{ "Self": {} }'; else
		printf '{\\n  "Self": { "DNSName": "biblioviva.tail1234.ts.net." },\\n  "CertDomains": [\\n    "biblioviva.tail1234.ts.net"\\n  ]\\n}\\n'; fi ;;
esac
exit 0`,
	sudo: `
echo "sudo $*" >> "$STUB_LOG"
if [ "$1" = chown ] || [ "$1" = apt-get ] || [ "$1" = usermod ]; then exit 0; fi
exec "$@"`,
	curl: `
echo "curl $*" >> "$STUB_LOG"
case "$*" in
	*get.docker.com*) echo 'echo "docker installed" >> "$STUB_LOG"' ;;
esac
exit 0`,
	uname: `
case "$1" in -s) echo Linux ;; -m) echo "\${STUB_ARCH:-x86_64}" ;; *) echo Linux ;; esac`,
	hostname: `
if [ "$1" = -I ]; then echo "192.168.1.50 fd00::50"; else echo biblioviva; fi`,
	"avahi-daemon": "exit 0",
	sleep: "exit 0",
};

let root = "";
let home = "";
let log = "";

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "bv-setup-"));
	home = join(root, "home");
	log = join(root, "log");
	mkdirSync(home);
	const bin = join(root, "bin");
	mkdirSync(bin);
	for (const [name, body] of Object.entries(STUBS)) {
		writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
		chmodSync(join(bin, name), 0o755);
	}
	writeFileSync(join(root, "os-release"), 'ID=debian\nPRETTY_NAME="Debian GNU/Linux 13"\n');
	writeFileSync(join(root, "meminfo"), "MemTotal:        3906328 kB\n");
	writeFileSync(join(root, "model"), "Raspberry Pi 4 Model B Rev 1.5\0");
	writeFileSync(log, "");
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

/** Runs setup.sh with the answers typed on its "terminal" (a file, read line by line). */
function run(
	args: string[],
	answers: string | null = null,
	env: Record<string, string> = {},
): SpawnSyncReturns<string> & { log: string } {
	const input = join(root, "answers");
	if (answers !== null) {
		writeFileSync(input, answers);
	}
	const result = spawnSync("bash", [SCRIPT, ...args], {
		encoding: "utf8",
		input: "",
		env: {
			PATH: `${join(root, "bin")}:${process.env.PATH ?? "/usr/bin:/bin"}`,
			HOME: home,
			LANG: "C.UTF-8",
			STUB_LOG: log,
			BIBLIOVIVA_SOURCE: REPO,
			BIBLIOVIVA_INPUT: answers === null ? join(root, "no-terminal") : input,
			BIBLIOVIVA_OS_RELEASE: join(root, "os-release"),
			BIBLIOVIVA_MEMINFO: join(root, "meminfo"),
			BIBLIOVIVA_MODEL_FILE: join(root, "model"),
			...env,
		},
	});
	return { ...result, log: readFileSync(log, "utf8") };
}

const dir = (): string => join(home, "biblioviva");
const file = (name: string): string => readFileSync(join(dir(), name), "utf8");
const repoFile = (name: string): string => readFileSync(join(REPO, name), "utf8");

describe("setup.sh", () => {
	it("installs the local-network way from its options, without a terminal", () => {
		const r = run(["--lang", "en", "--network", "lan", "--profile", "medium"]);
		expect(r.stderr).toBe("");
		expect(r.status).toBe(0);
		expect(file("compose.yml")).toBe(repoFile("docker/compose.lan.yml"));
		expect(existsSync(join(dir(), "tailscale"))).toBe(false);
		const env = file(".env");
		expect(env).toMatch(/^BIBLIOVIVA_NETWORK=lan$/m);
		expect(env).toMatch(/^MEM_LIMIT=1g$/m);
		expect(env).toMatch(/^LAN_PORT=8080$/m);
		expect(env).toMatch(/^TS_AUTHKEY=$/m);
		expect(statSync(join(dir(), ".env")).mode & 0o777).toBe(0o600);
		expect(JSON.parse(file("config/performance.json"))).toEqual({ profile: "medium" });
		expect(existsSync(join(dir(), "backups"))).toBe(true);
		expect(r.log).toContain("docker compose pull");
		expect(r.log).toContain("docker compose up -d --remove-orphans");
		expect(r.log).toContain("curl -fsS http://127.0.0.1:8080/healthz");
		expect(r.stdout).toContain("http://biblioviva.local:8080");
		expect(r.stdout).toContain("http://192.168.1.50:8080");
	});

	it("installs the Tailscale way and prints the address of the node's certificate", () => {
		const r = run([
			"--lang",
			"en",
			"--network",
			"tailscale",
			"--profile",
			"small",
			"--key",
			"tskey-auth-k1",
		]);
		expect(r.status).toBe(0);
		expect(file("compose.yml")).toBe(repoFile("docker/compose.yml"));
		expect(file("tailscale/serve.json")).toBe(repoFile("docker/tailscale/serve.json"));
		expect(file(".env")).toMatch(/^TS_AUTHKEY=tskey-auth-k1$/m);
		expect(file(".env")).toMatch(/^MEM_LIMIT=512m$/m);
		expect(r.log).toContain(
			"docker compose exec -T tailscale wget -qO- http://127.0.0.1:3000/healthz",
		);
		expect(r.stdout).toContain("https://biblioviva.tail1234.ts.net");
	});

	it("asks the questions on the terminal, proposing the profile that fits the computer", () => {
		// local network, Enter on the profile: a Raspberry Pi is small
		const r = run(["--lang", "it"], "2\n\n");
		expect(r.status).toBe(0);
		expect(r.stderr).toContain("Come raggiungono BiblioViva");
		expect(r.stderr).toContain("Scelta [small, proposta per questo computer]");
		expect(file(".env")).toMatch(/^BIBLIOVIVA_NETWORK=lan$/m);
		expect(JSON.parse(file("config/performance.json"))).toEqual({ profile: "small" });
		expect(r.stdout).toContain("BiblioViva è pronto");
	});

	it("asks again after a wrong answer, and for a key that looks like Tailscale's", () => {
		const r = run(["--lang", "en", "--profile", "large"], "3\n1\nnot-a-key\ntskey-auth-k2\n");
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("Invalid answer.");
		expect(r.stdout).toContain("The Tailscale key must start with tskey-.");
		expect(file(".env")).toMatch(/^TS_AUTHKEY=tskey-auth-k2$/m);
	});

	it("names the option when a question has no terminal to be asked on", () => {
		const r = run(["--lang", "en", "--network", "tailscale", "--profile", "small"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("give --key <tskey-auth-…>");
		expect(existsSync(dir())).toBe(false);
	});

	it("updates an installation when run again, asking nothing and keeping its settings", () => {
		run(["--lang", "en", "--network", "lan", "--profile", "medium"]);
		writeFileSync(join(dir(), ".env"), file(".env").replace("LAN_PORT=8080", "LAN_PORT=8090"));
		writeFileSync(log, "");
		const r = run(["--lang", "en"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("already installed");
		expect(file(".env")).toMatch(/^LAN_PORT=8090$/m);
		expect(r.log).toContain("docker compose pull");
		expect(r.log).not.toContain("compose down");
		expect(r.stdout).toContain("http://biblioviva.local:8090");
	});

	it("moves an installation from the local network to Tailscale, keeping the data", () => {
		run(["--lang", "en", "--network", "lan", "--profile", "medium"]);
		writeFileSync(log, "");
		const r = run(["--lang", "en", "--network", "tailscale", "--key", "tskey-auth-k3"]);
		expect(r.status).toBe(0);
		expect(r.log.indexOf("docker compose down")).toBeLessThan(
			r.log.indexOf("docker compose up"),
		);
		expect(r.log).not.toContain("down -v");
		expect(file("compose.yml")).toBe(repoFile("docker/compose.yml"));
		expect(file(".env")).toMatch(/^BIBLIOVIVA_NETWORK=tailscale$/m);
		expect(file(".env")).toMatch(/^TS_AUTHKEY=tskey-auth-k3$/m);
		expect(file(".env")).toMatch(/^MEM_LIMIT=1g$/m);
	});

	it("says when the tailnet gives no HTTPS certificate", () => {
		const r = run(
			[
				"--lang",
				"en",
				"--network",
				"tailscale",
				"--profile",
				"small",
				"--key",
				"tskey-auth-k4",
			],
			null,
			{ STUB_NO_CERT: "1" },
		);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("HTTPS certificates are off");
	});

	it("refuses a 32-bit system", () => {
		const r = run(["--lang", "en", "--network", "lan"], null, { STUB_ARCH: "armv7l" });
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("32-bit (armv7l)");
	});

	it("installs Docker only when the answer is yes", () => {
		const no = run(["--lang", "en", "--network", "lan", "--profile", "small"], "n\n", {
			STUB_NO_DOCKER: "1",
		});
		expect(no.status).toBe(1);
		expect(no.stderr).toContain("Docker was not installed");
		expect(no.log).not.toContain("get.docker.com");
	});

	it("chooses Italian from the system's language", () => {
		const r = run(["--network", "lan", "--profile", "small"], null, { LANG: "it_IT.UTF-8" });
		expect(r.stdout).toContain("Installazione di BiblioViva");
	});
});
