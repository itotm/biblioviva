# Withdraw a lost or damaged copy

This guide explains how to record in BiblioViva that a copy is lost, damaged, under repair or definitively taken off the
shelf (withdrawn), for a single copy or for many together. It is for whoever catalogues the books.

- Time: about 1 minute for one copy.
- Account: "Cataloguing" (also "Administration").
- Requirements: the code of the copy, which is on the label of the book (if the book is missing, the copy is found from
  the record of the book, see [Find a book](find-a-book.md)).

The copy is not deleted: it changes status and stays in the archive for the whole life of the catalogue. With the status
**Withdrawn** the copy keeps the day of the withdrawal and the reason on itself, and the record of the book shows them
under the status ("Withdrawn on" with the date and the reason); the reason also stays in the audit log for the months
set in **Months of the audit log** (24 by default). The statuses are these:

- **Available**: the copy is on the shelf and can be lent.
- **Lost**: the copy cannot be found. It is not lent.
- **Damaged**: the copy is spoiled but is still lent; to stop it choose **In repair**.
- **In repair**: the copy is off the shelf to be fixed. It is not lent.
- **Withdrawn**: the copy has been taken out of the library. It is never lent, not even by forcing the loan. When all the
  copies of a book are withdrawn, the book disappears from the catalogue searches.

## Procedure

### Change the status of a copy

1. Open the record of the book from **Catalogue**, see [Find a book](find-a-book.md).
1. In the **Copies** tab find the row of the copy by its **Barcode**.
1. Press the wrench icon on the row of the copy (the tooltip says "Status of copy …"). The window opens with the code of
   the copy in the title.

   <!-- figure: catalog/item-status-dialog | The window to change the status of a copy -->

1. In **New status** choose **Lost**, **Damaged**, **In repair**, **Withdrawn** or **Available**.
1. In **Reason (optional, recorded)** write why, for example "lost by a pupil" or "torn pages". The reason stays in the
   operations log of that copy, for the months set.
1. Press **Change status**. A notice confirms "Status updated" and the row shows the new status.

A copy on loan can be marked **Lost**: the loan is closed and the copy is shown as lost, also in the patron's record. A
copy on loan cannot be withdrawn: "The copy is on loan: record the return first." appears. Record the return at the
desk and then withdraw the copy.

### Change the status of many copies at once

To withdraw many copies in one go, for example after a check of the shelf, the selection of the catalogue is used.

1. Open **Catalogue** and search for the books concerned, see [Find a book](find-a-book.md).
1. Select the books with Ctrl + click (or Shift + click for a group) on the rows.
1. Press **Change the copies of the selection**. The **Change the copies** window opens, which says on how many copies it
   works.
1. In **What to change** choose **Status**.
1. In **New value** choose the status, for example **Withdrawn**.
1. Write the **Reason**: it is required for lost and withdrawn copies.
1. Press **Check**. The window says how many copies change and which stay as they are: the copies on loan stay as they
   are until they are returned.
1. Press **Apply to N copies**. A notice confirms "N copies changed".

### Put a copy back into service

1. Open the record of the book and press the wrench icon on the row of the copy.
1. In **New status** choose **Available** and press **Change status**.

A lost copy that turns up again can also be returned at the desk with **Returns**: it becomes available by itself.

### Delete a copy entered by mistake

Deletion is only for cataloguing mistakes and only for a copy that was never lent.

1. Press the trash icon on the row of the copy.
1. In the "Delete copy …?" window press **Delete copy**. A notice confirms "Copy deleted".

## Result

The copy shows the new status on the record of the book and is not lent (unless **Available** or **Damaged**). The
**Withdrawn** status also removes the copy from the "N available of M" count of the book. The reason and who changed the
status stay in the log. The list of the copies withdrawn in a period is the report **Copies withdrawn in the
period** in the **Books** category of the **Reports**, see [Reports](../screens/reports.md).

## Possible problems

### The copy is on loan

"The copy is on loan: record the return first." appears: a copy on loan cannot be withdrawn. Record the return, see
[Return a book](return-a-book.md), then change the status.

### The copy has recorded loans

"The copy has recorded loans: withdraw it instead of deleting it." appears: a copy already lent cannot be deleted, so as
not to lose the history. Choose **Withdrawn**.

### A withdrawn book is no longer found in the catalogue

Tick **Also show withdrawn books**, see [Find a book](find-a-book.md).

### A copy is refused at the desk

At the desk a copy is refused with "… is … and cannot be lent": the copy has a status that does not allow the loan. Open
the record of the book and check the status: if the book is back on the shelf choose **Available**.

### Many copies show as lost after the stocktaking

The copies not read when the stocktaking is closed are marked **Lost**; see [Do the stocktaking](stocktaking.md) for how
to undo the closing within a week.

## Related pages

- [Do the stocktaking](stocktaking.md)
- [Return a book](return-a-book.md)
- [Find a book](find-a-book.md)
- [Book record](../screens/book-record.md)
