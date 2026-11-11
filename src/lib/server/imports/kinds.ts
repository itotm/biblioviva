// SPDX-License-Identifier: GPL-3.0-or-later
// The CSV imports (PLAN.md steps 2.6, 3.9, 9.19): what each one reads, how large its file may be,
// and the options its validate and commit phases take from the configuration and the operator.
// The steps themselves are the same for all (`./handlers.ts`).
import { can } from "#lib/server/auth/rbac.js";
import { codeTable } from "#lib/server/barcodes/table.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import { getConfig } from "#lib/server/config/index.js";
import { marcToCatalogRows } from "#lib/server/marc/catalog-marc.js";
import { marcFlavour, readMarcFile } from "#lib/server/marc/read.js";
import { calendarRules } from "#lib/server/services/calendar.js";
import { catalogRules } from "#lib/server/services/catalog.js";
import { dueDateFor, resolveRule } from "#lib/server/services/circulation-rules.js";
import { setClassPerItem } from "#lib/server/services/config-edit.js";
import { patronRules } from "#lib/server/services/patrons.js";
import {
	CATALOG_FIELDS,
	CATALOG_IMPORT,
	LOAN_FIELDS,
	LOAN_IMPORT,
	type CatalogField,
	type LoanField,
} from "#lib/shared/import-columns.js";
import {
	commitCatalogImport,
	detectCatalogFormat,
	validateCatalogImport,
	type CatalogFormatDetection,
	type CatalogImportInput,
	type CatalogImportOptions,
	type CatalogImportResult,
	type CatalogImportSummary,
} from "./catalog.js";
import { todayIn } from "#lib/shared/dates.js";
import type { ImportKind, ImportRun } from "./handlers.js";
import {
	commitLoanImport,
	detectLoanFormat,
	validateLoanImport,
	type LoanFormatDetection,
	type LoanImportInput,
	type LoanImportOptions,
	type LoanImportResult,
	type LoanImportSummary,
} from "./loans.js";
import {
	commitPatronImport,
	detectPatronFormat,
	mapPatronRows,
	patronSpec,
	validatePatronImport,
	type DuplicatePolicy,
	type FormatDetection,
	type ImportMode,
	type PatronAudience,
	type PatronImportColumn,
	type PatronImportInput,
	type PatronImportOptions,
	type PatronImportResult,
	type PatronImportSummary,
} from "./patrons.js";
import { mapRows } from "./pipeline.js";

/** The catalogue import's answers: the special values, the class-per-copy and the item-type questions. */
export interface CatalogRun extends ImportRun<CatalogField> {
	useSpecialValues: boolean;
	/** The class-per-copy answer: omitted while not asked or not answered. */
	enableClassPerItem?: boolean;
	/** The item-type answer (Q139): omitted while not asked or not answered. */
	useMajorityType?: boolean;
	useComputedCallNumbers?: boolean;
}

function catalogOptions(config: AppConfig, run: CatalogRun): CatalogImportOptions {
	return {
		rules: catalogRules(config),
		useSpecialValues: run.useSpecialValues,
		enableClassPerItem: run.enableClassPerItem,
		useMajorityType: run.useMajorityType,
		useComputedCallNumbers: run.useComputedCallNumbers,
		today: todayIn(config.library.timezone),
	};
}

/** The catalogue and its copies (steps 3.9, 9.19): permission `catalog.import`. */
export const CATALOG_IMPORT_KIND: ImportKind<
	CatalogField,
	CatalogFormatDetection,
	CatalogImportInput,
	CatalogRun,
	CatalogImportResult,
	CatalogImportSummary
> = {
	name: "catalog",
	spec: CATALOG_IMPORT,
	// a Koha export of a whole school library stays well below this
	maxBytes: 20_000_000,
	fallbackName: "catalog.csv",
	detect: detectCatalogFormat,
	// a MARC file (ISO 2709 or MARCXML, UNIMARC or MARC 21) read into the same rows (9.65)
	read: (bytes) => {
		const file = readMarcFile(bytes);
		if (!file) {
			return null;
		}
		const { catalog } = getConfig();
		const flavour = marcFlavour(file.records);
		return {
			...marcToCatalogRows(file.records, flavour, {
				specialAuthors: catalog.specialAuthors,
				unknownPublisher: catalog.unknownPublisher,
			}),
			format: `${flavour === "unimarc" ? "UNIMARC" : "MARC 21"} · ${file.syntax === "marcxml" ? "MARCXML" : "ISO 2709"}`,
		};
	},
	map: (rows, mapping, header, lines) => mapRows(rows, mapping, header, CATALOG_FIELDS, lines),
	validate: (ctx, inputs, run) =>
		validateCatalogImport(ctx.db, inputs, catalogOptions(ctx.config, run)),
	commit: (ctx, inputs, run, actor, file) =>
		commitCatalogImport(ctx.db, inputs, {
			...catalogOptions(ctx.config, run),
			...file,
			actor,
			setClassPerItemInConfig: (on) => setClassPerItem(ctx.configDir, on),
		}),
};

function loanOptions(config: AppConfig): LoanImportOptions {
	const { library } = config;
	return {
		today: todayIn(library.timezone),
		schoolYearStart: library.schoolYearStart,
		codes: codeTable(config),
		dueOf: (patronType, itemType, issuedOn) =>
			dueDateFor(
				config,
				calendarRules(config),
				issuedOn,
				resolveRule(config, patronType, itemType).loanDays,
			).due,
	};
}

/** The loans open at the switch from Koha (steps 3.9, 9.19): permission `admin`. */
export const LOAN_IMPORT_KIND: ImportKind<
	LoanField,
	LoanFormatDetection,
	LoanImportInput,
	ImportRun<LoanField>,
	LoanImportResult,
	LoanImportSummary
> = {
	name: "loans",
	spec: LOAN_IMPORT,
	maxBytes: 5_000_000,
	fallbackName: "loans.csv",
	detect: detectLoanFormat,
	map: (rows, mapping, header, lines) => mapRows(rows, mapping, header, LOAN_FIELDS, lines),
	validate: (ctx, inputs) => validateLoanImport(ctx.db, inputs, loanOptions(ctx.config)),
	commit: (ctx, inputs, _run, actor, file) =>
		commitLoanImport(ctx.db, inputs, { ...loanOptions(ctx.config), ...file, actor }),
};

/** The patron imports' answers: the mode, the duplicates, the homonyms picked, the removal. */
export interface PatronRun extends ImportRun<PatronImportColumn> {
	audience: PatronAudience;
	mode: ImportMode;
	duplicatePolicy: DuplicatePolicy;
	/** Homonyms picked by hand: line → existing patron id, or `create`. */
	resolutions: Record<string, number | "create">;
	/** Commit only: remove the patrons missing from the file (sync mode, `anonymize`). */
	removeMissing?: boolean;
}

function patronOptions(
	config: AppConfig,
	audience: PatronAudience,
	run: PatronRun,
	actor: Parameters<typeof can>[0],
): PatronImportOptions {
	const resolutions: Record<number, number | "create"> = {};
	for (const [line, choice] of Object.entries(run.resolutions)) {
		resolutions[Number(line)] = choice;
	}
	return {
		audience,
		mode: run.mode,
		duplicatePolicy: run.duplicatePolicy,
		rules: patronRules(config),
		columns: run.mapping.filter((c): c is PatronImportColumn => c !== null),
		resolutions,
		canRemove: can(actor, "anonymize"),
	};
}

type PatronImportKind = ImportKind<
	PatronImportColumn,
	FormatDetection,
	PatronImportInput,
	PatronRun,
	PatronImportResult,
	PatronImportSummary
>;

function patronImportKind(audience: PatronAudience): PatronImportKind {
	return {
		name: audience,
		spec: patronSpec(audience),
		maxBytes: 5_000_000,
		fallbackName: "import.csv",
		detect: (rows) => detectPatronFormat(rows, audience),
		map: (rows, mapping, header, lines) =>
			mapPatronRows(rows, mapping, header, audience, lines),
		validate: (ctx, inputs, run, actor) =>
			validatePatronImport(ctx.db, inputs, patronOptions(ctx.config, audience, run, actor)),
		commit: (ctx, inputs, run, actor, file) =>
			commitPatronImport(ctx.db, inputs, {
				...patronOptions(ctx.config, audience, run, actor),
				...file,
				actor,
				removeMissing: run.removeMissing ?? false,
				dataDir: ctx.dataDir,
			}),
	};
}

/** The student and teacher imports (steps 2.6, 9.19): permission `patrons.import`. */
export const PATRON_IMPORT_KINDS: Record<PatronAudience, PatronImportKind> = {
	students: patronImportKind("students"),
	teachers: patronImportKind("teachers"),
};
