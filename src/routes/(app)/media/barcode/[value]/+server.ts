// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/barcode/<value>.svg?symbology=code128|code39|ean13&text=0|1`: barcode preview for any
// logged-in account (step 2.2). Cached: the same value always renders the same image.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { BarcodeError, renderBarcodeSvg, type Symbology } from "#lib/server/barcodes/render.js";

const SYMBOLOGIES: readonly Symbology[] = ["code128", "code39", "ean13"];

export const GET: RequestHandler = ({ locals, params, url }) => {
	requirePermission(locals);
	const value = params.value.replace(/\.svg$/i, "");
	const symbology = url.searchParams.get("symbology") ?? "code128";
	if (!(SYMBOLOGIES as readonly string[]).includes(symbology)) {
		error(400, "unknown symbology");
	}
	const heightParam = Number(url.searchParams.get("height") ?? "10");
	try {
		const svg = renderBarcodeSvg(value, {
			symbology: symbology as Symbology,
			text: url.searchParams.get("text") !== "0",
			heightMm: Number.isFinite(heightParam) ? Math.min(Math.max(heightParam, 3), 40) : 10,
		});
		return new Response(svg, {
			headers: {
				"Content-Type": "image/svg+xml; charset=utf-8",
				"Cache-Control": "private, max-age=86400",
			},
		});
	} catch (e) {
		if (e instanceof BarcodeError) {
			error(400, e.message);
		}
		throw e;
	}
};
