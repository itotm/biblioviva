# First run

The first run is the guided setup that BiblioViva offers in the browser as soon as it is installed: language, colours,
school, barcodes and the passwords of the shared accounts. This page is for whoever has finished the step [Install
BiblioViva](install.md) and has in front of them the address that `setup.sh` printed. The step takes about 10 minutes.

## Requirements

- The address of BiblioViva printed by `setup.sh` at the end of step 4.
- A computer with an up-to-date browser (Firefox, Chrome or Edge): normally the circulation desk computer.
- With Tailscale: the Tailscale application on that computer, signed in to the school's account; the first point of the
  procedure installs it, if it is missing.
- On the local network: that computer connected to the same school network as the BiblioViva computer.
- A sheet of paper and a pen, or a password manager, to note down the account passwords.

## Procedure

The guided setup has eight steps, shown at the top as "Step 1 of 8". In every step the **Next** button stays off until
the required data are valid; the **Back** button returns to the previous step without losing what was already written.
Almost every choice can be changed later from Administration: when unsure, leave the choices as BiblioViva proposes
them.

### Open the address

<!-- variant: tailscale -->
**With Tailscale**

The address of BiblioViva opens only from a device with Tailscale switched on and connected to the school's account.
For the first run a single computer is enough: the one the browser is opened from, normally the circulation desk
computer. The other devices are added at the step [Connect the devices](devices.md).

1. If Tailscale is not yet installed on this computer, install it and sign in with the school's account, as described in
   the section [Install Tailscale](devices.md#install-tailscale) of the step [Connect the devices](devices.md).
1. Open in the browser the address printed by `setup.sh`, in the form `https://biblioviva.<tailnet>.ts.net`.
1. Wait. At the first opening the HTTPS certificate is prepared and the page can take a few seconds.
<!-- /variant -->
<!-- variant: lan -->
**On the local network**

1. Connect the computer to the school network, by cable or Wi-Fi, the same one the BiblioViva computer is connected to.
1. Open in the browser the first address printed by `setup.sh`, in the form `http://biblioviva.local:8080`.
1. If the page does not open, open the second address printed, the numeric one, in the form
   `http://<computer address>:8080` (for example `http://192.168.1.50:8080`).
<!-- /variant -->

The page **First-time setup** opens on the first step. The guided setup appears only until it is completed and asks for
no password: complete it right away, without leaving the page open and unattended.

### Language

The first screen may appear in English. BiblioViva speaks one language per installation, valid for all the staff.

<!-- figure: setup/language | The Language step of the guided setup -->

1. Choose "English". The guided setup switches to English at once.
1. Press **Next**.

The language can also be changed later, from **Administration** → **Configuration** → **Appearance and language**.

To use a language other than Italian and English, already translated and published with this version of BiblioViva,
install it right away, from the "Need another language?" section under the choice of language:

1. Press **Add a language**. The **Add a language** panel appears.
1. Open the **Languages available on GitHub** list and choose the language. Under the list you see the percentage of
   texts translated and the kind of translation.
1. Press **Install**. When the installation is over the guided setup switches to that language at once, and it is
   already chosen.
1. Press **Next**.

The language chosen becomes the one of the installation, valid for all the staff, and can be changed later from
**Appearance and language**. For a computer without internet, or for a pack prepared yourself, **Upload a pack (zip)**
installs a ZIP downloaded elsewhere. The other operations are described in the guide [Add a
language](../../admin/guides/add-a-language.md).

Whoever moves BiblioViva to another computer, or starts again after a failure, does not answer the questions of the
guided procedure: under the choice of language they press **Restore from a backup** and choose the archive made with
**Export everything**. The procedure is in the section [From the first run](../restore.md#from-the-first-run) of
[Restart from a backup](../restore.md).

### Colours

BiblioViva offers fifteen colour sets. Only the colours change, never the shape, and they stay readable in black and
white too.

<!-- figure: setup/theme | The Colours step with the fifteen colour sets -->

1. Choose a colour set. The preview shows at once on the page. The proposed set is Ocean.
1. Press **Next**.

The colours can also be changed later, from **Administration** → **Configuration** → **Appearance and language**.

### Library

<!-- figure: setup/library | The Library step with the name and the two options -->

1. Write in the **Library name** field the name that must appear at the top left, on the cards and on the printouts,
   for example the name of the school preceded by "Library". The field is required.
1. Leave the **Patron photos** box ticked if the cards must carry the photo of students and teachers. Clear the tick if
   the school prefers not to keep photos: then there is no photo on any page and the cards come out without a photo.
1. Leave the **Book covers** box ticked if the catalogue must show covers, looked up online, photographed or uploaded.
   Clear the tick to have no covers at all.
1. Press **Next**.

The two boxes can be changed later in **Administration** → **Configuration** → **Patron photos** and in
**Administration** → **Configuration** → **Covers**; switching them off deletes nothing of what is already saved.

### School

The school type proposes the years, the classes and the reading levels. The classes are made right away.

<!-- figure: setup/school | The School step with the school type, the class names and the options -->

1. Choose from the **School type** list the one of the school, looking under "Italy". If the school combines several
   levels, choose the comprehensive school. The proposed type is the primary school.
1. Check the class names. For every school level there is a field (for example "Primaria: names of the classes, one per
   year") with the names of the sections, separated by commas: `A-D` stands for A, B, C, D. The names repeat for every
   year. An empty field makes no classes.
1. Check the list of the classes that will be made, below the fields.
1. Leave the choice of **How a class is written** as it is, unless the school writes the classes in another way. The
   entries show an example, such as "1 B".
1. Check the **Teachers group** field: the teachers join this group and other groups are added later.
1. Check **Start of the school year**, written as month and day in the form `MM-DD`, for example `09-01`.
1. Choose in **Name of the school year** whether the year is written with two years, as "2026/2027", or with the year
   it starts, as "2026". In Italy two years are used.
1. Leave the **Fiction shelved by reading level** box ticked if the library arranges novels by level. Below the box
   appear the levels that will be created.
1. Leave the proposed entry, "Genre, then level", in **Call number**, or choose another order. BiblioViva computes the
   call number of each copy from the classification, the level and the author; with "Free: typed on each copy" the call
   number is typed on each copy instead. Without reading levels the menu offers only "Genre, without the level" and
   "Free: typed on each copy".
1. Leave the proposed entry, "Author's initials, computed", in **End**, or choose another. The menu does not appear with
   the free order.
1. Check the examples under the menus, written as "Examples: B 4 DEL · B DEL · 590 ROS".
1. Press **Next**.

Years, classes and reading levels can be changed later in **Administration** → **Configuration** → **School** and in
**Administration** → **Configuration** → **Classes**. The call number is changed in **Administration** →
**Configuration** → **Classification**: see [Change the classification and the reading levels](../../admin/guides/classification.md#choose-how-the-call-number-is-made).

### Codes

The Codes step sets the barcode format of new copies and the one of new cards, each chosen on its own. The two formats
cannot be confused: whoever reads a code knows at once whether it is a book or a card.

<!-- figure: setup/codes | The Codes step with the two formats, the check character and the examples -->

1. Leave in **Format of the copies** the proposed entry, "Year, check and number (recommended)", or choose another one.
1. Leave in **Format of the cards** the proposed entry, "Check and a 6-digit number (recommended)", or choose another
   one.
1. Leave in **Check character** the proposed entry, "A letter (mod 23)".
1. Check **Scanner keyboard**: it must be the language of the keyboard of the computer the barcode scanner is plugged
   into. In Italy it is "Italian". The value serves to repair the characters that a scanner set for another keyboard
   writes wrongly; the step [Test the scanner and the printer](scanner-printer.md) checks it.
1. Check the examples below the fields, for the **Copy of a book** and for the **Card**.
1. Verify that the message "Copies and cards can never be confused." appears. If a refusal warning appears instead,
   choose another format.
1. Press **Next**.

The formats, the codes of earlier systems and the numbering can be changed later in **Administration** →
**Configuration** → **Barcodes**. A library that already has books and cards with codes printed by another system
leaves the proposed choices here: the existing codes are added afterwards, and keep working.

### Sample data

<!-- figure: setup/demo | The Sample data step with the box for the sample data -->

The sample data are made-up students, books and loans, generated according to the chosen school and codes: they serve to
try BiblioViva before entering the real data. They match no real person.

1. To try BiblioViva before real use, tick the **Load sample data** box. To start at once with the real data, leave it
   off.
1. Press **Next**.

With the sample data every account uses the same password, easy to remember. The sample data are removed when ready,
with a single button:

1. Sign in as `admin` and open **Administration**.
1. Press **Clear sample data** and confirm.

The deletion empties the database and the photos and logs out all the operators; the configuration and the accounts
stay. After the deletion change the passwords at once from **Administration** → **Staff accounts**, because those of the
sample data are known to everyone.

If the database already contains data, the step says so and the sample data are not loaded.

### Passwords

BiblioViva has five shared accounts, one per role. Each signs in with its own username and password.

<!-- figure: setup/passwords | The Passwords step with the five accounts and the proposed passwords -->

| Account | Username | Used for |
|---|---|---|
| **Administration (admin)** | `admin` | everything: settings, backups, imports, accounts |
| **Loan management (prestiti)** | `prestiti` | the circulation desk: loans and returns |
| **Cataloguing (catalogo)** | `catalogo` | the catalogue: books, copies, labels |
| **Cards and photos (tessere)** | `tessere` | the patrons and the cards |
| **Reports (report)** | `report` | the reports and the statistics |

1. Read the proposed passwords: they are generated at random and are fine as they are. To change one, write another in
   the field, of at least 8 characters.
1. To get another random password, press the **Regenerate** button next to the field.
1. Press **Next**.

With the sample data on, the fields cannot be edited: all the accounts use the password `biblioviva`.

> [!IMPORTANT]
> The passwords appear only in the summary and on the final screen: they are not shown again. Copy them and keep them
> in a safe place before going on.

### Summary

<!-- figure: setup/summary | The Summary with the choices and the account passwords -->

1. Check the summary: language, colours, library, classes, call number, codes and sample data.
1. Copy the passwords of all the accounts, for example on a sheet of paper kept safe.
1. Press **Complete the setup**. While saving, the button shows "Saving…".

If an error message appears, reread the steps with **Back** and try again. After saving, the **Setup completed** screen
appears.

### Setup completed

<!-- figure: setup/done | The final screen with the passwords and the Go to the login button -->

1. Check that the passwords noted down match those shown. If the sample data were loaded, the number of patrons,
   titles, copies and loans created also appears.
1. Press **Go to the login**.
1. Write `admin` in the **Username** field.
1. Write the password of the `admin` account in the **Password** field.
1. Press **Log in**.

## Check before going on

- After signing in, the **Dashboard** opens, titled with the library name chosen in the Library step. With the sample
  data, a notice at the top of the page reminds that the installation contains them.
- The passwords of the five accounts are noted down in a safe place.

When the guided setup does not open, see the possible problems below and the page
[Common problems](../../help/problems.md#address-that-does-not-open). If instead the login page opens, the setup
had already been completed: signing in requires the passwords chosen then. To start again from scratch, the section
"Resetting an installation" of the technical page
[Deployment notes (technical)](../../../deploy.md#resetting-an-installation-back-to-the-first-run-wizard) explains how.

## Possible problems

### The page does not open with Tailscale

The computer does not have Tailscale switched on and connected to the school's account, or the names feature (MagicDNS)
or the HTTPS certificates are not on in the Tailscale console. The step [Prepare the network](network.md) describes both
checks.

### The page does not open on the local network

The computer is not on the same network as BiblioViva, or the name `biblioviva.local` is not recognised. Use the numeric
address of the computer, as indicated above.

### A password was lost

Passwords cannot be seen again. Signing in with `admin`, the others are changed from **Administration** → **Staff
accounts**. For the password of `admin` the technical procedure "Forgotten admin password" of the page [Deployment notes
(technical)](../../../deploy.md#installing-updating-logs-step-85) is needed.

### The list of languages cannot be reached

"The list of languages cannot be reached" appears: the computer that runs BiblioViva is not connected to the internet.
On a computer with internet, download the language's file from the BiblioViva release page (the **Release page on
GitHub, to download the zips** link under the list) and upload it with **Upload a pack (zip)**.

### The Next button does not switch on

A field of the step is empty or not valid. The field to correct shows a warning: for example the password of at least 8
characters or the start of the year in the form `MM-DD`.

## Related pages

- Previous step: [Install BiblioViva](install.md)
- Next step: [Connect the devices](devices.md)
- [Common problems](../../help/problems.md)
