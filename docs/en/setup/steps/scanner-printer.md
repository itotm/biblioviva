# Test the scanner and the printer

This step connects the USB barcode scanner to the circulation desk computer and checks that BiblioViva prints cards and
labels in the right sizes. It is for whoever has completed the [first run](first-run.md) and signed in as `admin`. The
step takes about 30 minutes, test printing included.

## Requirements

- The USB barcode scanner, of the kind that "types" the code like a keyboard, with its own cable.
- The circulation desk computer, with the printer already installed and working: the installation of the printer is
  described by its maker.
- A4 sheets of plain paper for the test printing.
- A ruler in millimetres.
- If adhesive labels will be used: a sheet of labels of the kind that will really be used.
- A book with a printed barcode (any book with the ISBN code on the back).

## Procedure

### Connect the scanner

The scanner is connected to the circulation desk computer, not to the computer BiblioViva runs on. The scanner behaves
like a keyboard: every code read is written in the active field, followed by the Enter key.

1. Connect the scanner's USB cable to a port of the circulation desk computer.
1. Wait for the scanner to give the ready signal, usually a short sound or a light.

### Test the scanner in a text field

1. Open BiblioViva in the browser of the circulation desk computer and sign in as `admin`.
1. Open **Catalogue**.
1. Click in the search field **Search by title, author or ISBN…**.
1. Read with the scanner the barcode of a book, the ISBN one.
1. Check that the digits that appeared in the field are the same as those printed under the barcode.

The field changes nothing in the data: the reading only serves to see what the scanner writes.

### Test the "-" character and the keyboard

The codes of the copies have a hyphen, like `2026-E0267`. A scanner set for a keyboard different from the computer's
writes another character in its place, usually the apostrophe `'`. To test it a code with a hyphen is needed: the sample
sheet of the labels has one.

1. Open **Administration** → **Configuration** → **Print templates**.
1. Open the **Previews** tab.
1. Open the **Labels** tab.
1. Press **Sample sheet**. The sheet opens in a new browser tab.
1. Press Ctrl+P to open the print window and print the sheet on plain paper, with the settings of the section
   [Set the print window](#set-the-print-window).
1. Go back to the **Search by title, author or ISBN…** field of **Catalogue**.
1. Read with the scanner the barcode of one of the printed labels.
1. Check that the code in the field is the same as the one written on the label, hyphen included.

If an apostrophe `'` or another character appears in place of the hyphen, the keyboard declared to BiblioViva does not
match that of the computer.

1. Open **Administration** → **Configuration** → **Barcodes**.
1. Choose in **Computer keyboard** the language of the keyboard of the computer the scanner is plugged into. In Italy it
   is "Italian".
1. Press **Save** and repeat the reading of the label's code.

BiblioViva accepts anyway the codes read with both keyboards, but it is better that the scanner too is set to the
computer's keyboard. The scanner's manual describes the procedure, which depends on the model and usually involves
reading programming barcodes.

### Set the print window

The browser opens its own print window with Ctrl+P. The sizes of cards and labels are in millimetres and are valid only
if the page is neither reduced nor enlarged.

1. Choose the printer and the A4 sheet.
1. Set the scale to 100 %. The browser calls it "Actual size" or "100"; do not choose "Fit to page" nor "Fit to
   printable area".
1. Set the margins to "None".
1. Switch off "Headers and footers", that is the date and the address the browser adds at the top and bottom.
1. Print.

[VERIFY: the exact names of the entries of the print window in Firefox, Chrome and Edge]

### Print the test page of the cards

1. Open **Administration** → **Configuration** → **Print templates**.
1. Open the **Previews** tab.
1. Open the **Cards** tab.
1. Press **Print test page**. The page opens in a new tab.
1. Print with the settings of the section [Set the print window](#set-the-print-window).
1. Measure with the ruler the "10 cm ruler" mark printed on the page: it must measure 100 mm.
1. Measure one unit of the page, that is front and back side by side: with the supplied template it measures
   171.2 × 54 mm, with the fold at 85.6 mm. [VERIFY: on the real test sheet]

The test sheet shows the empty units, with the cut and fold marks: the real cards are printed later, from the patrons
page.

### Print the calibration page of the labels

A sheet of adhesive labels has a fixed size: the calibration page draws every label with its outline, to compare with a
real sheet.

1. Open **Administration** → **Configuration** → **Print templates**.
1. Open the **Previews** tab.
1. Open the **Labels** tab.
1. Choose in **Adhesive stock** the sheet the library will use. The proposed sheet has labels of 70 × 48 mm, 18 per
   sheet.
1. Press **Print calibration page**. The page opens in a new tab.
1. Print on plain paper with the settings of the section [Set the print window](#set-the-print-window).
1. Measure with the ruler the "10 cm ruler" mark printed on the page: it must measure 100 mm.
1. Lay the test sheet over a sheet of real labels, against the light or against a window.
1. Check that the printed outlines coincide with the labels.

If the outlines do not coincide, the sizes of the label sheet are not those of BiblioViva. The sizes are corrected in
**Administration** → **Configuration** → **Labels** → **Adhesive label sheets**; the procedure to measure a sheet not
provided is in the technical page
[Print templates: authoring guide](../../../templates-authoring.md#measuring-a-sheet-and-checking-the-output).

## Check before going on

- A code read by the scanner appears in the search field the same as the printed one, with the hyphen and no other
  characters. If not, check **Computer keyboard** as described above.
- The "10 cm ruler" of the cards test page and that of the calibration page measure 100 mm. If they measure less or
  more, the print window reduced or enlarged the page: go back to [Set the print window](#set-the-print-window).
- The outlines of the calibration page coincide with the labels of the real sheet.

## Possible problems

### The scanner writes nothing

Try another USB port and check that the field was clicked before reading. The scanner must be connected to the
circulation desk computer.

### The scanner writes the code but BiblioViva does not accept it

At the desk the scanner must send the Enter key after the code, because the code fields accept it only with Enter. The
scanner's manual explains how to enable the Enter suffix.

### The scanner writes wrong characters in place of the hyphen

See the section on the keyboard, above, and the page
[Common problems](../../help/problems.md#scanner-that-types-strange-characters). The technical explanation is in the
page [Deployment notes (technical)](../../../deploy.md#installing-updating-logs-step-85).

### The printed ruler measures less than 100 mm

The scale of the print window is not at 100 %.

### The printout has dates and addresses at the edges of the sheet

The browser's headers and footers are on.

## Related pages

- Previous step: [Connect the devices](devices.md)
- Next step: [Backups](backups.md)
- [Common problems](../../help/problems.md)
