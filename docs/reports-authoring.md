# Reports: authoring guide

Reports are JSON files (PLAN.md §3.11, Appendix B, step 9.20). The built-ins live in the application
(`config/reports/`); the school's own go in `CONFIG_DIR/reports/`, where a file with the `id` of a
built-in replaces it (ADR-014). A report is either **guided** (a `query` made of the pieces of a
catalogue, no SQL) or **SQL** (a statement written by hand); both can be **pivot tables**.

## The library and the editor

**Administration → Configuration → Reports library** (`/admin/config/reports`) lists every
report with where it comes from (shipped with BiblioViva, customised, added):

- **Edit** opens the editor (`/admin/config/reports/<id>`). Saving a built-in writes the school's
  customised copy with the same `id`; **Back to the original** removes it and the built-in comes back.
- **Duplicate** opens the editor on a copy with a new `id` (`/admin/config/reports/new?from=<id>`);
  **New report** starts a guided report from scratch (`/admin/config/reports/new`).
- **Try** opens the report with its form; **Download** gives the definition in use
  (`/admin/config/reports/<id>/file.json`); **Upload a report (JSON)** installs a JSON file.

Saving (from the editor or by upload) runs the checks of the loader — schema, reserved names, SQL
safety — and then **tries the report** on the read-only connection: the statement is compiled and run
with every parameter at its default (a sample value for a required parameter without one). Whatever
SQLite refuses — an unknown table or column, a function given the wrong data — is shown with its
message and nothing is saved; the file is written as `reports/<id>.json` only when the trial run
succeeds. A JSON part of the editor that does not parse blocks the save as well. Every operation is a change of the
configuration history and part of the configuration archive. Files that do not load are listed with
their problem.

The editor has the titles and descriptions in Italian and English, the category, "Administrators only", and two tabs over the same file:

- **Guided**: the data (loans, copies or patrons), the rows (one or two dimensions), the columns (a
  dimension whose values become the columns: a pivot table), the values, the totals, the order, the
  filters (none, asked when the report is opened, or fixed) and the chart.
- **SQL**: for an SQL report, the statement and the other parts as JSON; for a guided report, the SQL
  it compiles to (read-only) and **Edit as SQL**, which turns it into an SQL report after a
  confirmation. There is no way back: an SQL report is edited in this tab only.

**Preview** runs the draft with the default values of its parameters, the same as the trial run of
a save (200 rows at most), and shows the table, the chart or the problems.

## A guided report

```json
{
	"id": "loans-by-class-section",
	"title": { "it": "Prestiti per classe e sezione", "en": "Loans by class and section" },
	"category": "loans",
	"query": {
		"source": "loans",
		"filters": [{ "field": "period", "ask": true }],
		"rows": ["classYear"],
		"columns": "section",
		"measures": ["loans"],
		"totals": "both",
		"chart": "bar"
	}
}
```

The loader compiles `query` into `sql`, `columns`, `params`, `pivot` and `chart`; the file keeps only
the `query`. The pieces (`src/lib/server/reports/builder/catalogue.ts`):

| `source` | Dimensions (`rows`, `columns`) | Measures | Filters |
|---|---|---|---|
| `loans` (the class of the day of the loan) | `classYear`, `section`, `class`, `stage`, `patronType`, `month`, `weekday`, `schoolYear`, `classification`, `kind`, `readingLevel`, `itemType` | `loans`, `readers`, `titles`, `avgDays` | `period`, `patronType`, `stage`, `level`, `group`, `itemType`, `kind` |
| `items` (copies not withdrawn) | `classification`, `kind`, `readingLevel`, `itemType`, `status`, `acquisitionYear`, `decade` | `copies`, `titles` | `period` (acquisition), `itemType`, `kind` |
| `patrons` (active, the class of today) | `classYear`, `section`, `class`, `stage`, `patronType` | `patrons`, `withPhoto`, `withCard` | `patronType`, `stage`, `level`, `group` |

- `rows`: one or two dimensions; `columns` (optional): a dimension whose values become the columns,
  with exactly one measure; `measures`: one to three.
- `totals` (pivot tables): `both` (the total column and the total row, default), `rows` (the total
  column), `columns` (the total row) or `none`.
- `sort`: `dimension` (the order of the rows, default) or `measure` (the biggest first); `limit`: at
  most this many rows (top lists).
- `filters`: `{ "field": "…", "ask": true }` asks the value in the report's form (the `period` becomes
  the `from` and `to` dates, by default from the start of the school year to today);
  `{ "field": "…", "value": "…" }` fixes it (`"2025-09-01..2026-06-30"` for a period, a code, a
  class id, `fiction` / `nonfiction` / `unclassified` for `kind`).
- In a class-year dimension the teachers are one row, "Teachers"; they have no section, so in a class
  year × section table they count in the total only. Books still to classify are one value, "To
  classify", of `classification` and `kind`.

## An SQL report

```json
{
	"id": "reading-index-by-class",
	"title": { "it": "Indice di lettura per classe", "en": "Reading index by class" },
	"description": { "it": "…", "en": "…" },
	"category": "patrons",
	"restricted": false,
	"params": [
		{ "name": "from", "label": { "it": "Dal", "en": "From" }, "type": "date", "required": true, "default": "schoolYearStart" },
		{ "name": "to", "label": { "it": "Al", "en": "To" }, "type": "date", "required": true, "default": "today" }
	],
	"sql": "SELECT pc.class_label AS class, COUNT(DISTINCT p.id) AS students, … WHERE p.status = 'active' …",
	"columns": [
		{ "key": "class", "label": { "it": "Classe", "en": "Class" } },
		{ "key": "students", "label": { "it": "Studenti", "en": "Students" }, "type": "int" }
	],
	"chart": { "type": "bar", "x": "class", "y": "students" },
	"rowLimit": 5000
}
```

- `id`: lowercase letters, digits and `-` (`new` is the editor's address, never an id); the file name
  does not matter.
- Texts (`title`, `description`, every `label`): one string, or one string per language; the
  installation's language is used, else English, else the first one.
- `category`: `loans`, `books`, `patrons` or `ops`. `restricted: true` shows the report to
  administrators only.
- `rowLimit`: at most this many rows are read (default 5 000, maximum 50 000); the page says when
  more existed. The row cap and the read-only connection are the limits of a report: a running
  statement cannot be interrupted.

## Parameters

| `type` | Form control | Bound as |
|---|---|---|
| `date` | date picker | `:name`, `YYYY-MM-DD` |
| `dateRange` | two date pickers | `:nameFrom`, `:nameTo` |
| `int` | number (`min`, `max`) | integer |
| `text` | text box (≤ 200 characters) | text |
| `select` | list of `options` (`value`, `label`) | the option's value |
| `level` | the levels of the school | the level's code |
| `stage` | the stages of the school | the stage's code |
| `group` | the classes and teachers groups | the group's id |
| `patronType` | student or teacher | `student` / `teacher` |
| `itemType` | the item types of the configuration | the code |

An empty optional parameter is bound as `NULL`, so write `(:level IS NULL OR l.level_snapshot = :level)`.
Date defaults may be `today`, `schoolYearStart`, `monthStart` or `yearStart`. Every report may also
use, without declaring them, `:today`, `:schoolYearStart` and `:classificationCodes` (a JSON array of
every genre and class code, for `json_each(:classificationCodes)`).

## The SQL

One `SELECT` (or `WITH … SELECT`) statement, checked when the file is loaded: no `;`, no keyword
that writes or changes the connection (`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, `ALTER`,
`ATTACH`, `PRAGMA`, …, also inside a `WITH`), only `:name` parameters, each declared and used. The
statement runs on a separate read-only connection. Timestamps are stored in UTC
(`2026-09-25T09:30:00.000Z`); `date(l.issued_at)` gives the day, which during the library's opening
hours is the local day. The tables are described in `docs/database.md`: `loan` keeps the patron's
type and class at the time of the loan (`patron_type_snapshot`, `level_snapshot`,
`level_position_snapshot`, `stage_snapshot`, `group_id_snapshot`, `group_snapshot`,
`class_label_snapshot`), the view `patron_class` gives the class of today; `biblio.kind` is NULL for
a record still to classify.

## Columns, pivot tables and charts

Each column names a key of the result rows (other keys are ignored); `hidden: true` reads a column
without showing it. `type`: `text` (default), `int`, `number`, `percent`, `date`, `datetime`, and
coded values the app writes as words in the installation's language: `classification` ("590" →
"590 · Animali", `@unclassified` → "To classify"), `patronType`, `itemType`, `itemStatus`,
`weekday` (SQLite's `strftime('%w')`, 0 = Sunday), `boolean` (0/1 → no/yes), `level` (a level code,
`@teachers` → "Teachers"), `stage`, `kind` (`fiction`, `nonfiction`, `@unclassified`), `month`
(`2026-09` → "September 2026") and `decade` (`1990` → "1990–1999").

`pivot` (optional) turns the long rows into a table: `rows` (one or two column keys), `columns` (the
key whose values become the columns), `value` (the number summed in each cell), `columnOrder` (a key
that orders the values of `columns`, usually a hidden column; else their first appearance) and
`totals` (`both`, `rows`, `columns`, `none`). Missing cells are 0; a row with an empty value of
`columns` counts in its row total only. The grid, the print view and the CSV/ODS export show the
same table, with the total row last.

`chart` (optional): `type` `bar`, `line` or `doughnut`; `x` one column or several joined with a
space; `y` one or more columns plotted as series. A pivot table is drawn as stacked bars, one series
per column value, without the total row.

## Checking a file

The reports page lists files that could not be loaded, with the reason, to administrators. The
unit test `src/lib/server/reports/builtin.test.ts` runs every built-in on the seed data of a primaria
and of an istituto comprensivo.
