# Restart from a backup

This page explains how to put back into BiblioViva the data of a backup: after the failure of the card or the disk, on
another computer, after an error that deleted data. It is for whoever administers BiblioViva.

- Time: 20 to 40 minutes with another computer to prepare, about 10 minutes if BiblioViva already works.
- Requirements: a backup file (see below which ones) and the `admin` account.
- To restore on another computer: steps 1-4 of the installation, indicated further on.

## Which file is needed

BiblioViva produces three kinds of file; each can be restored.

| File | Where it is | What it contains |
|---|---|---|
| `biblioviva-YYYYMMDD-HHMM.db` | in the computer's `backups` folder, one per night | the library's data; the photos and the covers are in the `backups/uploads` folder |
| `biblioviva-export-YYYYMMDD-HHMM.zip` | downloaded with **Export everything** | data, photos, covers and the whole configuration |
| `biblioviva-YYYYMMDD-HHMM.zip` | in the `backups` folder, from the **Create backup** button | the parts chosen when the backup was made |

The configuration (settings, staff accounts, card and label templates) is part of the `.zip` files only. Restoring a
nightly `.db` backup, the configuration stays the one of the first run.

## Procedure

### If BiblioViva works: restore from the program

1. Open BiblioViva with the `admin` account, then **Administration**, then **Backups**.
1. For a file already in the list, press **Restore…** on its row.
1. For a file brought from another computer, press **Upload an archive** and choose the file. The browser accepts files
   up to 30 MB; a larger one is copied into the computer's `backups` folder (next section) and then chosen from the
   list.
1. Read the check that BiblioViva shows: the parts the file contains (with a box each), how many rows there are now and
   how many in the file. Clear the tick of the parts not to be touched: they stay as they are.
1. Press **Restore**. At the question "Restore the chosen parts?" confirm. The chosen data and configuration replace the
   current ones.
1. Wait for the message "Restore completed".

> [!WARNING]
> The restore replaces the chosen data with those of the file. If the computer has recent data not to be lost, first
> press **Back up now**.

### Copy a large file to the computer

1. From the computer where the file is, copy it into the `backups` folder of the BiblioViva computer, replacing
   `<user>` with the username and `<file>` with the file name. The command works in the terminal of Windows, macOS and
   Linux; in place of `biblioviva.local` the address used to connect to the computer can be used.

   ```sh
   scp <file> <user>@biblioviva.local:biblioviva/backups/
   ```

1. Open **Administration**, then **Backups**: the file appears in the list, and is restored with **Restore…**.

### If BiblioViva does not open: restore from the terminal

On the BiblioViva computer, with the terminal open as at the step [Connect to the computer](steps/terminal.md).

1. Copy the file into the `backups` folder (with `scp` as above, or from a USB drive).
1. Stop BiblioViva.

   ```sh
   cd ~/biblioviva && docker compose stop app
   ```

1. Have the restore program read the file, replacing `<file>` with its name. The program checks the file and writes what
   it contains, without changing anything.

   ```sh
   docker compose run --rm --entrypoint bun app cli/backup-restore.js /backups/<file>
   ```

1. If the check reports no errors, repeat the command with `--yes` at the end: it really restores.

   ```sh
   docker compose run --rm --entrypoint bun app cli/backup-restore.js /backups/<file> --yes
   ```

1. Restart BiblioViva.

   ```sh
   docker compose start app
   ```

### From the first run

On a newly installed computer, or when starting again from scratch, the guided procedure can restore an **Export
everything** archive without answering its questions. The choice appears only until the guided procedure is completed.

1. Open the BiblioViva address printed by `setup.sh`: the **First-time setup** page opens.
1. In the first step, under the choice of language, press **Restore from a backup**.
1. Press **Choose the archive** and choose the file `biblioviva-export-YYYYMMDD-HHMM.zip`. The browser accepts files
   up to 30 MB.
1. Wait for the check. BiblioViva shows the library that made the archive, the date, the version, how many patrons,
   books and loans it contains and the accounts that will be able to log in.
1. Press **Restore**. Settings, data and pictures come back as they were in the archive, all at once.
1. Wait for the "Restore completed" screen, which lists the accounts of the archive.
1. Press **Go to the login** and log in with one of those accounts, with the password it had in the archive.

An incomplete archive, one from a newer version or one that is not BiblioViva's is refused before anything is changed,
with a message that explains why. For an archive larger than 30 MB complete the guided procedure and restore from the
terminal, as described above.

### On another computer

1. Prepare the computer and install BiblioViva with steps 1-4 of the chosen path (see
   [Installation](README.md)), with the same way of connecting as before.
1. At the step [First run](steps/first-run.md) restore the file from the first screen of the guided procedure, as
   described in the section [From the first run](#from-the-first-run); the rest of the guided procedure is not needed.
1. If the backup comes from a different computer, open **Administration**, **Configuration**, **Performance** and check
   the **Computer** field: the backup brings that of the old computer.

## Result

BiblioViva shows again the patrons, books, loans and photos of the file. The staff accounts and their passwords are
those of the backup, if it contained the configuration; otherwise they are those chosen at the first run.

## Possible problems

- "The file is not a BiblioViva archive.": the chosen file is not a file produced by BiblioViva. Choose a `.db` or `.zip`
  file from the `backups` folder, or download the backup again.
- "The backup is from another version of BiblioViva…": the file was made by a version that has different tables. Install
  the same version (see "Stay on a version" in [Update BiblioViva](update.md)), restore, then update.
- From the first run: "The archive is incomplete: … are missing": the file does not contain every part of a library
  (the settings, the accounts, the patrons or the catalogue). Choose an archive made with **Export everything**.
- From the first run: "The archive was made by a newer version of BiblioViva…": install that version first, restore,
  then update.
- The restore reports rows that "refer to … that would not be there": add to the choice the part that the message names
  and repeat.
- From the terminal: "permission denied" about Docker: see [Install BiblioViva](steps/install.md).

## Related pages

- [Backups](steps/backups.md)
- [Move BiblioViva to another computer](move.md)
- [Update BiblioViva](update.md)
- [Common problems](../help/problems.md)
