// SPDX-License-Identifier: GPL-3.0-or-later
// The format table of the configuration (PLAN.md Phase 12): built once per loaded configuration and
// shared by the desk, the inventory, the catalogue search, the imports, the generators and the
// browser.
import type { AppConfig } from "#lib/server/config/schema.js";
import { buildCodeTable, type CodeFormats, type CodeTable } from "#lib/shared/barcodes/table.js";

export function codeFormatsFromConfig(config: AppConfig): CodeFormats {
	const { item, patron, libraryCode, keyboardLayout, plainMaxLength } = config.barcodes;
	const start = patron.counterStart;
	return {
		item: { current: item.format, retired: item.retired, legacy: item.legacy },
		card: { current: patron.format, retired: patron.retired, legacy: patron.legacy },
		plainMaxLength,
		libraryCode,
		layout: keyboardLayout,
		cardCounterStart: typeof start === "number" ? start : undefined,
	};
}

const tables = new WeakMap<AppConfig, CodeTable>();

/** The compiled table of a configuration (cached per loaded configuration object). */
export function codeTable(config: AppConfig): CodeTable {
	let table = tables.get(config);
	if (!table) {
		table = buildCodeTable(codeFormatsFromConfig(config));
		tables.set(config, table);
	}
	return table;
}
