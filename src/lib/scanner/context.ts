// SPDX-License-Identifier: GPL-3.0-or-later
// The format table of the configuration in the browser (PLAN.md Phase 12): the root layout builds
// it from the layout data, and the code inputs and the camera scanner read it from the context.
import { getContext, setContext } from "svelte";
import type { CodeTable } from "#lib/shared/barcodes/table.js";

const KEY = Symbol("biblioviva.codeTable");

export function provideCodeTable(table: CodeTable): void {
	setContext(KEY, table);
}

/** Context map for mounting components outside the layout (component tests). */
export function codeTableContext(table: CodeTable): Map<symbol, CodeTable> {
	return new Map([[KEY, table]]);
}

/** The format table set by the root layout. */
export function useCodeTable(): CodeTable {
	const table = getContext<CodeTable | undefined>(KEY);
	if (!table) {
		throw new Error("code table context missing: is the root layout mounted?");
	}
	return table;
}
