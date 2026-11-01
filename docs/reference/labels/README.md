# Reference: the library's current book labels (Koha plugin output)

These files are the **functional reference** for the `pair-default` label template (PLAN.md §3.12, step 3.8, Appendix G).
They were produced by the Koha label plugin the library uses today and must be reproduced by BiblioViva
in structure and proportions (pixel identity is not required).

- `koha-etichette.html` — the page the plugin generates (kept verbatim, including its CSS and per-label scripts). It
  references Koha URLs (`/cgi-bin/koha/svc/barcode`, `/intranet-tmpl/.../<code>.gif`) and a CDN, so it does not render
  offline; read it, do not serve it.
- `koha-etichette.png` — how the page prints on an A4 sheet, with the library's own pictograms masked by grey discs
  (they were an example only and are not kept in the repository, step 11.14; BiblioViva prints its generated ones).

## Geometry (measured from the CSS)

| Property | Value | BiblioViva stock `a4-70x48` |
|---|---|---|
| Paper | A4 portrait, `body { width: 210mm }` | `paper: "A4"` |
| Top margin | `.page { padding-top: 4mm }` | `marginMm.top: 4` |
| Left margin | `.page { margin-left: 0 }` | `marginMm.left: 0` |
| Cell (one adhesive label) | `.etichetta` 70 × 45 mm + `padding-top: 3mm` → 70 × 48 mm pitch | `labelMm: 70 × 48` |
| Columns × rows | 3 × 6 cells (18 labels per sheet) | `columns: 3, rows: 6` |
| Unit (one book) | `.label` 70 × 96 mm = two cells stacked vertically → 3 × 3 = 9 books per sheet | template `unit: { cells: 2, stack: "vertical" }` |
| Gaps | none | `gapMm: { x: 0, y: 0 }` |

The plugin adds a 3 mm `padding-top` inside each cell; the template keeps it in `style.css`.

## Content of each unit

Top cell (spine band, "fascetta"; the 70 mm width wraps around the spine onto both covers):

1. item barcode as text, 10 pt bold (`.titolo`)
2. title truncated to 30 characters, 10 pt bold
3. classification pictogram, 20 × 20 mm, `margin: 2mm` (`img.categoria`)
4. call number head, large bold, uppercase (`primaRiga`)
5. call number rest, large bold, uppercase (`secondaRiga`)

Bottom cell (internal barcode label):

1. full call number, 10 pt bold, `margin: 3pt 0 5pt` (`.segnatura`)
2. title truncated to 30 characters, 12 pt italic, normal weight (`.titolo-barcode`)
3. barcode image 50 × 15 mm, `margin: 3mm`, **Code 39** without text (`img.barcode`)
4. barcode as text, 15 pt bold (`.barcode`)

Font: `Arial, Helvetica, sans-serif`, bold, centred, `overflow: hidden`.

## Mapping from the plugin's data to BiblioViva fields

| Plugin | Meaning | BiblioViva |
|---|---|---|
| `"2026-0267"` | item barcode | `item.barcode` (new items: `YYYY-NNNNC` with Luhn digit) |
| `"La casa segreta".substring(0, 30)` | title | `biblio.title_short` (`labels.titleMaxChars` = 30) |
| `"B 4 DEL"` | call number | `item.call_number` |
| `if("4"=="S")` | the *class or `S`* field: reading class for fiction, `S` (saggistica) for non-fiction | `classification.is_fiction` / `is_nonfiction`, `classification.reading_class` |
| `primaRiga = "B 4 DEL".slice(0, 3)` | fiction: genre letter + class | `call.head` |
| `secondaRiga = "B 4 DEL".slice(4)` | fiction: author cutter | `call.rest` |
| `primaRiga = <code>`, `secondaRiga = categorieSaggistica[code]` | non-fiction: class code + class name | `call.head`, `classification.label` |
| `codice = "B"`; digits → first digit + `"00"` | pictogram file: genre letter, or the Dewey hundred | `classification.image_url`; children inherit the parent's image (§3.17) |
| `categorieSaggistica` | non-fiction taxonomy | `classification.nonfiction` in `config.json` (Appendix A) |
| `type=Code39` | barcode symbology | template `barcode.symbology`: `code128` for new labels (Q65); scanning still reads the old Code 39 labels |

Notes for the implementer:

- The plugin's non-fiction branch is buggy (`categorieSaggistica[B]` uses an undefined variable, and keys such as `001`
  are octal literals in JavaScript), so the printout only proves the fiction layout. Test the non-fiction layout with
  the rules above (code on the first line, class name in capitals on the second).
- The sample uses the legacy barcode format `YYYY-NNNN`; new labels carry the check digit.
