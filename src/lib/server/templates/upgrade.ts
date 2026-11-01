// SPDX-License-Identifier: GPL-3.0-or-later
// Copies of the built-in print templates in CONFIG_DIR follow the application while nobody edits
// them (§3.20). The built-ins are copied into CONFIG_DIR at the first start so they can be edited
// as files; a copy whose every file is a version the application shipped (`shipped.json`, written
// by `bun run templates:shipped` from the git history) was never edited, and at start it is
// replaced by the current built-in. Text files are compared without their layout of spaces and
// line breaks, so a version that differs only in formatting still counts as shipped. A copy with
// any other file — edited by hand, in the designer, or with an asset uploaded — is left as it is.
import { createHash } from "node:crypto";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { EXAMPLE_CONFIG_DIR } from "#lib/server/config/load.js";
import SHIPPED from "./shipped.json" with { type: "json" };
import { shippedTemplatesDir } from "./engine.js";

/** Every shipped version of each file, by template folder (`<kind>/<name>`) and file path. */
export type ShippedVersions = Record<string, Record<string, string[]>>;

const KINDS = ["cards", "labels", "slips"] as const;

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((f) => {
		const p = join(dir, f);
		return statSync(p).isDirectory() ? files(p) : [p];
	});
}

const TEXT = /\.(html|css|json)$/;

/**
 * The SHA-256 of a file's content; for HTML, CSS and JSON, of the text without its formatting
 * (spaces around punctuation dropped, other runs of spaces and line breaks made one space).
 */
export function contentHash(file: string, data: Uint8Array): string {
	const hash = createHash("sha256");
	if (TEXT.test(file)) {
		const text = new TextDecoder()
			.decode(data)
			.replace(/\s*([{};:,>])\s*/g, "$1")
			.replace(/\s+/g, " ")
			.replace(/;}/g, "}")
			.trim();
		return hash.update(text).digest("hex");
	}
	return hash.update(data).digest("hex");
}

/** The files of a folder with their `contentHash`, by path relative to it. */
export function folderHashes(dir: string): Record<string, string> {
	return Object.fromEntries(
		files(dir).map((f) => {
			const rel = relative(dir, f).split(sep).join("/");
			return [rel, contentHash(rel, readFileSync(f))];
		}),
	);
}

/** The shipped versions of two records together (either may be missing). */
function mergeVersions(
	a: Record<string, string[]> | undefined,
	b: Record<string, string[]> | undefined,
): Record<string, string[]> | undefined {
	if (!a || !b) {
		return a ?? b;
	}
	const out: Record<string, string[]> = { ...a };
	for (const [file, hashes] of Object.entries(b)) {
		out[file] = [...(out[file] ?? []), ...hashes];
	}
	return out;
}

/**
 * Replaces the copies of built-in templates in `configDir` that were never edited with the current
 * built-ins (the cards with or without the photo, as `photos.enabled` says: 9.38). Returns the
 * folders replaced (`<kind>/<name>`).
 */
export function upgradeShippedCopies(
	configDir: string,
	builtinRoot = EXAMPLE_CONFIG_DIR,
	shipped: ShippedVersions = SHIPPED,
	/** Photos on or off (default: the configuration's `photos.enabled`). */
	photos?: boolean,
): string[] {
	const upgraded: string[] = [];
	for (const kind of KINDS) {
		const dir = shippedTemplatesDir(kind, photos);
		const root = join(builtinRoot, kind, dir);
		if (!existsSync(root)) {
			continue;
		}
		for (const name of readdirSync(root)) {
			const builtin = join(root, name);
			const copy = join(configDir, kind, "templates", name);
			// a copy of either kind of shipped card, with or without the photo (recorded as
			// `cards-no-photo/<name>`, 9.38), follows the one photos call for now
			const versions = mergeVersions(
				shipped[`${kind}/${name}`],
				kind === "cards" ? shipped[`cards-no-photo/${name}`] : undefined,
			);
			if (!versions || !existsSync(copy) || !statSync(copy).isDirectory()) {
				continue;
			}
			const have = folderHashes(copy);
			const current = folderHashes(builtin);
			const untouched = Object.entries(have).every(([file, hash]) =>
				versions[file]?.includes(hash),
			);
			const same =
				Object.keys(have).length === Object.keys(current).length &&
				Object.entries(current).every(([file, hash]) => have[file] === hash);
			if (untouched && !same) {
				rmSync(copy, { recursive: true, force: true });
				cpSync(builtin, copy, { recursive: true });
				upgraded.push(`${kind}/${name}`);
			}
		}
	}
	return upgraded;
}
