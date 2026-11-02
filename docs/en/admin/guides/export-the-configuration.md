# Export and import the configuration

This guide explains how to save the whole BiblioViva configuration (settings, print templates, label sheets, logo,
reports, languages) in a single file and how to put it back into BiblioViva, even on another installation. It is for
whoever administers BiblioViva, to keep a copy of the settings or to repeat the same settings in another school.

The configuration archive does not contain the library's data (books, patrons, loans: for those there is the [backup](make-a-backup.md))
nor the history of changes.

- Time: about 5 minutes.
- Account: `admin`.
- Requirements: for the import, a BiblioViva ZIP archive.

> [!IMPORTANT]
> The archive also contains the staff accounts with their passwords in protected, unreadable form. Keep it with care and
> do not send it to anyone who must not enter BiblioViva.

## Procedure

### Export

1. Log in to BiblioViva as `admin`.
1. Open **Administration**.
1. Open **Configuration**.
1. Scroll down to the **Configuration archive** panel.
1. Press **Export configuration**. The browser saves the file `biblioviva-configurazione-YYYYMMDD-HHMM.zip`.

<!-- figure: admin/config-archive | The Configuration archive panel with the Export configuration and Import configuration buttons -->

To export only some parts:

1. Open **Choose what to export** and tick the parts to take.
1. Press **Export the chosen parts**.

### Import

1. In the **Configuration archive** panel press **Import configuration**.
1. Choose the ZIP file. BiblioViva checks it without changing anything and shows the result below the buttons: which
   archive it is, how many files are new, changed, removed and identical, and which sections change.
1. Open **List of files** to see one file at a time.
1. Tick the parts to take. The others stay as they are.
1. Read any problems. With even a single error the **Import** button stays off.
1. Press **Import**.
1. At the question "Replace the configuration with the archive's?" press **Import**. The message "Configuration
   imported" appears.

The archive can be a file from **Export configuration**, but also a backup or a file from **Export everything**: only
the configuration is taken, the library's data stays as it is. A file that contains only data is rejected.

> [!WARNING]
> If the archive comes from another installation and the **Security and access** part is also taken, the staff accounts
> and their passwords become those of the archive. Untick that part to keep the current accounts.

## Result

- The configuration `.zip` file is on the computer.
- After an import the configuration is that of the archive. The previous files stay in the history: to go back see
  [Undo a configuration change](undo-a-configuration-change.md).

## Possible problems

### The file is not a BiblioViva archive

"The file is not a valid ZIP archive." or "The file is not a BiblioViva archive." appears: choose a file produced by
BiblioViva.

### The archive holds no configuration

"The archive holds no configuration (only library data): it is restored from Administration → Backups." appears: the
file is a copy of the data, not of the configuration; see [Restart from a backup](../../setup/restore.md).

### The archive has problems to fix

"The archive has problems: they must be fixed before importing it." appears with a list: each line gives the file and
the key to correct, for example an invalid value or a code used by books that would disappear. Correct the archive, or
untick the parts that have the problem.

### The archive is too large

"The archive is too large" appears: the limit is given in the message.

### The same is to be done from the terminal

Whoever works on the BiblioViva computer can do the same from the terminal: the commands are in the technical page
[Deployment notes](../../../deploy.md).

## Related pages

- [Undo a configuration change](undo-a-configuration-change.md)
- [Make and download a backup](make-a-backup.md)
- [Configuration](../screens/configuration.md)
- [Administrator first steps](../first-steps.md)
