// SPDX-License-Identifier: GPL-3.0-or-later
// Registry of exportable tables: the `/export/[table]` route looks the table up here, validates the
// query string with its schema, checks the permission and re-runs the grid's query server-side.
import type { GenericSchema } from "valibot";
import type { AuthUser } from "#lib/server/auth/types.js";
import type { Db } from "#lib/server/db/client.js";
import type { Permission } from "#lib/shared/permissions.js";
import type { TableExport } from "./types.js";

export interface ExportDefinition<Params> {
	/** Permission required to download; undefined = any staff session (the catalogue is readable by all). */
	permission?: Permission;
	/** Validates the query-string parameters (all strings) into the params the builder needs. */
	schema: GenericSchema<Record<string, string>, Params>;
	build: (
		db: Db,
		params: Params,
		user: AuthUser,
		timezone: string,
	) => TableExport | Promise<TableExport>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const definitions = new Map<string, ExportDefinition<any>>();

export function registerExport<Params>(table: string, definition: ExportDefinition<Params>): void {
	definitions.set(table, definition);
}

export function getExport(table: string): ExportDefinition<unknown> | undefined {
	return definitions.get(table);
}

export function exportTables(): string[] {
	return [...definitions.keys()].sort();
}

/** Converts `URLSearchParams` to the flat record the schemas expect (first value wins). */
export function searchParamsRecord(params: URLSearchParams): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, value] of params) {
		if (!(k in out)) {
			out[k] = value;
		}
	}
	return out;
}
