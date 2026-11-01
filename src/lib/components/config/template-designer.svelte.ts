// SPDX-License-Identifier: GPL-3.0-or-later
// State of the visual template designer (steps 11.10, 11.16): the faces read from the files of the
// draft, the face shown and the element chosen, with the moves the canvas, the keyboard and the
// properties panel make — always inside the face, snapped to the grid chosen — and the places
// the preview measured for the elements that the files do not place. The files are the only
// source: `load` reads them, `write` gives them back with the changes.
import {
	type DesignElement,
	type DesignFace,
	type DesignKind,
	type ElementType,
	emptyFace,
	readFace,
} from "#lib/shared/template-design.js";
import { newElement, writeFace } from "#lib/shared/template-design-write.js";
import type { DesignStyle } from "#lib/shared/template-style.js";

export interface FaceSize {
	file: string;
	widthMm: number;
	heightMm: number;
	/** Where the face starts in its preview document (the cells of a unit are stacked). */
	offsetMm: number;
	/** The preview document that draws the face: `front`/`back` for cards, the stock for labels. */
	doc: string | null;
	/** The cell of the face in that document (labels, 0-based). */
	cell: number;
	/** The label variant the face belongs to (null: the only layout). */
	variant: string | null;
}

/** Where the preview draws an element, and the look it has there. */
export interface Measure {
	x: number;
	y: number;
	w: number;
	h: number;
	style: DesignStyle;
}

/** The steps of the grid the designer snaps to, in mm (0: no grid, free placement). */
export const GRID_STEPS = [0, 0.5, 1, 2, 2.5, 5, 10] as const;
export type GridStep = (typeof GRID_STEPS)[number];
const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);
const round = (v: number): number => Math.round(v * 100) / 100;

/** Closest the drawn lines of the grid may be, in px; closer, every 2, 5 or 10 steps is drawn. */
const MIN_LINE_PX = 6;

/**
 * The places (px from the face's edge) of the grid's lines across a length of the face: each one
 * computed on its own, so no line drifts from where the moves land (a repeated background tile is
 * rounded to whole pixels by the browser, and drops a line every few).
 */
export function gridLines(lengthMm: number, grid: number, scale: number): number[] {
	if (!(grid > 0 && scale > 0)) {
		return [];
	}
	const every = [1, 2, 5, 10, 20, 50].find((k) => grid * k * scale >= MIN_LINE_PX) ?? 100;
	const stepMm = grid * every;
	const out: number[] = [];
	for (let k = 0; k * stepMm <= lengthMm + 1e-9; k++) {
		out.push(k * stepMm * scale);
	}
	return out;
}

export class TemplateDesigner {
	faces = $state<DesignFace[]>([]);
	face = $state(0);
	selectedId = $state<string | null>(null);
	/** Places and looks measured in the preview, by element id. */
	measured = $state<Record<string, Measure>>({});
	/** The grid moves and sizes snap to (mm; 0: free, to a tenth of a millimetre). */
	grid = $state<GridStep>(2);
	#ids = 0;

	constructor(
		readonly kind: DesignKind,
		readonly sizes: readonly FaceSize[],
	) {}

	#nextId = (): string => `e${++this.#ids}`;

	/** A length on the grid (to a tenth of a millimetre without one). */
	snap(v: number): number {
		const step = this.grid > 0 ? this.grid : 0.1;
		return round(Math.round(v / step) * step);
	}

	/** How far an arrow key moves an element: one step of the grid. */
	get step(): number {
		return this.grid > 0 ? this.grid : 0.1;
	}

	/** Reads the faces from the files (a missing face starts empty); keeps the face shown. */
	load(files: Readonly<Record<string, string>>): void {
		this.#ids = 0;
		this.faces = this.sizes.map((s) =>
			readFace(
				this.kind,
				s.file,
				files[s.file] ?? emptyFace(this.kind, s.file),
				this.#nextId,
			),
		);
		this.face = Math.min(this.face, Math.max(0, this.faces.length - 1));
		this.selectedId = null;
		this.measured = {};
	}

	/**
	 * The files with the faces written back; with `mark`, every element carries `data-bv` for the
	 * preview to measure. A face whose file does not exist is written only when it has elements.
	 */
	write(files: Readonly<Record<string, string>>, mark = false): Record<string, string> {
		const out = { ...files };
		for (const f of this.faces) {
			if (f.file in files || f.nodes.some((n) => n.kind === "element")) {
				out[f.file] = writeFace($state.snapshot(f), mark);
			}
		}
		return out;
	}

	get size(): FaceSize {
		return (
			this.sizes[this.face] ??
			this.sizes[0] ?? {
				file: "",
				widthMm: 70,
				heightMm: 48,
				offsetMm: 0,
				doc: null,
				cell: 0,
				variant: null,
			}
		);
	}

	get current(): DesignFace | null {
		return this.faces[this.face] ?? null;
	}

	get elements(): DesignElement[] {
		return (this.current?.nodes ?? []).filter((n) => n.kind === "element");
	}

	get selected(): DesignElement | null {
		return this.elements.find((e) => e.id === this.selectedId) ?? null;
	}

	/** Where an element is: its own place, or the one measured in the preview. */
	box(e: DesignElement): { x: number; y: number; w: number; h: number } | null {
		if (e.placed) {
			return { x: e.x, y: e.y, w: e.w, h: e.h };
		}
		const m = this.measured[e.id];
		return m ? { x: m.x, y: m.y, w: m.w, h: m.h } : null;
	}

	/** Elements of the face shown that the files do not place. */
	get unplaced(): number {
		return this.elements.filter((e) => !e.placed).length;
	}

	/**
	 * Writes the measured place of every element of the face shown that has none, so moving one
	 * does not move the others: all of them stay where the preview draws them.
	 */
	fix(): void {
		for (const e of this.elements) {
			if (e.placed) {
				continue;
			}
			const m = this.measured[e.id];
			e.x = round(clamp(m?.x ?? 0, 0, this.size.widthMm));
			e.y = round(clamp(m?.y ?? 0, 0, this.size.heightMm));
			e.w = round(Math.max(m?.w ?? 10, 1));
			e.h = round(Math.max(m?.h ?? 5, 1));
			e.placed = true;
		}
	}

	add(type: ElementType, options: { text?: string; image?: string } = {}): void {
		const face = this.current;
		if (!face) {
			return;
		}
		const e = newElement(this.kind, type, this.#nextId(), this.size, options);
		// after the last element (drawn on top), indented like the first one
		const nodes = face.nodes;
		const first = nodes.findIndex((n) => n.kind === "element");
		const last = nodes.findLastIndex((n) => n.kind === "element");
		const lead = nodes[first - 1];
		const leadSpace = lead?.kind === "raw" ? (/\n\s*$/.exec(lead.text)?.[0] ?? null) : null;
		const indent = leadSpace ?? (face.root ? "\n\t" : last >= 0 ? "\n" : "");
		let at = last + 1;
		if (last < 0) {
			at = nodes.length;
			while (
				at > 0 &&
				nodes[at - 1]?.kind === "raw" &&
				/^\s*$/.test(nodes[at - 1]?.text ?? "")
			) {
				at--;
			}
		}
		nodes.splice(at, 0, { kind: "raw", text: indent }, e);
		if (!face.root && at + 2 === nodes.length) {
			nodes.push({ kind: "raw", text: "\n" });
		}
		this.selectedId = e.id;
	}

	remove(id: string): void {
		const face = this.current;
		if (!face) {
			return;
		}
		const i = face.nodes.findIndex((n) => n.kind === "element" && n.id === id);
		if (i < 0) {
			return;
		}
		const before = face.nodes[i - 1];
		const from = before?.kind === "raw" && /^\s*$/.test(before.text) ? i - 1 : i;
		face.nodes.splice(from, i - from + 1);
		if (this.selectedId === id) {
			this.selectedId = null;
		}
	}

	#find(id: string): DesignElement | null {
		return this.elements.find((el) => el.id === id) ?? null;
	}

	/** Moves an element to a position (mm), kept inside the face. */
	moveTo(id: string, x: number, y: number): void {
		const e = this.#find(id);
		if (!e) {
			return;
		}
		this.fix();
		e.x = clamp(this.snap(x), 0, Math.max(0, this.size.widthMm - e.w));
		e.y = clamp(this.snap(y), 0, Math.max(0, this.size.heightMm - e.h));
	}

	moveBy(id: string, dx: number, dy: number): void {
		const e = this.#find(id);
		const b = e ? this.box(e) : null;
		if (e && b) {
			this.moveTo(id, b.x + dx, b.y + dy);
		}
	}

	/** Resizes an element (mm), at least 1 mm and never past the face. */
	resizeTo(id: string, w: number, h: number): void {
		const e = this.#find(id);
		if (!e) {
			return;
		}
		this.fix();
		e.w = clamp(this.snap(w), 1, Math.max(1, this.size.widthMm - e.x));
		e.h = clamp(this.snap(h), 1, Math.max(1, this.size.heightMm - e.y));
	}

	/** One step earlier or later in the drawing order (later ones are drawn on top). */
	reorder(id: string, by: -1 | 1): void {
		const face = this.current;
		if (!face) {
			return;
		}
		const slots = face.nodes.flatMap((n, i) => (n.kind === "element" ? [i] : []));
		const k = slots.findIndex((i) => {
			const n = face.nodes[i];
			return n?.kind === "element" && n.id === id;
		});
		const a = slots[k];
		const b = slots[k + by];
		if (a === undefined || b === undefined) {
			return;
		}
		const x = face.nodes[a];
		const y = face.nodes[b];
		if (x && y) {
			face.nodes[a] = y;
			face.nodes[b] = x;
		}
	}
}
