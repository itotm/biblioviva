# Update BiblioViva

This page explains how to bring BiblioViva to the latest version, for whoever manages the computer it runs on. The
library's data (patrons, books, loans, photos, settings) stay where they are.

- Time: about 10 minutes, mostly waiting for the download.
- Requirements: the terminal of the BiblioViva computer (see [Connect to the computer](steps/terminal.md)) and a recent
  backup.
- For the backup: the `admin` account of BiblioViva.

## Procedure

### Make a backup

1. Make a backup with **Back up now**, as described in the section
   [Make a backup now](steps/backups.md#make-a-backup-now) of the step [Backups](steps/backups.md).

The nightly backup and the one to keep outside the computer are explained in the same step.

### Update

1. Open the terminal of the BiblioViva computer, as at the step [Connect to the computer](steps/terminal.md).
1. Copy the following command, paste it and press Enter. It is the same command as the installation.

   ```sh
   curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang en
   ```

1. Wait. The program recognises the installation already made, asks no question and writes a line like the following,
   with the folder and the way of connecting (`tailscale` or `lan`) that BiblioViva already has.

   ```
   BiblioViva is already installed in /home/<user>/biblioviva (tailscale): updating.
   ```

1. Wait for the end. The program downloads the latest version, restarts BiblioViva and writes "BiblioViva is ready."
   with the usual address. The restart interrupts BiblioViva for a few moments: do it when nobody is working at the
   desk.

> [!NOTE]
> The program rewrites the `compose.yml` file of the `biblioviva` folder (and, with Tailscale, `tailscale/serve.json`)
> with those of the way of connecting in use. The `.env` file, with the Tailscale key and the chosen version, and the
> `config` and `backups` folders are not touched. Whoever edited `compose.yml` by hand must make the edit again.

### Update with Docker commands (alternative)

For whoever prefers not to download the installation program again, two commands are enough.

1. Go into the BiblioViva folder.

   ```sh
   cd ~/biblioviva
   ```

1. Download the latest version.

   ```sh
   docker compose pull
   ```

1. Restart BiblioViva with the downloaded version.

   ```sh
   docker compose up -d
   ```

### Stay on a version

By default BiblioViva follows the latest published version. To stop it at a precise version, for example not to change
version during the school year:

1. Open the `.env` file with the terminal's editor.

   ```sh
   nano ~/biblioviva/.env
   ```

1. Find the line that starts with `BIBLIOVIVA_IMAGE=` and replace the part after the `=` sign with the wanted version,
   for example:

   ```
   BIBLIOVIVA_IMAGE=ghcr.io/itotm/biblioviva:1.0.0
   ```

1. Save with Ctrl+O and Enter, exit with Ctrl+X, then run the commands of the previous section
   (`docker compose pull`, then `docker compose up -d`).

To go back to the latest version, write `ghcr.io/itotm/biblioviva:latest` again. Running the installation command again
does not change this line.

## Result

BiblioViva answers at the same address as before, the login page opens and the books, the patrons and the loans are
those of before.

## Possible problems

- The command answers "permission denied" about Docker: the terminal must be closed and reopened after the installation
  of Docker (see [Install BiblioViva](steps/install.md)), or `sudo` is put in front of the `docker` commands.
- "BiblioViva does not answer yet.": wait two minutes and run the command again; if the message stays, reading the log is
  described in [Install BiblioViva](steps/install.md#possible-problems).
- Something is wrong after the update: restore the backup made at the start, as in
  [Restart from a backup](restore.md), and postpone the update by staying on the previous version as described above.

## Related pages

- [Backups](steps/backups.md)
- [Restart from a backup](restore.md)
- [Install BiblioViva](steps/install.md)
