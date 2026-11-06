# Return a book and lend another one at once

This page explains how to record the return of a book and the loan of the next one when the patron brings them
together to the desk. It is for staff at the circulation desk using the "Loan management" account.

- Time: less than a minute.
- Account: "Loan management" (also "Administration").
- Requirements: the returned book, the book the patron has chosen and the barcode scanner connected to the computer.
  The card is not needed: the patron is the one who had the book.

## Procedure

1. Open **Loans** from the side menu. The **Loans** page opens, with the **Card or patron's name** field ready to
   receive a scan.
1. Read the barcode of the returned book. The book is returned and the message “Returned: “`<title>`”. The books read
   now are lent to `<name>`.” appears. The field becomes **Scan the book** and the record of the patron who had the
   book appears on the right.

   <!-- figure: circulation/checkout-return-lend | The returned book and the patron who had it already chosen for the loan -->

1. Read the barcode of the book the patron has chosen. A message confirms the loan with the due date and the book
   enters the **Books lent now** list.
1. Read the other books, if there are any, one after the other.
1. Press **Done**. The page returns to the **Card or patron's name** field, ready for the next patron.

Alternatively start from **Returns**: after the return of a book, press **Lend to `<name>`** in the message. **Loans**
opens with the patron already chosen, ready to receive the next book.

<!-- figure: circulation/checkin-done | The returns with the Lend to button in the message of the last book -->

> [!NOTE]
> The patron stays chosen until another card is read, **Done** is pressed or the page closes by itself after the idle
> minutes set by the administrator.

## Result

The first book is no longer on loan and is available again; the next book is on loan to the same patron, with the due
date worked out by the loan rules. The return counts among the **Returned today** on the dashboard, like any other.

## Possible problems

### The returned book was overdue

Besides the green message, “Returned. “`<title>`” was `<n>` days overdue (due `<date>`).” appears. The delay is only
information: the return is recorded and the loan of the next book goes on.

### The returned book was marked as lost

The message [Lost book found](../screens/checkin.md#lost-book-found) appears too. The copy is available again and the
loan of the next book goes on.

### The patron has reached the loan limit

If after the return the patron still has the maximum number of books, the **Loan limit reached** window opens, as after
reading the card. See [Lend a book](lend-a-book.md#possible-problems).

### The book read is not on loan

An available book, read with no patron chosen, is not returned: “The book “`<title>`” is not on loan: to lend it, read
the patron's card first.” appears. Read the patron's card and then the book again. A book already returned today shows
the time of the return and nothing changes.

### The session closes by itself

After the idle time the page closes the operation and says so. Read the patron's card again to go on.

## Related pages

- [Lend a book](lend-a-book.md)
- [Return a book](return-a-book.md)
- [Loans](../screens/checkout.md)
- [Returns](../screens/checkin.md)
