// SPDX-License-Identifier: GPL-3.0-or-later
// Printing the cards (step 9.27, Q127): the defaults of the print dialog (side by side or on both
// sides of the sheet, how the sheet turns, what to cut along) for the accounts that print cards,
// and the duplex calibration the administrator saves.
import { command, query } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { cutGuide } from "#lib/server/services/card-sheets.js";
import { saveConfigKeys } from "#lib/server/services/config-sections.js";
import { calibratedOffset, CALIBRATION_RANGE } from "#lib/shared/card-layout.js";

export const getCardPrintOptions = query(() => {
	requireUser("patrons");
	const config = getConfig();
	const { layout, duplex } = config.cards;
	return { layout, flip: duplex.flip, backOffsetMm: duplex.backOffsetMm, cut: cutGuide(config) };
});

const reading = v.pipe(
	v.number(),
	v.minValue(-2 * CALIBRATION_RANGE),
	v.maxValue(2 * CALIBRATION_RANGE),
);

/** "Salva la calibrazione": the values read on the rulers added to the offset in use. */
export const saveDuplexCalibration = command(v.object({ x: reading, y: reading }), (read) => {
	const user = requireUser("admin");
	const offset = calibratedOffset(getConfig().cards.duplex.backOffsetMm, read);
	saveConfigKeys(
		getDb(),
		env().CONFIG_DIR,
		"cards",
		{ "cards.duplex.backOffsetMm": offset },
		user,
	);
	void getCardPrintOptions().refresh();
	return { ok: true as const, offset };
});
