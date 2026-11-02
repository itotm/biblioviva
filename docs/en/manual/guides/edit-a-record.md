# Correct a book record

This guide explains how to correct the data of a book already in the catalogue (title, author, series,
classification…), how to change the data of a single copy and how to delete a record entered by mistake. It is for
whoever catalogues the books.

- Time: about 2 minutes.
- Account: "Cataloguing" (also "Administration").
- Requirements: the book, to compare the data with the title page.

## Procedure

### Correct the data of the book

1. Open the record of the book from **Catalogue**, see [Find a book](find-a-book.md).
1. Press **Edit**. **Edit record** opens, with the title of the book under the heading.

   <!-- figure: catalog/edit-record | The Edit record page with the data of the book -->

1. Correct the fields. In the **Record** section: **Title**, **Subtitle**, **Original title**, **Author**, **Statement of
   responsibility (as on the title page)**, **Series** and **Number in the series**. In the **Publication** section:
   **Publisher**, **Place**, **Year**, **ISBN**, **EAN (not an ISBN)**, **Physical description** and **Material**. The material (book, DVD, magazine…) is one for
   the book and applies to all its copies; if the material is excluded from loans, all the
   copies are not lent. A single copy is kept from loans with **Reference only (not lent)**, in the data of the copy.
1. To correct subjects, notes or Dewey number open the **More** section.
1. To change the classification correct it in the **Classification** section; see below for the call numbers.
1. Press **Save changes**. The record of the book opens again, with the new data. **Cancel** leaves everything as it
   was.

### Change the data of a copy

A copy has data of its own, distinct from those of the book: **Call number**, **Level of the copy**,
**Volume / number**, **Acquisition date**, **Notes on the copy** and **Reference only (not lent)**.

1. If the book has a single copy, the "Copy …" section is at the bottom of the **Edit record** page: its data are
   changed there and saved together with the record.
1. If the book has several copies, open the record of the book and press the pencil icon on the row of the copy (the
   tooltip says "Edit copy …"). A window opens with the same fields.
1. Correct the fields and press **Save**. A notice confirms "Copy updated".

To change the same datum on many copies, for example the acquisition date, select the books in
**Catalogue** and press **Change the copies of the selection**: see [Withdraw a lost or damaged
copy](withdraw-a-copy.md#change-the-status-of-many-copies-at-once), where the tool is described. The same button also
changes the material of many books at once, by choosing **Material** in **What to change**: the material belongs to the book, so
it changes for all its copies.

### After changing the classification or the call number

Correcting the classification in the **Edit record** page does not rewrite the call numbers of the copies already
created. To rewrite them, and to put the spine bands back among the labels to print, use **Reclassify**, see [Classify
books](classify-books.md). If the call number of a copy is changed by hand, BiblioViva puts the spine band and the
barcode label back among the labels to print by itself, as after **Reclassify**: the copy reappears in the **Books
without labels** panel of the Dashboard and they are printed again as described in [Print book
labels](print-book-labels.md).

### Delete a record entered by mistake

1. Open the record of the book.
1. If the book has copies, first delete the copies entered by mistake with the trash icon on their row. A copy already
   lent cannot be deleted: it must be withdrawn, see [Withdraw a lost or damaged copy](withdraw-a-copy.md).
1. Press **Delete record** (in the menu of the other actions if the window is narrow).
1. In the "Delete the record …?" window press **Delete record**. A notice confirms "Record deleted".

## Result

The record of the book shows the corrected data, also in the pages that list it. The barcode of the copies and the loans
already recorded do not change.

## Possible problems

### The ISBN is already used by another record

Saving says "A record with this ISBN already exists": another record has that ISBN, and the book was probably
catalogued twice. Open the other record, add the copies there and remove the duplicate record.

### Invalid ISBN, ISSN or EAN

"Invalid ISBN (check the digits)", "Invalid ISSN" or "Invalid EAN" appears: the digits do not add up. Compare them
with the book and correct them, or leave the field empty.

### The year is implausible

"Implausible year" appears: write a year between 1450 and next year, or leave the field empty.

### Author or publisher is empty

Author or publisher cannot be left empty: use "Anonimo", "AA. VV.", "s.n." or "s.l." under the fields, see
[Catalogue a book without an ISBN](catalog-without-isbn.md).

### The record still has copies

"The record still has N copies: withdraw or delete them first." appears: the record cannot be deleted while it has
copies. Follow the second point of the last procedure.

### The copy has recorded loans

"The copy has recorded loans: withdraw it instead of deleting it." appears: a copy already lent stays in the loan
history: change the status to **Withdrawn**.

## Related pages

- [Find a book](find-a-book.md)
- [Classify books](classify-books.md)
- [Withdraw a lost or damaged copy](withdraw-a-copy.md)
- [Add the cover](add-a-cover.md)
- [Book record](../screens/book-record.md)
