# Dashboard

The dashboard is the first page for anyone working in BiblioViva: it shows the library today in a few number tiles,
the buttons to start work and the notes left by colleagues. It is seen by the "Administration", "Cataloguing",
"Cards and photos" and "Reports" accounts; the "Loan management" account, which has only the circulation desk, does
not see it, because after signing in it opens [Loans](checkout.md) directly. From the other pages, press the logo or
the library name at the top left to return to the dashboard.

Each account sees only what its role allows: a button or tile for a page that is not allowed does not appear. The
administrator can switch individual dashboard sections off under **Administration** → **Configuration** →
**Appearance and language**.

<!-- figure: dashboard/overview | The dashboard of the "Administration" account with sample data -->

1. Name and logo of the library: [Header](#header).
1. [Quick actions](#quick-actions).
1. [Pinned notes](#pinned-notes).
1. [Number tiles](#number-tiles).
1. [Add to the Home screen](#add-to-the-home-screen): phone only.
1. [Stocktaking in progress](#stocktaking-in-progress).
1. [Upcoming dates](#upcoming-dates).
1. [Due this week](#due-this-week).
1. [Today's loans](#todays-loans).

## Header

At the top appear the logo, the name of BiblioViva and the name of the library. An installation with sample data also
shows a yellow panel here: "This installation holds sample data loaded on `<date>`: `<n>` patrons, `<n>` titles,
`<n>` copies, `<n>` loans. Everything is made up: no real person." To remove the sample data see
[Remove the sample data](../../admin/guides/remove-demo-data.md).

## Quick actions

The **Quick actions** section is a row of buttons, each named after the page it opens. Only the ones allowed to the
account appear:

| Button | Opens | Account |
|---|---|---|
| **Loans** | [Loans](checkout.md) | Administration |
| **Returns** | [Returns](checkin.md) | Administration |
| **New book** | [New book](new-book.md) | Cataloguing, Administration |
| **New patron** | [New patron](patron-record.md#new-patron) | Cards and photos, Administration |
| **Photo census** | [Photo census](census.md) | Cards and photos, Administration (only with photos on) |
| **Printing** | [Printing](print-lists.md) | Cards and photos, Cataloguing, Administration |
| **Stocktaking** | [Stocktaking](inventory.md) | Cataloguing, Administration |
| **Reports** | [Reports](reports.md) | Reports, Administration |
| **Administration** | administration page | Administration |
| **Imports** | imports page | whoever can import without being an administrator |

The catalogue and the list of patrons have no button here: they open from the side menu (or from the bottom bar on
the phone).

## Pinned notes

Below the quick actions appear, as coloured slips, the notes that the administrator has pinned (see
[Notes](notes.md)). The **Open the notes** button leads to the full list. Without pinned notes the section does not
appear.

## Number tiles

The section, titled "The library today" for people who read with a screen reader, shows one tile for each number.
Pressing a tile opens the page where the matter is settled. Tiles that report a problem are yellow or red, those in
order are green; the colour is always accompanied by text and an icon.

For whoever has the loans permission:

- **Lent today**: opens [Loans](checkout.md).
- **Returned today**: opens [Returns](checkin.md).
- **Open loans**: opens [Books on loan](loans.md).
- **Overdue**: opens [Overdue notices](overdues.md); red if there is at least one overdue loan.

For whoever has the patrons permission:

- **Patrons without a printed card**: opens [Printing](print-lists.md).
- **Patrons without a photo**: opens the [Photo census](census.md). It appears only if the library requires photos.

For whoever has the catalogue permission:

- **Books without labels**: pressing the tile opens a window to print the labels of the books that do not have them
  yet. With zero books the tile cannot be pressed. See [Print book labels](../guides/print-book-labels.md).
- **Books to classify**: appears only when there are some; opens [To classify](to-classify.md).

For the administrator:

- **Open notes**: opens [Notes](notes.md); yellow if there is at least one.

## Stocktaking in progress

While a stocktaking is open, the **Stocktaking** section appears with the name of the campaign and its progress ("`<n>`
of `<n>` (`<n>`%)" copies seen). The **Continue** button resumes the work in [Stocktaking](inventory.md). It is seen by
whoever has the catalogue permission.

## Add to the Home screen

On the phone, if the browser allows it, below the tiles appears the **Add to the Home screen** section with the text
"BiblioViva opens like an app, full screen, from the icon on the phone." **Install** adds the icon; **Not now** hides
the section in that browser. In Firefox the section points to the browser's ⋮ menu, where to choose “Install” or “Add
to Home screen”. On the computer the section does not appear. It is an optional extra: the desk is used with the
computer and the barcode scanner.

## Upcoming dates

The **Upcoming dates** section lists the dates to remember from the [Calendar](calendar.md) in the next 30 days,
nearest first. Without dates it shows "No dates in the next 30 days."; if there are more than those shown, "and `<n>`
more". The **Open the calendar** button leads to the calendar. The section is visible to all accounts.

## Due this week

The **Due this week** section lists, for whoever has the loans permission, the books that must come back by the end of
the week, with the patron's name and the due date ("due `<day>`"). The number in brackets is the total. If there are
none: "No loan is due by `<day>`." The week starts on the day chosen by the administrator (the **First day of the
week** setting).

## Today's loans

The **Today's loans** section shows, for whoever has the loans permission, two lists: **Lent today** and
**Returned today**, with the time, the patron's name and the title. If there is nothing yet: "Nothing yet today." The
same pair of lists appears in [Loans](checkout.md) while no patron is chosen.

## Related pages

- [Loans](checkout.md)
- [Returns](checkin.md)
- [Notes](notes.md)
- [Calendar](calendar.md)
