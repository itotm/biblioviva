// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { reportContext, reportDecorations } from "./context.js";

const config = parseConfig(exampleRaw()).config;

describe("report context", () => {
	it("uses the library's day, school year and configuration", () => {
		const ctx = reportContext(config, new Date("2026-02-10T23:30:00Z"));
		expect(ctx.today).toBe("2026-02-11");
		expect(ctx.schoolYearStart).toBe("2025-09-01");
		expect(ctx.levels).toEqual(config.school.levels.map((l) => l.code));
		expect(ctx.levels).toEqual(["1", "2", "3", "4", "5"]);
		expect(ctx.stages).toEqual(["primaria"]);
		expect(ctx.classificationCodes).toContain("590");
		expect(ctx.itemTypes).toContain("dvd");
	});

	it("labels coded columns in the installation's language", async () => {
		const it = await reportDecorations(config, "it");
		expect(it.patronTypes).toEqual({ student: "Studente", teacher: "Docente" });
		expect(it.itemStatuses.in_repair).toBe("In riparazione");
		expect([it.yes, it.no]).toEqual(["Sì", "No"]);
		expect((await reportDecorations(config, "en")).patronTypes.teacher).toBe("Teacher");
	});
});
