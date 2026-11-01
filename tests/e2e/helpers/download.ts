// SPDX-License-Identifier: GPL-3.0-or-later
// A downloaded file as a local path. `download.path()` exists only when the browser runs on the same
// machine as the tests; `saveAs` also works with a browser served elsewhere (WebKit in Playwright's
// container, `bun run test:browsers`).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Download } from "@playwright/test";

export async function savedDownload(download: Download): Promise<string> {
	const path = join(
		mkdtempSync(join(tmpdir(), "biblioviva-download-")),
		download.suggestedFilename(),
	);
	await download.saveAs(path);
	return path;
}
