# Import the teachers

This guide explains how to load the list of teachers into BiblioViva from a file. It is for whoever administers
BiblioViva and is usually done once, at the start, and then when the teaching staff changes.

- Time: about 10 minutes.
- Account: `admin`. Another account can import teachers only if the role configuration grants it the **Import
  patrons** permission. To remove the teachers missing from the file the **Anonymize** permission is also needed.
- Requirements: the list of teachers in a spreadsheet (first name and last name) and, if the school has several teachers
  groups, the groups already created: see [Set up the classes](set-up-classes.md).

The procedure is the same as for students, explained step by step in [Import the students](import-students.md): this
page gives only the differences. BiblioViva checks the whole file before writing anything and imports only if there are
no errors.

## Procedure

### Prepare the file

1. Press **Administration**, then **Imports**, then **Teachers**. The **Import teachers** page opens.
1. In the **The template of the file** box choose the columns and press **Download the template**.
1. Open the template with a spreadsheet and write one row per teacher.
1. Save the sheet in CSV format.

The columns, with English names as in the template:

| Column | Content | Group |
|---|---|---|
| `first_name`, `last_name` | first name and last name | required |
| `card_number` | the number of the card the teacher already has | key |
| `external_id` | the teacher's code in the register | key |
| `email` | the email address | optional |
| `group` | the name of the teachers group, for example `Docenti` | optional |

Without `card_number` BiblioViva generates a card for each teacher; without `external_id` whoever is already in the
records is recognised by name. Without the `group` column every teacher joins the default teachers group.

### Upload and check

1. In the **File** step, in the **CSV file** field, choose the file and press **Upload**.
1. In the **Columns** step check how the columns are matched, as for students.
1. In the **Mode** field choose **Add and update**. Choose **Synchronise teachers** only if the file is the complete
   list of teachers: whoever is missing from the file is listed and, after a confirmation, removed. Students are never
   touched.
1. Press **Check the file** and read the **Result** column of each row: **New**, **Update**, **Unchanged** or **Error**.
1. With synchronisation, to remove the teachers absent from the file tick **Remove these teachers from the records
   (immediate anonymisation)**.
1. If there are errors, correct the file, press **Back to the columns**, upload it again and check once more.

> [!WARNING]
> Removal immediately and permanently erases the teacher's first name, last name, contacts, code in the register, card number and photo. It cannot be
> undone. Whoever has loans in progress is not removed.

### Import

1. Press **Import**. The **Completed** step summarises the numbers: "… new, … updated, … unchanged, … removed".
1. For the cards of the new teachers press **Print the cards of the new patrons**.

## Result

The teachers are in the records, each in their group and with their card. The original file stays stored on the
BiblioViva computer and the import appears in the **Audit log**. Uploading the same file again does not create
duplicates.

## Possible problems

### The group is not recognised

The row reports that the teachers group was not found and lists the valid groups. Create the group with **New teachers
group** in the **Classes** page, or correct the name in the file.

### A teacher appears twice

The row reports that the same person is already at the indicated row: remove the duplicate from the file.

### Two teachers have the same name

The page asks to choose which one to update, with **Pick the patron**, or **Create a new patron**.

### The teachers come from Koha

Teachers are extracted with a ready-made query: see [the technical instructions](../../../import/README.md).

## Related pages

- [Import the students](import-students.md)
- [Set up the classes](set-up-classes.md)
- [Enrol a teacher](../../manual/guides/enrol-a-teacher.md)
- [Imports](../screens/imports.md)
