# Import the catalogue

This guide explains how to load the books and copies into BiblioViva from a file, for example when leaving another
program. It is for whoever administers BiblioViva and is usually done once, at the start.

- Time: 30 minutes to two hours, depending on the size of the catalogue and how clean the file is.
- Account: `admin`. Another account can import the catalogue only if the role configuration grants it the **Import
  catalogue** permission.
- Requirements: the catalogue in a spreadsheet, with one row for each copy.

BiblioViva checks the whole file before writing anything and imports only if there are no errors: there are no
half-done imports. The file is a *CSV*, that is a text file with one row per copy and the data separated by `;`, `,` or
tab; every spreadsheet can save one. The data of the book (title, author, publisher…) are repeated on the rows of its
copies.

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
`not_for_loan` (`sì` for reference copies; `consultazione` in `item_type` also makes the copy a reference copy, without being the title's material), `acquisition_date` (`YYYY-MM-DD` or `DD/MM/YYYY`), `item_notes` and others:
the complete list is in the **The template of the file** box. The status is written `available`, `lost`, `damaged`,
`in_repair` or `withdrawn`; the Italian words (disponibile, perso, danneggiato, in riparazione, ritirato) are accepted.

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

1. In the **File** step, in the **CSV file** field, choose the file and press **Upload**.
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
version to another: whoever runs the query checks them first.

## Related pages

- [Import the open loans](import-loans.md)
- [Change the classification and the reading levels](classification.md)
- [Choose the barcode formats](barcode-formats.md)
- [Catalogue a new book](../../manual/guides/catalog-a-new-book.md)
- [Imports](../screens/imports.md)
