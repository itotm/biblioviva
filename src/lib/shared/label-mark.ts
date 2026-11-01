// SPDX-License-Identifier: GPL-3.0-or-later
// "Segna come stampate" in the label dialog: when it is offered.

export interface LabelMarkSource {
	/** The dialog prints the pending labels (the dashboard tile "Libri senza etichette"). */
	pending?: boolean;
	/** A print list marks through its own action. */
	listId?: number;
	ids: number[];
	biblioIds: number[];
	/** The copies of the pending sheet, read when the print page was opened. */
	pendingIds: number[];
}

/** True when the copies that were printed are known, so that exactly those can be marked. */
export function canMarkPrinted(source: LabelMarkSource): boolean {
	if (source.listId !== undefined) {
		return false;
	}
	if (source.pending) {
		return source.pendingIds.length > 0;
	}
	return source.ids.length > 0 || source.biblioIds.length > 0;
}
