# Make and download a backup

This guide explains how to make a backup right now, without waiting for the night one, and how to download it to the
computer. It is for whoever administers BiblioViva, before an update, a large import or a class upgrade, and at every
important change.

BiblioViva makes a backup of the database by itself every night. What the nightly backup contains, where it is and how
to keep a copy outside the BiblioViva computer is explained in the installation step
[Backups](../../setup/steps/backups.md).

- Time: 2 to 5 minutes, depending on the size of the data.
- Account: `admin`, the only one that sees the **Backups** page.
- Requirements: space on the computer for the downloaded file. Covers weigh more than the database.

## Procedure

### Make a backup now

1. Log in to BiblioViva as `admin`.
1. Open **Administration**.
1. Open **Backups**.
1. Press **Back up now**.
1. Wait for the message "Backup created:" followed by the file name. The file appears at the top of the list, with the
   date in **Created** and the **Size**.

<!-- figure: admin/backups | The Backups page with the list of backups and the Back up now and Export everything buttons -->

### Download a backup

1. In the list press **Download** next to the backup to take away. The browser saves a file
   `biblioviva-YYYYMMDD-HHMM.db` in the downloads folder.

The file contains only the database. Photos and covers are copied to the `uploads` folder of the backups and the
configuration is not part of the nightly backup.

### Download everything in a single file

1. Press **Export everything**.
1. Wait for the browser to save the file `biblioviva-export-YYYYMMDD-HHMM.zip`. It contains the database, the photos, the
   covers and the whole configuration, and is enough on its own to put BiblioViva back on another computer.

### Copy only some parts

The **Backup or export of some parts** panel allows saving only what is needed.

1. Tick the parts in the **Library data**, **Settings** and **Classification, templates and more** groups. The **All**
   and **None** buttons tick or untick everything. Some parts require others: the page says so.
1. Press **Create backup** to save the archive in the list, or **Download** to save it on the computer.

### Keep the file

1. Copy the downloaded file to a USB stick or another medium that is not in the BiblioViva computer. The steps are in
   the [Backups](../../setup/steps/backups.md) step.
1. Delete the copies that are no longer needed.

> [!IMPORTANT]
> The backups contain the students' data. Keep them in a safe place.

## Result

- A recent backup appears in the list of the **Backups** page.
- The downloaded file is on the computer, and then on a stick or another medium.

## Possible problems

### The list of backups is empty

The list shows "No backups yet.": the first one is made at the scheduled time or with **Back up now**.

### A backup is marked as made up at start

The backup was scheduled for the night, the computer was off and BiblioViva made it at the next start-up.

### The zip file is very large

The `.zip` file is very large: covers weigh more than the database. Use a medium with more space.

### The time or duration of the backups must change

The time and the duration of the backups are changed in **Administration**, **Configuration**, **Backup**, in the
**Backup time** and **Days kept** fields.

### The data of a backup must be put back

To put the data of a backup back into BiblioViva see [Restart from a backup](../../setup/restore.md).

## Related pages

- [Backups](../../setup/steps/backups.md)
- [Restart from a backup](../../setup/restore.md)
- [Export and import the configuration](export-the-configuration.md)
- [Backups](../screens/backups.md)
