// SPDX-License-Identifier: GPL-3.0-or-later
// The Mermaid blocks of the documentation (step 9.53): found the same way by `docs:diagrams`,
// which draws them, and by `site:build`, which puts the drawings in the pages.
import { createHash } from "node:crypto";

/** The code of every ```mermaid block of a Markdown text, as written. */
export function mermaidBlocks(markdown: string): string[] {
	return [...markdown.matchAll(/^```mermaid[ \t]*\n([\s\S]*?)^```[ \t]*$/gm)].map((m) =>
		normalize(m[1] ?? ""),
	);
}

/** The name of a diagram's drawing: the hash of its code (a changed diagram is drawn again). */
export function diagramHash(code: string): string {
	return createHash("sha256").update(normalize(code)).digest("hex").slice(0, 16);
}

function normalize(code: string): string {
	return code.replace(/\r\n/g, "\n").trim();
}
