# Import the catalogue

This guide explains how to load the books and copies into BiblioViva from a file, for example when leaving another
program. It is for whoever administers BiblioViva and is usually done once, at the start.

- Time: 30 minutes to two hours, depending on the size of the catalogue and how clean the file is.
- Account: `admin`. Another account can import the catalogue only if the role configuration grants it the **Import
  catalogue** permission.
- Requirements: the catalogue in a spreadsheet, with one row for each copy, or a MARC file exported by another library
  program.

BiblioViva checks the whole file before writing anything and imports only if there are no errors: there are no
half-done imports. The file is a *CSV*, that is a text file with one row per copy and the data separated by `;`, `,` or
tab; every spreadsheet can save one. The data of the book (title, author, publisher…) are repeated on the rows of its
copies. A MARC file is uploaded the same way: see [Load a MARC file](#load-a-marc-file).

## Procedure

### Prepare the file

1. Press **Administration**, then **Imports**, then **Catalogue**. The **Import the catalogue** page opens.
1. In the **The template of the file** box choose the columns and press **Download the template**. The file contains
   only the header row.
1. Open the template with a spreadsheet and write one row for each copy.
1. Save the sheet in CSV format.

The column names are in English and must be left as in the template. The main ones:

| Column | Content | Group |
|---|---|---|
| `title`, `author`, `publisher` | title, author (`Last name, First name`), publisher | required |
| `biblio_key` | the book's code in the old program: keeps the copies of the same book together | key |
| `barcode` | the barcode already on the copy | key |
| `classification` | the code of the genre (fiction) or of the subject (non-fiction) | optional |
| `reading_level` | the reading level (fiction) | optional |

Also optional are `isbn`, `subtitle`, `publication_place`, `publication_year`, `physical_description`, `series`,
`series_number`, `subjects`, `notes`, `call_number` (the call number, which BiblioViva computes: see below), `item_type` (the material: book, DVD…, one per title), `status`,
`not_for_loan` (`sì` for reference copies; `consultazione` in `item_type` also makes the copy a reference copy, without being the title's material), `acquisition_date` (`YYYY-MM-DD` or `DD/MM/YYYY`), `item_notes`, `inventory_number` (the inventory number), `origin`, `value` (the value in euro, `12.50` or `12,50`) and `accessible_formats` (the title's accessible formats) and others:
the complete list is in the **The template of the file** box. The status is written `available`, `lost`, `damaged`,
`in_repair` or `withdrawn`; the Italian words (disponibile, perso, danneggiato, in riparazione, ritirato) are accepted.

The columns `inventory_number`, `origin` and `value` concern the school inventory and are imported even while the
inventory is switched off: nothing of the file is lost, and the values appear when it is switched on. An inventory
number belongs to one copy only: the check refuses a number written twice in the file and a number already given to a
copy of the catalogue.

The column `accessible_formats` holds the title's accessible formats, separated by semicolons (for example
`Audiobook; Large print`), as in the **Accessible formats** list of the Configuration. The names are compared with the
list ignoring upper and lower case and accents. A format that is not in the list is an error of the row: the import
stays blocked until the file or the list is corrected.

The keys can be left out. Without `biblio_key` the copies of the same book are grouped by ISBN; without `barcode`
BiblioViva generates the code of each copy and at the end the labels are printed. A book without `classification` is
imported all the same, but it ends up in the **To classify** list and its copies cannot be lent until someone
classifies it.

The `call_number` column is not copied as it is: BiblioViva computes the call number of each copy from the scheme chosen
in **Administration** → **Configuration** → **Classification** (see [Change the classification and the reading
levels](classification.md#choose-how-the-call-number-is-made)). With the end "Author's initials, editable per title"
the title takes from the file the part after the classification, the most frequent among its copies. With the order
"Free: typed on each copy" each copy keeps the call number of the file.

> [!NOTE]
> The barcode of a copy cannot have the form of a card number: copies and cards can never be confused (see
> [Choose the barcode formats](barcode-formats.md)).

### Upload the file

1. In the **File** step, in the **CSV or MARC file** field, choose the file and press **Upload**.
1. In the **Columns** step check that each column is matched to the right field. Columns with the names of the template
   are recognised automatically; for the others choose the field in the menu, or **— ignore —** to leave them unused.
   The choice is remembered for the next import.
1. Read the warnings under the columns: if the keys or the classification are missing, the page says what will happen.
1. If the author or the publisher is missing in some rows, tick the box "Special values when the author or the publisher
   is missing": in the empty fields BiblioViva writes `Anonimo` and `s.n.`, as in cataloguing. Without the tick those
   rows are errors.
1. Press **Check the file**.

### Check the file

1. In the **Check** step read the **Result** column of each row: **New**, **Update**, **Unchanged** or **Error**. The
   **Details** column explains the errors. To see only the rows to correct tick **Show errors only**.
1. Above the rows the page summarises the new titles and those already in the catalogue, the copies that will receive a
   new code and the titles to classify.
1. If copies of the same book have different reading levels, the page asks whether to switch on the level per copy.
   Press **Yes, level per copy** to keep the level on each copy: the choice applies to the whole catalogue and moves
   the level of the books already present onto their copies. Press **No, they are errors to fix** to correct the file.
1. If the copies of one new title have different materials, the page asks **Copies of one title with different
   materials**, in a yellow box. Press **Yes, the most frequent material** so that each title takes the material of most
   of its copies. Press **No, they are errors to fix** to correct the file. Copies added to a title already in the
   catalogue keep the material of that title.
1. If some copies have in the file a call number other than the computed one, the page asks **Copies with a call number
   other than the computed one**. Press **Yes, the computed call number** so that those copies take the computed call
   number: their labels go back among those to print. Press **No, they are errors to fix** to correct the file.
1. If there are errors, correct the file, press **Back to the columns**, upload it again and check once more. With even
   one error **Import** stays off.

### Import

1. Press **Import**. BiblioViva writes everything at once. The **Completed** step summarises the numbers: new titles,
   copies added, titles already present, copies skipped.
1. If some copies had no barcode, press **Print the labels of the copies without a barcode**: see
   [Print book labels](../../manual/guides/print-book-labels.md).
1. Press **Go to the catalogue** to check the books.

### Load a MARC file

The catalogue can also be imported from a MARC file, the format in which library programs (Koha, SebinaNEXT, Clavis, the
SBN catalogue) exchange records, and in which BiblioViva itself exports the catalogue. ISO 2709 files (`.mrc`, `.marc`,
`.iso`) and MARCXML files (`.xml`) are accepted, in UNIMARC or in MARC 21. Nothing has to be chosen: BiblioViva
recognises the kind from the file. The files must be in UTF-8, as Koha and SBN write them; an old MARC-8 file is not
accepted.

1. In the **File** step, in the **CSV or MARC file** field, choose the MARC file and press **Upload**.
1. In the **Columns** step read, next to the file name, the line that summarises the content, for example "120 rows (one
   per copy) · MARC 21 · MARCXML file".
1. Check the columns, already matched because BiblioViva turns the file into the same rows as a CSV, with the header of
   the English names, and go on as for a CSV: the check and **Import** do not change.

All the rules of the CSV import hold: BiblioViva checks the whole file, asks the same questions (copies of one title with
different reading levels or materials, call numbers other than the computed ones), offers the special values for a
missing author or publisher, enables **Import** only with no errors, writes everything at once and keeps the original
file.

The row numbers of the check are those of the list "one per copy", not lines of the file: row 1 is the first copy of the
first record.

What is read from a file of another program:

- of the title: title, subtitle, responsibility, author, publisher, place and year of publication, ISBN, ISSN, EAN,
  physical description, series and number, Dewey class, subjects, notes and the original title of a translation. With
  three or more personal authors the author is "AA. VV."; with none it is "Anonimo". Of the series, the book's own is
  read, not the publisher's;
- of the copies, from field 952 (MARC 21) or 995 (UNIMARC): barcode, call number, material and the collection code, which
  BiblioViva reads as the classification (the code of a genre or a subject, as in the `classification` column of the
  CSV). From field 952 the acquisition date, the volume, the notes, the exclusion from loan, the status (lost, damaged,
  withdrawn), the inventory number, the origin and the value are read too.

The barcodes are recognised according to the library's formats, so the codes of old systems keep working.

A record without copies gives a row without a barcode: the import creates one copy with a generated code, as for a CSV
row without `barcode`. A record of the SBN catalogue has neither copies nor classification: its titles go to the **To
classify** list.

A file exported by BiblioViva itself (the **Export** menu of the [Catalogue](../../manual/screens/catalog.md#export)) is
read back with all the data, because it carries two local fields, which other programs ignore.

## Result

The books and copies are in the catalogue. Copies with a barcode already on the copy keep the labels they have; the
others have a new code, to be printed. Books without classification are in the **To classify** list: see
[Classify books](../../manual/guides/classify-books.md). The original file stays stored on the BiblioViva
computer. Importing the same file twice does not create duplicates: copies already present are skipped.

## Possible problems

### The classification is not in the configuration

"Classification not in the configuration" appears: the code written in `classification` is neither a genre nor a
subject. Correct the file or add the code: see [Change the classification and the reading levels](classification.md).

### The barcode belongs to another copy

"Barcode … already belongs to another copy in the catalogue" appears: the same barcode is on two different books.
Correct the code in the file.

### The inventory number is already used

"Inventory number already used on line N" appears (the number is written twice in the file), or "The inventory number … already belongs to another copy in the catalogue". Correct the number in the file.

### The accessible format is not in the list

"Accessible format not in the configuration: “Braille”" appears (the name is the one written in the file): a name in `accessible_formats` is not among the formats of the **Accessible formats** list. Correct the name in the file or add it to the list, in **Administration** → **Configuration** → **Catalogue**, and check again.

### The author or the publisher is missing

"The author is missing" or "The publisher is missing" appears: fill in the cell or tick the special values.

### The ISBN is not valid

"Invalid ISBN" appears: correct the ISBN or leave the cell empty.

### The copies of a title have different materials

"Copies of different materials (…): answer the question below" appears or, after **No, they are errors to fix**, "Copies
of different materials (…): a title has one material only": in the file the rows of the same book carry different
materials in `item_type`, but a title has one material only. Answer **Yes, the most frequent material** or correct
`item_type` in the file, making it the same on all the rows of the book, and check again.

### The copies have a call number other than the computed one

"Call number in the file …, computed …: answer the question below" appears or, after **No, they are errors to fix**,
"Call number in the file … other than the computed …": the call number written in `call_number` does not match the one
BiblioViva computes from the scheme. Answer **Yes, the computed call number**, or correct `call_number` in the file, or
change the scheme in the classification (with the order "Free: typed on each copy" the file is kept as it is), and check
again.

### Every copy is already in the catalogue

"Every copy in the file is already in the catalogue: there is nothing to import." appears: the file has already been
imported.

### The catalogue comes from Koha

The catalogue is extracted with a ready-made query; the file it produces is separated by tabs and must be uploaded as
it is: see [the technical instructions](../../../import/README.md). The names of Koha's columns change from one
version to another: whoever runs the query checks them first. Alternatively Koha exports the records in MARC 21 and the file is uploaded as
described in [Load a MARC file](#load-a-marc-file).

## Related pages

- [Import the open loans](import-loans.md)
- [Change the classification and the reading levels](classification.md)
- [Choose the barcode formats](barcode-formats.md)
- [Catalogue a new book](../../manual/guides/catalog-a-new-book.md)
- [Imports](../screens/imports.md)
