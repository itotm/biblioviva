// SPDX-License-Identifier: GPL-3.0-or-later
// The hardware profiles (PLAN.md §3.14, step 9.28): what each profile sets, and the values in force
// — the profile's, with the explicit `performance.*` keys over them. Every host-dependent setting
// is read from here (SQLite, password hashing, image work, yaz-client, heavy jobs, `bun --smol`,
// the idle timeout). No imports: the start launcher (`scripts/start.ts`) uses it before anything
// else is loaded.

/**
 * Seconds a connection may stay silent before the server closes it (`CONNECTION_IDLE_TIMEOUT`,
 * at most 255; step 9.32): the same on every profile, long enough for a print sheet that a slow
 * host takes many seconds to render, or one that waits its turn behind another heavy job (on a
 * Raspberry Pi with half a core and 10 users at once a sheet of labels took 60 s).
 */
export const CONNECTION_IDLE_TIMEOUT_S = 120;

export const PERFORMANCE_PROFILES = ["micro", "small", "medium", "large"] as const;
export type PerformanceProfile = (typeof PERFORMANCE_PROFILES)[number];

export interface PerformanceValues {
	sqliteCacheMb: number;
	sqliteMmapMb: number;
	walAutocheckpointPages: number;
	/** Image jobs (photos, covers, class pictures, the logo) run at once; the others wait. */
	imageConcurrency: number;
	/** `yaz-client` processes at once; the others wait. */
	yazConcurrency: number;
	/**
	 * Heavy jobs at once (step 9.32): print sheets (cards, labels, notices, receipts, the print view
	 * of a report) and exports (CSV, ODS, archives, backups); the others wait.
	 */
	heavyConcurrency: number;
	/**
	 * Memory of one argon2id password hash: 16 MB on every profile (step 9.29), the system is never
	 * exposed; overridable.
	 */
	argon2MemoryMb: number;
	/** The server runs with `bun --smol`: a smaller heap, more garbage collection. */
	smol: boolean;
}

/**
 * micro: one slow core and 512 MB (a Raspberry Pi Zero 2 W, the smallest VPS); small: a Raspberry
 * Pi 4 with 2 GB and an SD card (the default); medium: an old PC with a spinning disk; large: a PC
 * with plenty of RAM and an SSD.
 */
export const PROFILE_VALUES: Readonly<Record<PerformanceProfile, PerformanceValues>> = {
	micro: {
		sqliteCacheMb: 8,
		sqliteMmapMb: 0,
		walAutocheckpointPages: 500,
		imageConcurrency: 1,
		yazConcurrency: 1,
		heavyConcurrency: 1,
		argon2MemoryMb: 16,
		smol: true,
	},
	small: {
		sqliteCacheMb: 16,
		sqliteMmapMb: 0,
		walAutocheckpointPages: 1000,
		imageConcurrency: 1,
		yazConcurrency: 1,
		heavyConcurrency: 1,
		argon2MemoryMb: 16,
		smol: true,
	},
	medium: {
		sqliteCacheMb: 64,
		sqliteMmapMb: 0,
		walAutocheckpointPages: 2000,
		imageConcurrency: 2,
		yazConcurrency: 2,
		heavyConcurrency: 2,
		argon2MemoryMb: 16,
		smol: false,
	},
	large: {
		sqliteCacheMb: 256,
		sqliteMmapMb: 512,
		walAutocheckpointPages: 4000,
		imageConcurrency: 4,
		yazConcurrency: 2,
		heavyConcurrency: 4,
		argon2MemoryMb: 16,
		smol: false,
	},
};

/** The `performance` section as written: the profile and the keys that override it (null: none). */
export type PerformanceSettings = { profile?: string } & {
	[K in keyof PerformanceValues]?: PerformanceValues[K] | null;
};

const isProfile = (p: unknown): p is PerformanceProfile =>
	PERFORMANCE_PROFILES.includes(p as PerformanceProfile);

/** The values in force: the profile's (`small` when unknown), the explicit keys over them. */
export function resolvePerformance(settings: PerformanceSettings | undefined): PerformanceValues {
	const base = PROFILE_VALUES[isProfile(settings?.profile) ? settings.profile : "small"];
	const out = { ...base };
	for (const key of Object.keys(base) as (keyof PerformanceValues)[]) {
		const value = settings?.[key];
		if (value !== undefined && value !== null && typeof value === typeof base[key]) {
			(out as Record<string, unknown>)[key] = value;
		}
	}
	return out;
}
