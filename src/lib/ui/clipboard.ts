// SPDX-License-Identifier: GPL-3.0-or-later
// Copying text for the operator. The Clipboard API exists only on secure pages: in the basic
// local-network mode (plain http, step 8.8) the browser's older copy command does the job.

/** Copies `text`; false when the browser refused (the caller asks to copy it by hand). */
export async function copyText(
	text: string,
	clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator?.clipboard,
): Promise<boolean> {
	if (clipboard) {
		try {
			await clipboard.writeText(text);
			return true;
		} catch {
			// denied: try the old way below
		}
	}
	const area = document.createElement("textarea");
	area.value = text;
	area.setAttribute("readonly", "");
	area.style.position = "fixed";
	area.style.opacity = "0";
	document.body.append(area);
	area.select();
	try {
		// eslint-disable-next-line @typescript-eslint/no-deprecated -- the only copy on a plain-http page
		return document.execCommand("copy");
	} catch {
		return false;
	} finally {
		area.remove();
	}
}
