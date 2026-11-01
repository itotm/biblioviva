// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run templates:shipped` — records every version the application has shipped of the files of
// its built-in print templates (`config/{cards,labels,slips}/templates/<name>/`, and the cards
// without the photo of `config/cards/templates-no-photo/<name>/`), read from the git
// history and the working tree, in `src/lib/server/templates/shipped.json` (`contentHash` per
// file path). At start a copy in CONFIG_DIR made only of shipped versions was never edited, and the
// current built-in replaces it (`upgradeShippedCopies`). Run it after changing a built-in
// template: a unit test fails while the current files are missing from the record.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { contentHash } from "#lib/server/templates/upgrade.js";

const KINDS = ["cards", "labels", "slips"] as const;
const OUT = "src/lib/server/templates/shipped.json";

function git(args: string[]): Uint8Array {
	const r = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" });
	if (r.exitCode !== 0) {
		throw new Error(`git ${args.join(" ")}: ${r.stderr.toString()}`);
	}
	return r.stdout;
}

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((f) => {
		const p = join(dir, f);
		return statSync(p).isDirectory() ? walk(p) : [p];
	});
}

const record: Record<string, Record<string, Set<string>>> = {};
const add = (folder: string, file: string, hash: string): void => {
	const files = (record[folder] ??= {});
	(files[file] ??= new Set()).add(hash);
};

// the cards without the photo (9.38) are recorded as `cards-no-photo/<name>`
const ROOTS = [
	...KINDS.map((kind) => ({ key: kind, root: `config/${kind}/templates` })),
	{ key: "cards-no-photo", root: "config/cards/templates-no-photo" },
];

for (const { key, root } of ROOTS) {
	// every path the history knows under the folder, with every version of it
	const paths = new Set(
		new TextDecoder()
			.decode(git(["log", "--format=", "--name-only", "--", root]))
			.split("\n")
			.filter((p) => p.startsWith(`${root}/`)),
	);
	for (const path of paths) {
		const [name, ...rest] = path.slice(root.length + 1).split("/");
		const commits = new TextDecoder()
			.decode(git(["log", "--format=%H", "--", path]))
			.split("\n")
			.filter(Boolean);
		for (const commit of commits) {
			try {
				add(
					`${key}/${name}`,
					rest.join("/"),
					contentHash(path, git(["show", `${commit}:${path}`])),
				);
			} catch {
				// the commit removed the file
			}
		}
	}
	for (const name of readdirSync(root)) {
		for (const file of walk(join(root, name))) {
			const rel = relative(join(root, name), file).split(sep).join("/");
			add(`${key}/${name}`, rel, contentHash(rel, readFileSync(file)));
		}
	}
}

const sorted = Object.fromEntries(
	Object.keys(record)
		.sort()
		.map((folder) => [
			folder,
			Object.fromEntries(
				Object.keys(record[folder] ?? {})
					.sort()
					.map((file) => [file, [...(record[folder]?.[file] ?? [])].sort()]),
			),
		]),
);
writeFileSync(OUT, `${JSON.stringify(sorted, null, "\t")}\n`);
console.log(`${OUT}: ${Object.keys(sorted).length} template folders`);
