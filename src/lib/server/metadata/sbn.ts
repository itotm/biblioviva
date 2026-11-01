// SPDX-License-Identifier: GPL-3.0-or-later
// OPAC SBN through Z39.50 (yaz-client driver of 3.4 + UNIMARC mapping): the default and only
// out-of-the-box provider (Q26).
import { isAbsolute, resolve } from "node:path";
import { parseIso2709 } from "#lib/server/marc/iso2709.js";
import { mapUnimarc } from "#lib/server/marc/unimarc-map.js";
import { runYaz, Z3950Error } from "#lib/server/z3950/driver.js";
import { z3950Target } from "#lib/server/z3950/targets.js";
import { MetadataError, type MetadataProvider, type MetadataQuery } from "./types.js";

export const sbnProvider: MetadataProvider = {
	id: "sbn",
	name: "OPAC SBN",
	async lookup(query: MetadataQuery, ctx) {
		const { config } = ctx;
		const target = z3950Target(config);
		try {
			const result = await runYaz(target, query, {
				// the client runs inside the temp folder, so a relative wrapper path must be resolved
				command:
					ctx.env.YAZ_CLIENT.includes("/") && !isAbsolute(ctx.env.YAZ_CLIENT)
						? resolve(ctx.env.YAZ_CLIENT)
						: ctx.env.YAZ_CLIENT,
				tmpDir: ctx.tmpDir,
				timeoutMs: config.z3950.timeoutMs,
				max:
					query.kind === "isbn"
						? config.z3950.maxRecordsIsbn
						: config.z3950.maxRecordsSearch,
			});
			let records;
			try {
				records = parseIso2709(result.records);
			} catch (e) {
				throw new MetadataError("protocol", "malformed UNIMARC records", String(e));
			}
			const drafts = records.map((r) =>
				mapUnimarc(r, {
					specialAuthors: config.catalog.specialAuthors,
					unknownPublisher: config.catalog.unknownPublisher,
					source: "sbn",
				}),
			);
			return { hits: result.hits, drafts };
		} catch (e) {
			if (e instanceof Z3950Error) {
				throw new MetadataError(e.code, e.message, e.stderr);
			}
			throw e;
		}
	},
};
