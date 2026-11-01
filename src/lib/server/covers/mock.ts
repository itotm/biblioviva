// SPDX-License-Identifier: GPL-3.0-or-later
// Cover provider used with `METADATA_PROVIDER=mock` (e2e tests): the fixture cover for every
// ISBN except the mock "no hits" one, without any network access.
import { readFileSync } from "node:fs";
import { MOCK_NO_HITS_ISBN } from "#lib/server/metadata/mock.js";
import type { CoverProvider } from "./types.js";

export const MOCK_COVER_FILE = "tests/fixtures/images/book-cover.jpg";

export const mockCovers: CoverProvider = {
	id: "mock",
	name: "Mock",
	fetch(isbn13) {
		if (isbn13 === MOCK_NO_HITS_ISBN) {
			return Promise.resolve(null);
		}
		try {
			return Promise.resolve(new Uint8Array(readFileSync(MOCK_COVER_FILE)));
		} catch {
			return Promise.resolve(null);
		}
	},
};
