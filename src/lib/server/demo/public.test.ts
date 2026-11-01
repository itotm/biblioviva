// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env, resetEnvCache } from "#lib/server/env.js";
import { clientAddress } from "#lib/server/auth/client-address.js";
import {
	assertNotDemo,
	DEMO_CLASS_PICTURES,
	DemoBlockedError,
	isDemoClassPicture,
	isDemoPublic,
	nextResetAt,
	scheduleDemoReset,
} from "./public.js";

const saved = { DEMO_PUBLIC: process.env.DEMO_PUBLIC, MP: process.env.METADATA_PROVIDER };

function demo(on: boolean): void {
	if (on) {
		process.env.DEMO_PUBLIC = "1";
	} else {
		delete process.env.DEMO_PUBLIC;
	}
	resetEnvCache();
}

afterEach(() => {
	for (const [key, value] of [
		["DEMO_PUBLIC", saved.DEMO_PUBLIC],
		["METADATA_PROVIDER", saved.MP],
	] as const) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	resetEnvCache();
	vi.useRealTimers();
});

describe("the guard of the public demo", () => {
	it("refuses a feature only with DEMO_PUBLIC=1", () => {
		demo(false);
		expect(isDemoPublic()).toBe(false);
		expect(() => {
			assertNotDemo("config");
		}).not.toThrow();
		demo(true);
		expect(isDemoPublic()).toBe(true);
		try {
			assertNotDemo("restore");
			expect.unreachable();
		} catch (e) {
			expect(e).toBeInstanceOf(DemoBlockedError);
			expect((e as DemoBlockedError).feature).toBe("restore");
		}
	});

	it("never calls the metadata providers: the mock is forced", () => {
		process.env.METADATA_PROVIDER = "real";
		demo(false);
		expect(env().METADATA_PROVIDER).toBe("real");
		demo(true);
		expect(env().METADATA_PROVIDER).toBe("mock");
	});

	it("has the daily reset at 04:00 by default and refuses a malformed time", () => {
		demo(true);
		expect(env().DEMO_RESET_AT).toBe("04:00");
		expect(env().DEMO_NOTES_PER_DAY).toBe(5);
		process.env.DEMO_RESET_AT = "4am";
		resetEnvCache();
		expect(() => env()).toThrow();
		delete process.env.DEMO_RESET_AT;
	});

	it("knows the shipped class pictures, the scan and the photo, and nothing else", () => {
		for (const path of [DEMO_CLASS_PICTURES.scan, DEMO_CLASS_PICTURES.photo]) {
			const bytes = new Uint8Array(readFileSync(path));
			expect(isDemoClassPicture(bytes)).toBe(true);
			const other = bytes.slice();
			other[100] = (other[100] ?? 0) ^ 0xff;
			expect(isDemoClassPicture(other)).toBe(false);
		}
	});

	it("takes the client's address from the adapter, `unknown` without the header", () => {
		// adapter-bun reads ADDRESS_HEADER (cf-connecting-ip in compose.demo.yml)
		expect(clientAddress({ getClientAddress: () => "203.0.113.7" })).toBe("203.0.113.7");
		expect(
			clientAddress({
				getClientAddress: () => {
					throw new Error("Address header was specified but absent");
				},
			}),
		).toBe("unknown");
	});
});

describe("the daily reset", () => {
	const rome = "Europe/Rome";

	it("is today when the time has not come yet, tomorrow otherwise", () => {
		// 01:00 in Rome (CEST, UTC+2)
		expect(nextResetAt(new Date("2026-07-09T23:00:00Z"), "04:00", rome).toISOString()).toBe(
			"2026-07-10T02:00:00.000Z",
		);
		// 10:00 in Rome
		expect(nextResetAt(new Date("2026-07-10T08:00:00Z"), "04:00", rome).toISOString()).toBe(
			"2026-07-11T02:00:00.000Z",
		);
		// exactly at the reset: the next one
		expect(nextResetAt(new Date("2026-07-10T02:00:00Z"), "04:00", rome).toISOString()).toBe(
			"2026-07-11T02:00:00.000Z",
		);
	});

	it("stays at 04:00 on the library's clock across a change of daylight saving time", () => {
		// autumn: the clocks go back on 25 October 2026 at 03:00 CEST → 04:00 is UTC+1
		expect(nextResetAt(new Date("2026-10-24T12:00:00Z"), "04:00", rome).toISOString()).toBe(
			"2026-10-25T03:00:00.000Z",
		);
		// spring: the clocks go forward on 28 March 2027 at 02:00 CET → 04:00 is UTC+2
		expect(nextResetAt(new Date("2027-03-27T12:00:00Z"), "04:00", rome).toISOString()).toBe(
			"2027-03-28T02:00:00.000Z",
		);
	});

	it("ends the server at the reset time, and can be cancelled", () => {
		vi.useFakeTimers();
		const now = new Date("2026-07-10T01:59:00Z");
		vi.setSystemTime(now);
		const exit = vi.fn();
		const reset = scheduleDemoReset(rome, "04:00", exit);
		expect(reset.at.toISOString()).toBe("2026-07-10T02:00:00.000Z");
		vi.advanceTimersByTime(59_000);
		expect(exit).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1000);
		expect(exit).toHaveBeenCalledOnce();

		const other = vi.fn();
		scheduleDemoReset(rome, "04:00", other).cancel();
		vi.advanceTimersByTime(24 * 60 * 60 * 1000);
		expect(other).not.toHaveBeenCalled();
	});
});
