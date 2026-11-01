// SPDX-License-Identifier: GPL-3.0-or-later
// The two kinds of refusal a service throws: a row the request names that does not exist
// (`NotFoundError`, a 404 at the edge) and a refusal the page explains by its code
// (`ServiceError`). Services never speak HTTP: `#lib/server/http/errors.ts` maps both for the
// remote functions and the routes.

/** A row the request names does not exist (or no longer does). */
export class NotFoundError extends Error {
	constructor(
		/** What is missing, as the 404 names it ("patron", "print list"). */
		readonly entity: string,
		message = `${entity} not found`,
	) {
		super(message);
		this.name = "NotFoundError";
	}
}

/** A refusal with a code the page explains (`<area>.errors.<code>`). */
export class ServiceError<Code extends string = string> extends Error {
	constructor(
		readonly code: Code,
		message: string = code,
	) {
		super(message);
		this.name = "ServiceError";
	}
}
