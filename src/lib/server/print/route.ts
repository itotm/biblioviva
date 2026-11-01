// SPDX-License-Identifier: GPL-3.0-or-later
// What the print routes under `/print/` share: the HTML answer, never cached, the selection of
// `ids=` or of a print list (`list=<id>`, step 2.8) of the kind the route prints, and the answer
// to a job that cannot print.
import { error } from "@sveltejs/kit";
import type { DbOrTx } from "#lib/server/db/client.js";
import { rethrowHttp } from "#lib/server/http/errors.js";
import { LabelGeometryError } from "#lib/server/services/labels.js";
import { TemplateError } from "#lib/server/templates/engine.js";
import {
	entityIdsOf,
	PrintListKindError,
	type PrintListKind,
} from "#lib/server/services/print-lists.js";

/** A printable HTML page: never cached, with the route's own headers (counts). */
export function htmlResponse(body: string, headers: Record<string, string> = {}): Response {
	return new Response(body, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			...headers,
		},
	});
}

/**
 * The entities of a print route's query: the ids of a print list of `kind` in its own order
 * (`orderedIds`), else `ids=1,2`. A list that does not exist answers 404, an empty one or one of
 * the other kind 422.
 */
export function printSelection(
	db: DbOrTx,
	query: { list?: string; ids?: string },
	kind: PrintListKind,
): { ids?: number[]; orderedIds?: number[] } {
	if (query.list) {
		let orderedIds: number[];
		try {
			orderedIds = entityIdsOf(db, Number(query.list), kind);
		} catch (e) {
			if (e instanceof PrintListKindError) {
				error(422, `the print list holds ${e.kind}, not ${kind}`);
			}
			rethrowHttp(e);
		}
		if (orderedIds.length === 0) {
			error(422, "the print list is empty");
		}
		return { ids: orderedIds, orderedIds };
	}
	return query.ids ? { ids: query.ids.split(",").map(Number) } : {};
}

/**
 * Rethrows a print job that failed: a template or a stock that cannot print is a 422 with its
 * reason, a missing row (a label stock) a 404, anything else goes on.
 */
export function rethrowPrintError(e: unknown): never {
	if (e instanceof TemplateError || e instanceof LabelGeometryError) {
		error(422, e.message);
	}
	rethrowHttp(e);
}
