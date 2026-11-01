// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { breaks } from "./breaks.js";

describe("breaks", () => {
	it("gives the turn once the time is up, and goes on at once before", async () => {
		const order: string[] = [];
		setImmediate(() => order.push("waiting"));
		const early = breaks(60_000);
		await early();
		order.push("job, before its time");
		const due = breaks(0);
		await due();
		order.push("job, after its break");
		expect(order).toEqual(["job, before its time", "waiting", "job, after its break"]);
	});
});
