// SPDX-License-Identifier: GPL-3.0-or-later
// Checks of a deployed instance from the outside (step 8.4): `bun run deploy:check <url>` against
// https://biblioviva.<tailnet>.ts.net — health, HTTPS with a certificate the client accepts, HSTS,
// the security headers, the login page, where an anonymous visit lands.
export interface DeployCheck {
	name: string;
	ok: boolean;
	detail: string;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export async function checkDeployment(
	baseUrl: string,
	fetchImpl: Fetch = fetch,
): Promise<DeployCheck[]> {
	const base = baseUrl.replace(/\/+$/, "");
	const checks: DeployCheck[] = [];
	const add = (name: string, ok: boolean, detail: string): void => {
		checks.push({ name, ok, detail });
	};
	const https = base.startsWith("https://");
	add(
		"https",
		https,
		https
			? "the address uses HTTPS"
			: "use the https:// address given by Tailscale (camera and scanner need it)",
	);
	let health: Response;
	try {
		// fetch refuses an invalid or missing certificate: reaching the server proves it
		health = await fetchImpl(`${base}/healthz`);
	} catch (e) {
		add("reachable", false, `cannot reach ${base}: ${(e as Error).message}`);
		return checks;
	}
	add(
		"reachable",
		true,
		https ? "reached over HTTPS with a certificate the client accepts" : "reached",
	);
	let body: { status?: string; version?: string; db?: string } = {};
	try {
		body = (await health.json()) as typeof body;
	} catch {
		body = {};
	}
	add(
		"health",
		health.status === 200 && body.status === "ok" && body.db === "ok",
		`HTTP ${health.status}, status ${body.status ?? "?"}, database ${body.db ?? "?"}, version ${body.version ?? "?"}`,
	);
	const login = await fetchImpl(`${base}/login`);
	const html = await login.text();
	add("login page", login.status === 200 && html.includes("<form"), `HTTP ${login.status}`);
	const hsts = login.headers.get("strict-transport-security");
	add(
		"hsts",
		!https || hsts !== null,
		hsts ??
			(https ? "missing: is X-Forwarded-Proto reaching the app?" : "not expected over http"),
	);
	const nosniff = login.headers.get("x-content-type-options") === "nosniff";
	const frames = login.headers.get("x-frame-options") === "SAMEORIGIN";
	add(
		"security headers",
		nosniff && frames,
		`nosniff ${nosniff ? "yes" : "no"}, frame options ${frames ? "yes" : "no"}`,
	);
	const home = await fetchImpl(`${base}/`, { redirect: "manual" });
	const target = home.headers.get("location") ?? "";
	add(
		"anonymous visit",
		home.status >= 300 && home.status < 400 && /\/(login|setup)/.test(target),
		target.includes("/setup")
			? "goes to the first-run wizard (setup not completed yet)"
			: `goes to ${target || `HTTP ${home.status}`}`,
	);
	return checks;
}
