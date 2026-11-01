// SPDX-License-Identifier: GPL-3.0-or-later
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

interface Violation {
	id: string;
	impact?: string | null;
	nodes: { html: string }[];
}

/**
 * Known upstream issues that are not ours to fix. Each entry is re-checked when the
 * dependency is upgraded (PLAN.md rule 10); remove the entry when the bug is gone.
 */
const KNOWN_UPSTREAM: ((v: Violation) => boolean)[] = [
	// SVAR DataGrid 2.7.3 renders the first data row with aria-rowindex="0" (must be >= 1).
	(v) =>
		v.id === "aria-valid-attr-value" &&
		v.nodes.every((n) => n.html.includes("wx-row") && n.html.includes('aria-rowindex="0"')),
];

/** Runs axe on the current page and fails on serious/critical violations (PLAN.md §7). */
export async function expectAxeClean(page: Page): Promise<void> {
	// sandboxed iframes (template previews) cannot run axe: injecting into them hangs the run
	// let colour transitions settle: axe would otherwise sample half-faded text after a click
	await page.waitForTimeout(300);
	const results = await new AxeBuilder({ page }).exclude("iframe[sandbox]").analyze();
	const serious = (results.violations as Violation[]).filter(
		(v) =>
			(v.impact === "serious" || v.impact === "critical") &&
			!KNOWN_UPSTREAM.some((known) => known(v)),
	);
	expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}
