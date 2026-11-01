// SPDX-License-Identifier: GPL-3.0-or-later
// What a Z39.50 target of the configuration may say (`z3950.targets`): its values are written into
// the command file of yaz-client (PLAN.md Appendix D), one command per line, so none may hold a
// line break or a space that would start another command or argument. The configuration schema
// applies these rules; the targets editor shows them inline.

/** A host name or an IPv4 address: letters, digits, dots and hyphens. */
export const Z3950_HOST = /^[A-Za-z0-9.-]{1,253}$/;

/** The database, the character set and the element set: one word, no spaces or control characters. */
export const Z3950_WORD = /^[^\s\p{Cc}]{1,120}$/u;
