// SPDX-License-Identifier: GPL-3.0-or-later
// Reads the configuration folder (config.json + fragments, see folder.ts), validates and cross-checks it.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as v from "valibot";
import { assembleConfig, attachFiles, type AssembledConfig } from "./folder.js";
import { configSchema, type AppConfig } from "./schema.js";
import { crossValidate, type ConfigIssue } from "./validate.js";

export class ConfigError extends Error {
	constructor(
		message: string,
		readonly issues: ConfigIssue[],
	) {
		// the issues are part of the message so the console and the logs show what to fix
		super(
			`${message}\n${issues.map((i) => `  ${i.level}  ${i.path}${i.file ? ` (${i.file})` : ""}: ${i.message}`).join("\n")}`,
		);
		this.name = "ConfigError";
	}
}

export interface LoadedConfig {
	config: AppConfig;
	warnings: ConfigIssue[];
	/** `file` = CONFIG_DIR/config.json; `example` = the shipped example (setup not completed yet). */
	source: "file" | "example";
	path: string;
	/** Every file that took part, base first. */
	files: string[];
	/** Dotted key path → defining file (`config:check --explain`). */
	origins: Map<string, string>;
}

/** Validates a parsed JSON object; throws ConfigError with every problem listed. */
export function parseConfig(
	raw: unknown,
	origin = "config.json",
): { config: AppConfig; warnings: ConfigIssue[] } {
	const result = v.safeParse(configSchema, raw);
	if (!result.success) {
		const issues = result.issues.map<ConfigIssue>((issue) => ({
			level: "error",
			path:
				(issue.path ?? []).map((p) => String((p as { key: unknown }).key)).join(".") ||
				"(root)",
			message: issue.message,
		}));
		throw new ConfigError(`${origin}: ${issues.length} validation error(s)`, issues);
	}
	const cross = crossValidate(result.output);
	const errors = cross.filter((i) => i.level === "error");
	if (errors.length > 0) {
		throw new ConfigError(`${origin}: ${errors.length} consistency error(s)`, errors);
	}
	const moved: ConfigIssue[] =
		typeof raw === "object" &&
		raw !== null &&
		typeof (raw as { metadata?: Record<string, unknown> }).metadata?.googleBooksApiKey ===
			"string"
			? [
					{
						level: "warning",
						path: "metadata.googleBooksApiKey",
						message:
							"secrets are not configuration: set GOOGLE_BOOKS_API_KEY in the environment (the value here is ignored)",
					},
				]
			: [];
	return {
		config: result.output,
		warnings: [...cross.filter((i) => i.level === "warning"), ...moved],
	};
}

/** Merges `calendar.<year>.json` fragments (holidays and closedRanges) into the main calendar section. */
export function mergeCalendarFragments(
	main: Record<string, unknown>,
	fragments: Record<string, unknown>[],
): Record<string, unknown> {
	const calendar = { ...((main.calendar as Record<string, unknown>) ?? {}) };
	const holidays = [...((calendar.holidays as string[]) ?? [])];
	const closedRanges = [...((calendar.closedRanges as unknown[]) ?? [])];
	for (const fragment of fragments) {
		holidays.push(...((fragment.holidays as string[]) ?? []));
		closedRanges.push(...((fragment.closedRanges as unknown[]) ?? []));
	}
	return {
		...main,
		calendar: { ...calendar, holidays: [...new Set(holidays)].sort(), closedRanges },
	};
}

export function readJsonFile(path: string): Record<string, unknown> {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
	} catch (e) {
		throw new ConfigError(`${path}: ${(e as Error).message}`, [
			{ level: "error", path: "(file)", message: (e as Error).message },
		]);
	}
}

/** The shipped defaults: the same folder layout as CONFIG_DIR, with `config.example.json` as base. */
export const EXAMPLE_CONFIG_DIR = "config";
export const EXAMPLE_CONFIG_PATH = join(EXAMPLE_CONFIG_DIR, "config.example.json");

/** The shipped defaults merged into one raw document (tests, reference generator, wizard). */
export function exampleRaw(): Record<string, unknown> {
	return assembleConfig(
		EXAMPLE_CONFIG_DIR,
		readJsonFile(EXAMPLE_CONFIG_PATH),
		EXAMPLE_CONFIG_PATH,
	).raw;
}

/** Validates an assembled folder; issues carry the file they come from. */
export function parseAssembled(
	assembled: AssembledConfig,
	origin: string,
): { config: AppConfig; warnings: ConfigIssue[] } {
	try {
		const parsed = parseConfig(assembled.raw, origin);
		return {
			config: parsed.config,
			warnings: attachFiles([...assembled.warnings, ...parsed.warnings], assembled.origins),
		};
	} catch (e) {
		if (e instanceof ConfigError) {
			throw new ConfigError(
				e.message.split("\n")[0] ?? origin,
				attachFiles(e.issues, assembled.origins),
			);
		}
		throw e;
	}
}

/**
 * Validates `baseRaw` as if it were `dir/config.json` merged with the fragments of `dir`
 * (used by the writers before they touch the file).
 */
export function validateFolderWith(
	dir: string,
	baseRaw: Record<string, unknown>,
	baseFile: string,
): LoadedConfig {
	const assembled = assembleConfig(dir, baseRaw, baseFile);
	const parsed = parseAssembled(assembled, baseFile);
	return {
		...parsed,
		source: "file",
		path: baseFile,
		files: assembled.files,
		origins: assembled.origins,
	};
}

/** Loads the configuration folder CONFIG_DIR, or the shipped defaults when config.json does not exist yet. */
export function loadConfig(configDir: string): LoadedConfig {
	const path = join(configDir, "config.json");
	if (!existsSync(path)) {
		const assembled = assembleConfig(
			EXAMPLE_CONFIG_DIR,
			readJsonFile(EXAMPLE_CONFIG_PATH),
			EXAMPLE_CONFIG_PATH,
		);
		const parsed = parseAssembled(assembled, EXAMPLE_CONFIG_PATH);
		return {
			...parsed,
			source: "example",
			path: EXAMPLE_CONFIG_PATH,
			files: assembled.files,
			origins: assembled.origins,
		};
	}
	return validateFolderWith(configDir, readJsonFile(path), path);
}
