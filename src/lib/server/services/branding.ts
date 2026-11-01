// SPDX-License-Identifier: GPL-3.0-or-later
// The library's logo (PLAN.md step 4.10): uploaded from Configurazione → Aspetto e lingua,
// re-encoded as PNG (transparency kept, longest side at most 512 px, metadata dropped) into
// `CONFIG_DIR/branding/logo.png`, so it belongs to the configuration and travels with its archive;
// uploading or removing it is a change of the history like any other.
// Shown at the top left of the app; SVG is refused because it can carry scripts.
import { assertNotDemo } from "#lib/server/demo/public.js";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { DbOrTx } from "#lib/server/db/client.js";
import { encodePng } from "#lib/server/images/png.js";
import { writeAtomic } from "#lib/server/runtime/fs.js";
import type { AuditActor } from "./audit.js";
import { commitConfigChange } from "./config-commit.js";

/** The logo's place in the configuration folder (a path of the folder's table, with `/`). */
export const LOGO_FILE = "branding/logo.png";
export const LOGO_MAX_SIDE = 512;
export const LOGO_MAX_BYTES = 5_000_000;

export function logoPath(configDir: string): string {
	return join(configDir, LOGO_FILE);
}

/** The PNG to store: the upload scaled down to fit `maxSide` (never up), transparency kept. */
export function encodeLogo(input: Uint8Array, maxSide = LOGO_MAX_SIDE): Promise<Uint8Array> {
	return encodePng(input, { maxSide, maxBytes: LOGO_MAX_BYTES });
}

/**
 * Stores the logo as one configuration change (the previous one kept in the history, audited as
 * `config.logo`); returns its version.
 */
export async function saveLibraryLogo(
	db: DbOrTx,
	configDir: string,
	input: Uint8Array,
	actor: AuditActor,
): Promise<number> {
	assertNotDemo("config");
	const bytes = await encodeLogo(input);
	commitConfigChange(db, configDir, {
		action: "config.logo",
		writes: [{ path: LOGO_FILE, content: bytes }],
		audit: { actor, details: { action: "upload" } },
	});
	return logoVersion(configDir) ?? 0;
}

/** The logo written without the history or the guard of the public demo: the demo build sets its own (9.17). */
export async function writeLibraryLogo(configDir: string, input: Uint8Array): Promise<number> {
	writeAtomic(logoPath(configDir), await encodeLogo(input));
	return logoVersion(configDir) ?? 0;
}

/** Removes the logo as one configuration change; false when there is none. */
export function removeLibraryLogo(db: DbOrTx, configDir: string, actor: AuditActor): boolean {
	assertNotDemo("config");
	if (!existsSync(logoPath(configDir))) {
		return false;
	}
	commitConfigChange(db, configDir, {
		action: "config.logo",
		writes: [{ path: LOGO_FILE, content: null }],
		audit: { actor, details: { action: "remove" } },
	});
	return true;
}

/** The logo's version for cache-busting URLs, or null when none is uploaded. */
export function logoVersion(configDir: string): number | null {
	const path = logoPath(configDir);
	return existsSync(path) ? Math.round(statSync(path).mtimeMs) : null;
}

/** The URL the shell shows (`/media/branding/logo?v=…`), or null. */
export function logoUrl(configDir: string): string | null {
	const version = logoVersion(configDir);
	return version === null ? null : `/media/branding/logo?v=${version}`;
}
