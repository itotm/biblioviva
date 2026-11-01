// SPDX-License-Identifier: GPL-3.0-or-later
// Every writer the public demo refuses, refused in its service (9.17, Q118); the same calls
// without the flag are covered by the tests of each service.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import type { Db } from "#lib/server/db/client.js";
import { printList, printListEntry } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { storeUpload } from "#lib/server/imports/uploads.js";
import { saveLibraryLogo, removeLibraryLogo } from "#lib/server/services/branding.js";
import { createBackup, listBackups, runBackup } from "#lib/server/services/backup.js";
import { uploadSheet } from "#lib/server/services/class-sheets.js";
import { setConfigKeys } from "#lib/server/services/config-edit.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import { saveUiChoice } from "#lib/server/services/config-sections.js";
import { writeArchiveBackup } from "#lib/server/services/export-archive.js";
import {
	applyConfigArchive,
	checkConfigArchive,
	checkUploadedConfigArchive,
	stageRestore,
} from "#lib/server/services/full-restore.js";
import { renderCardsSheet } from "#lib/server/services/cards.js";
import { renderLabelsSheet } from "#lib/server/services/labels.js";
import { checkReportUpload, installReport } from "#lib/server/services/report-library.js";
import { saveAccount } from "#lib/server/services/staff-config.js";
import {
	DEMO_IMPORT_MAX_BYTES,
	DEMO_PRINT_MAX_SHEETS,
	DemoBlockedError,
	type DemoFeature,
} from "./public.js";

let configDir = "";
let dataDir = "";
const saved = {
	CONFIG_DIR: process.env.CONFIG_DIR,
	DATA_DIR: process.env.DATA_DIR,
	BACKUP_DIR: process.env.BACKUP_DIR,
	DEMO_PUBLIC: process.env.DEMO_PUBLIC,
};
const actor = { id: 1 };

beforeEach(() => {
	configDir = mkdtempSync(join(tmpdir(), "bv-demo-config-"));
	dataDir = mkdtempSync(join(tmpdir(), "bv-demo-data-"));
	process.env.CONFIG_DIR = configDir;
	process.env.DATA_DIR = dataDir;
	process.env.BACKUP_DIR = join(dataDir, "backups");
	delete process.env.DEMO_PUBLIC;
	resetEnvCache();
	resetConfigCache();
	// a configuration written before the flag is on, as the demo build does
	setConfigKeys(configDir, "test", { "performance.argon2MemoryMb": 8 });
	process.env.DEMO_PUBLIC = "1";
	resetEnvCache();
});

afterEach(() => {
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	resetEnvCache();
	resetConfigCache();
	rmSync(configDir, { recursive: true, force: true });
	rmSync(dataDir, { recursive: true, force: true });
});

async function refused(feature: DemoFeature, run: () => unknown): Promise<void> {
	try {
		await run();
	} catch (e) {
		expect(e).toBeInstanceOf(DemoBlockedError);
		expect((e as DemoBlockedError).feature).toBe(feature);
		return;
	}
	expect.unreachable(`not refused: ${feature}`);
}

const report = (file: string): Uint8Array => readFileSync(join("config/reports", file));
const noDb = {} as Db;

describe("the public demo refuses", () => {
	it("every write of the configuration, staff accounts and passwords included", async () => {
		await refused("config", () => setConfigKeys(configDir, "x", { "library.name": "Altra" }));
		await refused("config", () =>
			saveUiChoice(createTestDb(), configDir, "locale", "it", { id: 1 }),
		);
		await refused("config", () => setUiTheme(configDir, "grape"));
		await refused("config", () =>
			saveAccount(
				createTestDb(),
				configDir,
				{
					originalUsername: null,
					username: "intruso",
					displayName: "Intruso",
					roles: ["admin"],
					active: true,
					password: "una-password-lunga",
				},
				actor,
			),
		);
		await refused("config", () =>
			saveLibraryLogo(createTestDb(), configDir, new Uint8Array([1, 2, 3]), actor),
		);
		await refused("config", () => removeLibraryLogo(createTestDb(), configDir, actor));
		// a guided report passes its own check, then stops at the configuration write
		await refused("config", () =>
			installReport(
				createTestDb(),
				configDir,
				report("classification-by-level.json"),
				() => undefined,
				actor,
			),
		);
	});

	it("an SQL report before it is tried, never a guided one", async () => {
		let tried = 0;
		const check = (): void => {
			tried++;
		};
		await refused("sqlReports", () =>
			checkReportUpload(report("average-loan-duration.json"), check),
		);
		expect(tried).toBe(0);
		expect(checkReportUpload(report("classification-by-level.json"), check).id).toBe(
			"classification-by-level",
		);
		expect(tried).toBe(1);
	});

	it("a configuration archive, a restore and the manual backups", async () => {
		await refused("configImport", () =>
			checkUploadedConfigArchive({ db: noDb, configDir, dataDir }, new Uint8Array()),
		);
		await refused("configImport", () =>
			checkConfigArchive({ db: noDb, configDir, dataDir }, join(dataDir, "x.zip")),
		);
		await refused("configImport", () =>
			applyConfigArchive({ db: noDb, configDir, dataDir }, "0".repeat(32), null),
		);
		await refused("restore", () => stageRestore(dataDir, join(dataDir, "x.zip"), "x.zip"));
		const db = createTestDb();
		await refused("backups", () =>
			runBackup(db, dataDir, { timezone: "Europe/Rome", keepDays: 30 }),
		);
		await refused("backups", () =>
			writeArchiveBackup(db, dataDir, configDir, { timezone: "Europe/Rome", parts: [] }),
		);
	});

	it("keeps one backup at a time for the class upgrade", () => {
		const db = createTestDb();
		createBackup(db, "Europe/Rome", new Date("2026-07-10T08:00:00Z"));
		createBackup(db, "Europe/Rome", new Date("2026-07-10T08:05:00Z"));
		const last = createBackup(db, "Europe/Rome", new Date("2026-07-10T08:10:00Z"));
		expect(listBackups().map((b) => b.name)).toEqual([last.name]);
	});

	it("class pictures uploaded, except the shipped one (other pictures are replaced, content.test)", async () => {
		const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
		await refused("pictures", () =>
			uploadSheet(
				noDb,
				dataDir,
				{ group: 1, level: null } as never,
				bytes,
				getConfig().photos,
				actor,
			),
		);
	});

	it("files to import over the size cap", async () => {
		await refused("importSize", () =>
			storeUpload(dataDir, "big.csv", new Uint8Array(DEMO_IMPORT_MAX_BYTES + 1), "loans"),
		);
		expect(
			storeUpload(dataDir, "small.csv", new TextEncoder().encode("a,b\n"), "loans").id,
		).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("print sheets of labels and cards over the sheets cap, never a smaller one", async () => {
		const db = createTestDb();
		seedDatabase(db, { patrons: 60, teachers: 0, biblios: 40, items: 60, loans: 0 });
		const config = getConfig();
		// pairs on the A4 stock of 70 × 48 mm: nine a sheet
		const fits = Array.from({ length: DEMO_PRINT_MAX_SHEETS * 9 }, (_, i) => i + 1);
		expect(
			(await renderLabelsSheet({ db, config, configDir }, "pair", { ids: fits })).pages,
		).toBe(DEMO_PRINT_MAX_SHEETS);
		await refused("printSize", () =>
			renderLabelsSheet({ db, config, configDir }, "pair", {
				ids: [...fits, fits.length + 1],
			}),
		);
		// a sheet that starts further down counts its empty places too
		await refused("printSize", () =>
			renderLabelsSheet({ db, config, configDir }, "pair", { ids: fits }, { start: 2 }),
		);
		expect(
			(await renderCardsSheet({ db, config, configDir, dataDir }, { ids: [1, 2] })).count,
		).toBe(2);
		await refused("printSize", () =>
			renderCardsSheet({ db, config, configDir, dataDir }, { patronType: "student" }),
		);
		db.$client.close();
	});

	it("prints every list of the demo data within the sheets cap", async () => {
		// the owner's report (9.13, round 24): printing the cards of a list of the demo data was
		// refused, the list was longer than the cap
		const db = createTestDb();
		seedDatabase(db);
		const config = getConfig();
		const lists = db.select({ id: printList.id, kind: printList.kind }).from(printList).all();
		expect(lists.map((l) => l.kind).sort()).toEqual([
			"items",
			"items",
			"patrons",
			"patrons",
			"patrons",
		]);
		for (const l of lists) {
			const ids = db
				.select({ id: printListEntry.entityId })
				.from(printListEntry)
				.where(eq(printListEntry.listId, l.id))
				.orderBy(printListEntry.position)
				.all()
				.map((e) => e.id);
			await (l.kind === "patrons"
				? renderCardsSheet({ db, config, configDir, dataDir }, { ids })
				: renderLabelsSheet({ db, config, configDir }, "pair", { ids }));
		}
		db.$client.close();
	}, 60_000);
});
