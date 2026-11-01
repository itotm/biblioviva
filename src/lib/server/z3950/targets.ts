// SPDX-License-Identifier: GPL-3.0-or-later
// Z39.50 targets from the configuration (`z3950.targets`, default OPAC SBN).
import type { AppConfig } from "#lib/server/config/schema.js";

export interface Z3950Target {
	id: string;
	name: string;
	host: string;
	port: number;
	database: string;
	syntax: "unimarc" | "marc21";
	charset: string;
	elements: string;
}

export function z3950Target(config: AppConfig, id = config.z3950.defaultTarget): Z3950Target {
	const t = config.z3950.targets.find((x) => x.id === id);
	if (!t) {
		throw new Error(`z3950 target "${id}" is not configured`);
	}
	return {
		id: t.id,
		name: t.name,
		host: t.host,
		port: t.port,
		database: t.database,
		syntax: t.syntax,
		charset: t.charset,
		elements: t.elements,
	};
}
