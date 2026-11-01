// SPDX-License-Identifier: GPL-3.0-or-later
// A small, lossless reader of the HTML of a template face (PLAN.md step 11.16): it splits a file
// into top-level nodes — elements with their exact source, and everything else (text, comments,
// Mustache tags) as raw runs — so that joining the nodes gives back the file byte for byte. Start
// tags are read into attributes, `style` attributes into declarations. Mustache tags are plain
// text here: they may sit in attribute values and between elements. Pure: used by the designer in
// the browser and by the tests.

export interface RawNode {
	kind: "raw";
	text: string;
}

export interface ElementNode {
	kind: "element";
	/** Lower-case tag name. */
	tag: string;
	/** Attributes in order, values as written (entities and Mustache kept); `null`: no value. */
	attrs: [string, string | null][];
	/** The start tag as written. */
	startTag: string;
	/** Everything between the start and the end tag ("" for void elements). */
	inner: string;
	/** The end tag as written ("" for void and self-closed elements). */
	endTag: string;
	/** The whole element as written. */
	source: string;
}

export type HtmlNode = RawNode | ElementNode;

const VOID = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"source",
	"track",
	"wbr",
]);
/** Elements whose content is text, never tags. */
const TEXT_ONLY = new Set(["script", "style", "textarea", "title"]);

export const isVoid = (tag: string): boolean => VOID.has(tag);

const NAME_START = /[A-Za-z]/;

/** Reads a start tag at `at` (`<` included): its name, attributes and end, or null. */
function readStartTag(
	html: string,
	at: number,
): { tag: string; attrs: [string, string | null][]; end: number; selfClosed: boolean } | null {
	if (html[at] !== "<" || !NAME_START.test(html[at + 1] ?? "")) {
		return null;
	}
	let i = at + 1;
	while (i < html.length && /[\w:-]/.test(html[i] ?? "")) {
		i++;
	}
	const tag = html.slice(at + 1, i).toLowerCase();
	const attrs: [string, string | null][] = [];
	for (;;) {
		while (i < html.length && /\s/.test(html[i] ?? "")) {
			i++;
		}
		if (i >= html.length) {
			return null;
		}
		if (html[i] === ">") {
			return { tag, attrs, end: i + 1, selfClosed: false };
		}
		if (html[i] === "/" && html[i + 1] === ">") {
			return { tag, attrs, end: i + 2, selfClosed: true };
		}
		if (html[i] === "/") {
			i++;
			continue;
		}
		const nameStart = i;
		while (i < html.length && !/[\s=>]/.test(html[i] ?? "") && html.slice(i, i + 2) !== "/>") {
			i++;
		}
		const name = html.slice(nameStart, i);
		while (i < html.length && /\s/.test(html[i] ?? "")) {
			i++;
		}
		if (html[i] !== "=") {
			attrs.push([name, null]);
			continue;
		}
		i++;
		while (i < html.length && /\s/.test(html[i] ?? "")) {
			i++;
		}
		const quote = html[i];
		if (quote === '"' || quote === "'") {
			const close = html.indexOf(quote, i + 1);
			if (close < 0) {
				return null;
			}
			attrs.push([name, html.slice(i + 1, close)]);
			i = close + 1;
		} else {
			const valueStart = i;
			while (i < html.length && !/[\s>]/.test(html[i] ?? "")) {
				i++;
			}
			attrs.push([name, html.slice(valueStart, i)]);
		}
	}
}

/** The end of the element whose start tag ends at `from` (after its end tag), or -1. */
function findElementEnd(
	html: string,
	tag: string,
	from: number,
): { innerEnd: number; end: number } {
	if (TEXT_ONLY.has(tag)) {
		const close = html.toLowerCase().indexOf(`</${tag}`, from);
		if (close < 0) {
			return { innerEnd: -1, end: -1 };
		}
		const gt = html.indexOf(">", close);
		return { innerEnd: close, end: gt < 0 ? -1 : gt + 1 };
	}
	let depth = 1;
	let i = from;
	while (i < html.length) {
		if (html.startsWith("<!--", i)) {
			const close = html.indexOf("-->", i + 4);
			i = close < 0 ? html.length : close + 3;
			continue;
		}
		if (html[i] === "<" && html[i + 1] === "/") {
			let j = i + 2;
			while (j < html.length && /[\w:-]/.test(html[j] ?? "")) {
				j++;
			}
			const name = html.slice(i + 2, j).toLowerCase();
			const gt = html.indexOf(">", j);
			if (gt < 0) {
				return { innerEnd: -1, end: -1 };
			}
			if (name === tag) {
				depth--;
				if (depth === 0) {
					return { innerEnd: i, end: gt + 1 };
				}
			}
			i = gt + 1;
			continue;
		}
		const start = readStartTag(html, i);
		if (start) {
			if (start.tag === tag && !start.selfClosed && !VOID.has(start.tag)) {
				depth++;
			} else if (TEXT_ONLY.has(start.tag) && !start.selfClosed) {
				const inner = findElementEnd(html, start.tag, start.end);
				i = inner.end < 0 ? html.length : inner.end;
				continue;
			}
			i = start.end;
			continue;
		}
		i++;
	}
	return { innerEnd: -1, end: -1 };
}

/**
 * The top-level nodes of `html`. Joining their texts (`nodeText`) gives back `html` exactly; an
 * element that is never closed ends the parse as a raw run.
 */
export function splitNodes(html: string): HtmlNode[] {
	const nodes: HtmlNode[] = [];
	let raw = "";
	const flush = (): void => {
		if (raw !== "") {
			nodes.push({ kind: "raw", text: raw });
			raw = "";
		}
	};
	let i = 0;
	while (i < html.length) {
		if (html.startsWith("<!--", i)) {
			const close = html.indexOf("-->", i + 4);
			const end = close < 0 ? html.length : close + 3;
			raw += html.slice(i, end);
			i = end;
			continue;
		}
		const start = readStartTag(html, i);
		if (!start) {
			raw += html[i] ?? "";
			i++;
			continue;
		}
		let innerEnd = start.end;
		let end = start.end;
		if (!start.selfClosed && !VOID.has(start.tag)) {
			const found = findElementEnd(html, start.tag, start.end);
			if (found.end < 0) {
				raw += html.slice(i);
				break;
			}
			innerEnd = found.innerEnd;
			end = found.end;
		}
		flush();
		nodes.push({
			kind: "element",
			tag: start.tag,
			attrs: start.attrs,
			startTag: html.slice(i, start.end),
			inner: html.slice(start.end, innerEnd),
			endTag: html.slice(innerEnd, end),
			source: html.slice(i, end),
		});
		i = end;
	}
	flush();
	return nodes;
}

export const nodeText = (n: HtmlNode): string => (n.kind === "raw" ? n.text : n.source);

/** The open minus the closed Mustache sections of a text (`{{#x}}`, `{{^x}}`, `{{/x}}`). */
export function sectionBalance(text: string): number {
	let depth = 0;
	for (const m of text.matchAll(/\{\{\s*([#^/])/g)) {
		depth += m[1] === "/" ? -1 : 1;
	}
	return depth;
}

export function attr(node: { attrs: [string, string | null][] }, name: string): string | null {
	return node.attrs.find(([n]) => n.toLowerCase() === name)?.[1] ?? null;
}

const escapeAttr = (value: string): string => value.replace(/"/g, "&quot;");

/** A start tag from a name and attributes (`<img … />` for void elements). */
export function buildStartTag(tag: string, attrs: readonly [string, string | null][]): string {
	const list = attrs
		.map(([n, value]) => (value === null ? ` ${n}` : ` ${n}="${escapeAttr(value)}"`))
		.join("");
	return VOID.has(tag) ? `<${tag}${list} />` : `<${tag}${list}>`;
}

/** The attributes with `name` set to `value` (in place when present, appended otherwise), or removed. */
export function withAttr(
	attrs: readonly [string, string | null][],
	name: string,
	value: string | null,
): [string, string | null][] {
	const out: [string, string | null][] = [];
	let done = false;
	for (const [n, v] of attrs) {
		if (n.toLowerCase() === name) {
			if (!done && value !== null) {
				out.push([n, value]);
			}
			done = true;
		} else {
			out.push([n, v]);
		}
	}
	if (!done && value !== null) {
		out.push([name, value]);
	}
	return out;
}

/** A start tag as written with one more attribute right after the tag name (the preview marks). */
export function markStartTag(startTag: string, name: string, value: string): string {
	const m = /^<[\w:-]+/.exec(startTag);
	return m ? `${m[0]} ${name}="${escapeAttr(value)}"${startTag.slice(m[0].length)}` : startTag;
}

// --- style attributes ---------------------------------------------------------------------------

export interface StyleDecl {
	/** Lower-case property name. */
	prop: string;
	value: string;
}

/** The declarations of a `style` attribute (Mustache and quoted strings kept whole). */
export function parseStyle(style: string): StyleDecl[] {
	const out: StyleDecl[] = [];
	let part = "";
	let quote: string | null = null;
	let paren = 0;
	const push = (): void => {
		const colon = part.indexOf(":");
		if (colon > 0) {
			const prop = part.slice(0, colon).trim().toLowerCase();
			const value = part.slice(colon + 1).trim();
			if (prop !== "" && value !== "") {
				out.push({ prop, value });
			}
		}
		part = "";
	};
	for (const c of style) {
		if (quote) {
			if (c === quote) {
				quote = null;
			}
		} else if (c === '"' || c === "'") {
			quote = c;
		} else if (c === "(") {
			paren++;
		} else if (c === ")") {
			paren = Math.max(0, paren - 1);
		} else if (c === ";" && paren === 0) {
			push();
			continue;
		}
		part += c;
	}
	push();
	return out;
}

export const serializeStyle = (decls: readonly StyleDecl[]): string =>
	decls.map((d) => `${d.prop}:${d.value}`).join(";");

export function styleValue(decls: readonly StyleDecl[], prop: string): string | null {
	for (let i = decls.length - 1; i >= 0; i--) {
		if (decls[i]?.prop === prop) {
			return decls[i]?.value ?? null;
		}
	}
	return null;
}

/** The declarations with `prop` set to `value` (in place of its first occurrence), or removed. */
export function withStyle(
	decls: readonly StyleDecl[],
	prop: string,
	value: string | null,
): StyleDecl[] {
	const out: StyleDecl[] = [];
	let done = false;
	for (const d of decls) {
		if (d.prop === prop) {
			if (!done && value !== null) {
				out.push({ prop, value });
			}
			done = true;
		} else {
			out.push(d);
		}
	}
	if (!done && value !== null) {
		out.push({ prop, value });
	}
	return out;
}

// --- text -------------------------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

export function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
		if (code.startsWith("#x") || code.startsWith("#X")) {
			return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
		}
		if (code.startsWith("#")) {
			return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
		}
		return ENTITIES[code.toLowerCase()] ?? all;
	});
}

/** Text printed as it is: HTML-escaped, braces kept away from Mustache, new lines as `<br />`. */
export function literal(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/\{/g, "&#123;")
		.replace(/\}/g, "&#125;")
		.replace(/\n/g, "<br />");
}

/** The text of a content made only of text and `<br>` (no Mustache), or null. */
export function plainText(inner: string): string | null {
	if (inner.includes("{{") || /<(?!br\s*\/?>)/i.test(inner)) {
		return null;
	}
	return decodeEntities(
		inner
			.trim()
			.split(/\s*<br\s*\/?>\s*/i)
			.map((line) => line.replace(/\s+/g, " "))
			.join("\n"),
	);
}
