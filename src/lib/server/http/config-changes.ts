// SPDX-License-Identifier: GPL-3.0-or-later
// The answers of the remote functions that write the configuration (the `*.remote.ts` files of the
// Configurazione area), shared here since a remote module exports only remote functions.
import { error } from "@sveltejs/kit";
import { refusal, refusing } from "#lib/server/http/errors.js";
import {
	configRefused,
	failureOf,
	type ConfigFailure,
} from "#lib/server/services/config-commit.js";
import { NotASettingError, UnknownSectionError } from "#lib/server/services/config-sections.js";

/** A key or a section unknown: the page asked for something that is not there (400). */
export const UNKNOWN_SETTING = refusal([NotASettingError, UnknownSectionError], (e) =>
	error(400, e.message),
);

/** A write of the configuration, or the reasons the page shows when it did not happen. */
export function changing<T>(write: () => T): T | ConfigFailure {
	return refusing(write, [UNKNOWN_SETTING, refusal(configRefused(), (e) => failureOf(e))]);
}
