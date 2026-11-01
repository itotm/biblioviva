// SPDX-License-Identifier: GPL-3.0-or-later
// The beep of a camera read in Codici a barre (9.40): Conferma by default, "Ascolta" plays the
// sound being chosen, "Nessun suono" has nothing to play, a choice is saved and put back to the
// default. It changes the shared configuration, so it runs once every other spec is done (project
// `final`).
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { beeps, countBeeps } from "./helpers/beeps.js";
import { waitForHydration } from "./helpers/hydration.js";

test("the camera's sound is chosen, tried and saved", async ({ page }) => {
	await countBeeps(page);
	await page.goto("/admin/config/barcodes");
	await waitForHydration(page);
	const sound = page.getByTestId("setting-barcodes.cameraSound");
	const play = page.getByTestId("play-camera-sound");
	await expect(sound).toHaveValue("confirm");
	await expect(sound.locator("option:checked")).toHaveText("Conferma");
	await play.click();
	await expect.poll(() => beeps(page)).toBe(1);
	await sound.selectOption("till");
	await play.click();
	await expect.poll(() => beeps(page)).toBe(2);
	await sound.selectOption("off");
	await expect(play).toBeDisabled();
	await sound.selectOption("arpeggio");
	await expectAxeClean(page);
	await page.getByTestId("section-save").click();
	await expect(page.getByRole("status").getByText("Impostazioni salvate")).toBeVisible();
	await page.reload();
	await waitForHydration(page);
	await expect(sound).toHaveValue("arpeggio");
	// back to the default for the other tests
	await page.getByTestId("reset-barcodes.cameraSound").click();
	await page.getByTestId("section-save").click();
	await expect(page.getByRole("status").getByText("Impostazioni salvate")).toBeVisible();
	await page.reload();
	await waitForHydration(page);
	await expect(sound).toHaveValue("confirm");
});
