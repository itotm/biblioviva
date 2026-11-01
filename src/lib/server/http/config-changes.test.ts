// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { ConfigError } from "#lib/server/config/index.js";
import { ConfigInUseError } from "#lib/server/services/config-references.js";
import { NotASettingError, UnknownSectionError } from "#lib/server/services/config-sections.js";
import { changing } from "./config-changes.js";

function thrown(fn: () => unknown): unknown {
	try {
		fn();
	} catch (e) {
		return e;
	}
	return undefined;
}

describe("changes of the configuration", () => {
	it("answers what the write returns", () => {
		expect(changing(() => ({ ok: true as const, change: "c1" }))).toEqual({
			ok: true,
			change: "c1",
		});
	});

	it("answers an unknown key or section with a 400", () => {
		for (const e of [new NotASettingError("a.b"), new UnknownSectionError("nope")]) {
			expect(
				thrown(() =>
					changing(() => {
						throw e;
					}),
				),
			).toMatchObject({ status: 400, body: { message: e.message } });
		}
	});

	it("answers a refused change with its errors and what is in use", () => {
		const issue = { level: "error" as const, path: "library.name", message: "required" };
		const warning = { level: "warning" as const, path: "library.x", message: "odd" };
		expect(
			changing(() => {
				throw new ConfigError("invalid", [issue, warning]);
			}),
		).toEqual({ ok: false, issues: [issue], inUse: [] });
		const problem = { kind: "itemType", code: "DVD", count: 2 };
		expect(
			changing(() => {
				throw new ConfigInUseError([problem] as never);
			}),
		).toEqual({ ok: false, issues: [], inUse: [problem] });
	});

	it("throws anything else on", () => {
		const boom = new Error("disk");
		expect(
			thrown(() =>
				changing(() => {
					throw boom;
				}),
			),
		).toBe(boom);
	});
});
