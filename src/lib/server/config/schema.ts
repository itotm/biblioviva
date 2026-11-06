// SPDX-License-Identifier: GPL-3.0-or-later
// Valibot schema of config.json (PLAN.md Appendix A). Unknown keys (e.g. `_comment*`) are dropped.
import { PERFORMANCE_PROFILES } from "#lib/shared/performance.js";
import { WEEK_STARTS } from "#lib/shared/calendar-core.js";
import * as v from "valibot";
import { configCode as code, isoDay, levelCode, localeCode } from "#lib/shared/input-schemas.js";
import { AREA_STYLES, DEFAULT_THEME, THEMES } from "#lib/shared/theme-palette.js";
import { DASHBOARD_SECTIONS, type DashboardSection } from "#lib/shared/dashboard-sections.js";
import { CARD_LAYOUTS, DUPLEX_FLIPS } from "#lib/shared/card-layout.js";
import { DEFAULT_CARD_CLASS } from "#lib/shared/school.js";
import { SCHOOL_YEAR_LABELS } from "#lib/shared/school-year.js";

const LEGACY_THEMES: Record<string, (typeof THEMES)[number]> = {
	cerberus: "ocean",
	crimson: "cherry",
	rosepine: "grape",
	wintry: "lagoon",
};
import { PERMISSIONS } from "#lib/shared/permissions.js";
import { CHECK_ALGORITHMS } from "#lib/shared/barcodes/check.js";
import { KEYBOARD_LAYOUTS } from "#lib/shared/barcodes/layouts.js";
import { DEFAULT_SCAN_SOUND, SCAN_SOUNDS } from "#lib/shared/barcodes/scan-sounds.js";
import { Z3950_HOST, Z3950_WORD } from "#lib/shared/z3950.js";
import { DEFAULT_CHECK, DEFAULT_CODE_PRESET, presetFormats } from "#lib/shared/barcodes/presets.js";
import { CALL_TEXT_PROPOSALS } from "#lib/shared/classification.js";
import { unknownPlaceholders } from "#lib/shared/taxonomy.js";

const label = v.pipe(v.string(), v.minLength(1), v.maxLength(120));
const z3950Word = v.pipe(v.string(), v.regex(Z3950_WORD, "one word, without spaces"));
const positiveInt = v.pipe(v.number(), v.integer(), v.minValue(1));
const nonNegativeInt = v.pipe(v.number(), v.integer(), v.minValue(0));
const mm = v.pipe(v.number(), v.minValue(0), v.maxValue(500));
/** A shift of the printout, a centimetre at most either way (the duplex calibration, 9.27). */
const offsetMm = v.pipe(v.number(), v.minValue(-10), v.maxValue(10));
const monthDay = v.pipe(v.string(), v.regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/));
const hexColor = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/));
const cron = v.pipe(v.string(), v.regex(/^(\S+\s+){4}\S+$/));

const codeFormat = v.object({
	pattern: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
	check: v.picklist([...CHECK_ALGORITHMS, "none"]),
});
const DEFAULT_FORMATS = presetFormats(DEFAULT_CODE_PRESET, DEFAULT_CHECK);

/** What follows a level (9.41): a code, `null`, or two choices or more (`null` = leaves). */
export const nextLevelSchema = v.union([
	v.nullable(levelCode),
	v.pipe(v.array(v.nullable(levelCode)), v.minLength(2), v.maxLength(8)),
]);
/** A class label template: `{level}`, `{group}` (a stage's may leave the group out). */
const classTemplate = v.pipe(v.string(), v.minLength(1), v.maxLength(40), v.includes("{level}"));

const readingLevelSchema = v.object({
	code: levelCode,
	label,
});
/** One level per class of the primary school (the presets propose others, step 12.8). */
const DEFAULT_READING_LEVELS = ["1", "2", "3", "4", "5"].map((code) => ({
	code,
	label: `${code}ª`,
}));

const itemType = v.object({
	code,
	label,
	notForLoan: v.optional(v.boolean(), false),
});

const loanRule = v.object({
	loanDays: positiveInt,
	maxLoans: positiveInt,
	maxRenewals: nonNegativeInt,
	renewalDays: positiveInt,
});

const taxonomyLeaf = v.object({
	code,
	label,
	image: v.optional(v.string()),
	color: v.optional(hexColor),
});

const taxonomyNode = v.object({
	...taxonomyLeaf.entries,
	children: v.optional(v.array(taxonomyLeaf), []),
});

const labelStock = v.object({
	id: code,
	name: label,
	paper: v.optional(v.picklist(["A4"]), "A4"),
	labelMm: v.object({ width: mm, height: mm }),
	columns: positiveInt,
	rows: positiveInt,
	marginMm: v.object({ top: mm, left: mm }),
	gapMm: v.object({ x: mm, y: mm }),
	cornerRadiusMm: v.optional(mm, 0),
});

/** A pattern of the segnatura: not empty, only the known placeholders (Q143). */
const callPattern = v.pipe(
	v.string(),
	v.check((p) => p.trim() !== "", "the pattern is empty"),
	v.check(
		(p) => unknownPlaceholders(p).length === 0,
		(issue) => `unknown placeholder ${unknownPlaceholders(issue.input).join(", ")}`,
	),
);

const labelJob = v.object({ template: code, stock: code });

const user = v.pipe(
	v.object({
		username: v.pipe(v.string(), v.regex(/^[a-z0-9._-]{2,32}$/)),
		displayName: v.optional(v.string()),
		roles: v.pipe(v.array(code), v.minLength(1)),
		passwordHash: v.optional(v.string()),
		password: v.optional(v.string()),
		active: v.optional(v.boolean(), true),
		/** The password given by an administrator: the person changes it at the first login (9.51). */
		mustChangePassword: v.optional(v.boolean(), false),
	}),
	v.check((u) => Boolean(u.passwordHash || u.password), "passwordHash or password is required"),
);

export const configSchema = v.object({
	library: v.object({
		name: label,
		contactEmail: v.optional(v.pipe(v.string(), v.email())),
		schoolYearStart: v.optional(monthDay, "09-01"),
		/**
		 * How the school year is named on the cards, the reports and the screens (9.41): `span`
		 * → `2026/2027`, `start` → `2026` (Brazil, Japan's 年度, Korea's 학년도). Loans store it alike.
		 */
		schoolYearLabel: v.optional(v.picklist(SCHOOL_YEAR_LABELS), "span"),
		timezone: v.optional(v.string(), "Europe/Rome"),
		/** First day of the week in calendars and "this week" (9.13, round 17). */
		weekStart: v.optional(v.picklist(WEEK_STARTS), "monday"),
		itemTypes: v.pipe(v.array(itemType), v.minLength(1)),
	}),
	// Phase 12 (Q94): the levels of the school in order, grouped in stages; the classes themselves
	// are groups of the database (`class_group`)
	school: v.object({
		/** The preset the structure started from (`config/school-presets/<id>.json`). */
		preset: v.optional(v.pipe(v.string(), v.maxLength(40)), "custom"),
		stages: v.pipe(
			v.array(
				v.object({
					code,
					name: label,
					/** This stage's class label, which may leave out `{group}` (9.41). */
					classLabel: v.optional(classTemplate),
				}),
			),
			v.minLength(1),
		),
		levels: v.pipe(
			v.array(
				v.object({
					code: levelCode,
					label: v.pipe(v.string(), v.minLength(1), v.maxLength(20)),
					name: label,
					stage: code,
					/** One level, `null` (leaves), or the choices of a path that splits (9.41). */
					next: v.optional(nextLevelSchema),
					/** Other ways the register files write the level (9.41). */
					aliases: v.optional(
						v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(40))),
					),
				}),
			),
			v.minLength(1),
		),
		/** `{level}` and `{group}`: `{level} {group}` → `3 B` (Q94). */
		classLabel: v.optional(
			v.pipe(v.string(), v.minLength(1), v.maxLength(40), v.includes("{group}")),
			"{level} {group}",
		),
		groupWord: v.optional(label, "Sezione"),
		/** The class line of the card: `{word}`, `{group}`, `{level}`, `{class}` (9.41). */
		cardClass: v.optional(
			v.pipe(v.string(), v.minLength(1), v.maxLength(60)),
			DEFAULT_CARD_CLASS,
		),
		/** The name of the teachers group made when the first teacher arrives (Q102: `Docenti`). */
		teacherGroupName: v.optional(label, "Docenti"),
		/** Within a stage the group advances with its pupils (Q94: keep), or they lose it. */
		promotionWithinStage: v.optional(v.picklist(["keep", "clear"]), "keep"),
		/** Into the next stage (5ª primaria → 1ª secondaria): keep, clear or ask at the upgrade. */
		promotionAcrossStages: v.optional(v.picklist(["keep", "clear", "ask"]), "ask"),
	}),
	catalog: v.optional(
		v.object({
			specialAuthors: v.optional(v.array(v.string()), ["Anonimo", "AA. VV."]),
			unknownPublisher: v.optional(v.string(), "s.n."),
			unknownPlace: v.optional(v.string(), "s.l."),
		}),
		{},
	),
	// Phase 12 (Q90–Q93): formats as token patterns (#lib/shared/barcodes/pattern.ts); whether a
	// pattern is valid and whether copies and cards can be confused is checked in validate.ts
	barcodes: v.object({
		/** The `{lib}` token (several libraries with separate installations); unused here. */
		libraryCode: v.optional(v.pipe(v.string(), v.regex(/^[0-9A-HJ-NPR-Z]{0,8}$/)), ""),
		/** The keyboard layout the scanners type into (repair tables). */
		keyboardLayout: v.optional(v.picklist(KEYBOARD_LAYOUTS), "it"),
		/** The beep of a camera read, or none (9.40, Q137). */
		cameraSound: v.optional(v.picklist(SCAN_SOUNDS), DEFAULT_SCAN_SOUND),
		/** Plain numbers of older systems have up to this many digits (0 = none). */
		plainMaxLength: v.optional(v.pipe(nonNegativeInt, v.maxValue(20)), 0),
		item: v.object({
			format: v.optional(codeFormat, DEFAULT_FORMATS.item),
			retired: v.optional(v.array(codeFormat), []),
			legacy: v.optional(v.array(codeFormat), []),
			symbology: v.optional(v.picklist(["code128", "code39"]), "code128"),
		}),
		patron: v.object({
			format: v.optional(codeFormat, DEFAULT_FORMATS.card),
			retired: v.optional(v.array(codeFormat), []),
			legacy: v.optional(v.array(codeFormat), []),
			symbology: v.optional(v.picklist(["code128", "code39"]), "code128"),
			counterStart: v.optional(
				v.union([v.literal("afterLegacyMax"), positiveInt]),
				"afterLegacyMax",
			),
		}),
	}),
	circulation: v.object({
		rules: v.object({ student: loanRule, teacher: loanRule }),
		itemTypeOverrides: v.optional(v.record(v.string(), v.partial(loanRule)), {}),
		dueDateMode: v.optional(v.picklist(["datedue", "calendar", "days"]), "datedue"),
		renewFrom: v.optional(v.picklist(["today", "dueDate"]), "today"),
		allowRenewalWhenOverdue: v.optional(v.boolean(), true),
		overdueNotice: v.optional(
			v.object({
				template: v.optional(code, "overdue-by-class"),
				pageBreakPerGroup: v.optional(v.boolean(), false),
				minDays: v.optional(nonNegativeInt, 5),
			}),
			{},
		),
		blockIfOverdue: v.optional(v.boolean(), false),
		hardDueDate: v.optional(v.nullable(isoDay), null),
		receipts: v.optional(v.boolean(), false),
	}),
	calendar: v.object({
		weeklyClosedDays: v.optional(
			v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(6))),
			[0, 6],
		),
		autoItalianHolidays: v.optional(v.boolean(), true),
		holidays: v.optional(v.array(isoDay), []),
		closedRanges: v.optional(
			v.array(v.object({ from: isoDay, to: isoDay, reason: v.optional(v.string(), "") })),
			[],
		),
	}),
	z3950: v.object({
		defaultTarget: code,
		timeoutMs: v.optional(positiveInt, 15000),
		maxRecordsIsbn: v.optional(positiveInt, 20),
		maxRecordsSearch: v.optional(positiveInt, 20),
		targets: v.pipe(
			v.array(
				v.object({
					id: code,
					name: label,
					// written into yaz-client's command file: no line break, no space
					host: v.pipe(v.string(), v.regex(Z3950_HOST, "a host name or an IP address")),
					port: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535)),
					database: z3950Word,
					syntax: v.optional(v.picklist(["unimarc", "marc21"]), "unimarc"),
					charset: v.optional(z3950Word, "utf-8"),
					elements: v.optional(z3950Word, "F"),
				}),
			),
			v.minLength(1),
		),
	}),
	metadata: v.object({
		providers: v.optional(
			v.array(v.picklist(["sbn", "openlibrary", "googlebooks", "sbn-json"])),
			["sbn"],
		),
		cacheDays: v.optional(positiveInt, 30),
		/** Timeout of one HTTP provider call (Open Library, Google Books, sbn-json). */
		timeoutMs: v.optional(positiveInt, 8000),
	}),
	performance: v.optional(
		v.object({
			// the values of each profile: #lib/shared/performance.ts (step 9.28)
			profile: v.optional(v.picklist(PERFORMANCE_PROFILES), "small"),
			sqliteCacheMb: v.optional(v.nullable(positiveInt), null),
			sqliteMmapMb: v.optional(v.nullable(nonNegativeInt), null),
			walAutocheckpointPages: v.optional(v.nullable(positiveInt), null),
			imageConcurrency: v.optional(v.nullable(positiveInt), null),
			yazConcurrency: v.optional(v.nullable(positiveInt), null),
			heavyConcurrency: v.optional(v.nullable(positiveInt), null),
			argon2MemoryMb: v.optional(v.nullable(positiveInt), null),
			smol: v.optional(v.nullable(v.boolean()), null),
		}),
		{},
	),
	classification: v.object({
		fictionByClass: v.optional(v.boolean(), true),
		/**
		 * The reading levels of fiction (Phase 12.6, Q96): an independent scale, in order; the code is
		 * stored on the books and printed in the call number (`{{class}}`, `B 4 DEL`).
		 */
		readingLevels: v.optional(v.array(readingLevelSchema), DEFAULT_READING_LEVELS),
		classPerItem: v.optional(v.boolean(), false),
		genres: v.pipe(v.array(taxonomyLeaf), v.minLength(1)),
		nonfiction: v.pipe(v.array(taxonomyNode), v.minLength(1)),
		deweyMap: v.optional(
			v.array(v.object({ prefix: v.pipe(v.string(), v.regex(/^\d{1,3}$/)), code })),
			[],
		),
		/** The scheme of the segnatura (§3.17, Q143): three patterns and what `{{text}}` proposes. */
		callNumber: v.optional(
			v.object({
				fiction: v.optional(callPattern, "{{genre}} {{author3}}"),
				fictionWithClass: v.optional(callPattern, "{{genre}} {{class}} {{author3}}"),
				nonfiction: v.optional(callPattern, "{{code}} {{author3}}"),
				text: v.optional(v.picklist(CALL_TEXT_PROPOSALS), "author3"),
			}),
			{},
		),
	}),
	cards: v.object({
		defaultTemplate: v.optional(code, "default"),
		templateByPatronType: v.optional(v.record(v.string(), code), {}),
		/**
		 * How the cards are printed by default (9.27, Q127): front and back side by side on one
		 * side of the sheet, folded on the short edge, or front and back on the two sides of the
		 * sheet (a printer that prints both sides); chosen again at every print. An installation
		 * that still has the former `unit` key loads as before (the key is ignored).
		 */
		layout: v.optional(v.picklist(CARD_LAYOUTS), "side-by-side"),
		duplex: v.optional(
			v.object({
				/** How the printer turns the sheet: on its long edge (as a book) or its short one. */
				flip: v.optional(v.picklist(DUPLEX_FLIPS), "long-edge"),
				/** Where the backs are moved to fall behind the fronts (the calibration, 9.27). */
				backOffsetMm: v.optional(
					v.object({ x: v.optional(offsetMm, 0), y: v.optional(offsetMm, 0) }),
					{},
				),
			}),
			{},
		),
		cardMm: v.optional(v.object({ width: mm, height: mm }), { width: 85.6, height: 53.98 }),
		bleedMm: v.optional(mm, 0),
		sheet: v.optional(
			v.object({
				paper: v.optional(v.picklist(["A4"]), "A4"),
				rows: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)), 4),
				marginMm: v.optional(mm, 6),
				gapMm: v.optional(mm, 3),
				// the fold and the crop marks of the sheet (step 11.17): on by default; the coloured
				// outline of each card is off, the marks show where to cut
				foldMarks: v.optional(v.boolean(), true),
				cutMarks: v.optional(v.boolean(), true),
				cutLines: v.optional(v.nullable(v.object({ color: hexColor, widthMm: mm })), null),
			}),
			{},
		),
		validityMonths: v.optional(v.nullable(positiveInt), 12),
		showPhoto: v.optional(v.boolean(), true),
	}),
	labels: v.object({
		default: v.optional(v.picklist(["pair", "barcode", "spine"]), "pair"),
		titleMaxChars: v.optional(positiveInt, 30),
		stocks: v.pipe(v.array(labelStock), v.minLength(1)),
		monochrome: v.optional(v.boolean(), false),
		pair: labelJob,
		barcode: labelJob,
		spine: labelJob,
	}),
	photos: v.optional(
		v.object({
			/**
			 * Patron photos at all (9.38, Q135). Off, everything about them is gone: no photo taken,
			 * uploaded, imported or shown, no census, the shipped card templates without the photo
			 * (`config/cards/templates-no-photo/`); the files already stored are kept.
			 */
			enabled: v.optional(v.boolean(), true),
			/**
			 * Whether every patron is expected to have a photo (9.13, round 3). Off, nothing reminds
			 * that photos are missing (dashboard tile, list icons, print-list filter); photos can
			 * still be taken, uploaded and printed on the cards.
			 */
			required: v.optional(v.boolean(), true),
			width: v.optional(positiveInt, 480),
			height: v.optional(positiveInt, 640),
			/** Format of the stored files (step 3.11; WebP by default, owner: smaller files). */
			format: v.optional(v.picklist(["jpeg", "webp"]), "webp"),
			quality: v.optional(
				v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
				80,
			),
			maxUploadBytes: v.optional(positiveInt, 8_000_000),
			/**
			 * Pictures with many faces for the photo census (Phase 13, Q105): the upload limit, the
			 * longest side kept, how many frames at most, and the proportions (height / width) of a
			 * photo frame. The photos of the demo cards measure 1.10–1.18 (minimum 1.0).
			 */
			sheet: v.optional(
				v.pipe(
					v.object({
						maxUploadBytes: v.optional(positiveInt, 32_000_000),
						maxPixels: v.optional(
							v.pipe(v.number(), v.integer(), v.minValue(800), v.maxValue(8000)),
							4000,
						),
						maxFrames: v.optional(
							v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(200)),
							60,
						),
						minAspect: v.optional(
							v.pipe(v.number(), v.minValue(0.3), v.maxValue(3)),
							1,
						),
						maxAspect: v.optional(
							v.pipe(v.number(), v.minValue(0.3), v.maxValue(3)),
							1.6,
						),
					}),
					v.check(
						(s) => s.minAspect < s.maxAspect,
						"photos.sheet: minAspect must be smaller than maxAspect",
					),
				),
				{},
			),
		}),
		{},
	),
	covers: v.optional(
		v.object({
			/**
			 * Book covers at all (9.38, Q135). Off, everything about them is gone: no lookup at the
			 * providers, no cover taken, uploaded or shown; the files already stored are kept.
			 */
			enabled: v.optional(v.boolean(), true),
			width: v.optional(positiveInt, 600),
			/** Optional cap on the height (very tall images are scaled down to it). */
			maxHeight: v.optional(v.nullable(positiveInt), null),
			format: v.optional(v.picklist(["jpeg", "webp"]), "webp"),
			quality: v.optional(
				v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
				80,
			),
			maxUploadBytes: v.optional(positiveInt, 12_000_000),
			/** Chain order with a flag per provider (owner decision: Google Books last and off). */
			providers: v.optional(
				v.array(
					v.object({
						id: v.picklist(["amazon", "openlibrary", "googlebooks"]),
						enabled: v.optional(v.boolean(), true),
					}),
				),
				[
					{ id: "amazon", enabled: true },
					{ id: "openlibrary", enabled: true },
					{ id: "googlebooks", enabled: false },
				],
			),
			country: v.optional(v.pipe(v.string(), v.regex(/^[A-Z]{2}$/)), "IT"),
			minWidth: v.optional(positiveInt, 300),
			autoFetch: v.optional(v.boolean(), true),
			/** Timeout of one cover provider call. */
			timeoutMs: v.optional(positiveInt, 6000),
		}),
		{},
	),
	privacy: v.optional(v.object({ auditRetentionMonths: v.optional(positiveInt, 24) }), {}),
	backup: v.optional(
		v.object({
			cron: v.optional(cron, "0 3 * * *"),
			/** At start, one backup when the last scheduled one was missed (9.33, Q129). */
			catchUp: v.optional(v.boolean(), true),
			keepDays: v.optional(positiveInt, 30),
			offsite: v.optional(
				v.object({
					enabled: v.optional(v.boolean(), false),
					remote: v.optional(v.string(), ""),
				}),
				{},
			),
		}),
		{},
	),
	security: v.object({
		sessionDays: v.optional(positiveInt, 14),
		loginMaxAttempts: v.optional(positiveInt, 5),
		loginWindowMinutes: v.optional(positiveInt, 15),
		auth: v.optional(
			v.object({ mode: v.optional(v.picklist(["config", "database"]), "config") }),
			{},
		),
		users: v.optional(v.array(user), []),
		roles: v.record(code, v.array(v.union([v.literal("*"), v.picklist(PERMISSIONS)]))),
	}),
	ui: v.object({
		// English is always shipped (LOCALES[0]); the wizard offers it first
		/** A built-in locale or a language pack code (`CONFIG_DIR/i18n/<code>/`, step 1.14). */
		locale: v.optional(localeCode, "en"),
		theme: v.optional(
			v.pipe(
				v.string(),
				// names of the Skeleton presets used before step 2.3a, mapped to the closest new set
				v.transform((t) => LEGACY_THEMES[t] ?? t),
				v.picklist(THEMES, `one of ${THEMES.join(", ")}`),
			),
			DEFAULT_THEME,
		),
		/** The sections shown on the dashboard (step 11.15), every one on by default. */
		dashboard: v.optional(
			v.object(
				Object.fromEntries(
					DASHBOARD_SECTIONS.map((section) => [section, v.optional(v.boolean(), true)]),
				) as Record<DashboardSection, v.OptionalSchema<v.BooleanSchema<undefined>, true>>,
			),
			{},
		),
		/**
		 * How the top bar shows the area the operator is in (step 9.16): a light tint with a band
		 * (`tinted`, default), the whole bar in the area's colour (`filled`), a band on its left
		 * (`accents`), or the neutral bar without area colours (`none`).
		 */
		areaStyle: v.optional(v.picklist(AREA_STYLES), "tinted"),
		checkoutIdleSeconds: v.optional(positiveInt, 120),
		setupCompleted: v.optional(v.boolean(), false),
	}),
});

export type AppConfig = v.InferOutput<typeof configSchema>;
export type LabelStock = v.InferOutput<typeof labelStock>;
