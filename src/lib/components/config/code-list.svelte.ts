// SPDX-License-Identifier: GPL-3.0-or-later
// A list of codes being edited (step 11.4: item types, school sections): rows with a stable key,
// the code each row had when loaded (a changed code is a rename: its copies or students follow it
// on save), the inline checks, add, remove and reorder. Nothing leaves the page until "Salva";
// whether the list changed is the block's `DraftEditor` over `draft`.

export interface CodeRow {
	key: string;
	/** The code when loaded; null for a row added in this session. */
	originalCode: string | null;
	code: string;
	label: string;
	/** Item types: "solo consultazione" (not for loan). */
	flag: boolean;
}

export type CodeProblem = "codeRequired" | "codeFormat" | "codeTaken" | "labelRequired";

let counter = 0;
const newKey = (): string => `c${++counter}`;

export class CodeListEditor {
	rows = $state<CodeRow[]>([]);
	readonly #pattern: RegExp;
	readonly #withLabel: boolean;

	constructor(pattern: RegExp, withLabel: boolean) {
		this.#pattern = pattern;
		this.#withLabel = withLabel;
	}

	load(items: readonly { code: string; label?: string; flag?: boolean }[]): void {
		this.rows = items.map((i) => ({
			key: newKey(),
			originalCode: i.code,
			code: i.code,
			label: i.label ?? i.code,
			flag: i.flag ?? false,
		}));
	}

	readonly draft: { code: string; label: string; flag: boolean }[] = $derived(
		this.rows.map((r) => ({
			code: r.code.trim(),
			label: this.#withLabel ? r.label.trim() : r.code.trim(),
			flag: r.flag,
		})),
	);

	/** Old code → new code for the rows whose code changed. */
	readonly renames: Record<string, string> = $derived.by(() => {
		const out: Record<string, string> = {};
		for (const r of this.rows) {
			const code = r.code.trim();
			if (r.originalCode !== null && r.originalCode !== code && code !== "") {
				out[r.originalCode] = code;
			}
		}
		return out;
	});

	readonly problems: Readonly<Record<string, CodeProblem[]>> = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const r of this.rows) {
			const code = r.code.trim();
			counts[code] = (counts[code] ?? 0) + 1;
		}
		const out: Record<string, CodeProblem[]> = {};
		for (const r of this.rows) {
			const code = r.code.trim();
			const found: CodeProblem[] = [];
			if (code === "") {
				found.push("codeRequired");
			} else if (!this.#pattern.test(code)) {
				found.push("codeFormat");
			} else if ((counts[code] ?? 0) > 1) {
				found.push("codeTaken");
			}
			if (this.#withLabel && r.label.trim() === "") {
				found.push("labelRequired");
			}
			if (found.length > 0) {
				out[r.key] = found;
			}
		}
		return out;
	});

	readonly invalid: boolean = $derived(
		Object.keys(this.problems).length > 0 || this.rows.length === 0,
	);

	add(): void {
		this.rows.push({ key: newKey(), originalCode: null, code: "", label: "", flag: false });
	}

	remove(key: string): void {
		const i = this.rows.findIndex((r) => r.key === key);
		if (i !== -1 && this.rows.length > 1) {
			this.rows.splice(i, 1);
		}
	}

	move(key: string, delta: -1 | 1): void {
		const i = this.rows.findIndex((r) => r.key === key);
		const to = i + delta;
		if (i === -1 || to < 0 || to >= this.rows.length) {
			return;
		}
		const [row] = this.rows.splice(i, 1);
		if (row) {
			this.rows.splice(to, 0, row);
		}
	}
}
