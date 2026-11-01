// SPDX-License-Identifier: GPL-3.0-or-later
// Configuration changes for unit tests, without the guards and the audit of `config-sections.ts`.
import type { LoadedConfig } from "#lib/server/config/load.js";
import {
	applyConfigChange,
	revertAction,
	revertWrites,
	setConfigKeys,
	type ConfigChange,
} from "#lib/server/services/config-edit.js";

/** Sets the colour set, in the file that defines it: a fresh folder is started with it. */
export function setUiTheme(configDir: string, theme: string): LoadedConfig {
	return setConfigKeys(configDir, "config.theme", { "ui.theme": theme });
}

/** Undoes change `id` as a new change, as `revertChange` does without its checks and audit. */
export function revertConfigChange(
	configDir: string,
	id: string,
	now = new Date(),
): { change: ConfigChange; loaded: LoadedConfig } {
	return applyConfigChange(configDir, revertAction(id), revertWrites(configDir, id), now);
}
