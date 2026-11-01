// SPDX-License-Identifier: GPL-3.0-or-later
import { passwordHasher } from "#lib/server/runtime/password.js";

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string, memoryMb?: number): Promise<string> {
	return passwordHasher.hash(password, memoryMb);
}

/** False for wrong passwords and for malformed hashes (e.g. the `REPLACE_ME` placeholder). */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
	return passwordHasher.verify(password, hash);
}

export function looksLikeHash(value: string): boolean {
	return /^\$argon2(id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/.test(
		value,
	);
}
