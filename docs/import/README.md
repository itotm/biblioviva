# Import files

Sample files and helper queries for the imports of BiblioViva (PLAN.md §3.22, step 9.19). Every
import runs the same way: the whole file is checked first, the preview shows each row with its
result, and "Import" is enabled only when there are no errors; the commit is one transaction and
the original file is kept under `DATA_DIR/imports/<batch-id>/`.

**Columns.** The columns of every file have English names (`first_name`, `card_number`,
`publication_year`, …), the only names recognised in a header: any other column is ignored, or
mapped by hand on the "Columns" step. Every import page has a card "The template of the file" that
generates the template with the columns the operator chooses: the required ones are always in it,
the keys and the optional ones are ticked by hand, and the choice is remembered by the browser. The
template holds the header only. A key left out is allowed, and the page says what happens instead
(cards or barcodes generated, copies grouped by ISBN, patrons matched by name).

Rules shared by the imports: UTF-8 (with or without BOM) or Windows-1252; `;`, `,`, tab or `|` as
separator; blank lines ignored; dates `YYYY-MM-DD` or `DD/MM/YYYY`.

## Students (Administration → Imports → Students, `/admin/imports/students`)

| Group | Columns |
|---|---|
| required | `first_name`, `last_name`, and the class: `class` (one column, `3A`, `3 A`, `3ª A`) **or** `level` + `section` |
| keys | `card_number` (missing → generated), `external_id` (missing → students matched by name and class) |
| optional | `email` |

| File | Content |
|---|---|
| `students-sample.csv` | `first_name;last_name;level;section` |
| `students-class-sample.csv` | the class in one column, with `card_number` and `email` |
| `students-external-id-sample.csv` | the code of the school register in `external_id` (comma separated: both `;` and `,` are accepted) |
| `koha-students.sql` | extracts the current students from the Koha database in that shape, cards included |

The class must exist in Administration → Classes (the import never creates classes): `class` is
matched against the labels of the existing classes (case, spaces and ordinal marks ignored), `level`
is a level's code, label or name and `section` the name of a class hosting it. An unknown class is
an error that lists the valid classes. Without a header, four columns are read as
`first_name;last_name;level;section` and three as `first_name;last_name;class`; anything else is
mapped by hand. Matching order for "Add and update": card number, external id, then surname +
first name with the class as tie-breaker; unresolved namesakes are picked by hand in the preview. An
empty cell of an optional column keeps what the patron has (it never erases a card). "Synchronise
students" treats the file as the complete student list: students missing from it are listed and,
when the operator holds `anonymize` and confirms, anonymized at once (teachers are never touched).

## Teachers (Administration → Imports → Teachers, `/admin/imports/teachers`)

| Group | Columns |
|---|---|
| required | `first_name`, `last_name` |
| keys | `card_number` (missing → generated), `external_id` (missing → teachers matched by name) |
| optional | `email`, `group` (a teachers group; missing → the default teachers group) |

| File | Content |
|---|---|
| `teachers-sample.csv` | `first_name;last_name;card_number;email;group` |
| `koha-teachers.sql` | extracts the current teachers from the Koha database |

Without a header, two columns are read as `first_name;last_name`. "Synchronise teachers" works as for
the students, on the teachers only.

## Catalogue (Administration → Imports → Catalogue, `/admin/imports/catalog`)

| Group | Columns |
|---|---|
| required | `title`, `author`, `publisher` |
| keys | `biblio_key` (missing → copies grouped by ISBN, else one title per row), `barcode` (missing → generated, labels to print) |
| optional | `classification` (missing → the title goes to "To classify"), `reading_level`, `isbn`, `issn`, `ean`, `subtitle`, `original_title` (only for a translation), `responsibility`, `publication_place`, `publication_year`, `physical_description`, `series`, `series_number`, `dewey`, `subjects`, `notes`, `call_number`, `item_type`, `enumeration`, `status`, `not_for_loan`, `acquisition_date`, `item_notes` |

| File | Content |
|---|---|
| `catalog-sample.csv` | one row per copy, the title data repeated, `biblio_key` groups the copies of one title; the last title has no classification |
| `catalog-koha-sample.tsv` | the shape produced by `koha-biblio-items.sql` (tab-separated, as `mysql --batch` writes it): Koha's `ccode` as `classification`, `location` (`1`…`5` or `S`) as `reading_level`, legacy barcodes, one title with copies in two classes (the class-per-copy question), one without author and publisher (the special values) |
| `koha-biblio-items.sql` | extracts every copy from the Koha database in that shape |

One row per copy (the Koha export is tab-separated because physical descriptions contain `;`). The
classification is a genre code (fiction) or a class code (non-fiction): the configuration never has a
code that is both. A title without classification is imported and waits in Catalogue → To
classify; its copies are not lent until it is classified. `reading_level` accepts the codes and
labels of the configured scale and ignores Koha's `S`. `item_type` is read per copy, but the
material is the record's: copies of one new title with different types ask whether the record takes
the type of most of them (Q139). `consultazione` (Koha's `REF`) is not a material: it marks that copy
excluded from loans. `call_number` is not stored as it is: the segnatura is computed from the scheme
`classification.callNumber` (Q143). With a scheme that has a written part per title (`{{text}}`), the
title takes the part of the file's segnature after the computed head (the most frequent among its
copies); with the free scheme each copy keeps its segnatura as its own text; copies whose segnatura in
the file still differs from the computed one are counted, and the operator answers once whether they
take the computed one (their labels then go back among those to print) or the rows are errors. A book
without a real author (`Anonimo`, `AA. VV.`) takes the first letters of its title (`030 ENC`). A `biblio_key` imported before, or an ISBN
already in the catalogue, adds the copies to that record; a barcode already in the catalogue on the
same record is skipped (so the same file can be imported twice), on another record it is an error.
An empty author or publisher is an error unless the operator ticks "usa i valori speciali"
(`catalog.specialAuthors[0]`, `catalog.unknownPublisher`). When copies of one title sit in different
associated classes and `classification.classPerItem` is off, the preview asks whether to turn it on
(written to the configuration, and the class of the titles already present moves to their copies) or
to treat those rows as errors. Copies without a barcode get a new code in the current format and
their labels are offered for printing at the end; imported codes of the current format move the
year's counter past them. Status words: `available`, `lost`, `damaged`, `in_repair`, `withdrawn`
(the Italian words are read too).

## Open loans (Administration → Imports → Open loans, `/admin/imports/loans`, administrators, once)

| Group | Columns |
|---|---|
| required | `card_number`, `barcode` |
| optional | `issued_on` (missing → today), `due_on` (missing → computed as at the desk, with the loan rules and the calendar) |

| File | Content |
|---|---|
| `loans-sample.csv` | `card_number;barcode;issued_on;due_on`, the second loan without dates |
| `koha-issues.sql` | extracts the loans running in Koha on the day of the switch |

Every card number and barcode must already exist (import patrons and catalogue first); a copy
already on loan, a withdrawn copy, a date in the future or a due date before the issue date are
errors; loans already overdue are imported and reported, and so are copies of books still to
classify. The loans keep their original dates.

## Migration order from Koha

1. Students: `koha-students.sql` → Imports → Students (cards stay valid).
2. Teachers: `koha-teachers.sql` → Imports → Teachers.
3. Catalogue: `koha-biblio-items.sql` → Imports → Catalogue.
4. Open loans: `koha-issues.sql` → Imports → Open loans.
5. Photos: `koha-patron-images.sql` and the shell loop in its header write one file per patron
   (`<card number>.jpg`); import them from Imports → Patron photos (a ZIP archive, or the
   files copied into `DATA_DIR/imports/photos/`) or with
   `bun run patrons:import-photos <folder|file.zip> [--replace]`. Files that match no card are listed;
   photos already present are kept unless "Replace the photos already present" / `--replace`.

The queries are written for the current Koha schema: the school runs two Koha versions, so check
the column names against the one being migrated before running them (the admin guide says how).

The administrator's exports (Administration → Exports) write students, teachers, catalogue and
open loans in these same formats, so an exported file goes back in unchanged.
