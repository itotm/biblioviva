// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run deps:generate` — writes src/lib/generated/dependencies.json for the About page
// (step 1.12): every dependency of package.json with the version pinned there (checked against
// the installed package), its licence and homepage. A test fails when the file is stale.
import { writeFileSync } from "node:fs";
import { collectDependencies, DEPENDENCIES_FILE } from "#lib/server/dependencies.js";

const data = collectDependencies();
writeFileSync(DEPENDENCIES_FILE, `${JSON.stringify(data, null, "\t")}\n`);
console.log(
	`wrote ${DEPENDENCIES_FILE}: ${data.runtime.length} runtime + ${data.development.length} development packages`,
);
