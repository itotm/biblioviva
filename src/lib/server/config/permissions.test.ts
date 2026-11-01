// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { permissionHint } from "./permissions.js";

describe("startup permission hint", () => {
	it("explains a folder the app cannot write, and stays quiet otherwise", () => {
		const denied = Object.assign(new Error("denied"), { code: "EACCES" });
		const hint = permissionHint(denied, "/config", "CONFIG_DIR");
		expect(hint).toContain("CONFIG_DIR=/config cannot be written (EACCES)");
		expect(hint).toContain("chown -R 1000:1000");
		expect(hint).toContain(":Z");
		expect(
			permissionHint(Object.assign(new Error("ro"), { code: "EROFS" }), "/data", "DATA_DIR"),
		).toContain("DATA_DIR=/data");
		// the backups folder (9.35) is shared with the offsite service: a shared SELinux label
		expect(permissionHint(denied, "/backups", "BACKUP_DIR")).toContain('":z" (shared');
		expect(permissionHint(new Error("other"), "/config", "CONFIG_DIR")).toBeNull();
		expect(permissionHint(null, "/config", "CONFIG_DIR")).toBeNull();
		expect(
			permissionHint(Object.assign(new Error("x"), { code: "ENOENT" }), "/c", "CONFIG_DIR"),
		).toBeNull();
	});
});
