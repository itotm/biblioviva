// SPDX-License-Identifier: GPL-3.0-or-later
import { getDb } from "#lib/server/db/index.js";
import { APP_VERSION } from "#lib/shared/version.js";

/** Liveness probe for the container HEALTHCHECK: no auth, no personal data. */
export function GET(): Response {
	let db: "ok" | "error" = "ok";
	try {
		getDb().$client.query("SELECT 1").get();
	} catch {
		db = "error";
	}
	return Response.json(
		{ status: db === "ok" ? "ok" : "degraded", version: APP_VERSION, db },
		{ status: db === "ok" ? 200 : 503 },
	);
}
