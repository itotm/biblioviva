// SPDX-License-Identifier: GPL-3.0-or-later
// The staff notes, "Segnalazioni" (step 9.18, Q113): every account reads and writes them; pinning
// to the dashboard, archiving, restoring and deleting need `admin`. Nobody edits a note.
import { takeDemoNote } from "#lib/server/demo/limits.js";
import { isDemoPublic } from "#lib/server/demo/public.js";
import { clientAddress } from "#lib/server/auth/client-address.js";
import { command, getRequestEvent, query } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { can } from "#lib/server/auth/rbac.js";
import { orNotFound, refusing } from "#lib/server/http/errors.js";
import { getDb } from "#lib/server/db/index.js";
import {
	archiveNotes,
	createNote,
	deleteNote,
	listArchivedNotes,
	listOpenNotes,
	NoteNotFoundError,
	NoteValidationError,
	restoreNote,
	setNotePinned,
} from "#lib/server/services/notes.js";
import { NOTE_COLORS, NOTE_MAX_LENGTH } from "#lib/shared/notes.js";

import { dbId as id } from "#lib/shared/input-schemas.js";

export const getOpenNotes = query(() => {
	requireUser();
	return listOpenNotes(getDb());
});

/** The most recently archived notes: "Mostra altre" asks for a longer list. */
export const getArchivedNotes = query(
	v.object({ limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2000)) }),
	({ limit }) => {
		requireUser();
		return listArchivedNotes(getDb(), { limit });
	},
);

export const addNote = command(
	v.object({
		// a little room over the limit: the service trims, then measures
		body: v.pipe(v.string(), v.maxLength(NOTE_MAX_LENGTH * 2)),
		color: v.picklist(NOTE_COLORS),
		pinned: v.optional(v.boolean(), false),
	}),
	(input) => {
		const user = requireUser();
		if (input.pinned && !can(user, "admin")) {
			error(403, "forbidden: admin");
		}
		// the public demo: a few new notes per visitor and day (9.17, Q118)
		if (isDemoPublic()) {
			takeDemoNote(clientAddress(getRequestEvent()));
		}
		return refusing(
			() => {
				const noteId = createNote(getDb(), input, user);
				void getOpenNotes().refresh();
				return { ok: true as const, id: noteId };
			},
			NoteValidationError,
			(e) => ({ ok: false as const, error: e.code }),
		);
	},
);

/** Runs an administrator's action on one note; a note already gone is a 404. */
function adminAction(run: () => void): { ok: true } {
	orNotFound(run);
	void getOpenNotes().refresh();
	return { ok: true };
}

export const pinNote = command(v.object({ id, pinned: v.boolean() }), (input) => {
	const user = requireUser("admin");
	return adminAction(() => setNotePinned(getDb(), input.id, input.pinned, user));
});

export const archiveNote = command(v.object({ id }), (input) => {
	const user = requireUser("admin");
	return adminAction(() => {
		if (archiveNotes(getDb(), [input.id], user) === 0) {
			throw new NoteNotFoundError(input.id);
		}
	});
});

export const unarchiveNote = command(v.object({ id }), (input) => {
	const user = requireUser("admin");
	return adminAction(() => restoreNote(getDb(), input.id, user));
});

export const removeNote = command(v.object({ id }), (input) => {
	const user = requireUser("admin");
	return adminAction(() => deleteNote(getDb(), input.id, user));
});
