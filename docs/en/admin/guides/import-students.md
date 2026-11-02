# Import the students

This guide explains how to load the list of students into BiblioViva from a file, at the start of the school year or
when leaving another program. It is for whoever administers BiblioViva.

- Time: 15 to 30 minutes, depending on how much the file needs correcting.
- Account: `admin`. Another account can import students only if the role configuration grants it the **Import
  patrons** permission; to remove the students missing from the file the **Anonymize** permission is also needed, which
  the `admin` account has.
- Requirements: the list of students in a spreadsheet (first name, last name, class) and the classes already created:
  see [Set up the classes](set-up-classes.md).

BiblioViva checks the whole file before writing anything and imports only if there are no errors: there are no
half-done imports. The file is a *CSV*, that is a text file with one row per student and the data separated by `;` or
`,`; every spreadsheet can save one.

## Procedure

### Prepare the file

1. Press **Administration**, then **Imports**, then **Students**. The **Import students** page opens.
1. In the **The template of the file** box choose the columns. Those under **Required** are always in the template;
   those under **Keys** and **Optional** are chosen with the boxes.
1. For the class choose one of the two forms, under **The class**: **In one column (class: 3A)** or **In two columns
   (level: 3, section: A)**.
1. Press **Download the template**. The file contains only the header row.
1. Open the template with a spreadsheet and write one row per student.
1. Save the sheet in CSV format.

The column names are in English and must be left as in the template:

| Column | Content | Group |
|---|---|---|
| `first_name`, `last_name` | first name and last name | required |
| `class` | the class in one column: `3A`, `3 A`, `3ª A` | required, as an alternative to `level` and `section` |
| `level`, `section` | the year (`3`) and the section (`A`) in two columns | required, as an alternative to `class` |
| `card_number` | the number of the card the student already has | key |
| `external_id` | the registration number of the electronic register | key |
| `email` | the email address | optional |

The keys serve to recognise who is already in the records and can be left out. Without `card_number` BiblioViva
generates a new card for each student; without `external_id` whoever is already in the records is recognised by name
and class.

> [!NOTE]
> The import does not create classes: every class named in the file must exist in **Classes**. Files in UTF-8 and
> Windows-1252 are accepted, with separator `;`, `,`, tab or `|`. Empty rows are ignored.

### Upload the file

1. In the **File** step, in the **CSV file** field, choose the file.
1. Press **Upload**. The **Columns** step opens.
1. Check that each column of the file is matched to the right field. Columns with the names of the template are
   recognised automatically; for the others choose the field in the menu, or **— ignore —** to leave them unused. If the
   file has a header row, the box **The first row is a header** is ticked.
1. If a required column is missing, the page says which: "Required columns are missing: …". The **Check the file**
   button stays off until they are all matched.

### Choose what to do

1. In the **Mode** field choose **Add and update** for a file with new students or with updated classes: whoever is
   already in the records is updated, the others are created.
1. Choose **Synchronise students** only if the file is the complete list of the school's students: whoever is missing
   from the file is listed and, after a confirmation, removed. Teachers are never touched.
1. In the **Patrons already present** field choose what to do with a row that matches a student already in the records:
   **Update** (the normal choice), **Skip** or **Create anyway**.

### Check the file

1. Press **Check the file**. The **Check** step opens, with one row for each student.
1. Read the **Result** column: each row is **New**, **Update**, **Unchanged** or **Error**. The **Details** column
   explains the errors. To see only the rows to correct tick **Show errors only**.
1. If the file contains no card numbers, the page says how many new cards will be generated.
1. If two students in the records have the same first and last name, the page asks to choose which one to update,
   with **Pick the patron**, or **Create a new patron**. Then check again.
1. With synchronisation, the list of students present in the records but absent from the file appears. To remove them
   tick **Remove these students from the records (immediate anonymisation)**.
1. If there are errors, correct the file with the spreadsheet, press **Back to the columns**, upload the file again and
   repeat the check. With even one error **Import** stays off.

> [!WARNING]
> Removal immediately and permanently erases first name, last name, contacts, registration number, card number and
> photo; the class and the statistics remain. It cannot be undone. Whoever has loans in progress is not removed: the
> books must be returned first.

### Import

1. Press **Import**. BiblioViva writes everything at once. The **Completed** step summarises the numbers: "… new, …
   updated, … unchanged, … removed".
1. For the cards of the new students press **Print the cards of the new patrons**: see
   [Print the cards of a class](../../manual/guides/print-class-cards.md).
1. For the photos press **Photo census**.

## Result

The students are in the records, each in their class and with their card. The original file stays stored on the
BiblioViva computer and the import appears in the **Audit log**. Uploading the same file again does not create
duplicates: all the rows come out as **Unchanged**.

## Possible problems

### A class is not recognised

The row reports that the class was not found and lists the valid classes. Create the class in **Classes** or correct
the name in the file, then check again.

### The card number is already assigned

"Card number already assigned to another patron" appears: two people have the same card number, in the file or in the
records. Correct the number in the file.

### The card number looks like a book code

"Card number equal or similar to a copy barcode" appears: the number has the form of a book's code: cards and copies
can never be confused. Leave the cell empty: BiblioViva generates the number.

### An empty cell erases nothing

An empty card in the file leaves the student with the card they already have.

### The Import button does not become active

There are still rows with **Error**: read the **Details** column.

### The students come from Koha

Students are extracted with a ready-made query, which produces a file with the right column names and the card numbers
already in use: see [the technical instructions](../../../import/README.md). The names of Koha's columns change from
one version to another: whoever runs the query checks them first.

## Related pages

- [Set up the classes](set-up-classes.md)
- [Import the teachers](import-teachers.md)
- [Upgrade the classes](class-upgrade.md)
- [Import the patron photos](import-photos.md)
- [Enrol a student](../../manual/guides/enrol-a-student.md)
- [Imports](../screens/imports.md)
