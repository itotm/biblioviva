// SPDX-License-Identifier: GPL-3.0-or-later
// The class pictures that go (Q106): removing a patron erases every frame where they were chosen
// and paints their face over in the picture; the class upgrade deletes every picture, a patron
// list takes its pictures with it.
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { classPhotoFrame, classPhotoSheet } from "#lib/server/db/schema.js";
import { decodeRgb, encodeRgb, fillCorners, type Corners } from "#lib/server/images/warp.js";
import { writeAtomic } from "#lib/server/runtime/fs.js";
import { removeSheetFolder, SHEET_ROOT, sheetFolder } from "./class-sheets.js";

/**
 * Removing a patron (2.9, Q106): every frame where they were chosen (draft or saved) becomes
 * `erased` — no patron, its photo file deleted at once — and is painted over in its picture by
 * `paintErasedFrames` (through `coverRemovedFaces`) right after the removal's transaction (decoding and
 * encoding an image cannot run inside it); the media route, the backups and the exports run it
 * too before they read a picture. The picture stays with its class. Returns the frames erased.
 */
export function eraseFramesOfPatron(
	tx: DbOrTx,
	dataDir: string,
	patronId: number,
	now = new Date(),
): number {
	const frames = tx
		.select({ id: classPhotoFrame.id, cropPath: classPhotoFrame.cropPath })
		.from(classPhotoFrame)
		.where(eq(classPhotoFrame.patronId, patronId))
		.all();
	for (const f of frames) {
		if (f.cropPath) {
			rmSync(join(dataDir, f.cropPath), { force: true });
		}
		tx.update(classPhotoFrame)
			.set({
				state: "erased",
				patronId: null,
				assignedAt: null,
				cropPath: "",
				paintedAt: null,
				updatedAt: now.toISOString(),
			})
			.where(eq(classPhotoFrame.id, f.id))
			.run();
	}
	return frames.length;
}

/** The colour that covers a removed pupil's face: a neutral grey. */
const ERASED_COLOUR = [156, 163, 175] as const;
/** How much larger than the frame the painted area is: its border and a margin go too. */
const ERASE_GROW = 0.06;

let painting: Promise<number> = Promise.resolve(0);

/**
 * Paints over, in their pictures, the erased frames not painted yet (all pictures, or one): the
 * picture is decoded once, every such frame filled with grey a little beyond its border, the
 * picture re-encoded under a new name and the old file removed. One run at a time in the process.
 * Returns how many frames were painted.
 */
export function paintErasedFrames(db: Db, dataDir: string, sheetId?: number): Promise<number> {
	const run = async (): Promise<number> => {
		const pending = db
			.select({
				id: classPhotoFrame.id,
				sheetId: classPhotoFrame.sheetId,
				corners: classPhotoFrame.corners,
			})
			.from(classPhotoFrame)
			.where(
				and(
					eq(classPhotoFrame.state, "erased"),
					sql`${classPhotoFrame.paintedAt} is null`,
					sheetId === undefined ? undefined : eq(classPhotoFrame.sheetId, sheetId),
				),
			)
			.all();
		const bySheet = new Map<number, typeof pending>();
		for (const f of pending) {
			bySheet.set(f.sheetId, [...(bySheet.get(f.sheetId) ?? []), f]);
		}
		let painted = 0;
		for (const [id, frames] of bySheet) {
			const sheet = db.select().from(classPhotoSheet).where(eq(classPhotoSheet.id, id)).get();
			if (!sheet) {
				continue;
			}
			const picture = await decodeRgb(
				new Uint8Array(readFileSync(join(dataDir, sheet.path))),
			);
			for (const f of frames) {
				fillCorners(picture, f.corners as Corners, ERASED_COLOUR, ERASE_GROW);
			}
			const now = new Date();
			const path = join(sheetFolder(id), `picture-${now.getTime()}.jpg`);
			writeAtomic(join(dataDir, path), await encodeRgb(picture, "jpeg", 90));
			db.transaction((tx) => {
				tx.update(classPhotoSheet)
					.set({ path, updatedAt: now.toISOString() })
					.where(eq(classPhotoSheet.id, id))
					.run();
				tx.update(classPhotoFrame)
					.set({ paintedAt: now.toISOString() })
					.where(
						inArray(
							classPhotoFrame.id,
							frames.map((f) => f.id),
						),
					)
					.run();
			});
			if (sheet.path !== path) {
				rmSync(join(dataDir, sheet.path), { force: true });
			}
			painted += frames.length;
		}
		return painted;
	};
	painting = painting.then(run, run);
	return painting;
}

/** The class upgrade (12.5) deletes every class picture (Q106). */
export function deleteAllSheets(tx: DbOrTx, dataDir: string): number {
	const ids = tx
		.select({ id: classPhotoSheet.id })
		.from(classPhotoSheet)
		.all()
		.map((r) => r.id);
	deleteSheetRows(tx, dataDir, ids);
	rmSync(join(dataDir, SHEET_ROOT), { recursive: true, force: true });
	return ids.length;
}

/** The pictures of a patron list go with the list (2.8). */
export function deleteSheetsOfList(tx: DbOrTx, dataDir: string, listId: number): number {
	const ids = tx
		.select({ id: classPhotoSheet.id })
		.from(classPhotoSheet)
		.where(eq(classPhotoSheet.printListId, listId))
		.all()
		.map((r) => r.id);
	deleteSheetRows(tx, dataDir, ids);
	return ids.length;
}

function deleteSheetRows(tx: DbOrTx, dataDir: string, ids: readonly number[]): void {
	if (ids.length === 0) {
		return;
	}
	tx.delete(classPhotoFrame)
		.where(inArray(classPhotoFrame.sheetId, [...ids]))
		.run();
	tx.delete(classPhotoSheet)
		.where(inArray(classPhotoSheet.id, [...ids]))
		.run();
	for (const id of ids) {
		removeSheetFolder(dataDir, id);
	}
}
