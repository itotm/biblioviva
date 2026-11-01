// SPDX-License-Identifier: GPL-3.0-or-later
// The search of the documentation (Q134): the header's search button, Ctrl K or "/" open a dialog with
// Pagefind's interface, loaded the first time it opens. Without JavaScript, or without the index, the
// button leads to the A–Z index.
const dialog = document.querySelector("dialog.ds");
let ready = null;

function load() {
	ready ??= new Promise((resolve, reject) => {
		const css = document.createElement("link");
		css.rel = "stylesheet";
		css.href = "/pagefind/pagefind-ui.css";
		document.head.append(css);
		const script = document.createElement("script");
		script.src = "/pagefind/pagefind-ui.js";
		script.onload = () => {
			new PagefindUI({
				element: dialog.querySelector(".ds-ui"),
				showSubResults: true,
				showImages: false,
				resetStyles: false,
				autofocus: true,
				translations: {
					clear_search: document.documentElement.lang === "it" ? "Cancella" : "Clear",
				},
			});
			resolve();
		};
		script.onerror = reject;
		document.head.append(script);
	});
	return ready;
}

function open(event, fallback) {
	event.preventDefault();
	load().then(
		() => {
			dialog.showModal();
			dialog.querySelector("input")?.focus();
		},
		() => {
			location.href = fallback;
		},
	);
}

function typing(target) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
	);
}

if (dialog) {
	const button = document.querySelector("[data-search]");
	button?.addEventListener("click", (event) => open(event, button.href));
	document.addEventListener("keydown", (event) => {
		const shortcut =
			(event.key === "k" && (event.ctrlKey || event.metaKey)) ||
			(event.key === "/" && !typing(event.target));
		if (shortcut && !dialog.open && button) {
			open(event, button.href);
		}
	});
	dialog.querySelector(".ds-close")?.addEventListener("click", () => dialog.close());
	// a click on the backdrop, outside the box, closes the dialog
	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) {
			dialog.close();
		}
	});
}
