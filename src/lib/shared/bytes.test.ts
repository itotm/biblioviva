// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { formatBytes, megabytes } from "./bytes.js";

describe("megabytes", () => {
	it("counts decimal megabytes with the separator of the language", () => {
		expect(megabytes(5_000_000, "it")).toBe("5");
		expect(megabytes(2_500_000, "it")).toBe("2,5");
		expect(megabytes(2_500_000, "en")).toBe("2.5");
		expect(megabytes(5 * 1024 * 1024, "en")).toBe("5.2");
		expect(megabytes(30_000_000, "de")).toBe("30");
	});
});

describe("formatBytes", () => {
	it("picks the unit from bytes to gigabytes", () => {
		expect(formatBytes(0, "en")).toBe("0 byte");
		expect(formatBytes(999, "en")).toBe("999 byte");
		expect(formatBytes(1000, "en")).toBe("1 kB");
		expect(formatBytes(12_345, "it")).toBe("12,3 kB");
		expect(formatBytes(2_500_000, "it")).toBe("2,5 MB");
		expect(formatBytes(1_200_000_000, "en")).toBe("1.2 GB");
	});

	it("writes the unit of the language", () => {
		expect(formatBytes(2_500_000, "de")).toBe("2,5 MB");
		expect(formatBytes(512, "de")).toBe("512 Byte");
	});
});
