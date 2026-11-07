// SPDX-License-Identifier: GPL-3.0-or-later
// The page's title lives in the top bar (owner review: no empty band above a title that repeats
// the section). `PageHeader` and `DetailLayout` publish their title, subtitle, icon and back link
// here and the app shell renders them in the bar, always one row high; the page's views and
// actions stay in the page, under the bar (9.13, round 24). Context-scoped, so server requests
// never share state.
import type { ResolvedPathname } from "$app/types";
import { getContext, setContext } from "svelte";
import type { IconName } from "./icons.js";

export interface PageHeaderData {
	title: string;
	/** Text shown before the title in the brand style (the dashboard: "BiblioViva  <library>"). */
	brand?: string;
	subtitle?: string;
	icon?: IconName;
	/** An image shown in place of the icon, twice its size (the BiblioViva logo on the dashboard). */
	logo?: string;
	backHref?: ResolvedPathname;
	backLabel?: string;
	/** `p` when the bar shows the kind of page and the page has its own heading (record pages). */
	titleTag?: "h1" | "p";
	/**
	 * The page carries the same title as its first heading, for screen readers (`PageHeader`): the bar's
	 * copy, which comes after the page in the DOM, is hidden from them (WCAG 1.3.2, 2.4.6).
	 */
	inPage?: boolean;
}

export class PageHeaderStore {
	current = $state<(PageHeaderData & { token: symbol }) | null>(null);

	set(token: symbol, data: PageHeaderData): void {
		this.current = { ...data, token };
	}

	/** Clears only the entry set with `token`: a new page may already have published its own. */
	clear(token: symbol): void {
		if (this.current?.token === token) {
			this.current = null;
		}
	}
}

const KEY = Symbol("page-header");

export function providePageHeader(): PageHeaderStore {
	const store = new PageHeaderStore();
	setContext(KEY, store);
	return store;
}

export function usePageHeader(): PageHeaderStore | undefined {
	return getContext<PageHeaderStore | undefined>(KEY);
}
