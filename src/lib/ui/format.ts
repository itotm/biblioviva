// SPDX-License-Identifier: GPL-3.0-or-later
// Dates and numbers in the installation's one language (`ui.locale`) and the library's time zone
// (`library.timezone`): the root layout provides them from its data, components read them from the
// context instead of passing the locale down as props. A component that shows another language (the
// setup wizard before the installation has one) calls the formatters of `#lib/shared/dates.ts`.
import { getContext, setContext } from "svelte";
import { formatDate, formatDateTime, formatDay, type DateShape } from "#lib/shared/dates.js";

export interface FormatSettings {
	locale: string;
	timezone: string;
}

export interface Format {
	/** The installation's language (`ui.locale`). */
	readonly locale: string;
	/** The library's time zone (`library.timezone`). */
	readonly timezone: string;
	/** A calendar day (`YYYY-MM-DD`: due dates, closures), the same day in every zone. */
	day(isoDay: string, shape?: DateShape): string;
	/** The date of an instant (ISO timestamp or `Date`) on the library's day, or its time with a shape. */
	date(instant: string | Date, shape?: DateShape): string;
	/** The short date and time of an instant in the library's zone. */
	dateTime(instant: string | Date): string;
	number(value: number, options?: Intl.NumberFormatOptions): string;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(
	locale: string,
	options: Intl.NumberFormatOptions | undefined,
): Intl.NumberFormat {
	const key = `${locale}|${JSON.stringify(options ?? {})}`;
	let format = numberFormats.get(key);
	if (!format) {
		format = new Intl.NumberFormat(locale, options);
		numberFormats.set(key, format);
	}
	return format;
}

/**
 * The formatters bound to the settings `source` returns, read at every call: the layout passes its
 * data, so a new language or time zone after a reload of the configuration shows at once.
 */
export function createFormat(source: () => FormatSettings): Format {
	return {
		get locale() {
			return source().locale;
		},
		get timezone() {
			return source().timezone;
		},
		day: (isoDay, shape) => formatDay(isoDay, source().locale, shape),
		date: (instant, shape) => {
			const { locale, timezone } = source();
			return formatDate(instant, locale, timezone, shape);
		},
		dateTime: (instant) => {
			const { locale, timezone } = source();
			return formatDateTime(
				typeof instant === "string" ? instant : instant.toISOString(),
				locale,
				timezone,
			);
		},
		number: (value, options) => numberFormat(source().locale, options).format(value),
	};
}

const KEY = Symbol("biblioviva.format");

export function provideFormat(format: Format): void {
	setContext(KEY, format);
}

/** Context map for mounting components outside the layout (component tests): Italian, Rome. */
export function formatContext(
	settings: FormatSettings = { locale: "it", timezone: "Europe/Rome" },
): Map<symbol, Format> {
	return new Map([[KEY, createFormat(() => settings)]]);
}

/** The formatters of the installation (set by the root layout). */
export function useFormat(): Format {
	const format = getContext<Format | undefined>(KEY);
	if (!format) {
		throw new Error("format context missing: is the root layout mounted?");
	}
	return format;
}
