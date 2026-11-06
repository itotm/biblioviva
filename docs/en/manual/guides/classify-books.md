# Classify books

This guide explains how to give a book its genre or subject and, for fiction, its reading level: the call number, the
pictogram on the spine band and the shelf depend on this choice. It is for whoever catalogues the books, both when
saving and later, for the books saved with **Classify later**.

- Time: about 30 seconds per book.
- Account: "Cataloguing" (also "Administration").
- Requirements: the book, or at least title, author and subjects of the record.

The choice is one of two ways:

- fiction: a genre is chosen (a letter, for example `B`) and, if the library uses it, a reading level (for example
  `4`);
- non-fiction: a subject is chosen (a number like the Dewey ones, for example `590`), looking for it in two levels:
  first the main subject, then a more precise subject.

The call number is the code printed on the label and on the spine band, which says where the book goes. BiblioViva
computes it by itself from the classification, the reading level and the first three letters of the author's surname:
it is not typed whole. Examples: `B 4 DEL` is a novel of
genre B, reading level 4, by an author whose surname starts with DEL; `B DEL` is the same book in a library that does
not use levels; `590 ROS` is a non-fiction book of subject 590 by an author whose surname starts with ROS.

If the author is "Anonimo" or "AA. VV." the first three letters of the title are used, skipping a leading article:
"Gli animali della fattoria" becomes `590 ANI` and "Enciclopedia dei ragazzi" becomes `030 ENC`. All the copies of a book
have the same call number; the exception is the reading level when it is on each copy, because then each copy carries its
own. The form depends on the scheme the library has chosen (for example with the level before the genre, `4 B DEL`), see
[Change the classification and the reading levels](../../admin/guides/classification.md). A book not yet classified has no call number: it gets one when it is classified.

The reading level is a code the library chooses for novels (in the starting configuration from `1` to `5`) and does not
match the patron's class. If the level is assigned to each copy and not to the book, it is chosen in the form of the
copies, see [Add a copy to a book already in the catalogue](add-a-copy.md).

## Procedure

### Classify while cataloguing

1. In the form of the record find the **Classification** section.
1. Under "What kind of book is it?" press **Fiction** or **Non-fiction**.

   <!-- figure: catalog/classification-picker | The classification picker in the form of the record -->

1. For fiction choose the genre under "Pick the genre": each genre is a tile with the pictogram, the letter and the
   name.
1. For fiction also choose the **Reading level**, if it appears. **None** leaves the book without a level.
1. For non-fiction choose the main subject under "Pick the subject". If it has more precise subjects the list "Subjects
   of …" opens: choose one. To stop at the main subject press "Use … in general". To go back press **Back to the main
   subjects**.
1. If the record has a Dewey number, BiblioViva suggests the subject by itself ("Subject proposed from Dewey number
   …"): check it and change it if needed.
1. If it is not yet known how to classify the book press **Classify later**: the book goes to the list "To classify".
   Its copies are not lent and the spine band is not printed until it is classified.

### Classify the books set aside

1. Open **Catalogue** and then the **To classify** tab. The list shows, oldest first, the books without classification,
   with the number at the top ("N books to classify"). The number is also in the **Books to classify** panel of the
   **Dashboard**.

   <!-- figure: catalog/to-classify-list | The list of the books to classify -->

1. Press **Start classifying**. **Classify the book** opens on the first book of the list. To start from a specific book
   press its row, or **Classify** on its record.
1. Read title, author, publisher, subjects and notes of the book, with the cover if there is one. If the record has a
   Dewey number, "The Dewey number … points to the subject …" appears and the subject is already selected.
1. Choose genre or subject as above. As soon as the choice is made the **Call number of the copies** that the copies
   will receive appears.
1. Press **Save and next**. The notice "… classified" appears and the next book opens.
1. If the book cannot be classified press **Skip**: the book stays in the list.
1. At the end "There are no more books to classify in this round." appears. Press **Back to the list**.

### Change the classification of many books together

1. Open **Catalogue** and search for the books to reclassify, see [Find a book](find-a-book.md).
1. Select the books with Ctrl + click (or Shift + click for a group) on the rows.
1. Press **Reclassify**. The "Reclassify the selected titles" window opens.
1. Choose the **Kind**, then the **Genre** or the **Classification** and, for fiction, the **Level**.
1. Press **Check**. The window says how many titles change.
1. Press **Reclassify** followed by the number of titles. A notice confirms "… titles reclassified, … call numbers
   rewritten": the call number of the copies follows the new classification. The spine bands (and the labels, if the call
   number has changed) go back among those to print: see
   [Print book labels](print-book-labels.md).

## Result

The book has a genre or a subject, shown on the record and in the **Classification** column of the **Catalogue**, and
its copies have the call number. A book just classified can be lent and its spine band can be printed.

## Possible problems

### The genre or the subject is missing

"Pick the genre" or "Pick the subject" appears: saving requires the choice. Choose a genre or a subject, or
**Classify later**.

### The reading level does not appear

The library does not use levels, or assigns them to each copy (see above). The administrator decides in
[Change the classification and reading levels](../../admin/guides/classification.md).

### A book finds no place among the genres or subjects

Choose the closest one and make a note of it. The list of genres and subjects is edited by the administrator.

### A record already classified must be moved

The call number of the copies follows the classification: correct it in **Edit record**, or for many books together
with **Reclassify** as above. The spine bands go back among those to print.

### The book is already classified

"This book is already classified." appears: someone else has classified it in the meantime. Press **Skip**.

## Related pages

- [Catalogue a new book](catalog-a-new-book.md)
- [Correct a book record](edit-a-record.md)
- [Print book labels](print-book-labels.md)
- [To classify](../screens/to-classify.md)
- [Change the classification and the reading levels](../../admin/guides/classification.md)
