// SPDX-License-Identifier: GPL-3.0-or-later
// Backups page (step 1.9, 1.9b): run a backup, see it listed, download it as a SQLite file;
// "Esporta tutto" streams a ZIP with the database snapshot, the uploads and the configuration.
import { unzipSync, strFromU8 } from "fflate";
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

test.describe("admin backups", () => {
	test("runs a backup, lists it and serves the download to admins only", async ({ page }) => {
		await page.goto("/admin/backups");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Backup");
		await expect(page.getByTestId("offsite-status")).toHaveAttribute("data-state", "disabled");

		await expect(page.getByTestId("backup-contents")).toBeVisible();
		await page.getByTestId("run-backup").click();
		await expect(page.getByRole("status").getByText(/Backup creato/)).toBeVisible();
		await expect(page.getByTestId("backup-images")).toContainText(/copertine/);
		const row = page.getByTestId("backup-row").first();
		await expect(row).toContainText(/biblioviva-\d{8}-\d{4}(-\d+)?\.db/);
		await expectAxeClean(page);

		const href = await row.getByRole("link", { name: "Scarica" }).getAttribute("href");
		const res = await page.request.get(href!);
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toContain("sqlite");
		const body = await res.body();
		expect(body.subarray(0, 15).toString()).toBe("SQLite format 3");

		// "Esporta tutto": one ZIP with manifest, database snapshot, configuration and uploads
		const exportHref = await page.getByTestId("export-all").getAttribute("href");
		const archive = await page.request.get(exportHref!);
		expect(archive.status()).toBe(200);
		expect(archive.headers()["content-type"]).toContain("zip");
		expect(archive.headers()["content-disposition"]).toMatch(
			/biblioviva-export-\d{8}-\d{4}\.zip/,
		);
		const entries = unzipSync(new Uint8Array(await archive.body()));
		const names = Object.keys(entries);
		expect(names).toContain("manifest.json");
		expect(names).toContain("db/biblioviva.db");
		expect(names).toContain("config/config.json");
		expect(names.some((n) => n.startsWith("config/cards/"))).toBe(true);
		const manifest = JSON.parse(strFromU8(entries["manifest.json"]!)) as {
			app: string;
			config: { files: number };
		};
		expect(manifest.app).toBe("BiblioViva");
		expect(manifest.config.files).toBeGreaterThan(1);
		expect(strFromU8(entries["db/biblioviva.db"]!.subarray(0, 15))).toBe("SQLite format 3");

		// path traversal and unknown names are rejected
		expect(
			(await page.request.get("/admin/backups/download/..%2Fdb%2Fbiblioviva.db")).status(),
		).toBe(404);
		expect(
			(
				await page.request.get("/admin/backups/download/biblioviva-20990101-0000.db")
			).status(),
		).toBe(404);
	});
});
