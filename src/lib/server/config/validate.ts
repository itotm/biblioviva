// SPDX-License-Identifier: GPL-3.0-or-later
// Cross-field checks that a schema cannot express (PLAN.md step 1.1). Pure: no I/O.
import { stockProblems } from "#lib/shared/label-stock.js";
import { PAPER_MM } from "#lib/shared/paper.js";
import { cardFitProblem, cardSheetFit } from "#lib/shared/card-layout.js";
import { activeAdmins } from "#lib/server/auth/rbac.js";
import { codeFormatsFromConfig } from "#lib/server/barcodes/table.js";
import { checkCodeTable } from "#lib/shared/barcodes/compare.js";
import { capacity, compileFormat, PatternError } from "#lib/shared/barcodes/pattern.js";
import { buildCodeTable } from "#lib/shared/barcodes/table.js";
import { structureProblems } from "#lib/shared/school.js";
import type { AppConfig } from "./schema.js";

export interface ConfigIssue {
	level: "error" | "warning";
	path: string;
	message: string;
	/** The file that defines `path` (set by the folder loader). */
	file?: string;
}

function codeIssues(
	config: AppConfig,
	error: (path: string, message: string) => number,
	warning: (path: string, message: string) => number,
): void {
	const formats = codeFormatsFromConfig(config);
	let broken = false;
	for (const [kind, key] of [
		["item", "item"],
		["card", "patron"],
	] as const) {
		const k = formats[kind];
		const entries = [
			[`barcodes.${key}.format`, k.current, false],
			...k.retired.map((f, i) => [`barcodes.${key}.retired[${i}]`, f, false] as const),
			...k.legacy.map((f, i) => [`barcodes.${key}.legacy[${i}]`, f, true] as const),
		] as const;
		for (const [path, def, legacy] of entries) {
			try {
				compileFormat(def, { libraryCode: formats.libraryCode, counterOptional: legacy });
			} catch (e) {
				if (!(e instanceof PatternError)) {
					throw e;
				}
				broken = true;
				error(path, `invalid pattern "${def.pattern}" (${e.code})`);
			}
		}
	}
	if (broken) {
		return;
	}
	const table = buildCodeTable(formats);
	const start = config.barcodes.patron.counterStart;
	if (typeof start === "number" && start > capacity(table.card.current)) {
		error(
			"barcodes.patron.counterStart",
			`${String(start)} does not fit the card format "${table.card.current.def.pattern}"`,
		);
	}
	for (const issue of checkCodeTable(table)) {
		const other = issue.otherPattern ? ` and "${issue.otherPattern}"` : "";
		const example = issue.example ? `, e.g. "${issue.example}"` : "";
		const message = `"${issue.pattern}"${other}: ${issue.code}${example}`;
		if (issue.severity === "error") {
			error("barcodes", message);
		} else {
			warning("barcodes", message);
		}
	}
}

export function crossValidate(config: AppConfig): ConfigIssue[] {
	const issues: ConfigIssue[] = [];
	const error = (path: string, message: string): number =>
		issues.push({ level: "error", path, message });
	const warning = (path: string, message: string): number =>
		issues.push({ level: "warning", path, message });

	// Item types and loan rules
	const itemTypes = new Set(config.library.itemTypes.map((t) => t.code));
	if (itemTypes.size !== config.library.itemTypes.length) {
		error("library.itemTypes", "item type codes must be unique");
	}
	for (const typeCode of Object.keys(config.circulation.itemTypeOverrides)) {
		if (!itemTypes.has(typeCode)) {
			error(`circulation.itemTypeOverrides.${typeCode}`, `unknown item type "${typeCode}"`);
		}
	}
	// School structure (Phase 12)
	for (const problem of structureProblems(config.school)) {
		error("school", problem);
	}

	// Barcodes (Phase 12): every pattern compiles, and copies and cards can never be confused
	codeIssues(config, error, warning);

	// Classification
	const genreCodes = config.classification.genres.map((g) => g.code);
	const classCodes = config.classification.nonfiction.flatMap((n) => [
		n.code,
		...n.children.map((c) => c.code),
	]);
	for (const [path, codes] of [
		["classification.genres", genreCodes],
		["classification.nonfiction", classCodes],
	] as const) {
		const seen = new Set<string>();
		for (const c of codes) {
			if (seen.has(c)) {
				error(path, `duplicate code "${c}"`);
			}
			seen.add(c);
		}
	}
	// one `classification` column names either a genre or a class (9.19): a code is never both
	const genreSet = new Set(genreCodes);
	for (const c of classCodes) {
		if (genreSet.has(c)) {
			error("classification.nonfiction", `code "${c}" is both a genre and a class`);
		}
	}
	const levels = config.classification.readingLevels.map((l) => l.code);
	if (new Set(levels).size !== levels.length) {
		error("classification.readingLevels", "reading level codes must be unique");
	}
	const classSet = new Set(classCodes);
	config.classification.deweyMap.forEach((m, i) => {
		if (!classSet.has(m.code)) {
			error(`classification.deweyMap[${i}]`, `unknown non-fiction code "${m.code}"`);
		}
	});
	for (const node of config.classification.nonfiction) {
		if (!node.image) {
			warning(`classification.nonfiction.${node.code}`, "top-level node without an image");
		}
	}
	for (const genre of config.classification.genres) {
		if (!genre.image) {
			warning(`classification.genres.${genre.code}`, "genre without an image");
		}
	}

	// Labels: stocks must fit the page and jobs must reference existing stocks
	const stockIds = new Set<string>();
	config.labels.stocks.forEach((s, i) => {
		if (stockIds.has(s.id)) {
			error(`labels.stocks[${i}]`, `duplicate stock id "${s.id}"`);
		}
		stockIds.add(s.id);
		for (const p of stockProblems(s, 1, PAPER_MM[s.paper])) {
			if (p.reason === "overflowX") {
				error(
					`labels.stocks[${i}]`,
					`${s.id}: ${p.usedMm.toFixed(1)} mm wide exceeds the ${s.paper} width`,
				);
			} else if (p.reason === "overflowY") {
				error(
					`labels.stocks[${i}]`,
					`${s.id}: ${p.usedMm.toFixed(1)} mm tall exceeds the ${s.paper} height`,
				);
			}
		}
	});
	for (const kind of ["pair", "barcode", "spine"] as const) {
		if (!stockIds.has(config.labels[kind].stock)) {
			error(`labels.${kind}.stock`, `unknown stock "${config.labels[kind].stock}"`);
		}
	}
	if (config.labels.pair.stock && stockIds.has(config.labels.pair.stock)) {
		const stock = config.labels.stocks.find((s) => s.id === config.labels.pair.stock);
		if (stock && stockProblems(stock, 2).some((p) => p.reason === "rowsNotMultiple")) {
			error("labels.pair.stock", `${stock.id}: rows must be a multiple of 2 for the pair`);
		}
	}

	// Cards: the card size and the rows asked fit the page (the one check of `cardSheetFit`)
	const c = config.cards;
	const fit = cardSheetFit(c.cardMm, c.sheet);
	if (!fit.fits) {
		error("cards.cardMm", cardFitProblem(c.cardMm, fit));
	} else if (!fit.rowsFit) {
		const cardsHeight =
			2 * c.sheet.marginMm +
			c.sheet.rows * c.cardMm.height +
			(c.sheet.rows - 1) * c.sheet.gapMm;
		error(
			"cards.sheet.rows",
			`${c.sheet.rows} units need ${cardsHeight.toFixed(1)} mm, more than A4`,
		);
	}

	// Z39.50
	if (!config.z3950.targets.some((t) => t.id === config.z3950.defaultTarget)) {
		error("z3950.defaultTarget", `unknown target "${config.z3950.defaultTarget}"`);
	}

	// Security: roles, users, at least one active admin
	const roles = config.security.roles;
	config.security.users.forEach((u, i) => {
		for (const role of u.roles) {
			if (!(role in roles)) {
				error(`security.users[${i}].roles`, `unknown role "${role}"`);
			}
		}
		if (!u.passwordHash && u.password) {
			warning(
				`security.users[${i}]`,
				`"${u.username}" uses a plain password; run bun run auth:hash-password`,
			);
		}
	});
	const usernames = config.security.users.map((u) => u.username);
	if (new Set(usernames).size !== usernames.length) {
		error("security.users", "usernames must be unique");
	}
	if (
		config.security.users.length > 0 &&
		activeAdmins(config.security.users, roles).length === 0
	) {
		error("security.users", "at least one active account must hold admin");
	}

	// Calendar ranges
	config.calendar.closedRanges.forEach((r, i) => {
		if (r.from > r.to) {
			error(`calendar.closedRanges[${i}]`, "from is after to");
		}
	});

	return issues;
}
