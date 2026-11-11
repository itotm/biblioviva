# Reports

The **Reports** page offers the library's statistics: loans per month, most borrowed books, copies never lent, patrons per class and others. Each report is a table, sometimes with a chart, that can be printed and downloaded. Use it to answer the school's questions (how many loans this year, which books never go out) without counting by hand.

The page opens from the **Reports** item of the menu (on a phone, in the bottom bar, under **More**) and from the [dashboard](dashboard.md). The accounts "Reports" and "Administration" use it. Some reports contain more sensitive data and are reserved to "Administration": the other accounts do not see them, while "Administration" sees them with the mark **Administrators only**. The procedure is in the guide [Consult a report](../guides/run-a-report.md).

The page has two parts: the [list of reports](#list-of-reports) and the [page of a report](#report-page).

## List of reports

<!-- figure: reports/library | The list of reports, grouped by category -->

In the figure:

1. The title of the category: [Categories](#categories).
1. The card of a report, with title and description: [Report cards](#report-cards).
1. The marks **With chart**, **Administrators only** and **The school's**: [Marks](#marks).

### Categories

The reports are grouped in four categories, each with its icon: **Loans**, **Books**, **Patrons** and **Activity**. A category with no reports does not appear.

### Report cards

Each report is a card with the title and a short description. A click opens the report. Examples: overdue loans, most borrowed books, average duration of loans, copies never lent, holdings by classification, reading index by class. Two reports list, for a period, the copies withdrawn and the copies entered, with the inventory number, the origin and the value: they serve the school inventory, see [The school's inventory of assets](../../compliance/school-inventory.md). The report "Accessible books by format", in the **Books** category, lists for a period (**From** and **To**, by default from the start of the school year to today) one row per book and accessible format, ordered by format and title, with the columns **Format**, **Title**, **Author**, **Call number**, **Copies** (not counting the withdrawn ones) and **Loans** of the period. Like every report, it can be printed and exported.

### Marks

Under the description marks may appear:

- **With chart**: besides the table, the report draws a chart (bar, line or pie);
- **Administrators only**: the report opens only with the "Administration" account;
- **The school's**: the report is not supplied with BiblioViva but was added or customised by the school (see [Creating a report](../../admin/guides/create-a-report.md)).

### Report files not loaded

Only for "Administration": if a file of the school's reports has an error, at the top of the page a yellow box, titled **Report files not loaded**, explains: "These files of the reports folder have an error and are not listed:". Each row gives the name of the file and the reason.

## Report page

The page of a report shows the title and the description, the parameters form and the result. The back button **All reports** returns to the list.

<!-- figure: reports/report-page | A report with the parameters, the chart and the table of results -->

In the figure:

1. The buttons **Print** and **Export**: [Printing and export](#printing-and-export).
1. The **Parameters** form and the **Update** button: [Parameters](#parameters).
1. The number of rows and the time taken: [Result](#result).
1. The chart, if there is one: [Result](#result).
1. The table of results: [Result](#result).

### Parameters

The **Parameters** box contains the fields the report provides, for example a period or a number. If the report has none, the page writes "This report has no parameters." and the result appears at once.

1. Set the fields. A date is a single field; a period has two dates, written as "label (from)" and "label (to)"; a number and a text are typed by hand; a choice field offers the provided entries and, if optional, **All**; for the reports on patrons the choice can be **Students** or **Teachers**.
1. Press **Update**. The table is recalculated with the values written.

The parameters are also written in the address of the page: saving or sending the link reopens the same report with the same values.

### Result

Under the parameters, a line says "N rows" and "in N ms", that is how long the calculation took. Then, if the report provides it, a chart and always the table. The column headings sort the rows (not in summary tables, which keep the total at the bottom). If there is nothing, the page writes "No results with these parameters."

When the result is very long, the table shows only the first rows and the page warns: "Only the first N rows are shown: narrow the parameters to see them all."

## Parameter messages

A badly written value blocks the calculation and a red box says which field must be corrected.

### Missing parameter

"“label” is missing." The field is mandatory and must be filled in.

### Invalid value

"The value of “label” is not valid." Correct the field, for example a date written wrongly.

## Printing and export

- **Print** opens in a new browser tab the printable version of the report, with the line "Printed on" and the date, and the parameters used.
- **Export** downloads the table, with the parameters in use, in **CSV (spreadsheet, text)** or **ODS (LibreOffice)**.

## Related pages

- [Consult a report](../guides/run-a-report.md)
- [Create a report](../../admin/guides/create-a-report.md)
- [Catalogue](catalog.md)
