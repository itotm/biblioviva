// SPDX-License-Identifier: GPL-3.0-or-later
// The state of every import wizard (PLAN.md §3.22): upload → columns → check → done. The remote
// functions of the import and its column catalogue are given; what an import asks besides the
// columns (special values, mode, homonyms…) travels in `run`. Created while the page component
// initialises (it reacts to the upload form's result).
import { useI18n } from "#lib/i18n/context.js";
import type { ImportFailure, UploadOutcome } from "#lib/server/imports/handlers.js";
import type { ImportCounts, RowStatus } from "#lib/server/imports/pipeline.js";
import { missingHeaders, type ImportSpec } from "#lib/shared/import-columns.js";
import { toaster } from "#lib/ui/toaster.js";

export const IMPORT_STEPS = ["upload", "mapping", "preview", "done"] as const;
export type ImportStep = (typeof IMPORT_STEPS)[number];

/** What the wizard reads of a detection, a validation and a summary. */
export interface WizardDetection<F extends string> {
	header: boolean;
	mapping: (F | null)[];
	certain: boolean;
}
export interface WizardValidation {
	rows: { line: number; status: RowStatus }[];
	counts: ImportCounts;
	canCommit: boolean;
}
export interface WizardSummary {
	batchId: number;
}

/** The arguments of every validate and commit call. */
export interface WizardRun<F extends string> {
	uploadId: string;
	mapping: (F | null)[];
	header: boolean;
}

export interface ImportWizardOptions<
	F extends string,
	D extends WizardDetection<F>,
	E extends object,
	V extends WizardValidation,
	S extends WizardSummary,
> {
	/** The upload form of the import (its last result opens the column step). */
	upload: { readonly result?: UploadOutcome<F, D> | undefined };
	validate: (run: WizardRun<F> & E) => Promise<ImportFailure | ({ ok: true } & V)>;
	commit: (run: WizardRun<F> & E) => Promise<ImportFailure | ({ ok: true } & S)>;
	/** The column catalogue of the import. */
	spec: () => ImportSpec<F>;
	/** The answers of the import that travel with every call. */
	run: () => E;
	/** The toast of a completed import. */
	doneTitle: () => string;
	/** A new file was uploaded: forget the answers about the previous one. */
	onUpload?: () => void;
	/** A validation came back. */
	onValidated?: () => void;
}

export class ImportWizard<
	F extends string,
	D extends WizardDetection<F>,
	E extends object,
	V extends WizardValidation,
	S extends WizardSummary,
> {
	step = $state<ImportStep>("upload");
	uploadId = $state("");
	filename = $state("");
	info = $state({ rows: 0, encoding: "", delimiter: "" });
	detection = $state<D | null>(null);
	remembered = $state(false);
	sample = $state<string[][]>([]);
	mapping = $state<(F | null)[]>([]);
	header = $state(true);
	result = $state<V | null>(null);
	onlyErrors = $state(false);
	busy = $state(false);
	summary = $state<S | null>(null);

	readonly #options: ImportWizardOptions<F, D, E, V, S>;
	readonly #i18n = useI18n();

	/** The required columns no column feeds yet (null when the mapping is complete). */
	readonly missingText = $derived.by(() => missingHeaders(this.#options.spec(), this.mapping));
	readonly mappingComplete = $derived(this.missingText === null);
	/** The rows of the preview, only the errors when asked. */
	readonly visibleRows = $derived.by((): V["rows"][number][] =>
		[...(this.result?.rows ?? [])].filter((r) => !this.onlyErrors || r.status === "error"),
	);

	constructor(options: ImportWizardOptions<F, D, E, V, S>) {
		this.#options = options;
		// the remote form keeps its last result for the whole visit: an upload of a previous visit
		// counts as handled, so the page opens on the file choice again (9.13, round 9)
		let handledUpload = options.upload.result?.uploadId ?? "";
		$effect(() => {
			const r = options.upload.result;
			// each upload result is handled once, so "import another file" really goes back
			if (!r || r.uploadId === handledUpload) {
				return;
			}
			handledUpload = r.uploadId;
			this.uploadId = r.uploadId;
			this.filename = r.filename;
			this.info = { rows: r.rowCount, encoding: r.encoding, delimiter: r.delimiter };
			this.detection = r.detection;
			this.remembered = r.remembered;
			this.sample = r.sample;
			this.mapping = [...r.mapping];
			this.header = r.detection.header;
			options.onUpload?.();
			this.result = null;
			this.summary = null;
			this.step = "mapping";
		});
	}

	#run(): WizardRun<F> & E {
		return {
			...this.#options.run(),
			uploadId: this.uploadId,
			mapping: this.mapping,
			header: this.header,
		};
	}

	#failed(failure: ImportFailure): void {
		toaster.error({
			title: this.#i18n.t(`common.import.errors.${failure.error}`, {
				columns: "columns" in failure ? failure.columns : "",
			}),
		});
		if (failure.error === "uploadGone") {
			this.step = "upload";
		}
	}

	/** The check: every row with its status and reasons, nothing written. */
	validate = async (): Promise<void> => {
		this.busy = true;
		try {
			const r = await this.#options.validate(this.#run());
			if (!r.ok) {
				this.#failed(r);
				return;
			}
			this.result = r;
			this.#options.onValidated?.();
			this.step = "preview";
		} finally {
			this.busy = false;
		}
	};

	/** The import: validated again and written in one transaction. */
	commit = async (): Promise<void> => {
		this.busy = true;
		try {
			const r = await this.#options.commit(this.#run());
			if (!r.ok) {
				this.#failed(r);
				return;
			}
			this.summary = r;
			this.step = "done";
			toaster.success({ title: this.#options.doneTitle() });
		} finally {
			this.busy = false;
		}
	};

	/** Back to the file choice. */
	restart = (): void => {
		this.step = "upload";
		this.uploadId = "";
		this.result = null;
		this.summary = null;
	};
}
