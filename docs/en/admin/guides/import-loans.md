# Import the open loans

This guide explains how to bring into BiblioViva the books currently on loan, when switching from another program. It
is for whoever administers BiblioViva and is done only once, on the day of the switch.

- Time: about 20 minutes.
- Account: `admin`. No other account can import loans.
- Requirements: the list of open loans, with the card number and the copy barcode of each one; the students, teachers
  and catalogue already imported.

Every imported loan keeps its original date and due date; those already overdue appear at once among the late loans.
BiblioViva checks the whole file before writing anything and imports only if there are no errors.

## Procedure

### Before starting

1. Import the students: see [Import the students](import-students.md).
1. Import the teachers: see [Import the teachers](import-teachers.md).
1. Import the catalogue: see [Import the catalogue](import-the-catalogue.md).

The loans file refers to people and books already present: without the previous steps every row would be an error.

### Prepare the file

1. Press **Administration**, then **Imports**, then **Open loans**. The **Import the open loans** page opens.
1. In the **The template of the file** box choose the columns and press **Download the template**.
1. Open the template with a spreadsheet and write one row per loan.
1. Save the sheet in CSV format.

The columns, with English names as in the template:

| Column | Content | Group |
|---|---|---|
| `card_number` | the card number of the patron, already imported | required |
| `barcode` | the barcode of the copy, already imported | required |
| `issued_on` | the date of the loan, `YYYY-MM-DD` or `DD/MM/YYYY`; if missing, today | optional |
| `due_on` | the due date, in the same format; if missing, it is calculated as at the desk | optional |

Without the `due_on` column the due date is calculated with the loan rules and the calendar: see
[Set the loan rules](set-loan-rules.md).

### Upload and check

1. In the **File** step, in the **CSV file** field, choose the file and press **Upload**.
1. In the **Columns** step check that each column is matched to the right field: **Card**, **Barcode**, **Issue
   date**, **Due date**. The others are ignored with **— ignore —**. The page warns if the dates are missing.
1. Press **Check the file**.
1. In the **Check** step read the **Result** column of each row: **New** or **Error**, with the explanation in
   **Details**. To see only the rows to correct tick **Show errors only**.
1. If the page says that some loans are already overdue, check that the dates are right: those loans are imported and
   appear among the late loans.
1. If there are errors, correct the file, press **Back to the columns**, upload it again and check once more. With even
   one error **Import the loans** stays off.

### Import

1. Press **Import the loans**. BiblioViva writes everything at once.
1. Read the summary of the **Completed** step: "… loans imported, … of them already overdue".

> [!IMPORTANT]
> The import is meant for the day of the switch and is run only once. A second file with the same loans gives an error,
> because the copies are already on loan.

## Result

The books on loan are recorded on the right patrons, with the original dates. Opening **Loans**, then **Books on
loan**, shows the same loans as in the old program; whoever returns them goes through the **Returns** page as
usual. The original file stays stored on the BiblioViva computer.

After the import it is worth doing a spot check: read a few cards and a few labels with the barcode scanner and compare
the loans with the old program.

## Possible problems

- "No patron with card …" appears: the number matches no patron. Import the patron first or correct the number.
- "No copy with barcode …" appears: the barcode is not in the catalogue. Import the catalogue first or correct the
  barcode.
- "Copy … is already on loan" appears: the copy already has a loan in BiblioViva, or it appears twice in the file ("Same
  copy already on line …"). Remove the duplicate.
- "Copy … is withdrawn" appears: a withdrawn copy cannot be lent. Make it available again from the book's record, or
  remove the row.
- "Issue date in the future" or "The due date is before the issue date" appears: correct the dates.
- "Copy … belongs to a book to classify" appears: the loan is imported, but at the desk that copy is not lent until the
  book is classified: see [Classify books](../../manual/guides/classify-books.md).
- For those coming from Koha: open loans are extracted with a ready-made query, to be run on the day of the switch: see
  [the technical instructions](../../../import/README.md).

## Related pages

- [Import the catalogue](import-the-catalogue.md)
- [Set the loan rules](set-loan-rules.md)
- [Return a book](../../manual/guides/return-a-book.md)
- [Imports](../screens/imports.md)
