// SPDX-License-Identifier: GPL-3.0-or-later
import { join } from "node:path";

/** The storage state of a shared account, saved by `login.setup.ts` in the run folder. */
export const stateFile = (account: string): string =>
	join(process.env.BV_E2E_RUN_DIR ?? "", `docs-state-${account}.json`);
