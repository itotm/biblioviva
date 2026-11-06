# Administrator first steps

This page gives the order in which to set up BiblioViva after the [installation](../setup/README.md) and the
[first run](../setup/steps/first-run.md). It is for whoever administers BiblioViva with the `admin` account. Each
item points to the guide that explains the work; optional items are marked as such, and those a school does not need
can be skipped.

- Time: half a day to a day, split over several sessions.
- Account: `admin`, the only one that sees **Administration**.
- Requirements: BiblioViva installed and the first run completed; the account passwords noted down; the files of
  students, teachers and catalogue, if data is imported from another program.

## Procedure

### The sample data and the passwords

1. [Remove the sample data](guides/remove-demo-data.md), if the first run loaded it. Do this first, before entering
   real data.
1. [Change a password](guides/change-a-password.md) and, if needed, [manage the staff
   accounts](guides/manage-accounts.md): after the sample data, the simple passwords must be replaced.

### The library

1. [Set up the library](guides/set-up-the-library.md): the name, the logo, the colours and the language.
1. [Switch off photos or covers](guides/switch-off-photos-or-covers.md), if the school prefers not to keep them.
   Optional.
1. [Add a language](guides/add-a-language.md), if a language other than Italian and English is needed. Optional.

### The school and the rules

1. [Set up the classes](guides/set-up-classes.md): check and complete the classes created at the first run.
1. [Set the loan rules](guides/set-loan-rules.md): length, number of books and renewals, overdue notices.
1. [Set the school calendar](guides/set-the-calendar.md): weekly closing days, holidays and breaks.

### The codes and the catalogue

1. [Choose the barcode formats](guides/barcode-formats.md): to be done before printing labels and cards, and in
   particular if the library already has codes printed by another system.
1. [Change the classification and the reading levels](guides/classification.md): the genres, the subjects and the call
   number scheme.

### The printing

1. [Edit the card template](guides/edit-the-card-template.md).
1. [Edit the labels and the spine band](guides/edit-label-templates.md).
1. [Add a label sheet](guides/add-a-label-stock.md), if the school's adhesive sheet is not among those offered.
1. [Calibrate two-sided printing](guides/calibrate-duplex.md), if the cards are printed on both sides of the sheet.

### The real data

1. [Import the students](guides/import-students.md).
1. [Import the teachers](guides/import-teachers.md).
1. [Import the catalogue](guides/import-the-catalogue.md).
1. [Import the open loans](guides/import-loans.md), only once, on the day of the switch from another program.
1. [Import the patron photos](guides/import-photos.md), if the photos are already available.

### The backups

1. [Make and download a backup](guides/make-a-backup.md), and put it somewhere other than the BiblioViva computer. The
   nightly backup is already active: see the installation step [Backups](../setup/steps/backups.md).
1. [Export and import the configuration](guides/export-the-configuration.md): an archive of the settings to keep safe.

### After the settings

1. [Create a report](guides/create-a-report.md), if statistics other than the supplied ones are needed. Optional.
1. Give each colleague the password of their account and go on to the [Manual](../manual/README.md).

## Result

- BiblioViva has the school's name, colours, classes, rules and calendar.
- The sample data has been removed and the real data is in.
- The passwords have been changed and handed to those who use them.
- At least one backup exists, outside the BiblioViva computer.

## Possible problems

### It is not clear whether an item is needed

Skip it. The settings proposed by BiblioViva suit most schools, and every change can be undone from the
[configuration history](guides/undo-a-configuration-change.md).

### A setting cannot be found

The [Configuration](screens/configuration.md) page lists the sections, and [Administration](screens/admin.md) lists the
administrator's pages.

### The password is lost or BiblioViva does not open

See [Common problems](../help/problems.md).

## Related pages

- [Administration](README.md)
- [Manage the staff accounts](guides/manage-accounts.md)
- [Restart from a backup](../setup/restore.md)
- [Common problems](../help/problems.md)
