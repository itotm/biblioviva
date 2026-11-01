// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run i18n:locales` — writes src/lib/i18n/locales.ts from the dictionary folders present
// (owner decision: the language list is built from the files, English first).
import { writeFileSync } from "node:fs";
import { discoverLocales, LOCALES_FILE, localesModule } from "#lib/i18n/discover.js";

const locales = discoverLocales();
writeFileSync(LOCALES_FILE, localesModule(locales));
console.log(`wrote ${LOCALES_FILE}: ${locales.join(", ")}`);
