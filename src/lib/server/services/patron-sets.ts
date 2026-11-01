// SPDX-License-Identifier: GPL-3.0-or-later
// A set of patrons for the photo census (PLAN.md Phase 13, Q108): a class (or the patrons left
// without one) or a patron print list (2.8). The census, the class pictures and their drop-downs
// share one notion of "the active patrons of this set", with or without a photo.
import { and, asc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { classGroup, patron, printList, printListEntry } from "#lib/server/db/schema.js";
import { groupLabel, type SchoolStructure } from "#lib/shared/school.js";
import { groupsById } from "./class-groups.js";

/** A class (`null`: the patrons without one) or a patron print list. */
export type PatronSet = { group: number | null } | { list: number };

export interface SetMember {
	id: number;
	firstName: string;
	lastName: string;
	hasPhoto: boolean;
}

export const isListSet = (set: PatronSet): set is { list: number } => "list" in set;

/** The condition on `patron` that selects the active members of a set. */
function memberCondition(set: PatronSet): SQL | undefined {
	const membership = isListSet(set)
		? inArray(
				patron.id,
				sql`(SELECT ${printListEntry.entityId} FROM ${printListEntry} WHERE ${printListEntry.listId} = ${set.list})`,
			)
		: set.group === null
			? isNull(patron.classGroupId)
			: eq(patron.classGroupId, set.group);
	return and(membership, ne(patron.status, "anonymized"));
}

/** True when the class or the patron list exists. */
export function setExists(db: DbOrTx, set: PatronSet): boolean {
	if (isListSet(set)) {
		return (
			db
				.select({ id: printList.id })
				.from(printList)
				.where(and(eq(printList.id, set.list), eq(printList.kind, "patrons")))
				.get() !== undefined
		);
	}
	return (
		set.group === null ||
		db
			.select({ id: classGroup.id })
			.from(classGroup)
			.where(eq(classGroup.id, set.group))
			.get() !== undefined
	);
}

/** The active members of a set, those without a photo first, then by name. */
export function setMembers(db: DbOrTx, set: PatronSet): SetMember[] {
	return db
		.select({
			id: patron.id,
			firstName: patron.firstName,
			lastName: patron.lastName,
			photoPath: patron.photoPath,
		})
		.from(patron)
		.where(memberCondition(set))
		.orderBy(
			sql`case when ${patron.photoPath} is null then 0 else 1 end`,
			asc(patron.searchName),
		)
		.all()
		.map(({ photoPath, ...r }) => ({ ...r, hasPhoto: photoPath !== null }));
}

/** True when the patron is an active member of the set. */
export function isMember(db: DbOrTx, set: PatronSet, patronId: number): boolean {
	return (
		db
			.select({ id: patron.id })
			.from(patron)
			.where(and(memberCondition(set), eq(patron.id, patronId)))
			.get() !== undefined
	);
}

/** A patron print list in the census: its name and the photo progress of its active members. */
export interface CensusList {
	listId: number;
	name: string;
	total: number;
	withPhoto: number;
}

/** Every patron print list, by name, with the photo progress of its active members. */
export function censusLists(db: DbOrTx): CensusList[] {
	return db
		.select({
			listId: printList.id,
			name: printList.name,
			total: sql<number>`count(${patron.id})`,
			withPhoto: sql<number>`coalesce(sum(case when ${patron.photoPath} is not null then 1 else 0 end), 0)`,
		})
		.from(printList)
		.leftJoin(printListEntry, eq(printListEntry.listId, printList.id))
		.leftJoin(
			patron,
			and(eq(patron.id, printListEntry.entityId), ne(patron.status, "anonymized")),
		)
		.where(eq(printList.kind, "patrons"))
		.groupBy(printList.id)
		.orderBy(asc(printList.name))
		.all();
}

/** How a set is called on screen: the class label (`3 B`, `Docenti`) or the list's name. */
export function setLabel(db: DbOrTx, set: PatronSet, school: SchoolStructure): string {
	if (isListSet(set)) {
		return (
			db
				.select({ name: printList.name })
				.from(printList)
				.where(eq(printList.id, set.list))
				.get()?.name ?? ""
		);
	}
	const group = set.group === null ? undefined : groupsById(db, school).get(set.group);
	return group ? groupLabel(school, group) : "";
}
