# Overview

BiblioViva is free software for running a school library: the library staff use it from the browser of any computer,
tablet or phone of the school. This page summarises what it does.

## Settings

Most of a library's choices are a setting of BiblioViva and not a fixed rule of the program. At the first start a guided
setup proposes recommended values: primary school as the type of school, barcodes with a check letter, loans of 15 days,
one shared account per role, the Ocean colour set, patron photos and covers switched on. Whoever administers the library
can change these values at any time from Administration, without editing files.

Among other things, these can be set: the type of school, the years and the classes (multi-grade classes included); the
barcode formats of copies and cards, including those already printed by other systems; the genres, the subjects, the
reading levels and the scheme that builds the call number; the materials (books, DVDs and others) with their loan rules;
the school calendar; the roles, the permissions and the shared or personal accounts; the print templates of cards,
labels and spine band, which are drawn with the mouse or edited as code; the sheets of adhesive labels; the reports; the
name, the logo, the colours and the language; photos and covers, which can be switched off altogether; the performance
profile of the computer.

The whole configuration is exported and imported as one archive, and every change made from Administration can be
undone.

## Circulation desk

The circulation desk is used with the barcode scanner: the card is read, then the books. It lends, returns and renews,
returns a book and lends another one at once, and lends to a patron who does not have the card with them or a copy
without a label. It shows the books on loan and prints the overdue notices grouped by class. It also keeps the list of
wished-for books and the calendar with the closures, which the due dates take into account.

## Catalogue

The catalogue records the books and their copies. For a book with an ISBN the record is looked up automatically; for one
without an ISBN it is filled in by hand. The cover is looked up online or uploaded. Books are classified by genre or
subject and searched by title, author, ISBN or copy code. The catalogue also withdraws lost or damaged copies and does
the stocktaking, reading the copies with the scanner shelf by shelf.

## Patrons, classes and cards

The patrons are students and teachers, enrolled one at a time or from a file. The classes are permanent groups that move
up to the next year with the class upgrade. A patron's photo is taken with the camera, uploaded as a file or got from a
picture of the whole class. A lost card is reprinted. Removing a patron deletes their personal data at once and for
good.

## Printing

BiblioViva prints the cards, the book labels (spine band and barcode label), the overdue notices and, when switched on,
the loan receipts. The print lists prepare the printing when it suits and show what has already been printed. Two-sided
printing of the cards is calibrated.

## Reports

The reports answer questions about the library: loans per month, most borrowed books, copies never lent, patrons per
class and others. Every report can be printed and downloaded. The administrator can create reports of their own, in
addition to the supplied ones. The dashboard sums up today's library in a few boxes.

## Imports and exports

The students, the teachers, the catalogue, the open loans and the patron photos can be imported, for example when
switching from another program. Every file is checked as a whole first: with a single error nothing is imported. The
library's data are exported to files to keep, to import again or to take to another program.

## Backups

BiblioViva makes a backup by itself every night; a copy can also be made and downloaded at any time. From a copy
BiblioViva restarts on any computer, including one different from the original.

## Languages and appearance

Italian and English are included. One language applies to the whole installation, and other languages are added with a
translation pack. The name, the logo and the colour set of the library are chosen from Administration.

## Working with several people

The staff log in with shared or personal accounts, to which the administrator assigns roles and permissions. Each
account changes its own password. The notes allow leaving a message for colleagues. The audit log lists who did what,
without personal data of the patrons.

## Devices and installation

The USB barcode scanner is the normal reader of cards, copies and ISBNs; the phone is optional. BiblioViva runs on a
computer with Linux, for example an old PC or a Raspberry Pi, and is reached from the browser. The network is a choice:
the school's local network or Tailscale; the choice can be changed later ([Choose the
network](setup/choose-network.md)).

## Data privacy

The patrons are mostly minors. The data stay on the school's computer, except for the copies that the administrator
chooses to download or to keep elsewhere. Using BiblioViva requires an account, and each account sees only what its role
allows. Patron photos can be switched off altogether. The school remains the controller of the data (Regulation (EU)
2016/679, GDPR): the internet lookups of a book's record and cover send only the book's ISBN, title or author, never
data about patrons. What the rules ask of the school, and the ready texts for the record of processing and
the notice, are in the section [Compliance](compliance/data-protection.md).

## Accessibility

BiblioViva can be used with the keyboard alone, with a screen reader or with a magnified screen. Italian schools are
bound to the requirements of Law 4/2004 and the AgID guidelines (WCAG 2.1 level AA); the project's target is WCAG 2.2
AA, which includes them. The circulation desk works entirely with the keyboard and the barcode scanner, and its messages
are read by screen readers; the camera is never indispensable. The state, the checks and the gaps still open are
described in the page [Accessibility](compliance/accessibility.md) of the section Compliance.

## Design choices

BiblioViva is for staff only: it has no public catalogue and no accounts for the patrons. It does not handle fines or
holds on books.
