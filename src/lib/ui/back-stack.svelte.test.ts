// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { BackStack, pageName } from "./back-stack.svelte.js";

describe("back stack", () => {
	it("names a page from its document title", () => {
		expect(pageName("Catalogo · BiblioViva")).toBe("Catalogo");
		expect(pageName("Dashboard")).toBe("Dashboard");
	});

	it("follows links forward and the history back; a full load starts afresh", () => {
		const stack = new BackStack();
		stack.arrive("enter");
		expect(stack.previous).toBeNull();
		stack.leave("/", "Dashboard · BiblioViva");
		stack.arrive("link");
		expect(stack.previous).toEqual({ href: "/", title: "Dashboard" });
		stack.leave("/inventory", "Inventario · BiblioViva");
		stack.arrive("goto");
		expect(stack.previous?.title).toBe("Inventario");
		// Back: one step
		stack.leave("/catalog/1", "Scheda · BiblioViva");
		stack.arrive("popstate", -1);
		expect(stack.previous?.title).toBe("Dashboard");
		// Forward again: the page left is pushed
		stack.leave("/inventory", "Inventario · BiblioViva");
		stack.arrive("popstate", 1);
		expect(stack.previous?.title).toBe("Inventario");
		// two steps back at once
		stack.leave("/catalog/1", "Scheda · BiblioViva");
		stack.arrive("popstate", -2);
		expect(stack.previous).toBeNull();
		stack.leave("/wishlist", "X");
		stack.arrive("enter");
		expect(stack.previous).toBeNull();
	});
});
