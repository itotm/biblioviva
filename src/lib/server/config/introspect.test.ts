// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { schemaLeaves, schemaSections } from "./introspect.js";

const leaf = (path: string): ReturnType<typeof schemaLeaves>[number] | undefined =>
	schemaLeaves().find((l) => l.path === path);

describe("schema introspection", () => {
	it("describes the simple keys of the configuration for the generated forms", () => {
		expect(leaf("library.name")?.field).toMatchObject({
			kind: "text",
			minLength: 1,
			optional: false,
		});
		expect(leaf("school.classLabel")?.field).toMatchObject({
			kind: "text",
			optional: true,
			default: "{level} {group}",
		});
		expect(leaf("school.promotionAcrossStages")?.field).toMatchObject({
			kind: "choice",
			options: ["keep", "clear", "ask"],
			default: "ask",
		});
		// the stages and levels are lists of objects: edited by their own block
		expect(leaf("school.levels")?.field ?? null).toBeNull();
		expect(leaf("library.contactEmail")?.field).toMatchObject({ kind: "email" });
		expect(leaf("circulation.hardDueDate")?.field).toMatchObject({
			kind: "date",
			nullable: true,
			default: null,
		});
		expect(leaf("performance.smol")?.field).toMatchObject({
			kind: "boolean",
			nullable: true,
		});
		expect(leaf("performance.backupCompress")).toBeUndefined();
		expect(leaf("performance.profile")?.field).toMatchObject({
			kind: "choice",
			options: ["micro", "small", "medium", "large"],
		});
		expect(leaf("metadata.providers")?.field).toMatchObject({ kind: "choices" });
		expect(leaf("cards.layout")?.field).toMatchObject({
			kind: "choice",
			options: ["side-by-side", "duplex"],
		});
		expect(leaf("cards.duplex.flip")?.field).toMatchObject({
			kind: "choice",
			options: ["long-edge", "short-edge"],
		});
		expect(leaf("cards.duplex.backOffsetMm.x")?.field).toMatchObject({
			kind: "number",
			min: -10,
			max: 10,
		});
		// a key with one possible value is shown, not edited
		const fixed = schemaLeaves(
			v.object({ a: v.object({ b: v.optional(v.literal("only"), "only") }) }),
		);
		expect(fixed[0]?.field).toMatchObject({ kind: "fixed", fixed: "only" });
		expect(leaf("barcodes.keyboardLayout")?.field).toMatchObject({ kind: "choice" });
		expect(leaf("ui.theme")?.field).toMatchObject({ kind: "choice" });
		expect(leaf("cards.cardMm.width")?.field).toMatchObject({ kind: "number", min: 0 });
	});

	it("marks keys inside lists, maps and optional groups as needing their own editor", () => {
		expect(leaf("library.itemTypes[].code")?.field).toBeNull();
		expect(leaf("circulation.itemTypeOverrides.*.loanDays")?.field).toBeNull();
		expect(leaf("cards.sheet.cutLines.color")?.field).toBeNull();
		expect(leaf("security.roles.*")?.field).toBeNull();
		expect(leaf("calendar.weeklyClosedDays")?.field).toBeNull();
		expect(leaf("barcodes.patron.counterStart")?.field).toBeNull();
	});

	it("lists the sections in schema order and reads any object schema", () => {
		expect(schemaSections().slice(0, 3)).toEqual(["library", "school", "catalog"]);
		const schema = v.object({
			a: v.optional(v.nullable(v.number()), null),
			b: v.object({ c: v.boolean() }),
			d: v.custom<string>(() => true),
		});
		expect(schemaLeaves(schema).map((l) => [l.path, l.field?.kind ?? null])).toEqual([
			["a", "number"],
			["b.c", "boolean"],
			["d", null],
		]);
	});
});
