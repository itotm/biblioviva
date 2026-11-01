// SPDX-License-Identifier: GPL-3.0-or-later
// `--only a,b` and `--except c` of the backup and configuration helpers (step 11.12): part ids
// (`data:catalog`, `section:library`, `config:reports`…) or groups (`data`, `config`, `settings`).
import { selectParts, type PartId } from "#lib/shared/archive-parts.js";

function listAfter(args: readonly string[], flag: string): string[] | null {
	const i = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
	if (i === -1) {
		return null;
	}
	const arg = args[i] ?? "";
	const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : (args[i + 1] ?? "");
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/** The parts chosen by `--only` / `--except` among those available. */
export function partsFromArgs(args: readonly string[], available: readonly PartId[]): PartId[] {
	return selectParts(available, listAfter(args, "--only"), listAfter(args, "--except") ?? []);
}

/** The arguments that are not flags nor the values of `--only` / `--except`. */
export function positional(args: readonly string[]): string[] {
	return args.filter(
		(a, i) => !a.startsWith("--") && args[i - 1] !== "--only" && args[i - 1] !== "--except",
	);
}
