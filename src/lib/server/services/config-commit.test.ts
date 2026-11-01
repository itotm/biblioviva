// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { ConfigError, resetConfigCache } from "#lib/server/config/index.js";
import { auditLog, staffUser } from "#lib/server/db/schema.js";
import { commitConfigChange, failureLines, failureOf, failureWith } from "./config-commit.js";
import { listConfigChanges } from "./config-edit.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import { ConfigInUseError } from "./config-references.js";

let dir = "";
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-config-commit-"));
	setUiTheme(dir, "ocean");
});
afterEach(() => {
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

function database(): { db: ReturnType<typeof createTestDb>; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

const note = (text: string): { path: string; content: string } => ({
	path: "reports/note.json",
	content: JSON.stringify({ text }),
});

describe("the commit path of the configuration", () => {
	it("writes the files as one change, moves the data and audits with what moved", () => {
		const { db, actor } = database();
		const { change } = commitConfigChange(db, dir, {
			action: "config.test",
			writes: [{ path: "ui.json", content: JSON.stringify({ theme: "grape" }) }],
			move: () => ({ moved: 3 }),
			audit: { actor, details: { keys: ["ui.theme"] } },
		});
		expect(listConfigChanges(dir)[0]?.id).toBe(change.id);
		const row = db.select().from(auditLog).get();
		expect(row).toMatchObject({ action: "config.test", entity: "config" });
		expect(row?.details).toEqual({ change: change.id, keys: ["ui.theme"], moved: 3 });
	});

	it("puts the files back and rolls the moves back when a guard refuses", () => {
		const { db, actor } = database();
		const before = readFileSync(join(dir, "config.json"), "utf8");
		const refusal = new Error("in use");
		expect(() =>
			commitConfigChange(db, dir, {
				action: "config.test",
				writes: [note("x")],
				move: (tx) => {
					tx.insert(staffUser)
						.values({ username: "ghost", passwordHash: "x", roles: [] })
						.run();
					throw refusal;
				},
				audit: { actor },
			}),
		).toThrow(refusal);
		expect(existsSync(join(dir, "reports", "note.json"))).toBe(false);
		expect(readFileSync(join(dir, "config.json"), "utf8")).toBe(before);
		expect(db.select().from(staffUser).all()).toHaveLength(1);
		expect(db.select().from(auditLog).all()).toEqual([]);
		expect(listConfigChanges(dir).map((c) => c.action)).not.toContain("config.test");
	});

	it("refuses a template the configuration names that does not exist", () => {
		const { db } = database();
		expect(() =>
			commitConfigChange(db, dir, {
				action: "config.cards",
				writes: [
					{ path: "cards.json", content: JSON.stringify({ defaultTemplate: "nowhere" }) },
				],
				audit: null,
			}),
		).toThrow(ConfigError);
	});

	it("tells why a change was refused, errors only, and throws anything else again", () => {
		const invalid = failureOf(
			new ConfigError("x", [
				{ level: "error", path: "ui.theme", message: "unknown" },
				{ level: "warning", path: "ui", message: "ignored" },
			]),
		);
		expect(invalid).toEqual({
			ok: false,
			issues: [{ level: "error", path: "ui.theme", message: "unknown" }],
			inUse: [],
		});
		const inUse = failureOf(
			new ConfigInUseError([{ kind: "itemType", code: "dvd", count: 2 }]),
			{
				plan: null,
			},
		);
		expect(inUse).toEqual({
			ok: false,
			issues: [],
			inUse: [{ kind: "itemType", code: "dvd", count: 2 }],
			plan: null,
		});
		expect(failureLines(invalid)).toEqual(["ui.theme: unknown"]);
		expect(failureLines(inUse)).toEqual(["itemType dvd (2)"]);
		expect(() => failureOf(new Error("boom"))).toThrow("boom");
	});

	it("answers a refusal of the flow with its extras, never letting them hide the shape", () => {
		const plan = { ready: false };
		expect(
			failureWith({ plan }, [
				{ level: "warning", path: "a", message: "kept aside" },
				{ level: "error", path: "b", message: "blocks" },
			]),
		).toEqual({
			ok: false,
			issues: [{ level: "error", path: "b", message: "blocks" }],
			inUse: [],
			plan,
		});
		expect(failureWith({ ok: true, issues: ["x"] })).toMatchObject({ ok: false, issues: [] });
	});
});
