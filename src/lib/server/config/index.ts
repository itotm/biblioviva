// SPDX-License-Identifier: GPL-3.0-or-later
// Process-wide configuration: loaded at startup, reloadable on SIGHUP or from the admin UI.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { env } from "#lib/server/env.js";
import { DEFAULT_ENTRIES } from "./folder.js";
import { EXAMPLE_CONFIG_DIR, loadConfig, type LoadedConfig } from "./load.js";
import type { AppConfig } from "./schema.js";

export type { AppConfig } from "./schema.js";
export { ConfigError } from "./load.js";

let current: LoadedConfig | undefined;
const listeners = new Set<(config: AppConfig) => void>();

/** The active configuration (loads it on first use). */
export function getConfig(): AppConfig {
	return getLoadedConfig().config;
}

export function getLoadedConfig(): LoadedConfig {
	if (!current) {
		current = loadConfig(env().CONFIG_DIR);
	}
	return current;
}

/**
 * Re-reads the files (of CONFIG_DIR, or of the folder a writer has just changed and validated); on
 * error the previous configuration stays active and the error is thrown.
 */
export function reloadConfig(configDir = env().CONFIG_DIR): LoadedConfig {
	const next = loadConfig(configDir);
	current = next;
	for (const listener of listeners) {
		listener(next.config);
	}
	return next;
}

/** Registers a callback run after every successful reload (i18n cache, schedulers, …). */
export function onConfigReload(listener: (config: AppConfig) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Test helper. */
export function resetConfigCache(): void {
	current = undefined;
}

/** Copies the shipped folder layout of §3.6 into CONFIG_DIR where missing (`DEFAULT_ENTRIES`). */
export function ensureConfigDirDefaults(
	configDir = env().CONFIG_DIR,
	sourceRoot = EXAMPLE_CONFIG_DIR,
): string[] {
	const copied: string[] = [];
	mkdirSync(configDir, { recursive: true });
	for (const entry of DEFAULT_ENTRIES) {
		const target = join(configDir, entry);
		const source = join(sourceRoot, entry);
		if (!existsSync(target) && existsSync(source)) {
			cpSync(source, target, { recursive: true });
			copied.push(entry);
		}
	}
	return copied;
}

let signalInstalled = false;

/** SIGHUP → reload without restart (§3.6). Safe to call more than once. */
export function installReloadSignal(log: (msg: string) => void = console.warn): void {
	if (signalInstalled || typeof process.on !== "function") {
		return;
	}
	signalInstalled = true;
	process.on("SIGHUP", () => {
		try {
			const loaded = reloadConfig();
			log(`configuration reloaded from ${loaded.path}`);
		} catch (e) {
			log(`configuration reload failed, keeping the previous one: ${(e as Error).message}`);
		}
	});
}
