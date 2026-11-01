// SPDX-License-Identifier: GPL-3.0-or-later
// File helpers shared by the services: a file replaced whole or not at all, the files of a folder.
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Writes a file atomically: a temporary file beside it, then a rename over the target, its folder
 * created when missing. A reader sees the old content or the new one, never half of it.
 */
export function writeAtomic(path: string, content: string | Uint8Array): void {
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, content);
	renameSync(tmp, path);
}

/**
 * `<stem><extension>` in `dir`, or `<stem>-2<extension>`, `-3`, … when a file of that name exists
 * (two backups in the same minute get a counter instead of overwriting each other).
 */
export function freeFileName(dir: string, stem: string, extension: string): string {
	let name = `${stem}${extension}`;
	for (let i = 2; existsSync(join(dir, name)); i++) {
		name = `${stem}-${i}${extension}`;
	}
	return name;
}

/**
 * Relative paths (with `/`) of every regular file under `root`, sorted, empty when the folder is
 * missing; links and the temporary files of `writeAtomic` are left out, and so is every folder
 * `skip` names (its relative path).
 */
export function listFilesRecursive(
	root: string,
	skip: (dir: string) => boolean = () => false,
): string[] {
	if (!existsSync(root)) {
		return [];
	}
	const out: string[] = [];
	const walk = (dir: string, prefix: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
			a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
		)) {
			const rel = `${prefix}${entry.name}`;
			if (entry.isDirectory()) {
				if (!skip(rel)) {
					walk(join(dir, entry.name), `${rel}/`);
				}
			} else if (entry.isFile() && !entry.name.endsWith(".tmp")) {
				out.push(rel);
			}
		}
	};
	walk(root, "");
	return out;
}
