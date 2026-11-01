// SPDX-License-Identifier: GPL-3.0-or-later
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import pkg from "../../../package.json" with { type: "json" };

export const APP_VERSION: string = pkg.version;

/**
 * When this build was made (ISO), set by `vite.config.ts`; the scripts run by Bun without Vite
 * (`config:check`, `i18n:check`, …) take the time they start.
 */
export const BUILT_AT: string =
	typeof __BUILT_AT__ === "string" ? __BUILT_AT__ : new Date().toISOString();

/**
 * The version the public demo shows (owner request): the time of its build on the library's clock,
 * `yyyy.mm.dd.hhmm`, since it follows the main branch between releases. Archives and `/healthz`
 * keep `APP_VERSION`.
 */
export function demoVersion(builtAt: string, timezone: string): string {
	return format(new TZDate(new Date(builtAt).getTime(), timezone), "yyyy.MM.dd.HHmm");
}
