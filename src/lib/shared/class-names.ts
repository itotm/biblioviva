// SPDX-License-Identifier: GPL-3.0-or-later
// The names typed to create many classes at once (Phase 12, Configurazione → Classi, the first-run
// wizard): a list separated by commas, semicolons or new lines — a name may contain spaces
// (`Infanzia A`, `Coccinelle blu`) —, where `A-D` stands for A, B, C, D (letters or numbers, either
// way round only upwards). Duplicates are dropped, the order of first appearance is kept.

const MAX_NAMES = 40;

/** `"A-C, F"` → `["A", "B", "C", "F"]`; null when the text names nothing or too many classes. */
export function expandGroupNames(text: string): string[] | null {
	const out: string[] = [];
	for (const part of text
		.split(/[,;\n]+/)
		.map((p) => p.trim().replace(/\s+/g, " "))
		.filter(Boolean)) {
		const range = /^([A-Za-z]|\d{1,2})-([A-Za-z]|\d{1,2})$/.exec(part);
		if (range) {
			const [from, to] = [range[1] ?? "", range[2] ?? ""];
			const numeric = /^\d+$/.test(from) && /^\d+$/.test(to);
			const letters = /^[A-Za-z]$/.test(from) && /^[A-Za-z]$/.test(to);
			if (numeric) {
				for (let n = Number(from); n <= Number(to); n++) {
					out.push(String(n));
				}
				continue;
			}
			if (letters) {
				const a = from.toUpperCase().charCodeAt(0);
				const b = to.toUpperCase().charCodeAt(0);
				for (let c = a; c <= b; c++) {
					out.push(String.fromCharCode(c));
				}
				continue;
			}
		}
		out.push(part);
	}
	const unique = [...new Set(out)];
	return unique.length === 0 || unique.length > MAX_NAMES ? null : unique;
}
