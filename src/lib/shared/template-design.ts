// SPDX-License-Identifier: GPL-3.0-or-later
// The visual designer's view of a card or label template (PLAN.md steps 11.10, 11.16). The HTML
// files of the faces are the only source: a face is read into elements — the direct children of
// the face's root element, or of the file when it has no single root — and written back changing
// only the elements that changed, every other byte kept. An element carries its place and size in
// millimetres and its look in its own `style` attribute; one without a place there (laid out by
// `style.css` or by the flow) is "not placed": the designer shows it where the preview draws it
// and writes its measured place on the first move. This module reads the faces; writing them back
// and new elements are in `template-design-write.ts`, the look of an element in
// `template-style.ts`. Pure: used by the page and by the tests.
import { BLEED_BACKGROUND_SIZE } from "./card-backgrounds.js";
import {
	attr,
	isVoid,
	parseStyle,
	plainText,
	sectionBalance,
	splitNodes,
	styleValue,
	type ElementNode,
	type RawNode,
	type StyleDecl,
} from "./template-html.js";
import {
	ASSET,
	lengthMm,
	readBorder,
	readFill,
	readStyle,
	type BorderStyle,
	type DesignStyle,
} from "./template-style.js";

export type DesignKind = "cards" | "labels";

export const ELEMENT_TYPES = [
	"field",
	"text",
	"barcode",
	"photo",
	"pictogram",
	"image",
	"box",
	"html",
	"other",
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

/** The text fields a field element can show, by kind (a subset of the engine's allowlists). */
export const DESIGN_FIELDS: Record<DesignKind, readonly string[]> = {
	cards: [
		"library.name",
		"patron.first_name",
		"patron.last_name",
		"patron.card_number",
		"patron.class_label",
		"patron.class_line",
		"patron.level_label",
		"patron.group",
		"school_year",
		"issued_on",
		"valid_until",
	],
	labels: [
		"item.barcode",
		"item.call_number",
		"call.head",
		"call.rest",
		"biblio.title_short",
		"biblio.author_short",
		"biblio.publication_year",
		"biblio.series",
		"biblio.series_number",
		"classification.code",
		"classification.label",
		"classification.reading_level",
		"item.item_type",
		"library.name",
	],
};

/** The element types the designer adds, by kind. */
export const DESIGN_TYPES: Record<DesignKind, readonly ElementType[]> = {
	cards: ["field", "text", "barcode", "photo", "image", "box", "html"],
	labels: ["field", "text", "barcode", "pictogram", "image", "box", "html"],
};

/** The class whose `<svg>` the template engine sizes to the box (`renderTemplate`). */
export const BARCODE_CLASS = "bv-barcode";

/** What the designer edits of an element. */
export interface Editable {
	placed: boolean;
	x: number;
	y: number;
	w: number;
	h: number;
	field: string | null;
	text: string | null;
	image: string | null;
	html: string | null;
	fill: string | null;
	border: BorderStyle | null;
	style: DesignStyle;
}

export interface DesignElement extends Editable {
	kind: "element";
	id: string;
	type: ElementType;
	/** How the element is written, and what was read from it. */
	src: {
		tag: string;
		attrs: [string, string | null][];
		decls: StyleDecl[];
		startTag: string;
		inner: string;
		endTag: string;
		source: string;
		read: Editable;
	};
}

export type FaceNode = RawNode | DesignElement;

export interface FaceLook {
	background: string | null;
	/** An image of `assets/`, `NO_IMAGE`, or null: none of its own (the style sheet's, if any). */
	backgroundImage: string | null;
	/**
	 * The image runs `BACKGROUND_BLEED_MM` (card-backgrounds.ts) past the face on every side, to be cut away (the
	 * shipped backgrounds, step 11.17); otherwise it covers the face.
	 */
	backgroundBleed: boolean;
}

/** A face that shows no background image, even one the style sheet gives it. */
export const NO_IMAGE = "none";

export interface DesignFace extends FaceLook {
	file: string;
	/** Text before the root's start tag and after its end tag ("" without a root). */
	before: string;
	after: string;
	/** The root element (null: the elements sit at the top of the file). */
	root: {
		tag: string;
		attrs: [string, string | null][];
		decls: StyleDecl[];
		startTag: string;
		endTag: string;
		read: FaceLook;
	} | null;
	nodes: FaceNode[];
	/** Elements kept as code only (inside a Mustache section of the face, or `<style>`). */
	locked: number;
}

// --- reading --------------------------------------------------------------------------------------

const FIELD = /^\{\{\s*([\w.]+)\s*\}\}$/;
const PHOTO =
	/^\{\{#patron\.has_photo\}\}\s*<img\b[^>]*\bsrc=["']\{\{photo_url\}\}["'][^>]*>\s*\{\{\/patron\.has_photo\}\}$/;

function typeOf(kind: DesignKind, node: ElementNode): ElementType {
	const inner = node.inner.trim();
	if (node.tag === "img") {
		const src = attr(node, "src")?.trim() ?? "";
		if (src === "{{photo_url}}") {
			return "photo";
		}
		if (src === "{{classification.image_url}}") {
			return "pictogram";
		}
		return ASSET.test(src) ? "image" : "other";
	}
	if (isVoid(node.tag)) {
		return "other";
	}
	if (inner === "{{{barcode_svg}}}") {
		return "barcode";
	}
	if (PHOTO.test(inner)) {
		return "photo";
	}
	const field = FIELD.exec(inner)?.[1];
	if (field && DESIGN_FIELDS[kind].includes(field)) {
		return "field";
	}
	if (inner === "") {
		return "box";
	}
	return plainText(node.inner) === null ? "html" : "text";
}

/** An element of a face read from its node. */
export function readElement(kind: DesignKind, node: ElementNode, id: string): DesignElement {
	const decls = parseStyle(attr(node, "style") ?? "");
	const type = typeOf(kind, node);
	const left = lengthMm(styleValue(decls, "left"));
	const top = lengthMm(styleValue(decls, "top"));
	const width = lengthMm(styleValue(decls, "width"));
	const height = lengthMm(styleValue(decls, "height"));
	const placed =
		styleValue(decls, "position") === "absolute" &&
		left !== null &&
		top !== null &&
		width !== null &&
		height !== null;
	const editable: Editable = {
		placed,
		x: left ?? 0,
		y: top ?? 0,
		w: width ?? 0,
		h: height ?? 0,
		field: type === "field" ? (FIELD.exec(node.inner.trim())?.[1] ?? null) : null,
		text: type === "text" ? plainText(node.inner) : null,
		image: type === "image" ? (ASSET.exec(attr(node, "src") ?? "")?.[1] ?? null) : null,
		html: type === "html" ? node.inner : null,
		fill: readFill(decls),
		border: readBorder(decls),
		style: readStyle(decls),
	};
	return {
		kind: "element",
		id,
		type,
		...structuredClone(editable),
		src: {
			tag: node.tag,
			attrs: node.attrs,
			decls,
			startTag: node.startTag,
			inner: node.inner,
			endTag: node.endTag,
			source: node.source,
			read: editable,
		},
	};
}

export function readLook(decls: StyleDecl[]): FaceLook {
	return {
		background: readFill(decls),
		backgroundImage:
			styleValue(decls, "background-image")?.trim() === NO_IMAGE
				? NO_IMAGE
				: (ASSET.exec(styleValue(decls, "background-image") ?? "")?.[1] ?? null),
		backgroundBleed: styleValue(decls, "background-size")?.trim() === BLEED_BACKGROUND_SIZE,
	};
}

const isQuiet = (n: { kind: string; text?: string }): boolean =>
	n.kind === "raw" && /^(\s|<!--[\s\S]*?-->)*$/.test(n.text ?? "");

/** A new, empty face: the root of a card face, nothing for a label cell. */
export function emptyFace(kind: DesignKind, file: string): string {
	return kind === "cards" ? `<div class="face ${file.replace(/\.html$/, "")}">\n</div>\n` : "";
}

/**
 * The face of `file` read from its HTML. `nextId` names the elements (unique across the faces of a
 * template). Writing it back unchanged (`writeFace`) gives `source` exactly.
 */
export function readFace(
	kind: DesignKind,
	file: string,
	source: string,
	nextId: () => string,
): DesignFace {
	const top = splitNodes(source);
	const elements = top.filter((n) => n.kind === "element");
	const lone =
		elements.length === 1 && top.every((n) => n.kind === "element" || isQuiet(n))
			? elements[0]
			: undefined;
	// the face's root: the card face itself, or a label's wrapper of other elements; an element
	// placed by its own style is never a root
	const single =
		lone &&
		!isVoid(lone.tag) &&
		styleValue(parseStyle(attr(lone, "style") ?? ""), "position") !== "absolute" &&
		(kind === "cards" || splitNodes(lone.inner).some((n) => n.kind === "element"))
			? lone
			: undefined;
	const at = single ? top.indexOf(single) : -1;
	const children = single ? splitNodes(single.inner) : top;
	const rootDecls = single ? parseStyle(attr(single, "style") ?? "") : [];
	const look = readLook(rootDecls);
	const face: DesignFace = {
		file,
		before: single
			? top
					.slice(0, at)
					.map((n) => (n.kind === "raw" ? n.text : ""))
					.join("")
			: "",
		after: single
			? top
					.slice(at + 1)
					.map((n) => (n.kind === "raw" ? n.text : ""))
					.join("")
			: "",
		root: single
			? {
					tag: single.tag,
					attrs: single.attrs,
					decls: rootDecls,
					startTag: single.startTag,
					endTag: single.endTag,
					read: look,
				}
			: null,
		...structuredClone(look),
		nodes: [],
		locked: 0,
	};
	let depth = 0;
	for (const n of children) {
		if (n.kind === "raw") {
			depth += sectionBalance(n.text);
			face.nodes.push(n);
		} else if (depth > 0 || n.tag === "style" || n.tag === "script") {
			face.locked++;
			face.nodes.push({ kind: "raw", text: n.source });
		} else {
			face.nodes.push(readElement(kind, n, nextId()));
		}
	}
	return face;
}
