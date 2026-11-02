// SPDX-License-Identifier: GPL-3.0-or-later
// Drizzle schema of every table in PLAN.md §4. Conventions: integer ids, ISO-8601 UTC timestamps
// as text, dates as YYYY-MM-DD, booleans as 0/1, enumerations as text with CHECK constraints.
import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	sqliteView,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { SQL } from "drizzle-orm";
import { SHEET_KINDS } from "#lib/shared/sheet-frames.js";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const timestamps = {
	createdAt: text("created_at").notNull().default(now),
	updatedAt: text("updated_at").notNull().default(now),
};

export const BIBLIO_KINDS = ["fiction", "nonfiction"] as const;
export const ITEM_STATUSES = ["available", "lost", "damaged", "in_repair", "withdrawn"] as const;
export const PATRON_TYPES = ["student", "teacher"] as const;
export const PATRON_STATUSES = ["active", "anonymized"] as const;
/** Kinds of class groups (Phase 12, Q94, Q100): the classes of the pupils and the groups of teachers. */
export const GROUP_KINDS = ["students", "teachers"] as const;
export const LOAN_EVENT_TYPES = [
	"issue",
	"renew",
	"return",
	"lost",
	"found",
	"override",
	"notice_printed",
] as const;
export const IMPORT_KINDS = ["patrons", "catalog", "loans"] as const;
export const PRINT_LIST_KINDS = ["patrons", "items"] as const;
export const INVENTORY_STATUSES = ["open", "closed"] as const;
/**
 * A frame of a class picture (Phase 13): waiting for its patron, ignored, saved as the photo, or
 * erased — its patron was removed and the frame is painted over in the picture (Q106).
 */
export const FRAME_STATES = ["pending", "ignored", "saved", "erased"] as const;

const inList = (column: string, values: readonly string[]): SQL =>
	sql.raw(`${column} IN (${values.map((v) => `'${v}'`).join(", ")})`);

export const staffUser = sqliteTable(
	"staff_user",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		username: text("username").notNull(),
		passwordHash: text("password_hash").notNull(),
		displayName: text("display_name"),
		roles: text("roles", { mode: "json" })
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'`),
		active: integer("active").notNull().default(1),
		mustChangePassword: integer("must_change_password").notNull().default(0),
		source: text("source").notNull().default("config"),
		lastLoginAt: text("last_login_at"),
		...timestamps,
	},
	(t) => [
		uniqueIndex("staff_user_username").on(t.username),
		check("staff_user_source", inList("source", ["config", "database"])),
	],
);

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		userId: integer("user_id")
			.notNull()
			.references(() => staffUser.id, { onDelete: "cascade" }),
		createdAt: text("created_at").notNull().default(now),
		expiresAt: text("expires_at").notNull(),
		lastSeenAt: text("last_seen_at").notNull().default(now),
		ip: text("ip"),
		userAgent: text("user_agent"),
	},
	(t) => [index("session_user").on(t.userId), index("session_expires").on(t.expiresAt)],
);

export const biblio = sqliteTable(
	"biblio",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		title: text("title").notNull(),
		subtitle: text("subtitle"),
		/** The title of the original work, only for a translation (step 9.23, Q123). */
		originalTitle: text("original_title"),
		responsibility: text("responsibility"),
		author: text("author").notNull(),
		publisher: text("publisher").notNull(),
		publicationPlace: text("publication_place"),
		publicationYear: integer("publication_year"),
		isbn: text("isbn"),
		issn: text("issn"),
		ean: text("ean"),
		physicalDescription: text("physical_description"),
		/** Series and number in the series (step 9.14, Q84). */
		series: text("series"),
		seriesNumber: text("series_number"),
		dewey: text("dewey"),
		/** A code of `library.itemTypes`, the same for every copy of the title (step 9.45, Q139). */
		itemType: text("item_type").notNull().default("libro"),
		/** `fiction` | `nonfiction`; null while the record waits to be classified (step 9.21, Q117). */
		kind: text("kind"),
		genreCode: text("genre_code"),
		/** A code of `classification.readingLevels` (Phase 12.6). */
		readingLevel: text("reading_level"),
		classCode: text("class_code"),
		subjects: text("subjects", { mode: "json" })
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'`),
		notes: text("notes"),
		coverPath: text("cover_path"),
		coverSource: text("cover_source"),
		source: text("source").notNull().default("manual"),
		sourceId: text("source_id"),
		createdBy: integer("created_by").references(() => staffUser.id),
		updatedBy: integer("updated_by").references(() => staffUser.id),
		...timestamps,
	},
	(t) => [
		uniqueIndex("biblio_isbn").on(t.isbn),
		index("biblio_author").on(t.author),
		index("biblio_series").on(t.series),
		index("biblio_year").on(t.publicationYear),
		index("biblio_kind").on(t.kind),
		index("biblio_genre").on(t.genreCode),
		index("biblio_class").on(t.classCode),
		index("biblio_item_type").on(t.itemType),
		index("biblio_reading_level").on(t.readingLevel),
		check("biblio_kind_check", sql`kind IS NULL OR ${inList("kind", BIBLIO_KINDS)}`),
	],
);

export const item = sqliteTable(
	"item",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		biblioId: integer("biblio_id")
			.notNull()
			.references(() => biblio.id, { onDelete: "restrict" }),
		barcode: text("barcode").notNull(),
		callNumber: text("call_number"),
		/** A code of `classification.readingLevels` (Phase 12.6). */
		readingLevel: text("reading_level"),
		enumeration: text("enumeration"),
		status: text("status").notNull().default("available"),
		notForLoan: integer("not_for_loan").notNull().default(0),
		acquisitionDate: text("acquisition_date"),
		notes: text("notes"),
		barcodeLabelPrintedAt: text("barcode_label_printed_at"),
		spineLabelPrintedAt: text("spine_label_printed_at"),
		...timestamps,
	},
	(t) => [
		uniqueIndex("item_barcode").on(t.barcode),
		index("item_biblio").on(t.biblioId),
		index("item_status").on(t.status),
		index("item_reading_level").on(t.readingLevel),
		// the labels still to print (dashboard tile, print dialog) (9.2)
		index("item_spine_pending")
			.on(t.biblioId)
			.where(sql`spine_label_printed_at IS NULL`),
		index("item_barcode_label_pending")
			.on(t.biblioId)
			.where(sql`barcode_label_printed_at IS NULL`),
		check("item_status_check", inList("status", ITEM_STATUSES)),
	],
);

/**
 * A class of the school (Phase 12, Q94): its own object, no longer two attributes of the patron. A
 * students group hosts one level or several (a pluriclasse) and advances with its pupils at the
 * class upgrade (`3 B` becomes `4 B`, Q100); a teachers group hosts no level. Archived, never deleted.
 */
export const classGroup = sqliteTable(
	"class_group",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		kind: text("kind").notNull(),
		/** The section or the name of the class (`B`, `Coccinelle`, `Docenti`). */
		name: text("name").notNull(),
		/** The stage of a teachers group (optional, for the filters of a comprensivo). */
		stage: text("stage"),
		notes: text("notes"),
		archivedAt: text("archived_at"),
		...timestamps,
	},
	(t) => [
		index("class_group_kind").on(t.kind, t.archivedAt),
		check("class_group_kind_check", inList("kind", GROUP_KINDS)),
	],
);

/** The levels a students group hosts (codes of `school.levels`; several for a pluriclasse). */
export const classGroupLevel = sqliteTable(
	"class_group_level",
	{
		groupId: integer("group_id")
			.notNull()
			.references(() => classGroup.id, { onDelete: "cascade" }),
		levelCode: text("level_code").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.groupId, t.levelCode] }),
		index("class_group_level_level").on(t.levelCode),
	],
);

export const patron = sqliteTable(
	"patron",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		cardNumber: text("card_number"),
		externalId: text("external_id"),
		firstName: text("first_name").notNull(),
		lastName: text("last_name").notNull(),
		searchName: text("search_name").notNull().default(""),
		patronType: text("patron_type").notNull(),
		/** The class (students) or the teachers group (teachers), Phase 12. */
		classGroupId: integer("class_group_id").references(() => classGroup.id),
		/** The pupil's own level (one of the group's levels); NULL for teachers. */
		levelCode: text("level_code"),
		email: text("email"),
		photoPath: text("photo_path"),
		cardPrintedAt: text("card_printed_at"),
		status: text("status").notNull().default("active"),
		circulationNote: text("circulation_note"),
		notes: text("notes"),
		anonymizedAt: text("anonymized_at"),
		...timestamps,
	},
	(t) => [
		uniqueIndex("patron_card_number").on(t.cardNumber),
		uniqueIndex("patron_external_id").on(t.externalId),
		index("patron_search_name").on(t.searchName),
		index("patron_class_group").on(t.classGroupId),
		index("patron_level").on(t.levelCode),
		index("patron_status").on(t.status),
		index("patron_type").on(t.patronType),
		check("patron_type_check", inList("patron_type", PATRON_TYPES)),
		check("patron_status_check", inList("status", PATRON_STATUSES)),
	],
);

export const loan = sqliteTable(
	"loan",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		itemId: integer("item_id")
			.notNull()
			.references(() => item.id),
		patronId: integer("patron_id")
			.notNull()
			.references(() => patron.id),
		issuedAt: text("issued_at").notNull().default(now),
		dueDate: text("due_date").notNull(),
		returnedAt: text("returned_at"),
		renewals: integer("renewals").notNull().default(0),
		lastRenewedAt: text("last_renewed_at"),
		issuedBy: integer("issued_by").references(() => staffUser.id),
		returnedBy: integer("returned_by").references(() => staffUser.id),
		patronTypeSnapshot: text("patron_type_snapshot").notNull(),
		// the class as it was when the book was lent: a photo, never rewritten (Q95)
		levelSnapshot: text("level_snapshot"),
		levelPositionSnapshot: integer("level_position_snapshot"),
		stageSnapshot: text("stage_snapshot"),
		/** The class (a persistent group, never deleted) and its name at the time. */
		groupIdSnapshot: integer("group_id_snapshot"),
		groupSnapshot: text("group_snapshot"),
		classLabelSnapshot: text("class_label_snapshot"),
		schoolYear: text("school_year").notNull(),
		notes: text("notes"),
		...timestamps,
	},
	(t) => [
		uniqueIndex("loan_open_item")
			.on(t.itemId)
			.where(sql`returned_at IS NULL`),
		index("loan_patron").on(t.patronId, t.returnedAt),
		// the loan history of a copy (record page, check-in) without reading every loan (9.2)
		index("loan_item").on(t.itemId, t.issuedAt),
		index("loan_due").on(t.dueDate),
		index("loan_school_year").on(t.schoolYear),
	],
);

export const loanEvent = sqliteTable(
	"loan_event",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		loanId: integer("loan_id")
			.notNull()
			.references(() => loan.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		at: text("at").notNull().default(now),
		byUserId: integer("by_user_id").references(() => staffUser.id),
		details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
	},
	(t) => [
		index("loan_event_loan").on(t.loanId),
		check("loan_event_type_check", inList("type", LOAN_EVENT_TYPES)),
	],
);

/**
 * The levels of the school (`school.levels`, Phase 12), mirrored at startup and on every reload
 * so SQL can order, label and group the classes (`#lib/server/db/config-mirror.ts`).
 */
export const schoolLevel = sqliteTable("school_level", {
	code: text("code").primaryKey(),
	position: integer("position").notNull(),
	label: text("label").notNull(),
	name: text("name").notNull(),
	stage: text("stage").notNull(),
	/** The level of the next school year (the first choice where the path splits); NULL = leaves. */
	nextCode: text("next_code"),
	/** The class label template of the level: its stage's, or the school's (9.41). */
	classLabel: text("class_label"),
});

/** Settings of the configuration SQL needs: `class_label` (the template of `school.classLabel`). */
export const schoolSetting = sqliteTable("school_setting", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
});

/**
 * Every patron with their class as reports need it (Phase 12): the group, the level with its
 * position and stage, and the class label built with the configured template (`3 B`); teachers
 * get their group's name. Live data: a renamed group or level shows its new name.
 */
export const patronClass = sqliteView("patron_class", {
	patronId: integer("patron_id"),
	groupId: integer("group_id"),
	groupKind: text("group_kind"),
	groupName: text("group_name"),
	levelCode: text("level_code"),
	levelPosition: integer("level_position"),
	levelLabel: text("level_label"),
	stage: text("stage"),
	classLabel: text("class_label"),
}).as(
	sql`SELECT p.id AS patron_id, g.id AS group_id, g.kind AS group_kind, g.name AS group_name,
		l.code AS level_code, l.position AS level_position, l.label AS level_label,
		COALESCE(l.stage, g.stage) AS stage,
		CASE WHEN g.id IS NULL THEN NULL
			WHEN l.code IS NULL THEN g.name
			ELSE trim(replace(replace(COALESCE(l.class_label, (SELECT value FROM school_setting WHERE key = 'class_label'), '{level} {group}'), '{level}', l.label), '{group}', g.name))
		END AS class_label
	FROM patron p
	LEFT JOIN class_group g ON g.id = p.class_group_id
	LEFT JOIN school_level l ON l.code = p.level_code`,
);

/** The reading levels (`classification.readingLevels`, Phase 12.6), mirrored like the levels. */
export const readingLevel = sqliteTable("reading_level", {
	code: text("code").primaryKey(),
	position: integer("position").notNull(),
	label: text("label").notNull(),
});

export const sequence = sqliteTable("sequence", {
	name: text("name").primaryKey(),
	value: integer("value").notNull().default(0),
});

export const metadataCache = sqliteTable("metadata_cache", {
	key: text("key").primaryKey(),
	provider: text("provider").notNull(),
	payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
	fetchedAt: text("fetched_at").notNull().default(now),
});

export const auditLog = sqliteTable(
	"audit_log",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		at: text("at").notNull().default(now),
		userId: integer("user_id").references(() => staffUser.id),
		action: text("action").notNull(),
		entity: text("entity").notNull(),
		entityId: text("entity_id"),
		details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
	},
	(t) => [index("audit_at").on(t.at), index("audit_entity").on(t.entity, t.entityId)],
);

export const importBatch = sqliteTable(
	"import_batch",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		kind: text("kind").notNull(),
		filename: text("filename").notNull(),
		storedPath: text("stored_path"),
		mode: text("mode"),
		startedAt: text("started_at").notNull().default(now),
		finishedAt: text("finished_at"),
		summary: text("summary", { mode: "json" }).$type<Record<string, unknown>>(),
		byUserId: integer("by_user_id").references(() => staffUser.id),
	},
	() => [check("import_batch_kind_check", inList("kind", IMPORT_KINDS))],
);

export const printList = sqliteTable(
	"print_list",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		kind: text("kind").notNull(),
		name: text("name").notNull(),
		createdBy: integer("created_by").references(() => staffUser.id),
		lastPrintedAt: text("last_printed_at"),
		...timestamps,
	},
	() => [check("print_list_kind_check", inList("kind", PRINT_LIST_KINDS))],
);

/**
 * The wishlist (step 9.15, Q88): books the library would like to have. At least one of title,
 * author and series; the patron who asked is optional and erased with the patron; the same book
 * asked again adds a request.
 */
export const wish = sqliteTable(
	"wish",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		title: text("title"),
		author: text("author"),
		series: text("series"),
		seriesNumber: text("series_number"),
		note: text("note"),
		patronId: integer("patron_id").references(() => patron.id, { onDelete: "set null" }),
		requests: integer("requests").notNull().default(1),
		createdBy: integer("created_by").references(() => staffUser.id),
		...timestamps,
	},
	(t) => [
		index("wish_patron").on(t.patronId),
		check(
			"wish_something_check",
			sql`coalesce(${t.title}, ${t.author}, ${t.series}) is not null`,
		),
		check("wish_requests_check", sql`${t.requests} >= 1`),
	],
);

/**
 * The staff notes, "Segnalazioni" (step 9.18, Q113): written once by any account and never edited;
 * the administrator pins them to the dashboard, archives, restores and deletes them. The colours
 * are `NOTE_COLORS` of `#lib/shared/notes.ts`; an archived note is never pinned.
 */
export const note = sqliteTable(
	"note",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		body: text("body").notNull(),
		color: text("color").notNull().default("yellow"),
		pinned: integer("pinned").notNull().default(0),
		createdBy: integer("created_by").references(() => staffUser.id),
		createdAt: text("created_at").notNull().default(now),
		archivedAt: text("archived_at"),
		archivedBy: integer("archived_by").references(() => staffUser.id),
	},
	(t) => [
		index("note_open").on(t.archivedAt, t.pinned, t.createdAt),
		check("note_color_check", inList("color", ["yellow", "pink", "green", "blue", "orange"])),
		check("note_body_check", sql`length(trim(${t.body})) > 0`),
		check("note_pinned_check", sql`${t.pinned} = 0 or ${t.archivedAt} is null`),
	],
);

/**
 * A notable date of the calendar (step 9.25, Q125): a reading in a class, a deadline of the
 * bookmark contest; free text, one day or a period, written by the accounts with `loans`.
 */
export const calendarEvent = sqliteTable(
	"calendar_event",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		startsOn: text("starts_on").notNull(),
		endsOn: text("ends_on"),
		title: text("title").notNull(),
		notes: text("notes"),
		createdBy: integer("created_by").references(() => staffUser.id),
		updatedBy: integer("updated_by").references(() => staffUser.id),
		...timestamps,
	},
	(t) => [
		index("calendar_event_dates").on(t.startsOn, t.endsOn),
		check("calendar_event_title_check", sql`length(trim(${t.title})) > 0`),
		check(
			"calendar_event_period_check",
			sql`${t.endsOn} is null or ${t.endsOn} > ${t.startsOn}`,
		),
	],
);

export const printListEntry = sqliteTable(
	"print_list_entry",
	{
		listId: integer("list_id")
			.notNull()
			.references(() => printList.id, { onDelete: "cascade" }),
		entityId: integer("entity_id").notNull(),
		position: integer("position").notNull(),
		addedAt: text("added_at").notNull().default(now),
	},
	(t) => [
		uniqueIndex("print_list_entry_unique").on(t.listId, t.entityId),
		index("print_list_entry_list").on(t.listId, t.position),
	],
);

/**
 * A picture with many photos for the photo census (Phase 13, Q103–Q109): the photographer's sheet,
 * the class's cards on a table. It belongs to one class or one patron print list (exactly one), is
 * kept until the class upgrade (Q106) and deleted at once with a patron removed from it.
 */
export const classPhotoSheet = sqliteTable(
	"class_photo_sheet",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		classGroupId: integer("class_group_id").references(() => classGroup.id),
		printListId: integer("print_list_id").references(() => printList.id, {
			onDelete: "cascade",
		}),
		/** Under DATA_DIR (`uploads/class-sheets/<id>-<version>.<ext>`). */
		path: text("path").notNull(),
		width: integer("width").notNull(),
		height: integer("height").notNull(),
		/**
		 * "photo" (taken at an angle: a frame follows the perspective) or "scan" (lying flat: a frame
		 * is a rectangle that can only be turned), `#lib/shared/sheet-frames.ts`.
		 */
		kind: text("kind").notNull().default("photo"),
		/** When the frames were first found (null: the browser has not looked yet). */
		detectedAt: text("detected_at"),
		uploadedBy: integer("uploaded_by").references(() => staffUser.id),
		...timestamps,
	},
	(t) => [
		index("class_photo_sheet_group").on(t.classGroupId),
		index("class_photo_sheet_list").on(t.printListId),
		check(
			"class_photo_sheet_owner_check",
			sql`(${t.classGroupId} IS NULL) <> (${t.printListId} IS NULL)`,
		),
		check("class_photo_sheet_kind_check", inList("kind", SHEET_KINDS)),
	],
);

/**
 * A photo frame of a class picture: its corners in the picture's pixels, the straightened crop
 * (stored at the photo size), and the patron chosen for it — a draft until the picture is saved.
 * One frame per patron among the pictures of a class or list (checked by the service).
 */
export const classPhotoFrame = sqliteTable(
	"class_photo_frame",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		sheetId: integer("sheet_id")
			.notNull()
			.references(() => classPhotoSheet.id, { onDelete: "cascade" }),
		/** Reading order in the picture (1, 2, …). */
		position: integer("position").notNull(),
		/** Top-left, top-right, bottom-right, bottom-left, in the picture's pixels. */
		corners: text("corners", { mode: "json" }).$type<{ x: number; y: number }[]>().notNull(),
		/** The straightened photo under DATA_DIR, at the configured photo size; empty once erased. */
		cropPath: text("crop_path").notNull(),
		state: text("state").notNull().default("pending"),
		patronId: integer("patron_id").references(() => patron.id),
		assignedAt: text("assigned_at"),
		savedAt: text("saved_at"),
		/**
		 * When an erased frame was painted over in the picture (Q106): NULL while still to do, right
		 * after the removal (the painting cannot run inside the removal's transaction).
		 */
		paintedAt: text("painted_at"),
		...timestamps,
	},
	(t) => [
		index("class_photo_frame_sheet").on(t.sheetId, t.position),
		index("class_photo_frame_patron").on(t.patronId),
		check("class_photo_frame_state_check", inList("state", FRAME_STATES)),
	],
);

/** A stocktaking campaign (step 9.8): open while the shelves are scanned, closed with a summary. */
export const inventory = sqliteTable(
	"inventory",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		name: text("name").notNull(),
		status: text("status").notNull().default("open"),
		startedAt: text("started_at").notNull().default(now),
		startedBy: integer("started_by").references(() => staffUser.id),
		closedAt: text("closed_at"),
		closedBy: integer("closed_by").references(() => staffUser.id),
		notes: text("notes"),
		summary: text("summary", { mode: "json" }).$type<Record<string, unknown>>(),
	},
	() => [check("inventory_status_check", inList("status", INVENTORY_STATUSES))],
);

/** One copy seen during a campaign (once per copy); `shelf` is the context the scan ran in. */
export const inventoryScan = sqliteTable(
	"inventory_scan",
	{
		inventoryId: integer("inventory_id")
			.notNull()
			.references(() => inventory.id, { onDelete: "cascade" }),
		itemId: integer("item_id")
			.notNull()
			.references(() => item.id, { onDelete: "cascade" }),
		scannedAt: text("scanned_at").notNull().default(now),
		scannedBy: integer("scanned_by").references(() => staffUser.id),
		shelf: text("shelf"),
		misplaced: integer("misplaced").notNull().default(0),
		/** The copy was marked lost and turned up with this scan. */
		found: integer("found").notNull().default(0),
	},
	(t) => [
		uniqueIndex("inventory_scan_unique").on(t.inventoryId, t.itemId),
		index("inventory_scan_at").on(t.inventoryId, t.scannedAt),
	],
);

export type Biblio = typeof biblio.$inferSelect;
export type Item = typeof item.$inferSelect;
export type Patron = typeof patron.$inferSelect;
export type Loan = typeof loan.$inferSelect;
export type NewLoan = typeof loan.$inferInsert;
