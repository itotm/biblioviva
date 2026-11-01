// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { desktopToaster, phoneToaster, toaster } from "./toaster.js";

const titles = (): unknown[] => phoneToaster.getVisibleToasts().map((t) => t.title);

describe("toaster on a phone", () => {
	afterEach(() => {
		phoneToaster.remove();
	});

	it("shows the newest toast at once when the stack is full, dropping the oldest", async () => {
		await page.viewport(412, 915);
		toaster.success({ title: "Lista creata" });
		toaster.success({ title: "14 aggiunti" });
		toaster.success({ title: "0 aggiunti" });
		toaster.success({ title: "15 tessere segnate come stampate" });
		expect(titles()).toContain("15 tessere segnate come stampate");
		expect(titles()).not.toContain("Lista creata");
		expect(titles()).toHaveLength(3);
	});

	it("keeps the errors, which stay until closed, while other toasts can make room", async () => {
		await page.viewport(412, 915);
		toaster.error({ title: "Errore" });
		toaster.success({ title: "Primo" });
		toaster.success({ title: "Secondo" });
		toaster.success({ title: "Terzo" });
		expect(titles()).toEqual(["Terzo", "Secondo", "Errore"]);
	});

	it("leaves the desktop stack alone", async () => {
		await page.viewport(1280, 800);
		for (const n of [1, 2, 3, 4]) {
			toaster.info({ title: `Avviso ${n}` });
		}
		expect(titles()).toEqual([]);
		expect(desktopToaster.getVisibleToasts()).toHaveLength(4);
		desktopToaster.remove();
	});
});
