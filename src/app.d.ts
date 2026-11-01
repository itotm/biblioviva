// SPDX-License-Identifier: GPL-3.0-or-later
// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AppLocale } from "#lib/i18n/index.js";
import type { AuthUser } from "#lib/server/auth/types.js";

declare global {
	/** When this build was made (ISO): `define` in `vite.config.ts`, see `#lib/shared/version.ts`. */
	const __BUILT_AT__: string;
	namespace App {
		interface Locals {
			locale: AppLocale;
			/** The logged-in staff account, or null. */
			user: AuthUser | null;
			/** True while no active staff account exists (first-run wizard). */
			setupMode: boolean;
			/** The public demo refused this request (9.17): the message, answered as a 403. */
			demoBlocked?: string;
		}
		interface Error {
			message: string;
			/** Refused by the guard of the public demo (9.17): the client shows it as it is. */
			demo?: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
