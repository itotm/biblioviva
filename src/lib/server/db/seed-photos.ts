// SPDX-License-Identifier: GPL-3.0-or-later
// Photos for the demo data: about half of the seeded patrons get one of the synthetic portraits
// shipped in `demo/photos/` (cartoon faces, no real person), stored exactly like a photo taken at
// the desk (configured format and size, main + thumbnail). A face can belong to several patrons.
// One class is left without photos for the demonstration of the photo census.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fakerIT as faker } from "@faker-js/faker";
import { encodePhoto, storeEncodedPhoto, type PhotoSettings } from "#lib/server/services/media.js";
import type { Db } from "./client.js";

/** The shipped portraits, cwd-relative like `config/` and `drizzle/` (the container copies it). */
export const DEMO_PHOTOS_DIR = "demo/photos";

/** Every student of this class stays without a photo: the photo census starts from a full class. */
export const CENSUS_DEMO_CLASS = { level: "2", group: "C" } as const;

type Sex = "m" | "f" | "any";
type Age = "child" | "adult" | "any";

export interface Portrait {
	file: string;
	sex: Sex;
	age: Age;
}

export interface PatronRow {
	id: number;
	firstName: string;
	patronType: string;
	level: string | null;
	group: string | null;
	photoPath: string | null;
}

const MALE = new Set(faker.definitions.person.first_name.male);
const FEMALE = new Set(faker.definitions.person.first_name.female);

function sexOf(firstName: string): Sex {
	return MALE.has(firstName) ? "m" : FEMALE.has(firstName) ? "f" : "any";
}

function fits(portrait: Portrait, sex: Sex, age: Age): boolean {
	const sexOk = portrait.sex === "any" || sex === "any" || portrait.sex === sex;
	const ageOk = portrait.age === "any" || portrait.age === age;
	return sexOk && ageOk;
}

export function readPortraits(dir: string): Portrait[] {
	const manifest = JSON.parse(readFileSync(join(dir, "photos.json"), "utf8")) as {
		portraits: Portrait[];
	};
	return manifest.portraits;
}

/**
 * Chooses the portrait of every other patron (in id order) outside the census demo class:
 * patron id → portrait file. Faces follow the gender of the first name and the patron type
 * (teachers adult, students children); within a pool they take turns, so faces are shared.
 */
export function planDemoPhotos(patrons: PatronRow[], portraits: Portrait[]): Map<number, string> {
	const plan = new Map<number, string>();
	const turns = new Map<string, number>();
	const eligible = patrons.filter(
		(p) => p.level !== CENSUS_DEMO_CLASS.level || p.group !== CENSUS_DEMO_CLASS.group,
	);
	for (const [index, p] of eligible.entries()) {
		if (index % 2 === 1 || p.photoPath) {
			continue;
		}
		const sex = sexOf(p.firstName);
		const age: Age = p.patronType === "teacher" ? "adult" : "child";
		const pool = portraits.filter((portrait) => fits(portrait, sex, age));
		const candidates = pool.length > 0 ? pool : portraits;
		const key = `${sex}-${age}`;
		const turn = turns.get(key) ?? 0;
		turns.set(key, turn + 1);
		const portrait = candidates[turn % candidates.length];
		if (portrait) {
			plan.set(p.id, portrait.file);
		}
	}
	return plan;
}

/**
 * Stores the planned photos and returns how many patrons got one. Deterministic: the same
 * database gets the same faces and the same file names. Each portrait is encoded once and its
 * bytes written for every patron who shares it.
 */
export async function seedPatronPhotos(
	db: Db,
	dataDir: string,
	settings: PhotoSettings,
	dir = DEMO_PHOTOS_DIR,
): Promise<number> {
	const patrons = db.$client
		.query<PatronRow, []>(
			`SELECT p.id, p.first_name AS firstName, p.patron_type AS patronType,
				p.level_code AS level, g.name AS "group", p.photo_path AS photoPath
			FROM patron p LEFT JOIN class_group g ON g.id = p.class_group_id
			WHERE p.status = 'active' ORDER BY p.id`,
		)
		.all();
	const plan = planDemoPhotos(patrons, readPortraits(dir));
	const encoded = new Map<string, { main: Uint8Array; thumb: Uint8Array }>();
	const format = settings.format ?? "webp";
	for (const [patronId, file] of plan) {
		let photo = encoded.get(file);
		if (!photo) {
			const input = new Uint8Array(readFileSync(join(dir, file)));
			const [main, thumb] = await Promise.all([
				encodePhoto(input, settings, "main"),
				encodePhoto(input, settings, "thumb"),
			]);
			photo = { main, thumb };
			encoded.set(file, photo);
		}
		storeEncodedPhoto(db, dataDir, patronId, { ...photo, format, version: 1 });
	}
	return plan.size;
}
