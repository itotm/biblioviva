# Installation check

The **Installation check** page says whether the installation is in order: the configuration file, the address, the
computer's profile, the account passwords and the backups. It also proposes the tests to do by hand with the printer,
the camera and the barcode scanner. It shows the state and the links to fix it: it changes no setting. It is reserved
for the `admin` account and opens from the **Installation check** tab of [Administration](admin.md). While a check is to
fix, the **Dashboard** of the `admin` account also reminds of it, with a button that leads here. How to use it after the
installation: [First steps of the administrator](../first-steps.md).

<!-- figure: admin/setup | The Installation check page with the checks and the tests -->

1. The **Check again** button.
2. The summary.
3. The checks, one card per item, each with its state.
4. The tests with the printer, the camera and the scanner.

## Check again

The **Check again** button repeats every check. It serves after each correction: the page does not refresh by itself.

## The summary

Under the title a line sums up the page: "All in order" when no check reports a problem, or how many checks are to look
at or to fix. The tests done by hand do not enter the summary: BiblioViva cannot know how the printer prints or how the
scanner types.

## The states

Every check has a state, always with a colour, an icon and a word.

- **OK** (green): nothing to do.
- **To review** (yellow): it works, but something should be tidied up.
- **To fix** (red): something is really wrong.

A card with several lines takes the state of its worst line. The cards that are not OK have at the bottom the buttons
that open the page of Administration where it is fixed and the **Guide** button, which opens the page of the
documentation that explains that problem.

## Configuration file

The **Configuration file** card reads the file again from the disk, as the server would at start, and also checks the
templates, the reports and the language packs.

- **OK**: "The configuration file is valid."
- **To review**: the file `config.json` is missing and BiblioViva uses the example configuration, because the guided
  setup was not completed; or the configuration has warnings, listed under the line. The warning about passwords in
  clear does not appear here, but in the **Account passwords** card.
- **To fix**: the file on disk is not valid, with the list of errors. The server still uses the last valid
  configuration, but would not start at the next restart.

The buttons open the **Configuration** and the **Configuration history**, from which the last change is undone. Guide:
[Undo a configuration change](../guides/undo-a-configuration-change.md).

## Address and HTTPS

The **Address and HTTPS** card looks at the address the page was opened with, as the server sees it.

- **OK** over HTTPS: the camera and the installation as an app work.
- **OK** over plain HTTP on `localhost`, `127.0.0.1` or `::1`: the page is open on BiblioViva's own computer. The HTTPS
  check concerns the address the other devices use, so it is worth opening this page from one of them too.
- **To review** over plain HTTP in the basic mode on the local network, without Tailscale: everything works with the
  barcode scanner, but the camera and the installation as an app do not.
- **To fix** over plain HTTP on another address, outside the basic mode: the address is not Tailscale's secure one
  (`https://…ts.net`). Over plain HTTP the camera does not work and passwords travel in the clear on the network.

No page of Administration fixes the address: it depends on how the installation was made. The card points to the guide:
for the basic mode [Choose the network](../../setup/choose-network.md#local-network), for the insecure address the
problem "Missing padlock" of [Common problems](../../help/problems.md#missing-padlock).

## Computer and profile

The **Computer and profile** card compares the profile chosen in **Performance** with the computer: it says the memory,
the processors and the disk that holds the data (SD card, spinning disk or SSD; on some computers the kind of disk
cannot be seen).

- **OK**: the computer has the memory the profile needs (about 0.35 GB for the minimal profile, 1.5 GB for the small
  and the medium ones, 3 GB for the large one: BiblioViva is light, and a computer with 4 GB and two processors is
  enough for the large profile).
- A hint, without changing the state: the computer can do more and another profile would make better use of it. With
  an SD card the right profile stays the small one, even with plenty of memory; with a spinning disk the medium one;
  with an SSD the large one, from about 4 GB of memory and two processors.
- **To review**: the profile needs more memory than the computer has. A lighter profile is chosen.

The **Performance** button opens the section of the Configuration where the profile is chosen (see
[Performance](configuration.md#performance)).

## Account passwords

The **Account passwords** card looks at the active accounts.

- **OK**: no password is written in clear in the configuration file and none is equal to one known to everyone.
- **To fix**: one or more accounts still have the example password (`cambiami`) or the demo data's one (`biblioviva`),
  with the names of the accounts. Anyone who knows the password can log in.
- **To review**: one or more accounts have the password written in clear in `config.json`, with the names of the
  accounts. It works, but it should be replaced.

The **Staff accounts** button opens the page of the accounts. Guides: [Change a password](../guides/change-a-password.md)
and [Manage the staff accounts](../guides/manage-accounts.md).

## Backups

The **Backups** card gathers several lines: the folder, the schedule, the last copy and, if it is on, the off-site copy.

- The backups folder: if it cannot be written (a disk unplugged, wrong permissions), the line is **To fix** and says why.
- The schedule: **OK** with the schedule and the time of the next backup; **To review** if the automatic backups are not
  running, and then BiblioViva must be restarted; **To fix** if the schedule is not valid.
- The last copy: **OK** with the name and the time of the last backup; a backup made at start counts like any other.
  **To review** when there is no backup yet, or when the one of the last scheduled time is missing: a computer that was
  off at that moment makes it at start, if the catch-up setting is on. **To fix** when the last backup is more than
  seven days old.
- The off-site copy, only if it is on: **OK** with the last successful copy; **To review** if it has not written its
  status, if it ended badly or if it has stopped for more than two days.

The buttons open **Backups**, to make one at once, and **Backup schedule**, the section of the Configuration. Guides:
[Make and download a backup](../guides/make-a-backup.md); for a backup that does not run, the problems "Backup not made"
and "Computer left off" of [Common problems](../../help/problems.md).

## Printer

The **Printer** box gathers the test pages. Each row has the **Print** button, which opens the page in a new browser tab,
to print with the scale at 100 % and without "Fit to page": the 10 cm ruler must measure 100 mm.

- **Card test page**: empty units with cut and fold marks and the ruler.
- **Label sample sheet**: labels with the barcodes of made-up copies. They also serve to try the scanner.
- **Label calibration page**: the outlines of the adhesive label sheet, to lay over a real sheet.
- **Two-sided calibration sheet**: for cards printed on both sides; its row also has the **Guide** button for the full
  procedure.

Guides: [Calibrate two-sided printing](../guides/calibrate-duplex.md) and, for a print too small or shifted, the problem
"Print too small or misaligned" of [Common problems](../../help/problems.md#print-too-small-or-misaligned).

## Camera

The **Camera** box has the **Try the camera** button, which opens the Photo census: the browser asks for permission to
use the camera the first time. With patron photos switched off the button opens New book instead, where the camera reads
the ISBN barcode.

With an address without HTTPS the button is off and the box explains that the camera is not available: a secure page is
needed. The problem is the same as in the **Address and HTTPS** card. Guide: the problem "Camera that does not start" of
[Common problems](../../help/problems.md#camera-that-does-not-start).

## Barcode scanner

The **Barcode scanner** box has a field, **Code read by the scanner**, that searches and saves nothing. Click in the
field and read a code, for example that of a label of the sample sheet. Below appear:

- **The scanner typed**: the text as it arrived.
- **BiblioViva reads it as**: the code the desk gets from it, with the same rules as every code field.
- **Type**: copy, card, ISBN or "Not recognised".
- **Enter key**: whether the key came after the code. If it has not come after a second and a half, the line says to
  switch on the Enter suffix in the scanner.

A coloured line gives the verdict. If the scanner typed an apostrophe `'` in place of the dash `-`, or another character
in place of one of the code, the line says so: the keyboard declared to BiblioViva does not match the scanner's.
BiblioViva corrects the reading anyway, but the two should match: it is changed in the **Computer keyboard** field of the
**Barcodes** section of the [Configuration](configuration.md#barcodes). The **Clear** button empties the field and the
reading.

Guide: the problem "Scanner that types strange characters" of
[Common problems](../../help/problems.md#scanner-that-types-strange-characters).
