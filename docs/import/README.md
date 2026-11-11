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
| optional | `classification` (missing → the title goes to "To classify"), `reading_level`, `isbn`, `issn`, `ean`, `subtitle`, `original_title` (only for a translation), `responsibility`, `publication_place`, `publication_year`, `physical_description`, `series`, `series_number`, `dewey`, `subjects`, `accessible_formats`, `notes`, `call_number`, `item_type`, `enumeration`, `status`, `not_for_loan`, `acquisition_date`, `item_notes`, `inventory_number`, `origin`, `value` |

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

`inventory_number`, `origin` and `value` are the school inventory's columns (9.64,
`catalog.inventory.enabled`), read per copy and stored even while the inventory is switched off, so
nothing of the file is lost. `inventory_number` is unique: letters, digits and `. / -`, at most 20
characters; a number used twice in the file is an error ("Inventory number already used on line N")
and so is a number already given to a copy of the catalogue. `origin` is free text (the values of
`catalog.inventory.origins` are the choices of the forms). `value` is the value in euro, `12.50` or
`12,50`, not negative. The catalogue export writes the three columns, the value with a point
(`12.50`), so that a file exported can be imported again.

`accessible_formats` (9.66) holds the title's accessible formats, separated by semicolons
(`Audiolibro; Caratteri grandi`), matched to `catalog.accessibleFormats` ignoring case and accents and stored in
the order of that list. A name that is not in the list is an error of the row ("Accessible format not in the
configuration: “Braille”"), so the import stays blocked until the file or the list is corrected. The catalogue export
writes the column after `subjects`, the formats joined by `; `, so that a file exported can be imported again.

## Catalogue from a MARC file (same page, `/admin/imports/catalog`, step 9.65)

The catalogue import also takes a MARC file: ISO 2709 (`.mrc`, `.marc`, `.iso`) or MARCXML (`.xml`), UNIMARC or MARC 21.
The kind is recognised from the file itself (leader and fields), nothing is chosen. The file must be UTF-8 (Koha and SBN
write UTF-8); a MARC-8 file is not supported. The records are turned into the rows of the CSV import, one row per copy
with the title's fields repeated, under a generated header of the English column names, so the columns step has nothing
to map and everything above holds: the whole file is validated first, the same questions are asked (reading levels,
materials, segnature), the special values stand in for a missing author or publisher, "Import" needs zero errors, the
commit is one transaction and the original file is kept. The line under the file name reads "N rows (one per copy) ·
MARC 21 · MARCXML file". The row numbers of the preview are the rows of that list (one per copy), not lines of the file.
`biblio_key` is field 001 of the record (`marc-N` when it has none), so the copies of one record stay together.

**A file of another system** (no local field 959).

| Row column | UNIMARC | MARC 21 |
|---|---|---|
| `title`, `subtitle`, `responsibility` | 200 `$a`, `$e`, `$f` | 245 `$a`, `$b`, `$c` |
| `author` | 700, 701, 710 (the lookups' mapping, Appendix D) | 100 and 700; 110 when there is no 100 |
| `publisher`, `publication_place`, `publication_year` | 210 `$c`, `$a`, `$d` | 264 (second indicator 1, else the first 264, else 260) `$b`, `$a`, `$c` |
| `isbn`, `issn`, `ean` | 010, 011, 073 | 020, 022, 024 (first indicator 3) |
| `physical_description` | 215 `$a` | 300 `$a` |
| `series`, `series_number` | 461 `$a`, `$v` (the publisher's collana of 225 and 410 is left out, as in the SBN lookups) | 490 `$a`, `$v` (else 830) |
| `dewey` | 676 | 082 |
| `subjects` | 606 | 650 `$a` and `$x` |
| `notes` | 300 | 500 |
| `original_title` | 500 | 240 |
| `item_type` | 995 `$r` | 942 `$c` (the copy's 952 `$y` wins) |

Three or more personal authors give the special value for many authors (`catalog.specialAuthors[1]`, `AA. VV.`),
none gives `catalog.specialAuthors[0]` (`Anonimo`); a missing publisher gives `catalog.unknownPublisher`. In MARC 21 the
ISBD punctuation left at the end of a subfield (`/ : ; , =`) is removed. A record of SBN has no copies and no
collection code: one row without a barcode (a generated copy), and the title waits in "To classify".

The copies come from 952 (MARC 21) or 995 (UNIMARC), one row each:

| Row column | 952 (MARC 21) | 995 (UNIMARC) |
|---|---|---|
| `barcode` | `$p` | `$f` |
| `call_number` | `$o` | `$k` |
| `item_type` | `$y` | `$r` |
| `classification` | `$8` collection code | `$h` collection code |
| `acquisition_date` | `$d` | |
| `enumeration` (volume) | `$h` | |
| `item_notes` | `$x` non-public note | `$u` |
| `not_for_loan` | `$7` (any value from 1) | |
| `status` | `$0` withdrawn, `$1` lost, `$4` damaged | |
| `inventory_number`, `origin`, `value` | `$i`, `$e` (source of acquisition), `$g` (cost) | |

A barcode goes through the format table (`#lib/shared/scan.ts`), so legacy codes keep working. The collection code is
read as the CSV column `classification`: a genre code or a class code of BiblioViva's classification. A record without
copies gives one row without a barcode, and the import then creates one copy with a generated barcode, as for a CSV row
without `barcode`.

**A file of BiblioViva** (it has the local fields 959 and 958) comes back whole, read exactly as it was written, without
the clean-ups that the records of other systems need.

- 959, once per title: `$a` kind, `$g` genre, `$c` class, `$l` reading level, `$t` material, `$f` accessible format
  (repeated).
- 958, once per copy: `$f` barcode, `$k` call number, `$l` reading level, `$h` volume, `$s` status, `$n` not for loan
  (`1` or `0`), `$d` acquisition date, `$u` notes (one per line), `$i` inventory number, `$e` origin, `$g` value.

When a record has 958 fields, they are read instead of 952 or 995.

**The export** is the **Export** menu of three lists: the catalogue (the titles of the list with all their copies), a print
list of copies (its titles with only the copies of the list) and the missing copies of a stocktaking campaign (the titles
with only the missing copies). Four entries after CSV and ODS: MARC 21 ISO 2709 (`.mrc`), MARC 21 MARCXML (`.xml`),
UNIMARC ISO 2709 and UNIMARC MARCXML, named like the other exports (`catalog-<date>-<time>-marc21.mrc`). One record per
title, in UTF-8; the leader says UTF-8 and the kind of record, `001` is BiblioViva's record id, the UNIMARC `100` and the
MARC 21 `008` are built from the day the record was created. The title's fields are those of the table above (UNIMARC:
010, 011, 073, 100, 101 for a translation, 200, 210, 215, 300, 461, 500, 606, 676, 700; MARC 21: 008, 020, 022, 024, 082,
100, 240, 245, 264, 300, 490, 500, 650, 942), plus 959. An unknown author (`catalog.specialAuthors[0]`) is written as no
author at all. A note of several lines is one field per line.

The copies are written in 952 (MARC 21) with the subfields of the table above, flags `1` when they apply: `$p` barcode,
`$o` call number, `$y` item type, `$8` collection code (the genre, else the class), `$d` acquisition date, `$h`
enumeration, `$x` non-public note, `$7` not for loan, `$1` lost, `$4` damaged, `$0` withdrawn, `$i` inventory number, `$e`
source of acquisition, `$g` cost with a point. In UNIMARC they are written in 995 with `$f` barcode, `$k` call number,
`$r` item type, `$h` collection code and `$u` notes. [VERIFY at the Koha migration: the subfields of 995 in the school's
UNIMARC framework.] Each copy also has its 958. The withdrawal day and reason of a copy (9.64) are not exported, as the
CSV import has no column for them. Other programs ignore 958 and 959. The download is recorded in the audit log like
every export.

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
