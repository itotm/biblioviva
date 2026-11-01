# Reference: the library's current patron cards

The built-in card template `default` (PLAN.md §3.12, step 2.5, Appendix C) reproduces the cards the library prints
today from Koha. The sample printout examined is **not stored in the repository** because it shows
photos and names of minors (even blurred); this description replaces it.

## Sheet

- A4 portrait, four units stacked vertically, each unit = front on the left and back on the right, sharing the short
  edge (cut out, fold once).
- Units are outlined by a thin red line used as the cutting guide; there are no fold or crop marks.
  BiblioViva prints crop marks and the fold instead (`cards.sheet.cutMarks`, `cards.sheet.foldMarks`);
  `cards.sheet.cutLines` draws the coloured outline.
- The sample cards are slightly taller than credit-card format; BiblioViva uses CR80 (85.6 × 53.98 mm) and keeps
  the proportions of the layout below.

## Front (white background)

Positions are given as fractions of the face width (w) and height (h), then as the millimetres used by the template.

| Element | Position in the sample | Template (mm on 85.6 × 53.98) |
|---|---|---|
| School logo (round monochrome emblem) | top-left, about 0.05–0.22 w, 0.05–0.32 h | left 3, top 2.5, 16 × 16 |
| Library name, serif italic ("Biblioteca Bergognone") | top, centred over the space right of the logo, about 0.08 h | left 21, right 3, top 3, 3.6 mm type |
| ID photo, portrait 3:4 | right column, about 0.57–0.95 w, 0.14–0.75 h | right 4, top 8, 24 × 32 |
| First name, grey, regular | left, about 0.45 h | left 4, top 22, 3.4 mm type |
| Surname, black, bold | directly under the first name | same block |
| Group line ("Sezione B") | left, about 0.68 h | left 4, top 35, 3.2 mm type |
| Barcode, Code 39, no text | left, about 0.07–0.57 w, 0.78–0.90 h | left 4, top 40, 40 × 7 |
| Card number, bold, centred under the barcode ("0000001240") | about 0.93 h | left 4, top 47.5, width 40, 3.4 mm type |

Notes:

- Only the **section** is printed, not the class year, so the card remains valid while the pupil moves from class 1
  to class 5 in the same section. Teachers get `Docente` (students and teachers are the only patron types).
- No school year, validity date, rules text or signature line.
- Card numbers are legacy counters zero-padded to 10 digits (`0000001240`); new numbers are 9-digit counters plus a
  Luhn digit and start above the highest legacy number (PLAN.md §3.7).

## Back

A single illustration filling the whole face (children reading, with the caption "giulia orecchia per i bambini di
bergognone"), no text, no barcode. The artwork is commissioned and belongs to the school: it is never committed, and a
copy of the `default` template in `CONFIG_DIR` takes it as its back's picture at deployment. The repository's `default`
template has a shipped background on its back instead (`background-d4.webp`, step 11.17).
