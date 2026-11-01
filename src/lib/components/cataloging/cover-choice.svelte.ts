// SPDX-License-Identifier: GPL-3.0-or-later
// The cover of a book being added (fast add, 9.13 round 11): looked up from the providers while
// the form is shown, replaced by a photo when wrong or missing, kept as a data URL and stored only
// when the record is saved (`store`). A newer lookup or choice makes an older answer stale.
import { saveCoverData, previewCover } from "#lib/remote/catalog.remote.js";
import { debugReport } from "#lib/debug.js";

export interface CoverChoice {
	dataUrl: string;
	source: "photo" | "googlebooks" | "amazon" | "openlibrary" | "mock";
	/** Provider name, null for a photo. */
	name: string | null;
}

function readAsDataUrl(file: File): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () =>
			typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read"));
		reader.onerror = () => reject(new Error("read"));
		reader.readAsDataURL(file);
	});
}

export class CoverChoiceState {
	cover = $state<CoverChoice | null>(null);
	search = $state<"idle" | "searching" | "none">("idle");
	/** The camera panel is open. */
	camera = $state(false);
	#token = 0;

	/** Looks the cover of `isbn` up at the providers. */
	async lookup(isbn: string): Promise<void> {
		const token = ++this.#token;
		this.search = "searching";
		const started = performance.now();
		try {
			const r = await previewCover({ isbn });
			debugReport("fastadd", "cover lookup", {
				isbn,
				found: r.ok,
				provider: r.ok ? r.provider : null,
				ms: Math.round(performance.now() - started),
				stale: token !== this.#token,
			});
			if (token !== this.#token) {
				return;
			}
			if (r.ok) {
				this.cover = { dataUrl: r.dataUrl, source: r.provider, name: r.name };
				this.search = "idle";
			} else {
				this.search = "none";
			}
		} catch {
			if (token === this.#token) {
				this.search = "none";
			}
		}
	}

	/** No cover, no lookup running, the camera closed. */
	clear(): void {
		this.#token += 1;
		this.cover = null;
		this.search = "idle";
		this.camera = false;
	}

	/** A photographed cover replaces whatever was found. */
	async fromPhoto(file: File): Promise<void> {
		const dataUrl = await readAsDataUrl(file);
		this.#token += 1;
		this.cover = { dataUrl, source: "photo", name: null };
		this.search = "idle";
		this.camera = false;
	}
}

/** Stores the chosen cover as the record's cover; false when it could not be saved. */
export async function storeCover(biblioId: number, choice: CoverChoice): Promise<boolean> {
	const data = choice.dataUrl.slice(choice.dataUrl.indexOf(",") + 1);
	const ok = await saveCoverData({ id: biblioId, data, source: choice.source }).then(
		(r) => r.ok,
		() => false,
	);
	debugReport("fastadd", "cover stored", { biblioId, source: choice.source, ok });
	return ok;
}
