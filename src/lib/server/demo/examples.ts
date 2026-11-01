// SPDX-License-Identifier: GPL-3.0-or-later
// The example files of the CSV imports in the public demo (PLAN.md step 9.17, Q121, ADR-035):
// students, teachers and the catalogue accept only the file the demo made at its start, valid
// against its classes and its classification and recognised by its SHA-256, so no list of real
// pupils or free text of a visitor reaches the shared data. The template download of each import
// gives that file in the demo. The loans import (card numbers, barcodes and dates) stays free.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { base, en, Faker, it } from "@faker-js/faker";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { schoolEmail } from "#lib/server/db/seed.js";
import { writeCsv } from "#lib/server/imports/csv.js";
import { schoolOf } from "#lib/server/school/structure.js";
import { groupsById } from "#lib/server/services/class-groups.js";
import { classLabels } from "#lib/shared/school.js";
import { isDemoPublic } from "./public.js";

export const DEMO_EXAMPLE_KINDS = ["students", "teachers", "catalog"] as const;
export type DemoExampleKind = (typeof DEMO_EXAMPLE_KINDS)[number];

const isExampleKind = (kind: string): kind is DemoExampleKind =>
	(DEMO_EXAMPLE_KINDS as readonly string[]).includes(kind);

/** The name of an example file, also the name a stored upload of the demo takes. */
export const demoExampleName = (kind: DemoExampleKind): string => `${kind}-example.csv`;

export function demoExamplePath(dataDir: string, kind: DemoExampleKind): string {
	return join(dataDir, "demo", "imports", demoExampleName(kind));
}

/** The rows of the three examples, from the demo's classes and classification. */
export function demoExampleRows(
	db: DbOrTx,
	config: AppConfig,
	seed = 121,
): Record<DemoExampleKind, string[][]> {
	const faker = new Faker({ locale: [it, en, base], seed });
	const school = schoolOf(config);
	const classes = classLabels(school, [...groupsById(db, school).values()]).slice(0, 3);
	const person = (): [string, string] => [faker.person.firstName(), faker.person.lastName()];
	// the school's address of each person (9.22)
	const emails = new Set<string>();
	const email = (first: string, last: string): string =>
		schoolEmail(first, last, "scuola.example", emails);
	const students: string[][] = [["first_name", "last_name", "class", "email"]];
	for (let i = 0; i < 8; i++) {
		const [first, last] = person();
		students.push([
			first,
			last,
			classes[i % Math.max(1, classes.length)] ?? "",
			email(first, last),
		]);
	}
	const teachers: string[][] = [["first_name", "last_name", "email"]];
	for (let i = 0; i < 3; i++) {
		const [first, last] = person();
		teachers.push([first, last, email(first, last)]);
	}
	const classification = config.classification;
	const genre = classification.genres[0]?.code ?? "";
	const level =
		classification.fictionByClass && !classification.classPerItem
			? (classification.readingLevels[0]?.code ?? "")
			: "";
	const catalog: string[][] = [
		["title", "author", "publisher", "publication_year", "classification", "reading_level"],
	];
	for (let i = 0; i < 6; i++) {
		const author = person();
		// two titles wait for their classification, as a file from another system may leave them
		const classified = i < 4;
		catalog.push([
			faker.book.title(),
			`${author[1]}, ${author[0]}`,
			faker.book.publisher(),
			String(2005 + i * 3),
			classified ? genre : "",
			classified ? level : "",
		]);
	}
	return { students, teachers, catalog };
}

/** Writes the three example files under `DATA_DIR/demo/imports/` (the demo's build). */
export function writeDemoExamples(db: DbOrTx, config: AppConfig, dataDir: string): void {
	const rows = demoExampleRows(db, config);
	mkdirSync(join(dataDir, "demo", "imports"), { recursive: true });
	for (const kind of DEMO_EXAMPLE_KINDS) {
		writeFileSync(demoExamplePath(dataDir, kind), writeCsv(rows[kind]));
	}
}

/** The example file of an import and its name, when the demo has one for it. */
export function readDemoExample(
	dataDir: string,
	kind: string,
): { bytes: Uint8Array; name: string } | null {
	if (!isExampleKind(kind)) {
		return null;
	}
	const path = demoExamplePath(dataDir, kind);
	return existsSync(path)
		? { bytes: new Uint8Array(readFileSync(path)), name: demoExampleName(kind) }
		: null;
}

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/**
 * In the public demo, whether a file may be imported as `kind`: an import with an example takes
 * that file only (same SHA-256). Outside the demo, and for the loans import, any file.
 */
export function demoImportAllowed(dataDir: string, kind: string, bytes: Uint8Array): boolean {
	if (!isDemoPublic() || !isExampleKind(kind)) {
		return true;
	}
	const example = readDemoExample(dataDir, kind);
	return example !== null && sha256(example.bytes) === sha256(bytes);
}
