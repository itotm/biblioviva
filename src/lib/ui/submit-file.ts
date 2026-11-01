// SPDX-License-Identifier: GPL-3.0-or-later
// Sends a file the page already holds (a camera picture, a file picked by a button, a dropped
// file) through a remote form: the file is put into the form's hidden file input, then the form
// is submitted, so validation, issues and `pending` work as for a file chosen in the input. The
// form waits for the pending state updates first: hidden inputs bound to state set just before
// (a file name, a target) carry their new values.
import { tick } from "svelte";

interface SubmittableForm {
	submit(): Promise<boolean>;
}

/** Puts `file` into `input` and submits `form`; false when there is no input or the form refuses. */
export async function submitFile(
	form: SubmittableForm,
	input: HTMLInputElement | null | undefined,
	file: File,
): Promise<boolean> {
	if (!input) {
		return false;
	}
	const transfer = new DataTransfer();
	transfer.items.add(file);
	input.files = transfer.files;
	await tick();
	return await form.submit();
}
