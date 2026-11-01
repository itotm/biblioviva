// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it } from "vitest";
import { env, resetEnvCache } from "./env.js";

const saved = { ...process.env };

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in saved)) {
			delete process.env[key];
		}
	}
	Object.assign(process.env, saved);
	resetEnvCache();
});

describe("environment", () => {
	it("applies defaults and derives the database path", () => {
		delete process.env.DATABASE_PATH;
		process.env.DATA_DIR = "/tmp/bv-data";
		resetEnvCache();
		const e = env();
		expect(e.DATABASE_PATH).toBe("/tmp/bv-data/db/biblioviva.db");
		expect(e.PORT).toBe(3000);
		expect(e.YAZ_CLIENT).toBe("yaz-client");
		expect(env()).toBe(e); // memoised
	});

	it("keeps the backups in a folder of their own (step 9.35)", () => {
		delete process.env.BACKUP_DIR;
		process.env.DATA_DIR = "/tmp/bv-data";
		resetEnvCache();
		expect(env().BACKUP_DIR).toBe("local/backups");
		process.env.BACKUP_DIR = "/backups";
		resetEnvCache();
		expect(env().BACKUP_DIR).toBe("/backups");
	});

	it("parses numbers and rejects bad values", () => {
		process.env.PORT = "8080";
		resetEnvCache();
		expect(env().PORT).toBe(8080);
		process.env.PORT = "eighty";
		resetEnvCache();
		expect(() => env()).toThrow();
		process.env.PORT = "3000";
		process.env.LOG_LEVEL = "loud";
		resetEnvCache();
		expect(() => env()).toThrow();
	});

	it("keeps a silent connection 120 s unless told, 255 s at most (step 9.32)", () => {
		delete process.env.CONNECTION_IDLE_TIMEOUT;
		resetEnvCache();
		expect(env().CONNECTION_IDLE_TIMEOUT).toBe(120);
		process.env.CONNECTION_IDLE_TIMEOUT = "90";
		resetEnvCache();
		expect(env().CONNECTION_IDLE_TIMEOUT).toBe(90);
		// adapter-bun refuses more than 255: so does the app
		process.env.CONNECTION_IDLE_TIMEOUT = "300";
		resetEnvCache();
		expect(() => env()).toThrow();
	});
});
