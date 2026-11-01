// SPDX-License-Identifier: GPL-3.0-or-later
// The start of the server (the `init` hook of `hooks.server.ts`), in this order: the public demo
// built afresh, the configuration folder's defaults and the built-in templates' copies, the
// language packs, the configuration, the database with the mirrored tables and accounts, the
// reload hooks, the backups and the backup at start when the scheduled one was missed (or the
// demo's daily reset), the faces of removed pupils left to
// cover, the basic local-network front, the shutdown hooks, the reload signal, the audit
// retention and the housekeeping.
import { getUiLocale } from "#lib/server/config/locale.js";
import { buildPublicDemo } from "#lib/server/demo/build.js";
import { prepareDemoTexts } from "#lib/server/demo/content.js";
import { isDemoPublic, scheduleDemoReset } from "#lib/server/demo/public.js";
import { mirrorConfigTables } from "#lib/server/db/config-mirror.js";
import { invalidateServerI18n, tServer } from "#lib/i18n/server.js";
import { installDefaultPacks, invalidatePacks, loadPacks } from "#lib/server/i18n/registry.js";
import { mirrorConfigUsers } from "#lib/server/auth/index.js";
import {
	ensureConfigDirDefaults,
	getConfig,
	getLoadedConfig,
	installReloadSignal,
	onConfigReload,
} from "#lib/server/config/index.js";
import { upgradeShippedCopies } from "#lib/server/templates/upgrade.js";
import { permissionHint } from "#lib/server/config/permissions.js";
import { closeDb, getDb } from "#lib/server/db/index.js";
import { coverRemovedFaces } from "#lib/server/services/anonymize.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import { env } from "#lib/server/env.js";
import { startLanFront } from "#lib/server/runtime/lan-front.js";
import { audit, installAuditRetention } from "#lib/server/services/audit.js";
import { installHousekeeping } from "#lib/server/services/housekeeping.js";
import {
	installBackupSchedule,
	backupNow,
	backupsDirProblem,
	cancelCatchUpBackup,
	catchUpBackup,
	planCatchUpBackup,
	stopBackupSchedule,
} from "#lib/server/services/backup.js";

/** Runs once before the first request: configuration, default folders, accounts, reload hooks. */
export async function startServer(): Promise<void> {
	// the public demo (9.17): both volumes built afresh before anything reads them
	if (isDemoPublic()) {
		const built = await buildPublicDemo({
			configDir: env().CONFIG_DIR,
			dataDir: env().DATA_DIR,
		});
		console.warn(
			`[demo] public demo built: ${String(built.patrons)} patrons, ${String(built.biblios)} titles`,
		);
	}
	try {
		ensureConfigDirDefaults(env().CONFIG_DIR);
		// copies of the built-in templates never edited follow the application
		for (const folder of upgradeShippedCopies(env().CONFIG_DIR)) {
			console.warn(`[templates] ${folder}: never edited, replaced by the current built-in`);
		}
	} catch (e) {
		const hint = permissionHint(e, env().CONFIG_DIR, "CONFIG_DIR");
		if (hint) {
			console.error(hint);
		}
		throw e;
	}
	// language packs (step 1.14): the built-in dictionaries as examples, then whatever the school added
	await installDefaultPacks(env().CONFIG_DIR);
	await loadPacks(env().CONFIG_DIR);
	const loaded = getLoadedConfig(); // throws a readable ConfigError on an invalid file
	for (const w of loaded.warnings) {
		console.warn(`[config] ${w.path}: ${w.message}`);
	}
	if (loaded.source === "example") {
		console.warn(
			`[config] ${env().CONFIG_DIR}/config.json not found: using the shipped example (setup not completed)`,
		);
	}
	let db: ReturnType<typeof getDb>;
	try {
		db = getDb(); // opens DATABASE_PATH and applies pending migrations
	} catch (e) {
		const hint = permissionHint(e, env().DATA_DIR, "DATA_DIR");
		if (hint) {
			console.error(hint);
		}
		throw e;
	}
	mirrorConfigTables(db, loaded.config);
	const mirrored = await mirrorConfigUsers(db, loaded.config);
	if (mirrored.plainPasswords.length > 0) {
		console.warn(
			`[auth] accounts with a plain password in config.json: ${mirrored.plainPasswords.join(", ")}`,
		);
	}
	onConfigReload((config) => {
		invalidateServerI18n();
		invalidatePacks();
		void loadPacks(env().CONFIG_DIR);
		void mirrorConfigUsers(getDb(), config);
		mirrorConfigTables(getDb(), config);
		// photos switched on or off (9.38): the cards never edited follow, with or without the photo
		upgradeShippedCopies(env().CONFIG_DIR);
		audit(getDb(), null, "config.reload", "config");
		if (!isDemoPublic()) {
			scheduleBackups(config);
		}
	});
	// the public demo keeps nothing: no backups; it ends at the reset time and Docker starts it again
	if (isDemoPublic()) {
		// the examples that replace what a visitor sends, in the installation's language (Q121)
		const locale = getUiLocale();
		await prepareDemoTexts(locale, loaded.config.library.timezone, (key, params) =>
			tServer(locale, key, params),
		);
		const reset = scheduleDemoReset(loaded.config.library.timezone, env().DEMO_RESET_AT, () => {
			console.warn("[demo] daily reset: the server ends, Docker starts it on a fresh demo");
			closeDb();
			process.exit(0);
		});
		// a pending reset must not keep a stopping server alive
		process.once("sveltekit:shutdown", reset.cancel);
		console.warn(`[demo] next reset at ${reset.at.toISOString()}`);
	} else {
		// the backups folder, a volume of its own (9.35): a wrong owner is told now, not at night
		const problem = backupsDirProblem();
		if (problem) {
			console.error(problem);
		}
		scheduleBackups(loaded.config);
		// a computer switched off at night (Q129): its missed backup a minute after the start
		planCatchUpBackup(runCatchUpBackup);
	}
	// faces of removed pupils left to cover in the class pictures (Phase 13, Q106), if a removal
	// was interrupted before its painting
	void coverRemovedFaces(db, env().DATA_DIR);
	// the basic local-network mode (step 8.8): plain http on LAN_PORT, in front of the app
	const lanPort = env().LAN_PORT;
	const lan =
		lanPort === undefined
			? undefined
			: startLanFront({
					port: lanPort,
					target: `http://127.0.0.1:${String(env().PORT)}`,
					idleTimeout: env().CONNECTION_IDLE_TIMEOUT,
				});
	if (lan) {
		console.warn(`[lan] plain http on port ${String(lan.port)} (basic mode, no Tailscale)`);
	}
	process.once("sveltekit:shutdown", () => {
		void lan?.stop();
		stopBackupSchedule();
		cancelCatchUpBackup();
		closeDb();
	});
	installReloadSignal((msg) => console.warn(`[config] ${msg}`));
	installAuditRetention(
		getDb,
		() => getConfig().privacy.auditRetentionMonths,
		(msg) => console.warn(`[audit] ${msg}`),
	);
	// expired sessions, old lookups and "no cover" answers, abandoned temporary files (9.13, round 16)
	installHousekeeping(getDb, getConfig, env().DATA_DIR, (msg) =>
		console.warn(`[housekeeping] ${msg}`),
	);
}

/** Daily backup job from `backup.cron` in the library time zone (idempotent across reloads). */
function scheduleBackups(config: AppConfig): void {
	installBackupSchedule(config.backup.cron, config.library.timezone, async () => {
		try {
			const current = getConfig();
			await backupNow(
				getDb(),
				env().DATA_DIR,
				{ timezone: current.library.timezone, keepDays: current.backup.keepDays },
				null,
			);
		} catch (e) {
			console.error(`[backup] scheduled backup failed: ${(e as Error).message}`);
		}
	});
}

/** The backup at start (9.33), with the configuration of the moment it runs. */
async function runCatchUpBackup(): Promise<void> {
	try {
		const config = getConfig();
		const run = await catchUpBackup(getDb(), env().DATA_DIR, {
			cron: config.backup.cron,
			timezone: config.library.timezone,
			keepDays: config.backup.keepDays,
			enabled: config.backup.catchUp,
		});
		if (run) {
			console.warn(`[backup] scheduled backup missed: ${run.backup.name} made at start`);
		}
	} catch (e) {
		console.error(`[backup] backup at start failed: ${(e as Error).message}`);
	}
}
