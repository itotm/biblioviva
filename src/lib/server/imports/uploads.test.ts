// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	finalizeUpload,
	headerSignature,
	readUpload,
	rememberedMapping,
	rememberMapping,
	storeUpload,
	sweepUploads,
	UPLOAD_TTL_MS,
	UploadNotFoundError,
	uploadsDir,
} from "./uploads.js";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-uploads-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

describe("uploads", () => {
	it("stores, reads, finalizes under the batch folder", () => {
		const dataDir = temp();
		const stored = storeUpload(
			dataDir,
			"Elenco classi 2026/27.csv",
			new TextEncoder().encode("a;b"),
			"students",
		);
		expect(stored.filename).toBe("Elenco_classi_2026_27.csv");
		const read = readUpload(dataDir, stored.id);
		expect(new TextDecoder().decode(read.bytes)).toBe("a;b");
		const relative = finalizeUpload(dataDir, stored.id, 7);
		expect(relative).toBe(join("imports", "7", "Elenco_classi_2026_27.csv"));
		expect(readFileSync(join(dataDir, relative), "utf8")).toBe("a;b");
		expect(existsSync(join(uploadsDir(dataDir), stored.id))).toBe(false);
		expect(() => readUpload(dataDir, stored.id)).toThrow(UploadNotFoundError);
		expect(() => readUpload(dataDir, "../etc")).toThrow(UploadNotFoundError);
		const other = storeUpload(dataDir, "", new Uint8Array([1]), "loans");
		expect(other.filename).toBe("import.csv");
	});

	it("sweeps uploads older than a day", () => {
		const dataDir = temp();
		const old = storeUpload(dataDir, "old.csv", new Uint8Array([1]), "loans");
		const fresh = storeUpload(dataDir, "fresh.csv", new Uint8Array([1]), "loans");
		const past = new Date(Date.now() - UPLOAD_TTL_MS - 60_000);
		utimesSync(join(uploadsDir(dataDir), old.id), past, past);
		expect(sweepUploads(dataDir)).toBe(1);
		expect(existsSync(join(uploadsDir(dataDir), old.id))).toBe(false);
		expect(existsSync(join(uploadsDir(dataDir), fresh.id))).toBe(true);
		expect(sweepUploads(temp())).toBe(0);
	});

	it("remembers the mapping per header signature", () => {
		const dataDir = temp();
		const sig = headerSignature([["Nome", "Cognome", "Classe", "Sezione"]], true);
		expect(sig).toBe("nome|cognome|classe|sezione");
		expect(headerSignature([["a", "b", "c"]], false)).toBe("columns:3");
		expect(rememberedMapping(dataDir, "patrons", sig)).toBeNull();
		rememberMapping(dataDir, "patrons", sig, ["firstName", "lastName", "classYear", "section"]);
		rememberMapping(dataDir, "patrons", "other", [null]);
		expect(rememberedMapping(dataDir, "patrons", sig)).toEqual([
			"firstName",
			"lastName",
			"classYear",
			"section",
		]);
		expect(rememberedMapping(dataDir, "patrons", "other")).toEqual([null]);
	});
});
