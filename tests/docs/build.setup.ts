// SPDX-License-Identifier: GPL-3.0-or-later
// Builds the application once before the shot passes start their servers (`E2E_PREBUILT=1` when
// `bun run ci` or a previous step has just built it).
import { execFileSync } from "node:child_process";

export default function globalSetup(): void {
	if (!process.env.E2E_PREBUILT) {
		execFileSync("bun", ["run", "build"], { stdio: "inherit" });
	}
}
