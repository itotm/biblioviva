// SPDX-License-Identifier: GPL-3.0-or-later
// Writing the designer's faces back (PLAN.md step 11.16): an element unchanged is written as it was
// read, byte for byte; a changed one is rebuilt from its node with only the changed declarations
// and attributes; the face's root keeps everything but its background. New elements of each type
// are written in the same form the designer reads. Pure: used by the page and by the tests.
import { BLEED_BACKGROUND_SIZE } from "./card-backgrounds.js";
import {
	BARCODE_CLASS,
	DESIGN_FIELDS,
	NO_IMAGE,
	readElement,
	type DesignElement,
	type DesignFace,
	type DesignKind,
	type Editable,
	type ElementType,
} from "./template-design.js";
import {
	buildStartTag,
	isVoid,
	literal,
	markStartTag,
	serializeStyle,
	splitNodes,
	withAttr,
	withStyle,
	type ElementNode,
} from "./template-html.js";
import { FONTS, mm, writeFill, writeStyle } from "./template-style.js";

const editableOf = (e: Editable): Editable => ({
	placed: e.placed,
	x: e.x,
	y: e.y,
	w: e.w,
	h: e.h,
	field: e.field,
	text: e.text,
	image: e.image,
	html: e.html,
	fill: e.fill,
	border: e.border ? { color: e.border.color, widthMm: e.border.widthMm } : null,
	style: { ...e.style },
});

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Whether an element differs from what was read. */
export const elementChanged = (e: DesignElement): boolean =>
	!same(editableOf(e), editableOf(e.src.read));

/** The HTML of an element: as written when unchanged, otherwise its node with the changes. */
export function writeElement(e: DesignElement, mark = false): string {
	const { src } = e;
	if (!elementChanged(e)) {
		return mark
			? `${markStartTag(src.startTag, "data-bv", e.id)}${src.source.slice(src.startTag.length)}`
			: src.source;
	}
	const was = src.read;
	let decls = src.decls;
	if (
		e.placed &&
		(!was.placed || e.x !== was.x || e.y !== was.y || e.w !== was.w || e.h !== was.h)
	) {
		decls = withStyle(decls, "position", "absolute");
		if (!was.placed) {
			// laid out by the style sheet or the flow until now: its margins no longer move it
			decls = withStyle(withStyle(decls, "margin", "0"), "box-sizing", "border-box");
		}
		decls = withStyle(decls, "left", mm(e.x));
		decls = withStyle(decls, "top", mm(e.y));
		decls = withStyle(decls, "width", mm(e.w));
		decls = withStyle(decls, "height", mm(e.h));
	}
	decls = writeStyle(decls, e.style, was.style);
	decls = writeFill(decls, e.fill, was.fill);
	if (!same(e.border, was.border)) {
		decls = withStyle(
			decls,
			"border",
			e.border ? `${mm(e.border.widthMm)} solid ${e.border.color}` : null,
		);
	}
	let attrs = withAttr(src.attrs, "style", decls.length > 0 ? serializeStyle(decls) : null);
	if (e.type === "image" && e.image !== was.image) {
		attrs = withAttr(attrs, "src", `{{#asset}}${e.image ?? ""}{{/asset}}`);
	}
	if (mark) {
		attrs = [["data-bv", e.id], ...attrs];
	}
	if (isVoid(src.tag)) {
		return buildStartTag(src.tag, attrs);
	}
	const inner =
		e.field !== was.field && e.field !== null
			? `{{${e.field}}}`
			: e.text !== was.text && e.text !== null
				? literal(e.text)
				: e.html !== was.html && e.html !== null
					? e.html
					: src.inner;
	return `${buildStartTag(src.tag, attrs)}${inner}${src.endTag || `</${src.tag}>`}`;
}

function writeRootStart(face: DesignFace): string {
	const root = face.root;
	if (!root) {
		return "";
	}
	if (
		face.background === root.read.background &&
		face.backgroundImage === root.read.backgroundImage &&
		face.backgroundBleed === root.read.backgroundBleed
	) {
		return root.startTag;
	}
	let decls = writeFill(root.decls, face.background, root.read.background);
	if (
		face.backgroundImage !== root.read.backgroundImage ||
		face.backgroundBleed !== root.read.backgroundBleed
	) {
		const image = face.backgroundImage === NO_IMAGE ? null : face.backgroundImage;
		decls = withStyle(
			decls,
			"background-image",
			image
				? `url('{{#asset}}${image}{{/asset}}')`
				: face.backgroundImage === NO_IMAGE
					? NO_IMAGE
					: null,
		);
		decls = withStyle(
			decls,
			"background-size",
			image ? (face.backgroundBleed ? BLEED_BACKGROUND_SIZE : "cover") : null,
		);
		decls = withStyle(decls, "background-position", image ? "center" : null);
	}
	return buildStartTag(
		root.tag,
		withAttr(root.attrs, "style", decls.length > 0 ? serializeStyle(decls) : null),
	);
}

/**
 * The HTML of a face. `mark` adds `data-bv="<id>"` to every element, so the preview can tell where
 * each one is drawn (never saved).
 */
export function writeFace(face: DesignFace, mark = false): string {
	const body = face.nodes
		.map((n) => (n.kind === "raw" ? n.text : writeElement(n, mark)))
		.join("");
	return face.root
		? `${face.before}${writeRootStart(face)}${body}${face.root.endTag}${face.after}`
		: body;
}

// --- new elements --------------------------------------------------------------------------------

const geometry = (x: number, y: number, w: number, h: number): string =>
	`position:absolute;left:${mm(x)};top:${mm(y)};width:${mm(w)};height:${mm(h)}`;

/** The HTML of a new element of a type, at the top left of a face of the given size. */
export function newElementHtml(
	kind: DesignKind,
	type: ElementType,
	face: { widthMm: number; heightMm: number },
	options: { text?: string; image?: string } = {},
): string {
	const w = Math.min(
		type === "barcode" ? 40 : type === "text" || type === "field" || type === "html" ? 30 : 15,
		face.widthMm,
	);
	const h = Math.min(
		type === "barcode" ? 10 : type === "text" || type === "field" || type === "html" ? 6 : 15,
		face.heightMm,
	);
	const g = geometry(Math.min(2, face.widthMm - w), Math.min(2, face.heightMm - h), w, h);
	const font = `font-family:${FONTS.sans};font-size:10pt`;
	switch (type) {
		case "field":
			return `<div style="${g};overflow:hidden;${font}">{{${DESIGN_FIELDS[kind][0] ?? ""}}}</div>`;
		case "text":
		case "html":
			return `<div style="${g};overflow:hidden;${font}">${literal(options.text ?? "")}</div>`;
		case "barcode":
			return `<div class="${BARCODE_CLASS}" style="${g}">{{{barcode_svg}}}</div>`;
		case "photo":
			return `<div style="${g};overflow:hidden;background-color:#e5e7eb">{{#patron.has_photo}}<img src="{{photo_url}}" alt="" style="display:block;width:100%;height:100%;object-fit:cover" />{{/patron.has_photo}}</div>`;
		case "pictogram":
			return `<img src="{{classification.image_url}}" alt="" style="${g};object-fit:contain" />`;
		case "image":
			return `<img src="{{#asset}}${options.image ?? ""}{{/asset}}" alt="" style="${g};object-fit:contain" />`;
		case "box":
		case "other":
			return `<div style="${g};border:0.3mm solid #000000"></div>`;
	}
}

/**
 * A new element (it writes the HTML of `newElementHtml`). A free-HTML element whose content is
 * plain text still opens as free HTML until the face is read again.
 */
export function newElement(
	kind: DesignKind,
	type: ElementType,
	id: string,
	face: { widthMm: number; heightMm: number },
	options: { text?: string; image?: string } = {},
): DesignElement {
	const node = splitNodes(newElementHtml(kind, type, face, options))[0] as ElementNode;
	const e = readElement(kind, node, id);
	// unchanged since read, so `writeElement` gives the HTML above; the new element is new to the file
	if (type === "html" && e.type !== "html") {
		e.type = "html";
		e.html = node.inner;
		e.text = null;
		e.src.read = { ...e.src.read, html: node.inner, text: null };
	}
	return e;
}
