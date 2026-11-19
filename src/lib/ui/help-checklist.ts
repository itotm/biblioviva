// SPDX-License-Identifier: GPL-3.0-or-later
// The guides behind the installation check (`/admin/setup`, step 8.7): a module of its own, so the
// other pages do not load it with the help button's table.
import type { PROBLEM_FINDINGS } from "#lib/shared/install-check.js";
import { CONFIG_SECTIONS_PAGE, type HelpTarget, section } from "./help-links.js";

const PROBLEMS_PAGE = "help/problems/";
const problem = (it: string, en: string): HelpTarget => section(PROBLEMS_PAGE, it, en);
const BACKUP_PROBLEM = problem("copia-di-sicurezza-non-fatta", "backup-not-made");

/**
 * The page of the documentation that explains each finding of the installation check that is not
 * green (`/admin/setup`, step 8.7), by `<item>.<finding>`: where the problem is fixed, or the
 * common problem it is.
 */
export const CHECKLIST_HELP: Readonly<Record<(typeof PROBLEM_FINDINGS)[number], HelpTarget>> = {
	"config.invalid": { page: "admin/guides/undo-a-configuration-change/" },
	"config.example": { page: "admin/first-steps/" },
	"config.warnings": { page: CONFIG_SECTIONS_PAGE },
	"address.lan": section("install/choose-network/", "rete-locale", "local-network"),
	"address.plainHttp": problem("lucchetto-che-manca", "missing-padlock"),
	"profile.weaker": section(CONFIG_SECTIONS_PAGE, "prestazioni", "performance"),
	"accounts.example": { page: "admin/guides/change-a-password/" },
	"accounts.plain": section(
		"admin/guides/change-a-password/",
		"laccount-mostra-password-in-chiaro-nel-file",
		"the-account-shows-clear-password-in-the-file",
	),
	"backup.folder": BACKUP_PROBLEM,
	"backup.scheduleInvalid": section(CONFIG_SECTIONS_PAGE, "backup", "backup"),
	"backup.notScheduled": BACKUP_PROBLEM,
	"backup.none": { page: "admin/guides/make-a-backup/" },
	"backup.late": problem("computer-rimasto-spento", "computer-left-off"),
	"backup.stale": BACKUP_PROBLEM,
	"backup.offsiteNone": section("admin/screens/backups/", "copia-esterna", "off-site-copy"),
	"backup.offsiteError": section("admin/screens/backups/", "copia-esterna", "off-site-copy"),
	"backup.offsiteStale": section("admin/screens/backups/", "copia-esterna", "off-site-copy"),
};

/** The guide of each test of the installation check: the problem the test may show. */
export const CHECKLIST_TEST_HELP = {
	printers: problem("stampa-troppo-piccola-o-sfalsata", "print-too-small-or-misaligned"),
	duplex: { page: "admin/guides/calibrate-duplex/" },
	camera: problem("fotocamera-che-non-si-avvia", "camera-that-does-not-start"),
	scanner: problem(
		"lettore-che-scrive-caratteri-strani",
		"scanner-that-types-strange-characters",
	),
} as const satisfies Record<string, HelpTarget>;
