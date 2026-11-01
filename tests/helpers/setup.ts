// SPDX-License-Identifier: GPL-3.0-or-later
// Vitest setup for the `server` project: fixed time zone and locale so date tests are deterministic.
process.env.TZ = "Europe/Rome";
process.env.CONFIG_DIR ??= "tests/fixtures/config";
process.env.DATA_DIR ??= "local/test-data";
process.env.BACKUP_DIR ??= "local/test-backups";
