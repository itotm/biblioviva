// SPDX-License-Identifier: GPL-3.0-or-later
// The size of a card template (step 11.17): `cardMm` of its `template.json`, read and written in
// the text of the file so every other byte stays as it was (the designer keeps the files as they
// are written, 11.16). Without `cardMm` the card takes `cards.cardMm` of the configuration.

export interface CardSize {
	width: number;
	height: number;
}

const CARD_MM = /\n?([ \t]*)"cardMm"\s*:\s*\{[^}]*\}[ \t]*,?/;

/** The size the file names, or null when it names none (or is not valid JSON). */
export function readCardSize(json: string): CardSize | null {
	try {
		const size = (JSON.parse(json) as { cardMm?: Partial<CardSize> }).cardMm;
		return typeof size?.width === "number" && typeof size.height === "number"
			? { width: size.width, height: size.height }
			: null;
	} catch {
		return null;
	}
}

/** The file with `cardMm` set to `size`, or taken out with null; the rest of the text kept. */
export function writeCardSize(json: string, size: CardSize | null): string {
	const entry = size ? `"cardMm": { "width": ${size.width}, "height": ${size.height} }` : null;
	const match = CARD_MM.exec(json);
	if (match) {
		const indent = match[1] ?? "\t";
		const comma = match[0].trimEnd().endsWith(",");
		if (!entry) {
			// the key goes; a comma left dangling before the closing brace goes too
			return json.replace(CARD_MM, "").replace(/,(\s*)\}\s*$/, "$1}\n");
		}
		return json.replace(CARD_MM, `\n${indent}${entry}${comma ? "," : ""}`);
	}
	if (!entry) {
		return json;
	}
	// a new key: after the first line of the object, as the shipped templates write it
	const open = json.indexOf("{");
	if (open < 0) {
		return json;
	}
	const indent = /\{\s*\n([ \t]*)/.exec(json)?.[1] ?? "\t";
	const rest = json.slice(open + 1);
	return /^\s*\}/.test(rest)
		? `${json.slice(0, open + 1)}\n${indent}${entry}\n${rest.trimStart()}`
		: `${json.slice(0, open + 1)}\n${indent}${entry},${rest}`;
}
