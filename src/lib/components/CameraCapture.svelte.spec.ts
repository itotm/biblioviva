// SPDX-License-Identifier: GPL-3.0-or-later
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { testI18nContext } from "../../../tests/helpers/i18n.js";
import CameraCapture from "./CameraCapture.svelte";

describe("CameraCapture.svelte", () => {
	it("explains that the camera needs a secure context when mediaDevices is missing", async () => {
		const onerror = vi.fn();
		await render(CameraCapture, {
			props: { mediaDevices: null, onerror },
			context: await testI18nContext(),
		});
		await expect.element(page.getByTestId("camera-error")).toMatchTextContent(/https/);
		expect(onerror).toHaveBeenCalledWith("insecure");
	});

	it("explains a denied permission and offers a retry", async () => {
		const mediaDevices = {
			getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
			enumerateDevices: vi.fn().mockResolvedValue([]),
		} as unknown as MediaDevices;
		await render(CameraCapture, { props: { mediaDevices }, context: await testI18nContext() });
		await expect
			.element(page.getByTestId("camera-error"))
			.toMatchTextContent(/Permesso negato/);
		await expect.element(page.getByRole("button", { name: "Riprova" })).toBeVisible();
	});

	it("shows the stream and the stop button when the camera starts", async () => {
		// Chromium fake device (vitest browser runs with the default flags → a synthetic stream)
		await render(CameraCapture, { props: {}, context: await testI18nContext() });
		await expect.element(page.getByRole("button", { name: "Ferma fotocamera" })).toBeVisible();
	});
});
