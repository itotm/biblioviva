# Consult a report

This page explains how to open a report, choose the period, read the numbers, print them or save them in a spreadsheet.
It is for whoever wants to know how the library is doing: how many loans, which books, which classes read the most, which
loans are overdue.

- Time: about 3 minutes.
- Account: "Reports" (also Administration).
- Requirements: no material. To print, a printer and an A4 sheet.
- Some reports are reserved to the administrator and do not appear to the other accounts. New reports, made for the
  school, are created by the administrator: see [Create a report](../../admin/guides/create-a-report.md).

## Procedure

### Open a report

1. Log in to BiblioViva with the "Reports" account.
1. Open **Reports**. The page groups the reports in four parts: **Loans**, **Books**, **Patrons** and **Activity**. Each
   report has a title and a line of explanation.

   <!-- figure: reports/library | The Reports page with the reports divided by category -->

1. Choose the report. Some have the **With chart** mark, those made by the school have the **The school's** mark. The
   **Administrators only** mark indicates a reserved report.
1. Press the report. Its page opens. The report starts at once with the starting values and shows the rows.

### Choose the period and the other parameters

<!-- figure: reports/report | The page of a report with the parameters, the chart and the table -->

1. In the **Parameters** part read the fields. For example the report "Most borrowed books" has the fields "From", "To"
   and "How many". Normally the period goes from the start of the school year to today.
1. Change the dates or the other values. A report that has none says "This report has no parameters.".
1. Press **Update**. The report is redone with the chosen values.

### Read the result

1. Read the number of rows, for example "20 rows", and the time taken.
1. If the report has a chart, it is above the table.
1. Read the table. Press the title of a column to sort the rows.
1. If "Only the first N rows are shown: narrow the parameters to see them all." appears, narrow the period or the other
   values and press **Update**.

### Print the report

1. Press **Print**. The report opens in a new tab, with the title, the parameters and the print date.
1. Press Ctrl+P. The page is set to landscape on an A4 sheet. For the other settings see [Set the print
   window](../../setup/steps/scanner-printer.md#set-the-print-window).

### Save the report in a spreadsheet

1. Press **Export**.
1. Choose "CSV (spreadsheet, text)" or "ODS (LibreOffice)". The browser downloads a file with the rows of the
   report, with the same parameters as the page.

## Result

The page shows the numbers of the chosen period. The address of the page contains the parameters: copying and pasting it
in another browser, the same report opens again with the same values.

## Possible problems

### No results with these parameters

"No results with these parameters." appears: there is nothing in the chosen period. Widen the period.

### A required field is missing

""From" is missing." (or the name of another field) appears: the field is mandatory and must be filled in.

### The value of a field is not valid

"The value of "…" is not valid." appears: the date or the number has a value that is not allowed. Correct the field.

### A report does not appear

It may be reserved to the administrator. The reports that show single readers, such as "Most active readers", are
visible only to the administrator.

### A school report does not appear in the list

It probably has an error. The administrator sees at the top of the page the notice "Report files not loaded" with the
reason.

### Two reports give different numbers for the same class

The classes of the report are today's, while the loans keep the class of the day they were made: two reports can
therefore give different numbers for the same class, if the students have changed class.

## Related pages

- [Check the books on loan](open-loans.md)
- [Print the overdue notices](overdue-reminders.md)
- [Reports](../screens/reports.md)
- [Create a report](../../admin/guides/create-a-report.md)
