// SPDX-License-Identifier: GPL-3.0-or-later
// The grid used with the keyboard (WCAG 2.1.1, 3.2.2): the arrows move between the rows without
// opening them; Enter opens the row that has the focus, as a click does.
import { page, userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { formatContext } from "#lib/ui/format.js";
import DataGrid from "./DataGrid.svelte";

const rows = [
	{ id: 1, title: "Il piccolo principe" },
	{ id: 2, title: "Pinocchio" },
	{ id: 3, title: "Cuore" },
];

describe("DataGrid.svelte", () => {
	it("opens a row on click and on Enter, never on the arrows", async () => {
		const onrowclick = vi.fn();
		await render(DataGrid, {
			props: {
				data: rows,
				columns: [{ id: "title", header: "Titolo", flexgrow: 1 }],
				height: "20rem",
				onrowclick,
			},
			context: formatContext(),
		});
		await page.getByText("Il piccolo principe").click();
		expect(onrowclick).toHaveBeenCalledTimes(1);
		expect(onrowclick.mock.calls[0]?.[0]).toMatchObject({ id: 1 });

		await userEvent.keyboard("{ArrowDown}");
		await userEvent.keyboard("{ArrowDown}");
		expect(onrowclick).toHaveBeenCalledTimes(1);

		await userEvent.keyboard("{Enter}");
		expect(onrowclick).toHaveBeenCalledTimes(2);
		expect(onrowclick.mock.calls[1]?.[0]).toMatchObject({ id: 3 });
		expect(onrowclick.mock.calls[1]?.[1]).toBe(false);

		// a click on the row reached with the arrows opens it as well
		await page.getByText("Cuore").click();
		expect(onrowclick).toHaveBeenCalledTimes(3);
		expect(onrowclick.mock.calls[2]?.[0]).toMatchObject({ id: 3 });
	});
});
