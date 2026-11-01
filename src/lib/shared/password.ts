// SPDX-License-Identifier: GPL-3.0-or-later
// Readable random passwords for the first-run wizard: three groups of four unambiguous characters
// (no 0/O, 1/l/I), from `crypto.getRandomValues` on both server and browser.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generatePassword(groups = 3, groupLength = 4): string {
	const bytes = new Uint32Array(groups * groupLength);
	crypto.getRandomValues(bytes);
	const chars = Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]);
	const parts: string[] = [];
	for (let i = 0; i < groups; i++) {
		parts.push(chars.slice(i * groupLength, (i + 1) * groupLength).join(""));
	}
	return parts.join("-");
}
