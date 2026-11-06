// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run deps:generate` — writes src/lib/generated/dependencies.json (step 1.12) and the
// technical page of the documentation `docs/libraries.md` (step 9.53): every dependency of
// package.json with the version pinned there (checked against the installed package), its licence
// and homepage. A test fails when either file is stale.
import { writeFileSync } from "node:fs";
import {
	collectDependencies,
	DEPENDENCIES_FILE,
	LIBRARIES_PAGE,
	librariesPage,
} from "#lib/server/dependencies.js";

const data = collectDependencies();
writeFileSync(DEPENDENCIES_FILE, `${JSON.stringify(data, null, "\t")}\n`);
writeFileSync(LIBRARIES_PAGE, librariesPage(data));
console.log(
	`wrote ${DEPENDENCIES_FILE}: ${data.runtime.length} runtime + ${data.development.length} development packages`,
);
