// SPDX-License-Identifier: GPL-3.0-or-later
// The phone keyboard (9.13 round 33): the page asks the browser to shrink the window above it
// (`interactive-widget=resizes-content`, app.html), so a window much shorter than before while a
// text field has the focus means the keyboard is open. `data-keyboard` on <html> then lets the
// bottom bar step aside (app.css) instead of taking the room of the field being typed in. A field
// that merely keeps the focus (the desk's code field) with no keyboard on screen changes nothing.

/** Fields that open the keyboard (not checkboxes, buttons, pickers). */
const NO_KEYBOARD = new Set([
	"checkbox",
	"radio",
	"file",
	"range",
	"color",
	"button",
	"submit",
	"reset",
	"image",
]);

export function opensKeyboard(el: Element | null): boolean {
	if (el instanceof HTMLInputElement) {
		return !NO_KEYBOARD.has(el.type);
	}
	return el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
}

/** How much shorter than the full window the keyboard makes it, at least. */
export const KEYBOARD_MIN_PX = 150;

/** Watches the window and the focus; returns the function that stops watching. */
export function watchKeyboard(win: Window = window): () => void {
	let width = win.innerWidth;
	let full = win.innerHeight;
	const update = (): void => {
		// a new width is a turned phone (or a resized desktop window): measure again
		if (win.innerWidth !== width) {
			width = win.innerWidth;
			full = win.innerHeight;
		}
		full = Math.max(full, win.innerHeight);
		const open =
			full - win.innerHeight >= KEYBOARD_MIN_PX && opensKeyboard(win.document.activeElement);
		win.document.documentElement.toggleAttribute("data-keyboard", open);
	};
	const events = ["resize", "focusin", "focusout"] as const;
	for (const e of events) {
		win.addEventListener(e, update);
	}
	return () => {
		for (const e of events) {
			win.removeEventListener(e, update);
		}
		win.document.documentElement.removeAttribute("data-keyboard");
	};
}
