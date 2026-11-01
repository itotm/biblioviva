// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it } from "vitest";
import { opensKeyboard, watchKeyboard } from "./keyboard.js";

/** A window whose size the test sets, around the real document. */
type FakeWindow = Window & { resize(h: number, w?: number): void };

function fakeWindow(width: number, height: number): FakeWindow {
	const target = new EventTarget();
	const win: { innerWidth: number; innerHeight: number } & Record<string, unknown> = {
		innerWidth: width,
		innerHeight: height,
		document,
		addEventListener: target.addEventListener.bind(target),
		removeEventListener: target.removeEventListener.bind(target),
		resize(h: number, w = win.innerWidth): void {
			win.innerHeight = h;
			win.innerWidth = w;
			target.dispatchEvent(new Event("resize"));
		},
	};
	return win as unknown as FakeWindow;
}

const flag = (): boolean => document.documentElement.hasAttribute("data-keyboard");

describe("keyboard", () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it("tells the fields that open the keyboard", () => {
		const input = (type: string): HTMLInputElement =>
			Object.assign(document.createElement("input"), { type });
		expect(opensKeyboard(input("text"))).toBe(true);
		expect(opensKeyboard(input("search"))).toBe(true);
		expect(opensKeyboard(document.createElement("textarea"))).toBe(true);
		expect(opensKeyboard(input("checkbox"))).toBe(false);
		expect(opensKeyboard(document.createElement("button"))).toBe(false);
		expect(opensKeyboard(null)).toBe(false);
	});

	it("marks the page while a field has the focus and the window has shrunk", () => {
		const win = fakeWindow(412, 915);
		const stop = watchKeyboard(win);
		const field = document.body.appendChild(document.createElement("input"));
		field.focus();
		win.resize(915);
		expect(flag()).toBe(false);
		win.resize(520);
		expect(flag()).toBe(true);
		field.blur();
		win.resize(520);
		expect(flag()).toBe(false);
		// a turned phone measures again: the shorter window is the full one now
		field.focus();
		win.resize(412, 915);
		expect(flag()).toBe(false);
		stop();
		expect(flag()).toBe(false);
	});
});
