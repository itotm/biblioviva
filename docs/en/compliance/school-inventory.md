# The school's inventory of assets

This page covers the rules on the inventory of the assets of schools, that is, the accounting regulation (Interministerial
Decree of 28 August 2018, no. 129, D.I. 129/2018), title III, articles 29 to 34, for the part that concerns the library's
books. It is written for the head teacher and for the school's administrative manager (DSGA), who keeps the inventory.

## What the rule asks

- The inventories (art. 31, paragraph 1). The school's assets are entered in separate inventories by category. One
  category is «libri e materiale bibliografico» (“books and bibliographic material”). The others are movable assets,
  assets of historical or artistic value, securities, vehicles and boats, and real estate.
- What is entered (art. 31, paragraphs 2 and 3). The movable assets of the first four categories, books included, are
  entered in chronological order, with a progressive and uninterrupted numbering and with all the elements that
  establish their origin, the place where they are, the quantity or number, the state of conservation, the value and
  any income. Each object bears the progressive number under which it is entered. The value (art. 32) is the invoice
  price for the assets purchased, the cost price for those produced in the institution, the estimated price for those
  received as gifts.
- What is not entered (art. 31, paragraphs 5 and 6). Consumables and movable assets worth two hundred euro or less, VAT
  included, are not inventoried, unless they are elements of a set of assets of higher value. Periodicals and other
  serial publications are not inventoried either, nor are the books intended for the class libraries; they must,
  however, be kept in the ways of use or with the arrangements provided by the institution's regulation. Each school
  approves, with a resolution of the school board (Consiglio d'istituto), its own regulation for the management of
  assets and inventories, which also contains the rules for the assets that are not inventoried (art. 29, paragraph 3).
  The rule does not say whether and how a set of books of a school library, whose total value exceeds two hundred euro,
  is entered by title, by copy or by lot: the school's regulation establishes it.
- The changes (art. 31, paragraph 7). Every change, increase or decrease, of the inventoried assets is noted in
  chronological order in the inventory.
- Who keeps it (art. 31, paragraph 8; art. 30). The inventory is kept and looked after by the DSGA, who has the
  responsibilities of the custodian (consegnatario), that is, of whoever keeps and manages the assets.
- The physical verification (art. 31, paragraph 9). At least every five years the assets are physically verified
  (ricognizione), and at least every ten years the inventories are renewed and the assets revalued.
- The write-off (art. 33). Material that is missing through theft or force majeure, or has become unusable, is removed
  from the inventory with a decision of the head teacher. The decision states the duty of replacement at the expense of
  those responsible, or that it has been ascertained, with adequate reasons, that there are no causes of administrative
  liability. Attached to it is a copy of the report to the public security authority, if the material is missing through
  theft, or the minutes of the committee referred to in art. 34, if it has become unusable. For assets missing through
  theft or force majeure the DSGA's report on the circumstances of the theft or loss is attached as well.
- The transfer of assets no longer in use (art. 34). Assets that can no longer be used are transferred with a decision of
  the head teacher, following a notice published on the school's website; the write-off decision records the sum paid.

## What BiblioViva does

BiblioViva is a catalogue and a loan system for the library. It is not the school's inventory register and does not
replace it. With the **School inventory** switched on it does record, for each copy, the data that the school office
enters in the register (inventory number, origin, value), and it provides the lists of the copies entered and withdrawn
in a period. On this page «the school inventory» is the accounting inventory of art. 31; «the shelf inventory» is the
check of the copies on the shelf, run with the campaigns of the **Stocktaking** page of the **Catalogue**.

### The school inventory

The school inventory is optional and is off by default. The administrator switches it on in **Administration**,
**Configuration**, section **Catalogue**, in the group «School inventory», with the switch **School inventory**; in the
same group the list **Origins** (one per line) holds the choices offered for the origin of a copy (by default Purchase,
Gift, Other). Switching it off deletes nothing: the fields and the column disappear from the pages, the values stay and
come back when it is switched on again.

### What it records for each copy

- The barcode of the copy, which identifies it uniquely.
- The acquisition date, optional (**Acquisition date**), which can be changed from the record and for many copies
  together.
- The call number, the status (**Available**, **Lost**, **Damaged**, **In repair**, **Withdrawn**), the copy's notes
  and, for periodicals, the designation of the issue.
- The material of the title (book, DVD, magazine…), according to the library's **Materials** list.
- With the school inventory on, three more items: the **Inventory number**, the **Origin** and the **Value (€)**.
- With the status **Withdrawn**, the day of the write-off and the reason.

The **Inventory number** is unique: BiblioViva refuses a number already given to another copy. It is written with
letters, digits and the signs `.`, `/`, `-`, up to 20 characters. When copies are added BiblioViva proposes the number
after the highest one made of digits only (numbers with letters, kept from an earlier register, do not count; leading
zeros are kept: after `000123` comes `000124`), and the number can be changed or emptied. The numbering is proposed, not
imposed: that it is progressive and uninterrupted, as art. 31, paragraph 2 asks, is checked by the school. The **Value
(€)** is the price or the estimated value, for example 12.50; the school sets it according to art. 32.

BiblioViva does not keep the chronological register of changes of art. 31, paragraph 7, and does not produce the
inventory in the form of the register. The purchase accounting documents stay in the school's accounts.

### Withdrawing a copy

A copy that has been lent is not deleted: when it leaves the library it is marked **Withdrawn**, from its record or, for
many copies together, from **Change the copies of the selection** in the **Catalogue**. The **Reason** is optional for a
single copy and required when many copies are withdrawn together. A copy on loan cannot be withdrawn. A withdrawn copy
is never lent and does not count among those expected on the shelf in the stocktaking campaigns. The procedure is in the
guide [Withdraw a lost or damaged copy](../manual/guides/withdraw-a-copy.md).

Where the trace of the withdrawal stays:

- The copy stays in the catalogue with the status **Withdrawn**, in the book's record. A book with all its copies
  withdrawn disappears from the searches of the **Catalogue** and comes back with **Also show withdrawn books**.
- The copy keeps the day of the withdrawal and the reason on itself, with or without the school inventory: the table of
  the copies shows them under the status («Withdrawn on» followed by the date and the reason). If the copy goes back to
  another status, the day and the reason are cleared.
- The change of status, with the reason, the account and the time, is also a row of the **Audit log**, which the
  administrator consults, filters by **Action** and by dates, and exports. The rows older than the number of months
  chosen (24 by default) are deleted (setting **Months of the audit log**); the list of the copies withdrawn does not
  depend on the log and covers any period.

### The lists for the inventory

Two reports of the **Books** category of the **Reports**, with the parameters **From** and **To** (by default the start
of the school year and today), are printed and exported as CSV or ODS like every report:

- **Copies withdrawn in the period**: the copies withdrawn between the two dates, with **Inventory number**, **Copy**,
  **Title**, **Author**, **Withdrawn on**, **Reason**, **Origin** and **Value (€)**. It is the list to attach to the
  head teacher's write-off decision (art. 33).
- **Copies entered in the period**: the copies acquired between the two dates, in the order of the inventory number, with
  **Inventory number**, **Copy**, **Title**, **Author**, **Publisher**, **Year**, **Acquired on**, **Origin** and
  **Value (€)**. It is what the school office enters in the inventory register (art. 31, paragraph 7: the increases).

Two other reports: "Acquisitions by year" counts the copies that entered the library each year (it uses the acquisition
date, and the date the copy was entered when the former is missing); "Lost, damaged or in-repair copies" lists the
copies in those statuses and does not include the withdrawn ones.

### The shelf inventory campaigns

The **Stocktaking** page of the **Catalogue** runs the checking campaigns: every copy on the shelf is read with the
barcode scanner, and at closing the copies never read are marked **Lost**. A campaign lasts as long as needed, even
several days; it reports the copies out of place, the ones found again and the ones on loan, which do not count among
the missing. The list of the copies still to be found can be downloaded as CSV or ODS, with the code, the call number and
the title of each; with the school inventory on, the list shows «Inv.» and the number next to each copy and the export
has the **Inventory number** as its first column. At closing the page shows the summary: copies seen out of those
expected, marked lost, found again, on loan, out of place. The procedure is in the guide
[Do the stocktaking](../manual/guides/stocktaking.md).

The campaign ascertains which copies of the catalogue are on the shelf: the list of the missing copies, with the
inventory number, serves the physical verification, at least every five years, of art. 31, paragraph 9. The campaign is
not, however, a write-off decision: marking a copy **Lost** does not remove it from the school inventory.

### Exports

- **Catalogue (CSV)**, from **Exports** in Administration: one row per copy, withdrawn ones included, with barcode, call
  number, title, author, publisher, year, ISBN, status, acquisition date, the copy's notes, inventory number, origin and
  value. It is the list to compare with the school's inventory register.
- The **Export** menu of the **Catalogue**: the search results, with the filters in use, as CSV or ODS.

### Class libraries and periodicals

Magazines are catalogued with a material of their own (as a rule "Magazine") and the designation of the issue. For the
books of a class library BiblioViva has no field for the location of the copy: the school can tell them apart with a
dedicated material, added in the **Materials** list of the **Library and school** section of the Configuration, and
record their loans like those of the other books. How the school keeps and records the assets that are not inventoried is
set by its regulation (art. 31, paragraph 6; art. 29, paragraph 3).

## What the school does

- Keep the inventory register in its own accounting system: the register of art. 31 belongs to the school and the DSGA,
  even if BiblioViva records number, origin and value on each copy. Decide whether to switch on the school inventory in
  BiblioViva and which **Origins** to offer.
- Decide in the regulation for the management of assets how the books of the school library are inventoried and how the
  class libraries and the periodicals are kept.
- Check that the numbering is progressive and uninterrupted, and set the value of each copy according to art. 32.
- At the end of a period, enter in the register the copies of the report **Copies entered in the period**.
- For the physical verification, at least every five years, run a campaign in **Stocktaking** and compare the list of the
  missing copies, with the inventory numbers, and that of the **Catalogue (CSV)** with the inventory register. The school
  does the comparison: BiblioViva does not run it.
- For the write-off, adopt the head teacher's decision with the attachments required (report to the authorities, minutes
  of the committee, DSGA's report) and, once the decision is adopted, mark the copies **Withdrawn** in BiblioViva with
  the **Reason** (for example the reference of the decision). Attach to the decision the report **Copies withdrawn in
  the period**.
- Keep the lists needed for the records, exported from the reports and from the catalogue.

## References

- [Interministerial Decree of 28 August 2018, no.
  129](https://www.normattiva.it/uri-res/N2Ls?urn:nir:ministero.istruzione:decreto:2018-08-28;129), on Normattiva (in
  Italian): regulation containing general instructions on the administrative and accounting management of schools, title
  III (articles 29 to 34).
- [Gazzetta Ufficiale no. 267 of 16 November 2018](https://www.gazzettaufficiale.it/eli/id/2018/11/16/18G00155/sg) (in
  Italian), the Official Journal with the text of the decree.

## Related pages

- [Withdraw a lost or damaged copy](../manual/guides/withdraw-a-copy.md)
- [Do the stocktaking](../manual/guides/stocktaking.md)
- [Stocktaking](../manual/screens/inventory.md)
- [Reports](../manual/screens/reports.md)
- [Configuration](../admin/screens/configuration.md)
- [Exports](../admin/screens/exports.md)
- [Audit log](../admin/screens/audit.md)
