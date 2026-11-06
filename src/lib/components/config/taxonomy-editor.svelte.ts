// SPDX-License-Identifier: GPL-3.0-or-later
// The classification editor's working copy (step 11.1): the draft as reactive state with a stable
// key per node (lists, drag and drop, selection) and the code each node had when it was loaded —
// a changed code is a rename, and on save the records of the old code follow it. Nothing leaves
// the page until "Salva"; `dirty` tells whether there is anything to save.
import type { CallNumberScheme } from "#lib/shared/classification.js";
import {
	codeCounts,
	deweyProblems,
	LEVEL_KEY,
	leafProblems,
	levelProblems,
	type DeweyProblem,
	type LeafProblem,
	type TaxonomyDraft,
	type TaxonomyKind,
	type TaxonomyLeaf,
} from "#lib/shared/taxonomy.js";

export interface EditLeaf extends TaxonomyLeaf {
	key: string;
	/** The code when the draft was loaded; null for a node added in this session. */
	originalCode: string | null;
}

export interface EditNode extends EditLeaf {
	children: EditLeaf[];
}

/** A reading level being edited (Phase 12.6). */
export interface EditLevel {
	key: string;
	originalCode: string | null;
	code: string;
	label: string;
}

export interface EditDewey {
	key: string;
	prefix: string;
	/** Key of the class the prefix points to, so a renamed class keeps its rows. */
	target: string;
}

/** Where a node sits: a genre, a top-level class, or a class under `parent`. */
export interface NodePlace {
	kind: TaxonomyKind;
	node: EditLeaf;
	parent: EditNode | null;
	siblings: EditLeaf[];
	index: number;
}

let counter = 0;
const newKey = (): string => `n${++counter}`;
const editLeaf = (l: TaxonomyLeaf): EditLeaf => ({ ...l, key: newKey(), originalCode: l.code });
const plain = (l: EditLeaf): TaxonomyLeaf => ({
	code: l.code.trim(),
	label: l.label.trim(),
	image: l.image,
	color: l.color,
});

export class TaxonomyEditor {
	fictionByClass = $state(true);
	readingLevels = $state<EditLevel[]>([]);
	classPerItem = $state(false);
	genres = $state<EditLeaf[]>([]);
	nonfiction = $state<EditNode[]>([]);
	deweyMap = $state<EditDewey[]>([]);
	callNumber = $state<CallNumberScheme>({
		fiction: "",
		fictionWithClass: "",
		nonfiction: "",
		text: "author3",
	});
	/** Key of the node shown in the side panel. */
	selected = $state<string | null>(null);
	#saved = $state("");

	constructor(draft: TaxonomyDraft) {
		this.reset(draft);
	}

	/** Loads a saved taxonomy; the selection follows its code when it still exists. */
	reset(draft: TaxonomyDraft): void {
		const before = this.selected === null ? null : this.find(this.selected);
		this.fictionByClass = draft.fictionByClass;
		this.readingLevels = draft.readingLevels.map((l) => ({
			key: newKey(),
			originalCode: l.code,
			code: l.code,
			label: l.label,
		}));
		this.classPerItem = draft.classPerItem;
		this.genres = draft.genres.map(editLeaf);
		this.nonfiction = draft.nonfiction.map((n) => ({
			...editLeaf(n),
			children: n.children.map(editLeaf),
		}));
		this.deweyMap = draft.deweyMap.map((m) => ({
			key: newKey(),
			prefix: m.prefix,
			target: this.findCode("nonfiction", m.code)?.node.key ?? "",
		}));
		this.callNumber = { ...draft.callNumber };
		this.#saved = JSON.stringify(this.draft);
		const again = before ? this.findCode(before.kind, before.node.code.trim()) : null;
		this.selected = again?.node.key ?? null;
	}

	readonly draft: TaxonomyDraft = $derived.by(() => ({
		fictionByClass: this.fictionByClass,
		readingLevels: this.readingLevels.map((l) => ({
			code: l.code.trim(),
			label: l.label.trim(),
		})),
		classPerItem: this.classPerItem,
		genres: this.genres.map(plain),
		nonfiction: this.nonfiction.map((n) => ({ ...plain(n), children: n.children.map(plain) })),
		deweyMap: this.deweyMap.map((m) => ({
			prefix: m.prefix.trim(),
			code: this.find(m.target)?.node.code.trim() ?? "",
		})),
		callNumber: { ...this.callNumber },
	}));

	readonly dirty: boolean = $derived(JSON.stringify(this.draft) !== this.#saved);

	/** Renamed codes: old code → new code (their records follow on save). */
	readonly renames: Record<string, string> = $derived.by(() => {
		const out: Record<string, string> = {};
		for (const node of this.#all()) {
			const code = node.code.trim();
			if (node.originalCode !== null && node.originalCode !== code && code !== "") {
				out[node.originalCode] = code;
			}
		}
		// a renamed reading level: its books follow it (prefixed: level codes may look like others)
		for (const level of this.readingLevels) {
			const code = level.code.trim();
			if (level.originalCode !== null && level.originalCode !== code && code !== "") {
				out[`${LEVEL_KEY}${level.originalCode}`] = code;
			}
		}
		return out;
	});

	/** Inline problems per reading level key. */
	readonly levelIssues: Readonly<Record<string, LeafProblem[]>> = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const l of this.readingLevels) {
			counts[l.code.trim()] = (counts[l.code.trim()] ?? 0) + 1;
		}
		return Object.fromEntries(
			this.readingLevels
				.map((l) => [l.key, levelProblems(l, counts)] as const)
				.filter(([, found]) => found.length > 0),
		);
	});

	addLevel(): void {
		this.readingLevels.push({ key: newKey(), originalCode: null, code: "", label: "" });
	}

	removeLevel(key: string): void {
		const i = this.readingLevels.findIndex((l) => l.key === key);
		if (i !== -1) {
			this.readingLevels.splice(i, 1);
		}
	}

	moveLevel(key: string, delta: -1 | 1): void {
		const i = this.readingLevels.findIndex((l) => l.key === key);
		const to = i + delta;
		if (i === -1 || to < 0 || to >= this.readingLevels.length) {
			return;
		}
		const [level] = this.readingLevels.splice(i, 1);
		if (level) {
			this.readingLevels.splice(to, 0, level);
		}
	}

	/** Inline problems per node key (nodes without problems are left out). */
	readonly problems: Readonly<Record<string, LeafProblem[]>> = $derived.by(() => {
		const counts = codeCounts(this.draft);
		return Object.fromEntries(
			[...this.#all()]
				.map((node) => [node.key, leafProblems(node, counts)] as const)
				.filter(([, found]) => found.length > 0),
		);
	});

	/** Codes of every class, parents and children, in tree order (Dewey map choices). */
	readonly classCodes: string[] = $derived(
		this.nonfiction.flatMap((n) => [n.code.trim(), ...n.children.map((c) => c.code.trim())]),
	);

	readonly deweyIssues: DeweyProblem[][] = $derived(
		deweyProblems(this.draft.deweyMap, this.classCodes),
	);

	readonly patternsMissing: boolean = $derived(
		[
			this.callNumber.fiction,
			this.callNumber.fictionWithClass,
			this.callNumber.nonfiction,
		].some((p) => p.trim() === ""),
	);

	/** Something blocks the save: a node, a Dewey row or an empty pattern has a problem. */
	readonly invalid: boolean = $derived(
		Object.keys(this.problems).length > 0 ||
			Object.keys(this.levelIssues).length > 0 ||
			this.deweyIssues.some((p) => p.length > 0) ||
			this.patternsMissing,
	);

	*#all(): Generator<EditLeaf> {
		yield* this.genres;
		for (const n of this.nonfiction) {
			yield n;
			yield* n.children;
		}
	}

	find(key: string): NodePlace | null {
		const g = this.genres.findIndex((x) => x.key === key);
		if (g !== -1) {
			const node = this.genres[g];
			return node
				? { kind: "fiction", node, parent: null, siblings: this.genres, index: g }
				: null;
		}
		for (const [i, n] of this.nonfiction.entries()) {
			if (n.key === key) {
				return {
					kind: "nonfiction",
					node: n,
					parent: null,
					siblings: this.nonfiction,
					index: i,
				};
			}
			const c = n.children.findIndex((x) => x.key === key);
			const child = n.children[c];
			if (child) {
				return {
					kind: "nonfiction",
					node: child,
					parent: n,
					siblings: n.children,
					index: c,
				};
			}
		}
		return null;
	}

	findCode(kind: TaxonomyKind, code: string): NodePlace | null {
		for (const node of this.#all()) {
			if (node.code.trim() === code) {
				const place = this.find(node.key);
				if (place?.kind === kind) {
					return place;
				}
			}
		}
		return null;
	}

	readonly current: NodePlace | null = $derived(
		this.selected === null ? null : this.find(this.selected),
	);

	addGenre(): EditLeaf {
		const node: EditLeaf = {
			key: newKey(),
			originalCode: null,
			code: "",
			label: "",
			image: null,
			color: null,
		};
		this.genres.push(node);
		this.selected = node.key;
		return this.#placed(node.key);
	}

	/** A new class at the top level, or under `parentKey`. */
	addClass(parentKey: string | null = null): EditLeaf {
		const leaf: EditLeaf = {
			key: newKey(),
			originalCode: null,
			code: "",
			label: "",
			image: null,
			color: null,
		};
		const parent = this.nonfiction.find((n) => n.key === parentKey);
		if (parent) {
			parent.children.push(leaf);
		} else {
			this.nonfiction.push({ ...leaf, children: [] });
		}
		this.selected = leaf.key;
		return this.#placed(leaf.key);
	}

	/** The node as the state holds it (the reactive copy, not the object that was pushed). */
	#placed(key: string): EditLeaf {
		const place = this.find(key);
		if (!place) {
			throw new Error(`node ${key} not found`);
		}
		return place.node;
	}

	/** Removes a node (a class with its subclasses); the list keeps at least one node. */
	remove(key: string): void {
		const place = this.find(key);
		if (!place || !this.canRemove(key)) {
			return;
		}
		place.siblings.splice(place.index, 1);
		// the selection goes when it was the node or one of its subclasses
		if (this.selected !== null && this.find(this.selected) === null) {
			this.selected = null;
		}
	}

	canRemove(key: string): boolean {
		const place = this.find(key);
		return place !== null && (place.parent !== null || place.siblings.length > 1);
	}

	/** One step up or down among its siblings. */
	move(key: string, delta: -1 | 1): void {
		const place = this.find(key);
		const to = (place?.index ?? 0) + delta;
		if (!place || to < 0 || to >= place.siblings.length) {
			return;
		}
		const [node] = place.siblings.splice(place.index, 1);
		if (node) {
			place.siblings.splice(to, 0, node);
		}
	}

	/**
	 * Drag and drop: `key` goes before (or after) `target`. Genres move among genres and top
	 * classes among top classes; a subclass moves among subclasses, also under another class, or
	 * to the end of a top class it is dropped on.
	 */
	drop(key: string, target: string, after = false): void {
		const from = this.find(key);
		const to = this.find(target);
		if (!from || !to || key === target || from.kind !== to.kind) {
			return;
		}
		const topLevel = from.parent === null;
		if (from.kind === "nonfiction" && !topLevel && to.parent === null) {
			// a subclass dropped on a top class joins it at the end
			const parent = this.nonfiction.find((n) => n.key === target);
			if (parent) {
				from.siblings.splice(from.index, 1);
				parent.children.push(from.node);
			}
			return;
		}
		if (topLevel !== (to.parent === null)) {
			return;
		}
		const [node] = from.siblings.splice(from.index, 1);
		if (!node) {
			return;
		}
		const index = to.siblings.findIndex((x) => x.key === target);
		to.siblings.splice(after ? index + 1 : index, 0, node);
	}

	/**
	 * Moves a class to the top level (`parentKey` null) or under another top class. A top class
	 * with subclasses cannot become a subclass (two levels at most).
	 */
	reparent(key: string, parentKey: string | null): void {
		const place = this.find(key);
		if (place?.kind !== "nonfiction" || (place.parent?.key ?? null) === parentKey) {
			return;
		}
		const node = place.node as EditNode;
		if (place.parent === null && (node.children?.length ?? 0) > 0) {
			return;
		}
		const target = this.nonfiction.find((n) => n.key === parentKey);
		if (parentKey !== null && !target) {
			return;
		}
		place.siblings.splice(place.index, 1);
		const leaf: EditLeaf = {
			key: node.key,
			originalCode: node.originalCode,
			code: node.code,
			label: node.label,
			image: node.image,
			color: node.color,
		};
		if (target) {
			target.children.push(leaf);
		} else {
			this.nonfiction.push({ ...leaf, children: [] });
		}
	}

	addDewey(): void {
		this.deweyMap.push({ key: newKey(), prefix: "", target: this.nonfiction[0]?.key ?? "" });
	}

	removeDewey(key: string): void {
		const i = this.deweyMap.findIndex((m) => m.key === key);
		if (i !== -1) {
			this.deweyMap.splice(i, 1);
		}
	}
}
