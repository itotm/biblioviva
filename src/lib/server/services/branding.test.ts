// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { solidImage } from "../../../../tests/helpers/images.js";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { ensureConfigDirDefaults, resetConfigCache } from "#lib/server/config/index.js";
import { auditLog, staffUser } from "#lib/server/db/schema.js";
import { encodeLogo, logoPath, logoUrl, removeLibraryLogo, saveLibraryLogo } from "./branding.js";
import { listConfigChanges } from "./config-edit.js";
import { MediaError } from "./media.js";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-branding-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const image = solidImage;

describe("library logo", () => {
	it("stores PNG, JPEG and WebP uploads as PNG, scaled down to 512 px", async () => {
		for (const format of ["png", "jpeg", "webp"] as const) {
			const out = await encodeLogo(await image(40, 20, format));
			expect(await new Bun.Image(out).metadata()).toMatchObject({
				format: "png",
				width: 40,
				height: 20,
			});
		}
		const big = await encodeLogo(await image(1200, 600, "png"));
		expect(await new Bun.Image(big).metadata()).toMatchObject({ width: 512, height: 256 });
	});

	it("refuses empty, oversize, non-image and SVG uploads", async () => {
		const code = async (bytes: Uint8Array): Promise<string> => {
			try {
				await encodeLogo(bytes);
				return "ok";
			} catch (e) {
				return e instanceof MediaError ? e.code : String(e);
			}
		};
		expect(await code(new Uint8Array())).toBe("empty");
		expect(await code(new Uint8Array(5_000_001))).toBe("too_large");
		expect(await code(new TextEncoder().encode("hello"))).toBe("not_an_image");
		const svg = new TextEncoder().encode(
			'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
		);
		expect(["not_an_image", "unsupported_format"]).toContain(await code(svg));
	});

	it("saves, versions and removes the logo as changes of the history, audited", async () => {
		const dir = temp();
		const db = createTestDb();
		const actor = db
			.insert(staffUser)
			.values({ username: "admin", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		ensureConfigDirDefaults(dir);
		expect(logoUrl(dir)).toBeNull();
		await saveLibraryLogo(db, dir, await image(10, 10, "png"), actor);
		expect(existsSync(logoPath(dir))).toBe(true);
		expect(logoUrl(dir)).toMatch(/^\/media\/branding\/logo\?v=\d+$/);
		expect(removeLibraryLogo(db, dir, actor)).toBe(true);
		expect(removeLibraryLogo(db, dir, actor)).toBe(false);
		expect(logoUrl(dir)).toBeNull();
		expect(listConfigChanges(dir).map((c) => [c.action, c.files])).toEqual([
			["config.logo", [{ path: "branding/logo.png", existed: true, removed: true }]],
			["config.logo", [{ path: "branding/logo.png", existed: false }]],
		]);
		expect(
			db
				.select()
				.from(auditLog)
				.all()
				.map((r) => [r.action, (r.details as { action: string }).action]),
		).toEqual([
			["config.logo", "upload"],
			["config.logo", "remove"],
		]);
		resetConfigCache();
	});
});
