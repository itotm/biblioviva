// SPDX-License-Identifier: GPL-3.0-or-later
// The pack folders of `i18n-packs/`: a folder is a pack once it holds more than its glossary (the
// terms are written before the translation starts), and a folder starting with `_` is left alone.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function packCodes(root: string): string[] {
	if (!existsSync(root)) {
		return [];
	}
	return readdirSync(root, { withFileTypes: true })
		.filter(
			(e) =>
				e.isDirectory() &&
				!e.name.startsWith("_") &&
				readdirSync(join(root, e.name)).some((f) => f !== "glossary.json"),
		)
		.map((e) => e.name)
		.sort();
}
