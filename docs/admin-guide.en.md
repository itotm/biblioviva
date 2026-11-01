# BiblioViva — Guide for the library administrator

This guide covers the tasks done a few times a year: importing students, managing cards, backups.
It is written for readers without technical skills. The Italian version is
[admin-guide.it.md](admin-guide.it.md). The sections grow with the application.

## 1. Importing students and teachers from a file

You need the *Patron import* permission (normally the **Administration** or **Cards** account). The
imports are in **Administration → Imports**: **Students** and **Teachers** are two separate pages.

### 1.1 Preparing the file

1. At the bottom of the page the card **The template of the file** lets you choose the columns you
   need; press **Download the template**. The template holds the header row only, to fill with one
   row per person (a spreadsheet saved as CSV works too).
2. The **required** columns are always in the template:
   - for **students** `first_name`, `last_name` and the class, in one column `class` (for example
     `3A` or `3 A`) or in two columns `level` (the year, `3`) and `section` (the section, `A`): you
     choose which form to use;
   - for **teachers** only `first_name` and `last_name`.
3. The **keys** recognise who is on record already and may be left out: `card_number` (the card
   number in use: when missing, the card is generated) and `external_id` (the code of the school
   register: when missing, people on record are recognised by name and class).
4. Optional columns: `email`; for teachers `group` (the teachers group; when missing, the default
   one).
5. Column names are written as in the template, in English: columns with other names are ignored
   (they can be matched by hand on the **Columns** step). A file without a header is fine when the
   columns are in the order `first_name;last_name;level;section` or `first_name;last_name;class`
   (teachers: `first_name;last_name`).
6. The class must already exist in **Administration → Configuration → Classes**: the import never creates classes.
7. Encoding and separator need no care: UTF-8 and Windows-1252, `;` and `,` are accepted. Empty
   lines are ignored.

### 1.2 Uploading and checking

1. Open **Administration → Imports → Students** (or **Teachers**).
2. Choose the file and press **Upload**.
3. On the **Columns** step check that each column of the file is matched to the right field; the
   required fields and the keys are marked *required* or *key*. When a required column is missing
   the page says which. The choice is remembered for next time.
4. Choose the **mode**:
   - **Add and update** (normal): whoever is on record is updated (for example with the new class),
     the others are created.
   - **Synchronise students** (or **Synchronise teachers**): to use with the complete list. Whoever
     is no longer in the file is listed; if you hold the permission and confirm, they are
     **removed** (personal data is erased at once and for good, only class and statistics remain).
     The students' synchronisation never touches the teachers, and the other way round.
5. Press **Check the file**.

### 1.3 Reading the outcome

- Each row has an outcome: **New**, **Update**, **Unchanged** or **Error** with the explanation. A
  class that does not exist is an error that lists the valid classes.
- With even one error the **Import** button stays off: fix the file (or the patron on record) and
  check again. There is no "skip errors": this keeps the records clean.
- When the file has no card numbers, the page says how many new cards will be generated.
- An empty cell erases nothing: for example an empty card in the file keeps the card the patron
  already has.
- When two people on record share first name and surname, the row asks which one to update (or to
  create a new one); then check again.
- In the synchronisation, missing people with open loans are not removed: their books must be
  returned or marked lost first.

### 1.4 Importing

1. Press **Import**: everything is written at once. New patrons without a number get their card
   number automatically.
2. The final page sums up the numbers and offers **Print the cards of the new patrons** and
   **Photo census**. The original file is kept on the server (Administration → Activity log records
   the import).

Uploading the same file again does no harm: every row comes out *Unchanged*.

### 1.5 Moving from Koha

Whoever comes from Koha can extract the students with the query `docs/import/koha-students.sql` and
the teachers with `docs/import/koha-teachers.sql` (see `docs/import/README.md`): the files they
produce have the right column names already and carry the card numbers, so the cards already printed
keep working. Koha's column names can change between versions: whoever runs the query must check them
first.

## 1b. Importing the catalogue and moving from Koha

### 1b.1 The catalogue file

**Administration → Imports → Catalogue** takes a file with **one row per copy**: the title's data
(title, author, publisher, year, ISBN, classification…) repeats on the rows of its copies (barcode,
call number, material, acquisition date…). Here too the template is generated from the page with the
columns you need; samples in `docs/import/`.

- **Required**: `title`, `author`, `publisher`.
- **Keys**: `biblio_key` (the code of the title in the old program, Koha's `biblionumber`: it keeps
  the copies together; when missing, copies are grouped by ISBN) and `barcode` (the barcode already
  on the copy; when missing, the barcode is generated and the labels must be printed).
- **Optional**: all the others, among them `classification` (the code of the genre or of the
  subject). A book without classification is imported all the same and goes to **Catalogue → To
  classify**: its copies are not lent until somebody classifies it.

1. Upload the file. Columns with the template's names are recognised by themselves; the others are
   chosen by hand (the choice is remembered). When keys or classification are missing, the page says
   what will happen.
2. If some rows lack author or publisher, tick **"use the special values"**: "Anonimo" and "s.n."
   are filled in, as in cataloguing.
3. **Check the file**: each row shows its outcome, and the page counts the copies that will get a
   new barcode and the titles to classify. With even one error "Import" stays off: fix the file and
   check again.
4. If copies of the same title have **different reading levels**, BiblioViva asks whether to turn on
   the **level per copy** (the reading level sits on each copy instead of the title). Answering yes,
   the setting holds for the whole catalogue and the level of the titles already present moves to
   their copies; answering no, those rows stay errors.
5. **Import**: everything in one operation. Copies without a barcode get a new one and at the end you
   can print their labels; those with Koha's code keep the labels they already have. Importing the
   same file twice creates no duplicates.

### 1b.2 Moving from Koha: the order

The school runs **two versions of Koha**: before running the exports you need to know which version
you start from, because the column names change. The queries in `docs/import/` are written for the
current Koha version; whoever runs them must check them against their own.

1. **Students**: `koha-students.sql` → **Imports → Students** (cards stay valid).
2. **Teachers**: `koha-teachers.sql` → **Imports → Teachers**.
3. **Catalogue**: `koha-biblio-items.sql` → **Imports → Catalogue**. The export is tab-separated:
   upload it as it is (physical descriptions contain ";").
4. **Open loans**: `koha-issues.sql` → **Imports → Open loans**. Used once, on the day of the
   switch: every loan keeps its original dates, those already overdue show up among the overdues at
   once. When the file has no dates, the loan is dated today and the due date follows the loan
   rules.
5. **Patron photos**: `koha-patron-images.sql` and the loop described at the top of the file write
   one file per patron, named after the card number. Then **Imports → Patron photos**: upload them in
   a ZIP archive, or copy them into the `imports/photos` folder of the data and press "Import from
   the folder". Photos already present stay unless "Replace" is ticked; the files without a patron
   can be downloaded as a list.

After each step check the numbers: how many patrons, titles, copies and loans Koha had and how many
BiblioViva shows; scan a few labels and cards.

## 2. Notes, history and removal of a patron

On the page of every student or teacher (**Patrons** → click the name):

- **Notes**: *Edit notes* lets you write the *circulation note* (it pops up when that person
  borrows a book) and the internal notes.
- **History**: every loan, returned ones included, with its outcome (open, overdue, returned,
  returned late) and **Export** to CSV or ODS.
- **Remove student / Remove teacher** (needs the *Anonymization* permission, normally only the
  Administration account): erases at once and for good first name, surname, contacts, external id,
  notes, card number and photo. Type, class, section and the loan history stay, for statistics. It
  cannot be undone and is refused while loans are open: return them or mark them lost first. It is
  the same operation the student synchronisation (§1.2) offers for whoever is no longer in the file.

## 3. Print lists

A **print list** is an ordered set of patrons or copies to print in one go, for example the cards
of a class or the labels of the books that just arrived. It lives under **Printing** and in the basket at the top right, which shows
the number of lists **to print** (with at least one entry and never marked as printed); its menu lists them
with their number of entries; every other list is under *Printing*.

1. **New patron list** in *Printing*, with a telling name (for example "Cards 1A").
2. Add people: with the **quick filters** (class and section, type, only those without a printed
   card or a photo, an import, created from a date), with the **scanner** (pass the cards one after
   the other: whoever is already in the list is ignored with a notice, no sounds), or from the
   **Patrons** page with *Add to a list* (also on the Ctrl-click selection).
3. Reorder by dragging the entries or with the arrows; remove with the ×.
4. **Print cards** opens the sheet ready for the printer in the list order.
5. **Mark as printed** records the date on the list and on every card; tick *Empty the list after
   printing* when you no longer need it.

Lists can be renamed and deleted: deleting a list never touches the patrons.

The cards of a whole class need no list: under the lists, *Printing* shows the **classes**, each
with **Print cards**.

### 3.1 Book labels

**Book lists** (**New book list** in *Printing*) work the same way and print the labels: the **pair** (spine band on top, barcode
label below, one per book on the 70 × 48 mm adhesive sheet: nine books per sheet, like the current
printout), or the barcode label alone, or the spine band alone.

1. Add copies: from the **Catalogue** (select titles with Ctrl-click and use *Add the selection to a
   list*: every copy of those titles goes in), from a **book's page** (*Add to a list* takes every
   copy), with the **scanner** walking along the shelf, or with the **quick filters** (labels still
   to print, acquisition date, genre or non-fiction class, copy type, import).
2. **Print labels** opens a dialog where you choose the kind (pair, barcode only, spine band only),
   the **label sheet** and the **first free position**, to use a sheet already started: positions
   are counted in units (in pairs for the pair). The dialog says how many copies and sheets are
   needed and opens the print page in a new tab.
3. Print at **100 % scale**, never "fit to page". The first time, print the **calibration page** on
   plain paper (*Administration → Configuration → Print templates → Labels*) and hold it against a sheet of labels
   to check the margins.
4. **Mark as printed** (choose the kind next to the button) records the date on every copy: the pair
   marks both labels. Copies still without labels show up on the **Dashboard**, from where they are
   printed in one go.

The same actions are on the book's page (every copy, or a single one with the printer icon on the
copy's row) and at the end of the new-book flow.

### 3.2 Changing many copies at once (for example withdrawing books)

Copies change in one go from the **Catalogue**: select the titles with Ctrl-click and use **Change
the copies of the selection** (the lists of *Printing* only print).

1. Choose *Status → Withdrawn* and write the **reason** (required for withdrawn and lost).
2. **Check** shows how many copies change and which stay as they are: copies **on loan** are not
   withdrawn until they are returned.
3. **Apply**: every copy changes together and each keeps the reason in its log.

The same tool changes the material, the not-for-loan flag, the acquisition date or the class of
the copy, and **Reclassify** gives the selected titles a new genre or subject, rewriting the call
numbers if you want: the spine bands (and the labels, if the call number changes) go back among
those to print.

## 4. Backups and full export

BiblioViva makes a backup on its own every night (at the time set in `backup.cron`, 3:00 by
default); you find it under **Administration → Backups**.

**A computer switched off at night.** If BiblioViva runs on a computer that is switched off in the
evening, nobody is there to make the backup at its time. Then, at the next start, BiblioViva notices
that the scheduled backup was missed and makes one a minute after the start (only one, even if the
computer stayed off for several days). In the list of the Backups page that copy is marked **Made
up at start**. The option is called “Backup at start if missed”, under **Administration →
Configuration → Backup**, and it is on by default. On the same page you can also move the backup
time into the opening hours (for example `0 13 * * 1-5`, at 13:00 from Monday to Friday), when the
computer is surely on.

### 4.1 What the nightly backup contains

- **The database**: a full copy at every run, kept for the configured number of days (30 by
  default). The copies are the `biblioviva-YYYYMMDD-HHMM.db` files listed on the page.
- **Photos and covers**: copied into the `backups/uploads` folder (only new or changed files, so the
  job stays fast even on a Raspberry Pi). The page tells how many photos and covers are already safe.
- If you enabled the off-site copy (the *offsite* service, see `docs/deploy.md`), the backups folder is
  copied every hour to its destination, images included.

The **configuration** (settings, card and label templates with their images) is not part of the
nightly backup: it lives in the `/config` folder and rarely changes. To have it in one file use the
full export (§4.2) or **Export configuration** (§14).

Every ZIP file BiblioViva makes — **Export everything**, **Export configuration**, the backups of
chosen parts — is made the same way: each one holds only the parts you asked for. This is why any of
them can be given both to **Restore** and to **Import configuration**.

### 4.2 Export everything

1. Open **Administration → Backups** and press **Export everything**.
2. The browser downloads a `biblioviva-export-YYYYMMDD-HHMM.zip` file containing the database, every
   photo and cover and the whole configuration (templates and images included), plus a
   `manifest.json` that summarises the content.
3. Keep the file somewhere safe (a USB stick, the school's cloud): it is all you need to bring
   BiblioViva back on another computer.

The file can be large (covers weigh more than the database): with a few thousand books expect a few
hundred megabytes.

### 4.3 Restoring

- **From a nightly copy**: stop the app, replace `/data/db/biblioviva.db` with the chosen file, delete
  `biblioviva.db-wal` and `biblioviva.db-shm` if present, put the images back from
  `/backups/uploads` into `/data/uploads` when they are missing, and start again.
- **From a backup or a BiblioViva file** ("Export everything", "Export configuration"): in
  **Administration → Backups** press **Restore…** on the backup of the list, or **Upload an archive**
  for a file brought from another computer. The page shows the parts the file holds (a file of the
  configuration alone offers only the configuration parts): choose which to take back and press
  **Restore**. The parts you do not choose stay as they are.
- **From the terminal**: stop the app and, on the computer that hosts it, run
  `bun run backup:restore <file.zip>`: without other options it shows what the archive contains; with
  `--yes` it puts it back over the current data and configuration. Then start the app again.

Before unpacking anything the archive is checked: one that is not a BiblioViva file, or with paths
that lead out of its folders, links, files that do not belong to it, more than 200 000 files or
contents far larger than the file itself (more than twenty times its size, 8 GB at most) is refused
and nothing is written. Restoring the patrons brings their classes back too.

The exact steps for the container are in the installation guide (`docs/deploy.md`).

### 4.4 Where the backups are and how to keep a copy elsewhere

The backups — the nightly copies, the backups of chosen parts and the copy of the photos and covers —
are in the **`backups`** folder, beside BiblioViva's files on the computer that hosts it (the same
folder that holds `compose.yml` and the `config` folder). It is an ordinary folder: you can open it,
look at its files and copy it. The database lives in a place of its own, inside Docker: if that
breaks or is deleted, the backups stay.

To have a copy somewhere else too:

1. **On a USB stick or an external disk, now and then**: copy the `backups` folder (or only the
   newest files). Or download a backup from **Administration → Backups** (the **Download** button
   beside each backup), or press **Export everything**.
2. **On a second disk, always**: whoever looks after the computer can keep the `backups` folder on a
   second disk or on a USB disk that stays plugged in (the steps are in the technical guide,
   `docs/deploy.md`, "Backups on a second disk or a USB drive"). Then a broken main disk does not
   take the backups with it.
3. **A second copy, every hour**: the off-site copy (the *offsite* service, rclone, see `docs/deploy.md`) copies the
   `backups` folder into a folder of another disk or of the school's server, or to a service the school already
   uses, with an account it owns.

The backups hold the pupils' data: keep them in a safe place and delete the copies you no longer
need.

## 5. Adding a language

BiblioViva speaks English and Italian. If you need another language you can add it without
touching the program: a folder with the translations in the configuration folder is enough.

1. Open the configuration folder (`/config`, see the installation guide): inside you find `i18n/en/`
   and `i18n/it/`, the official translations written there as examples at the first start.
2. Copy the `i18n/en/` (or `it/`) folder and rename the copy with the code of the new language, for
   example `i18n/de/` for German or `i18n/fr/` for French (two lowercase letters, optionally
   followed by the country: `pt-BR`).
3. In the copy's `pack.json` write the name of the language in English (`"name"`) and in the language
   itself (`"nativeName"`, which is what the menus show).
4. Translate the texts in the `.json` files: change only what is to the right of the colon, never the
   keys on the left, and leave the parts in double braces such as `{{name}}` untouched (the program
   replaces them). You can translate a little at a time: whatever is missing stays in English.
5. Restart BiblioViva (or reload the configuration). The new language appears in the first-run wizard
   and under **Administration → Configuration → Appearance and language**.

Before loading it, BiblioViva checks the folder: if a file is missing, if a file is not valid JSON or
if a translation lost a part in braces, the language **is not offered** and the server log shows a
warning naming exactly which file and key to fix. Anyone comfortable with a terminal can run the same
check before restarting with `bun run i18n:check /config/i18n/de`.

The official translations stay inside the program: the `en/` and `it/` folders under `/config/i18n/`
are only copies to start from, and editing them does not change the app's English and Italian.

## 6. Calendar and due dates

Loan due dates take the days the library is closed into account. **Loans → Calendar**
shows the months of the school year with the closed days and the reason of each (weekly closing,
national holidays — Easter included, computed by itself —, school holidays, closure periods such
as the Christmas break or the summer). The page is for checking: closures are changed in
**Administration → Configuration → Calendar** (saved in the `calendar` section of `config.json` or
in a file per year `calendar.2026.json` in the `/config` folder).

With the normal setting a due date that falls on a closed day moves to the next open day;
`circulation.hardDueDate` sets a last day after which no loan can be due (for example the end of
lessons).

## 7. Photos and covers: format and size

Patron photos and covers are stored in the format chosen in the configuration: `photos.format` and
`covers.format` (`jpeg`, the usual one, or `webp`, a little lighter) with `quality` from 1 to 100
(80 is a good compromise).

- **Photos**: always exactly `photos.width × photos.height` pixels (480 × 640, the 3:4 proportion of
  an ID photo). When you take or upload a photo in the browser you choose the framing inside the
  frame; photos that arrive without framing (the Koha import, files the browser cannot open) are
  cropped at the centre.
- **Covers**: `covers.width` pixels wide (600) with the book's proportions, never cropped;
  `covers.maxHeight` limits the height of very tall images.

Changing the format applies to the photos and covers saved from then on: those already present stay
as they are and keep working.

## 8. Overdue notices, reminders and receipts

**Loans → Overdue notices** lists the overdue loans grouped by class and section (teachers last,
under "Teacher"), with the number of overdue books of each group.

1. Check **Minimum days late**: a loan appears only after this many days (usually 5, because not
   everyone can come to the library every day; 0 = straight away). The starting value is
   `circulation.overdueNotice.minDays`.
2. Untick the groups you do not want to print; choose **One page per class** to hand one sheet to
   each teacher.
3. Press **Print notices**: a new tab opens with the notices as printed today (heading "1 D -
   Solleciti biblioteca del …", table Nome, Titolo, Giorni ritardo). Print at 100 % scale.
4. After printing press **Mark notices printed**: the date shows as "Last notice" in the **On loan**
   list.

**Print reminder** prints one patron's overdue books: it is on the patron page, at the returns desk
(when other books are still overdue) and in the checkout desk message about overdue books. The
**checkout receipt** ("Print receipt" at the desk) is turned on with `"receipts": true` in the
`circulation` section of the configuration. The three templates are in `/config/slips/templates/`
and are edited like the card templates (`docs/templates-authoring.md`).

### 8.1 Lost, damaged and withdrawn books

- **Lost**: on the patron page, next to the loan, the button with the red cross ("Mark lost")
  closes the loan and marks the copy lost; the book stays listed under **Lost books** on the patron
  page. If it turns up, scan it at **Returns**: it becomes available again by itself. A copy can
  also be marked lost from the book page (status change): if it was on loan, the loan closes the
  same way.
- **Damaged**: after a return, "Mark damaged". A damaged copy can still be lent; to stop it choose
  "In repair" on the book page.
- **Withdrawn**: a withdrawn copy is never lent, not even by forcing; when every copy of a book is
  withdrawn the book disappears from the catalogue searches (tick **Also show withdrawn books** to
  find it). A copy on loan cannot be withdrawn.

## 9. Library logo

In **Administration → Configuration → Appearance and language**, box **Library logo**:

1. Press **Upload the logo** and choose the image (PNG, JPEG or WebP; a PNG with a transparent
   background works best). The logo appears at once at the top left of every page, next to the
   library's name.
2. To change it press **Change the logo**; to take it away **Remove the logo** (a generic icon
   comes back).

The logo is saved in the configuration folder (`/config/branding/logo.png`), so it is part of the
backups and of the configuration export. The BiblioViva logo and name stay on the dashboard only.

## 10. Class upgrade (end of the year)

Done once a year, when the administrator decides (usually in June or before lessons start):
**Administration → Class upgrade**.

1. **Backup**: press **Create the backup**. Without it the wizard does not go on; if anything goes
   wrong, restore it from **Administration → Backups**.
2. **Classes**: every student moves up one class (3 A becomes 4 A). Open a class to mark who
   **repeats** the year or changes **section**.
3. **Leavers**: the students of the last class leave the school and their data is **erased at once
   and for good** (only the numbers of the statistics remain). Untick whoever stays. A student who
   still has books blocks the upgrade: register the return (or mark the book lost), or untick them.
4. **Confirm**: check the summary and press **Upgrade classes**. If the last upgrade was less than
   six months ago, one more confirmation is asked.
5. Then import the new first-year students with **Administration → Imports → Students**
   (synchronisation, §1).

Teachers do not change. Past loans keep the class of the day of the loan, so the statistics of past
years stay right.

## 11. Exports

**Administration → Exports** downloads the library's data:

- **Students**, **Teachers**, **Catalogue** and **Open loans** as CSV, in the same format as the
  imports: they can be corrected with a spreadsheet and imported again, or taken to a new
  installation (students and teachers first, then the catalogue, then the open loans).
- **Loan history** as CSV, with each patron's class and section at the time of the loan.
- **All the data** in one JSON file, to move to another installation or program.

One person's data (for example when a parent asks which data we keep) is downloaded from the
patron's page with **Export the person's data**. These files hold personal data of minors: keep
them carefully and delete them when no longer needed.

## 12. Classification: genres, subjects and pictograms

**Administration → Configuration → Classification** holds the fiction genres, the non-fiction
subjects with their sub-subjects, the Dewey table and the call number options. Changes stay in a
draft until you press **Save**; if you leave first, the page asks for confirmation.

1. Choose the tab (**Fiction**, **Non-fiction**, **Dewey**, **Options**) and press a row to edit it in
   the panel on the right (on a phone a window opens). Next to each row you see how many books use it.
2. In the panel you change **code**, **name**, **colour** and **pictogram**: upload an image (PNG,
   JPEG or WebP, stored as PNG) or choose one that is already there. A sub-subject without a colour or
   an image uses those of its subject. The **preview** shows the spine band as it would be printed.
3. To change the order drag the rows or use the arrows. A sub-subject moves under another subject with
   **Position**.
4. In **Dewey** each row links a Dewey prefix to a subject: when a book comes with its Dewey number
   (for example from SBN) the subject of the longest matching prefix is suggested. The **Try a Dewey
   number** field shows at once what would be suggested.
5. In **Options** you choose whether fiction is divided by class, whether the class is on each copy
   (needed when copies of the same book sit on the shelves of different classes) and the call number
   patterns of new copies (for example `A 4 DEL`).
6. Press **Save**: first you see what changes in the catalogue. If you deleted or renamed a code that
   some books use, choose where to move those books: the new code goes on the books and at the start
   of their call numbers, and the spine bands go back among the labels to print (**Printing**, §3.1).
   If you change the name, colour or pictogram of a code in use, you can put those spine bands back
   among the labels to print as well.

Each save writes the file `classification.json` of the configuration folder and keeps the previous
version (with the removed images) in the configuration history (§13). A code cannot be used both by a genre
and by a subject.

## 13. Configuration: settings, history and restore

**Administration → Configuration** shows whether the configuration is valid and one card per
section (Library and school, Loans, Labels, Backup…), with the name of the file it is saved in.

1. Open a section: the **Settings** tab lists the values with a short explanation. Change what you
   need and press **Save**: wrong values are marked in red and the save waits until they are fixed.
   Under each field is the name of the key in the file.
2. **Back to the default** shows when a value differs from the default: on save the key is taken out
   of the file and the default applies again.
3. At the bottom, **Other settings of this section** lists what is changed elsewhere (for example the
   classification or the language) with a link to the right page. What has no page of its own yet is
   changed in the **JSON** tab, which shows the section as written in the file and checks it while you
   type.
4. A save that would take away something still in use is refused with an explanation: for example a
   copy type used by copies, a section with students, a genre with books.
5. **History** lists the changes made from here (the last 50). **Restore** puts back only the values
   that change set: later changes to other values stay. If the same values were changed again in the
   meantime, the restore is refused. The restore goes into the history too and can be undone.
6. If someone changed the files by hand, the page says so: press **Reload** to use the changes. If
   the files have errors, the library keeps the previous version and the page lists what to fix.
7. The **Library and school** section also holds the **copy types** and the class **sections**,
   with how many copies or students use each one. Changing a code moves its copies or students to
   the new code; if you remove a code still in use, on save you choose where they go.
8. In the **Barcodes** section you choose the barcode type (Code 128 for new printouts, Code 39 only
   if the library's scanners cannot read Code 128) and the number new cards start from; the preview
   shows the next card and the next copy without using them up.

## 14. Configuration archive

In **Administration → Configuration**, **Configuration archive** panel:

1. **Export configuration** downloads one ZIP file with the whole configuration: settings, print
   templates with their images, adhesive sheets, pictograms, logo, reports and languages. It holds
   none of the library's data (books, patrons, loans: the backup is for those, §4) nor the history of
   changes. It does hold the staff accounts with their passwords in protected (hashed) form: keep it
   carefully. With **Choose what to export** you can take only some of its parts.
2. **Import configuration** takes a BiblioViva file (from this installation or another one): a file
   of **Export configuration**, but also a backup or an **Export everything** file, from which it takes
   only the configuration (the library's data stays as it is). A file that holds only data is refused
   with a message. It checks the file first, changing nothing: how many files are new, changed or
   removed, which sections change, any problem (an invalid value, a broken template, a code used by
   books that would disappear…). You can choose which parts of the configuration to take: the others
   stay as they are.
3. **Import** can be pressed only when there are no errors. The previous configuration stays in the
   history (§13): **Restore** brings it back.

Whoever works on the server can do the same with `bun run config:export` and `bun run config:import`
(technical guide, `deploy.md`).

## 15. Reports: changing them and making new ones

**Administration → Configuration → Reports library** lists every report: those shipped with
BiblioViva, those customised by the school and those added.

1. **Edit** opens the editor. For a report shipped with BiblioViva, saving makes the school's copy
   with the same name; **Back to the original** removes it.
2. **Duplicate** opens the editor on a copy, with a new code to type; **New report** starts from
   scratch.
3. In the **Guided** tab choose the data (loans, copies or patrons), what goes in the **rows** (for
   example the class year) and, for a pivot table, in the **columns** (for example the section): then
   the **totals** column and row appear. Then the **values** (loans, readers…), the **filters** — none,
   asked when the report is opened (for example the period) or fixed — and the chart. The teachers are
   one row "Docenti", the books not yet classified one row "Da classificare".
4. **Preview** shows the result with the default values; **Save** checks the report, tries it and
   puts it in the library. When the query fails, the message says why and the report is not saved.
5. The **SQL** tab is for those who know SQL: for a guided report it shows the SQL it becomes, and
   **Edit as SQL** turns it into a report written by hand (there is no way back). The full format is
   in `docs/reports-authoring.md`.

Every save goes into the configuration history (§13) and the archive (§14).
