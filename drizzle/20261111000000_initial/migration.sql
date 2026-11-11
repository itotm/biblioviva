CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`details` text,
	CONSTRAINT `fk_audit_log_user_id_staff_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `staff_user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `biblio` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`subtitle` text,
	`original_title` text,
	`responsibility` text,
	`author` text NOT NULL,
	`publisher` text NOT NULL,
	`publication_place` text,
	`publication_year` integer,
	`isbn` text,
	`issn` text,
	`ean` text,
	`physical_description` text,
	`series` text,
	`series_number` text,
	`dewey` text,
	`item_type` text DEFAULT 'libro' NOT NULL,
	`kind` text,
	`genre_code` text,
	`reading_level` text,
	`class_code` text,
	`call_text` text,
	`subjects` text DEFAULT '[]' NOT NULL,
	`accessible_formats` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`cover_path` text,
	`cover_source` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_id` text,
	`created_by` integer,
	`updated_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_biblio_created_by_staff_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT `fk_biblio_updated_by_staff_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT "biblio_kind_check" CHECK(kind IS NULL OR kind IN ('fiction', 'nonfiction'))
);
--> statement-breakpoint
CREATE TABLE `calendar_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`title` text NOT NULL,
	`notes` text,
	`created_by` integer,
	`updated_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_calendar_event_created_by_staff_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT `fk_calendar_event_updated_by_staff_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT "calendar_event_title_check" CHECK(length(trim("title")) > 0),
	CONSTRAINT "calendar_event_period_check" CHECK("ends_on" is null or "ends_on" > "starts_on")
);
--> statement-breakpoint
CREATE TABLE `class_group` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`stage` text,
	`notes` text,
	`archived_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "class_group_kind_check" CHECK(kind IN ('students', 'teachers'))
);
--> statement-breakpoint
CREATE TABLE `class_group_level` (
	`group_id` integer NOT NULL,
	`level_code` text NOT NULL,
	CONSTRAINT `class_group_level_pk` PRIMARY KEY(`group_id`, `level_code`),
	CONSTRAINT `fk_class_group_level_group_id_class_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `class_group`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `class_photo_frame` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`sheet_id` integer NOT NULL,
	`position` integer NOT NULL,
	`corners` text NOT NULL,
	`crop_path` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`patron_id` integer,
	`assigned_at` text,
	`saved_at` text,
	`painted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_class_photo_frame_sheet_id_class_photo_sheet_id_fk` FOREIGN KEY (`sheet_id`) REFERENCES `class_photo_sheet`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_class_photo_frame_patron_id_patron_id_fk` FOREIGN KEY (`patron_id`) REFERENCES `patron`(`id`),
	CONSTRAINT "class_photo_frame_state_check" CHECK(state IN ('pending', 'ignored', 'saved', 'erased'))
);
--> statement-breakpoint
CREATE TABLE `class_photo_sheet` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`class_group_id` integer,
	`print_list_id` integer,
	`path` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`kind` text DEFAULT 'photo' NOT NULL,
	`detected_at` text,
	`uploaded_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_class_photo_sheet_class_group_id_class_group_id_fk` FOREIGN KEY (`class_group_id`) REFERENCES `class_group`(`id`),
	CONSTRAINT `fk_class_photo_sheet_print_list_id_print_list_id_fk` FOREIGN KEY (`print_list_id`) REFERENCES `print_list`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_class_photo_sheet_uploaded_by_staff_user_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT "class_photo_sheet_owner_check" CHECK(("class_group_id" IS NULL) <> ("print_list_id" IS NULL)),
	CONSTRAINT "class_photo_sheet_kind_check" CHECK(kind IN ('photo', 'scan'))
);
--> statement-breakpoint
CREATE TABLE `import_batch` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`stored_path` text,
	`mode` text,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`finished_at` text,
	`summary` text,
	`by_user_id` integer,
	CONSTRAINT `fk_import_batch_by_user_id_staff_user_id_fk` FOREIGN KEY (`by_user_id`) REFERENCES `staff_user`(`id`),
	CONSTRAINT "import_batch_kind_check" CHECK(kind IN ('patrons', 'catalog', 'loans'))
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`started_by` integer,
	`closed_at` text,
	`closed_by` integer,
	`notes` text,
	`summary` text,
	CONSTRAINT `fk_inventory_started_by_staff_user_id_fk` FOREIGN KEY (`started_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT `fk_inventory_closed_by_staff_user_id_fk` FOREIGN KEY (`closed_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT "inventory_status_check" CHECK(status IN ('open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE `inventory_scan` (
	`inventory_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`scanned_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`scanned_by` integer,
	`shelf` text,
	`misplaced` integer DEFAULT 0 NOT NULL,
	`found` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_inventory_scan_inventory_id_inventory_id_fk` FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_inventory_scan_item_id_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_inventory_scan_scanned_by_staff_user_id_fk` FOREIGN KEY (`scanned_by`) REFERENCES `staff_user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `item` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`biblio_id` integer NOT NULL,
	`barcode` text NOT NULL,
	`call_number` text,
	`call_head` text,
	`call_text` text,
	`reading_level` text,
	`enumeration` text,
	`status` text DEFAULT 'available' NOT NULL,
	`not_for_loan` integer DEFAULT 0 NOT NULL,
	`acquisition_date` text,
	`notes` text,
	`inventory_number` text,
	`origin` text,
	`value_cents` integer,
	`withdrawn_on` text,
	`withdrawn_reason` text,
	`barcode_label_printed_at` text,
	`spine_label_printed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_item_biblio_id_biblio_id_fk` FOREIGN KEY (`biblio_id`) REFERENCES `biblio`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "item_status_check" CHECK(status IN ('available', 'lost', 'damaged', 'in_repair', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE `loan` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`item_id` integer NOT NULL,
	`patron_id` integer NOT NULL,
	`issued_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`due_date` text NOT NULL,
	`returned_at` text,
	`renewals` integer DEFAULT 0 NOT NULL,
	`last_renewed_at` text,
	`issued_by` integer,
	`returned_by` integer,
	`patron_type_snapshot` text NOT NULL,
	`level_snapshot` text,
	`level_position_snapshot` integer,
	`stage_snapshot` text,
	`group_id_snapshot` integer,
	`group_snapshot` text,
	`class_label_snapshot` text,
	`school_year` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_loan_item_id_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `item`(`id`),
	CONSTRAINT `fk_loan_patron_id_patron_id_fk` FOREIGN KEY (`patron_id`) REFERENCES `patron`(`id`),
	CONSTRAINT `fk_loan_issued_by_staff_user_id_fk` FOREIGN KEY (`issued_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT `fk_loan_returned_by_staff_user_id_fk` FOREIGN KEY (`returned_by`) REFERENCES `staff_user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `loan_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`loan_id` integer NOT NULL,
	`type` text NOT NULL,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`by_user_id` integer,
	`details` text,
	CONSTRAINT `fk_loan_event_loan_id_loan_id_fk` FOREIGN KEY (`loan_id`) REFERENCES `loan`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_loan_event_by_user_id_staff_user_id_fk` FOREIGN KEY (`by_user_id`) REFERENCES `staff_user`(`id`),
	CONSTRAINT "loan_event_type_check" CHECK(type IN ('issue', 'renew', 'return', 'lost', 'found', 'override', 'notice_printed'))
);
--> statement-breakpoint
CREATE TABLE `metadata_cache` (
	`key` text PRIMARY KEY,
	`provider` text NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `note` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`body` text NOT NULL,
	`color` text DEFAULT 'yellow' NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`archived_at` text,
	`archived_by` integer,
	CONSTRAINT `fk_note_created_by_staff_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT `fk_note_archived_by_staff_user_id_fk` FOREIGN KEY (`archived_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT "note_color_check" CHECK(color IN ('yellow', 'pink', 'green', 'blue', 'orange')),
	CONSTRAINT "note_body_check" CHECK(length(trim("body")) > 0),
	CONSTRAINT "note_pinned_check" CHECK("pinned" = 0 or "archived_at" is null)
);
--> statement-breakpoint
CREATE TABLE `patron` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`card_number` text,
	`external_id` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`search_name` text DEFAULT '' NOT NULL,
	`patron_type` text NOT NULL,
	`class_group_id` integer,
	`level_code` text,
	`email` text,
	`photo_path` text,
	`card_printed_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`circulation_note` text,
	`notes` text,
	`anonymized_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_patron_class_group_id_class_group_id_fk` FOREIGN KEY (`class_group_id`) REFERENCES `class_group`(`id`),
	CONSTRAINT "patron_type_check" CHECK(patron_type IN ('student', 'teacher')),
	CONSTRAINT "patron_status_check" CHECK(status IN ('active', 'anonymized'))
);
--> statement-breakpoint
CREATE TABLE `print_list` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`created_by` integer,
	`last_printed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_print_list_created_by_staff_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT "print_list_kind_check" CHECK(kind IN ('patrons', 'items'))
);
--> statement-breakpoint
CREATE TABLE `print_list_entry` (
	`list_id` integer NOT NULL,
	`entity_id` integer NOT NULL,
	`position` integer NOT NULL,
	`added_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_print_list_entry_list_id_print_list_id_fk` FOREIGN KEY (`list_id`) REFERENCES `print_list`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `reading_level` (
	`code` text PRIMARY KEY,
	`position` integer NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `school_level` (
	`code` text PRIMARY KEY,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	`name` text NOT NULL,
	`stage` text NOT NULL,
	`next_code` text,
	`class_label` text
);
--> statement-breakpoint
CREATE TABLE `school_setting` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sequence` (
	`name` text PRIMARY KEY,
	`value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`user_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`ip` text,
	`user_agent` text,
	CONSTRAINT `fk_session_user_id_staff_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `staff_user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `staff_user` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`roles` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`must_change_password` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'config' NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "staff_user_source" CHECK(source IN ('config', 'database'))
);
--> statement-breakpoint
CREATE TABLE `wish` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text,
	`author` text,
	`series` text,
	`series_number` text,
	`note` text,
	`patron_id` integer,
	`requests` integer DEFAULT 1 NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_wish_patron_id_patron_id_fk` FOREIGN KEY (`patron_id`) REFERENCES `patron`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_wish_created_by_staff_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `staff_user`(`id`),
	CONSTRAINT "wish_something_check" CHECK(coalesce("title", "author", "series") is not null),
	CONSTRAINT "wish_requests_check" CHECK("requests" >= 1)
);
--> statement-breakpoint
CREATE INDEX `audit_at` ON `audit_log` (`at`);--> statement-breakpoint
CREATE INDEX `audit_entity` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `biblio_isbn` ON `biblio` (`isbn`);--> statement-breakpoint
CREATE INDEX `biblio_author` ON `biblio` (`author`);--> statement-breakpoint
CREATE INDEX `biblio_series` ON `biblio` (`series`);--> statement-breakpoint
CREATE INDEX `biblio_year` ON `biblio` (`publication_year`);--> statement-breakpoint
CREATE INDEX `biblio_kind` ON `biblio` (`kind`);--> statement-breakpoint
CREATE INDEX `biblio_genre` ON `biblio` (`genre_code`);--> statement-breakpoint
CREATE INDEX `biblio_class` ON `biblio` (`class_code`);--> statement-breakpoint
CREATE INDEX `biblio_item_type` ON `biblio` (`item_type`);--> statement-breakpoint
CREATE INDEX `biblio_reading_level` ON `biblio` (`reading_level`);--> statement-breakpoint
CREATE INDEX `calendar_event_dates` ON `calendar_event` (`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `class_group_kind` ON `class_group` (`kind`,`archived_at`);--> statement-breakpoint
CREATE INDEX `class_group_level_level` ON `class_group_level` (`level_code`);--> statement-breakpoint
CREATE INDEX `class_photo_frame_sheet` ON `class_photo_frame` (`sheet_id`,`position`);--> statement-breakpoint
CREATE INDEX `class_photo_frame_patron` ON `class_photo_frame` (`patron_id`);--> statement-breakpoint
CREATE INDEX `class_photo_sheet_group` ON `class_photo_sheet` (`class_group_id`);--> statement-breakpoint
CREATE INDEX `class_photo_sheet_list` ON `class_photo_sheet` (`print_list_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_scan_unique` ON `inventory_scan` (`inventory_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `inventory_scan_at` ON `inventory_scan` (`inventory_id`,`scanned_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_barcode` ON `item` (`barcode`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_inventory_number` ON `item` (`inventory_number`);--> statement-breakpoint
CREATE INDEX `item_withdrawn_on` ON `item` (`withdrawn_on`);--> statement-breakpoint
CREATE INDEX `item_biblio` ON `item` (`biblio_id`);--> statement-breakpoint
CREATE INDEX `item_status` ON `item` (`status`);--> statement-breakpoint
CREATE INDEX `item_reading_level` ON `item` (`reading_level`);--> statement-breakpoint
CREATE INDEX `item_spine_pending` ON `item` (`biblio_id`) WHERE spine_label_printed_at IS NULL;--> statement-breakpoint
CREATE INDEX `item_barcode_label_pending` ON `item` (`biblio_id`) WHERE barcode_label_printed_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `loan_open_item` ON `loan` (`item_id`) WHERE returned_at IS NULL;--> statement-breakpoint
CREATE INDEX `loan_patron` ON `loan` (`patron_id`,`returned_at`);--> statement-breakpoint
CREATE INDEX `loan_item` ON `loan` (`item_id`,`issued_at`);--> statement-breakpoint
CREATE INDEX `loan_due` ON `loan` (`due_date`);--> statement-breakpoint
CREATE INDEX `loan_school_year` ON `loan` (`school_year`);--> statement-breakpoint
CREATE INDEX `loan_event_loan` ON `loan_event` (`loan_id`);--> statement-breakpoint
CREATE INDEX `note_open` ON `note` (`archived_at`,`pinned`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `patron_card_number` ON `patron` (`card_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `patron_external_id` ON `patron` (`external_id`);--> statement-breakpoint
CREATE INDEX `patron_search_name` ON `patron` (`search_name`);--> statement-breakpoint
CREATE INDEX `patron_class_group` ON `patron` (`class_group_id`);--> statement-breakpoint
CREATE INDEX `patron_level` ON `patron` (`level_code`);--> statement-breakpoint
CREATE INDEX `patron_status` ON `patron` (`status`);--> statement-breakpoint
CREATE INDEX `patron_type` ON `patron` (`patron_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `print_list_entry_unique` ON `print_list_entry` (`list_id`,`entity_id`);--> statement-breakpoint
CREATE INDEX `print_list_entry_list` ON `print_list_entry` (`list_id`,`position`);--> statement-breakpoint
CREATE INDEX `session_user` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expires` ON `session` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_user_username` ON `staff_user` (`username`);--> statement-breakpoint
CREATE INDEX `wish_patron` ON `wish` (`patron_id`);--> statement-breakpoint
CREATE VIEW `patron_class` AS SELECT p.id AS patron_id, g.id AS group_id, g.kind AS group_kind, g.name AS group_name,
		l.code AS level_code, l.position AS level_position, l.label AS level_label,
		COALESCE(l.stage, g.stage) AS stage,
		CASE WHEN g.id IS NULL THEN NULL
			WHEN l.code IS NULL THEN g.name
			ELSE trim(replace(replace(COALESCE(l.class_label, (SELECT value FROM school_setting WHERE key = 'class_label'), '{level} {group}'), '{level}', l.label), '{group}', g.name))
		END AS class_label
	FROM patron p
	LEFT JOIN class_group g ON g.id = p.class_group_id
	LEFT JOIN school_level l ON l.code = p.level_code;