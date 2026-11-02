# Print templates: authoring guide

Cards, labels and slips are rendered from **template folders** (PLAN.md §3.12). A folder is copied,
renamed and edited; no code is involved. This page covers the parts common to every kind, the
card templates, the label templates and the slips in detail.

## Where templates live

| Kind | Built-in (shipped with the app) | Yours (configuration volume) |
|---|---|---|
| Cards | `config/cards/templates/<name>/` | `CONFIG_DIR/cards/templates/<name>/` |
| Labels | `config/labels/templates/<name>/` | `CONFIG_DIR/labels/templates/<name>/` |
| Slips | `config/slips/templates/<name>/` | `CONFIG_DIR/slips/templates/<name>/` |

A folder in `CONFIG_DIR` with the **same name** as a built-in replaces it. The built-ins are copied
into `CONFIG_DIR` at the first start, so editing `CONFIG_DIR/cards/templates/default/` changes the
default card; copying that folder to `CONFIG_DIR/cards/templates/mia-scuola/` and pointing
`cards.defaultTemplate` (or `cards.templateByPatronType`) at `mia-scuola` keeps the original intact.
Names: letters, digits, `-` and `_`.

A copy that nobody edited follows the application: at every start, a folder of `CONFIG_DIR` whose
every file is a version the application shipped (spaces and line breaks of HTML, CSS and JSON do
not count) is replaced by the current built-in, so improvements and fixes of the built-ins reach
every installation. Once any file of the copy is changed (by hand, in the designer, or with an asset
uploaded) the copy is yours and is never replaced. After changing a built-in template, run
`bun run templates:shipped`: it records the shipped versions (`src/lib/server/templates/shipped.json`)
from the git history, and a unit test fails until it is run.

The same operations are available in **Administration → Configuration → Print templates**
(`/admin/config/templates`, administrators): "Customise" copies a built-in folder under its own
name, "Duplicate" copies any folder under a new name (lowercase letters, digits, `-`, `_`),
"Rename" moves a folder of `CONFIG_DIR` and updates the settings that name it, "Delete" removes
it (refused while a setting names it, unless a built-in with the same name takes its place again —
"Back to the original"), and the files of `assets/` are uploaded or removed there (PNG, JPEG, WebP,
GIF, SVG without scripts, WOFF2, WOFF, TTF; 5 MB at most; a file mentioned by the HTML or CSS
cannot be removed). Each operation is one change of the configuration history. Every change of the
configuration is also refused when it would leave a setting naming a template that does not exist.

## Editing from the admin UI: drawing and code

A template of `CONFIG_DIR` opens in **Configuration → Print templates → Edit**
(`/admin/config/templates/<kind>/<name>`; a built-in is customised first). Cards and labels open
in **Design**, slips in **Code**. Both tabs edit **the same files**: switching from the drawing
to the code writes the drawing into the files, switching back reads the files into the drawing, so
a change made in one is what the other shows and nothing is dropped. There is no layout file beside
the faces (a `design.json` in a folder is not read, and the next save removes it).

- **Design** (cards and labels): each face or cell at its real size — for labels every layout of
  the unit, the full one and each variant by cell height, previewed on a stock of the template that
  selects it — with the boxes of its elements drawn over the preview. Elements are moved with the
  mouse, the arrow keys (one step of the grid; with Shift about 5 mm, a whole number of steps) or the numbers of the side panel, resized from
  the corner, restyled (size, typeface, bold, italic, capitals, alignment, colour), sent backward or
  forward, removed; new ones are added: a field (`DESIGN_FIELDS` in `#lib/shared/template-design.ts`,
  a subset of the field lists below), a fixed text, the barcode, the photo (cards), the pictogram
  (labels), an image of `assets/`, a box, or **free HTML**. With nothing chosen, the panel sets the
  background colour and image of the face (on its root element); the image is one of `assets/`,
  "None" (`background-image:none`, which also hides a picture the style sheet gives the face) or
  "Default" (none of its own: the style sheet's, if any).
  Moves and sizes snap to the **grid** chosen above the canvas (none — free, to a tenth of a
  millimetre —, 0.5, 1, 2, 2.5, 5 or 10 mm; 2 mm by default, remembered by the browser), drawn over
  the face one line per step (every 2, 5 or 10 steps when the lines would be closer than 6 px), each
  line where the moves land.
- **Code** (every kind): the HTML, CSS and `template.json` of the folder.

### How the drawing reads the files

- An **element** is a direct child of the face's root element (`<div class="face front">`, a
  label's wrapper such as `<div class="band">`), or of the file when the file has no single root.
  Elements inside a Mustache section at that level (`{{#x}}<img …>{{/x}}`) and `<style>` blocks
  stay as code: the drawing keeps them and says so; put the section inside the element instead
  (`<div …>{{#x}}…{{/x}}</div>`) to draw it.
- An element is **placed** when its own `style` attribute says `position:absolute` and gives
  `left`, `top`, `width` and `height` (mm, or cm, in, pt, px, converted). The drawing reads and
  writes its look there too: `font-size`, `font-family`, `font-weight`, `font-style`,
  `text-transform`, `text-align`, `color`, and for boxes `background-color` and
  `border: <w>mm solid <colour>`. A value the element does not set shows lighter in the panel (it
  comes from `style.css`); changing it writes it on the element, where it wins over `style.css`.
- An element **not placed** (laid out by `style.css` or by the normal flow, as in the built-in
  labels, which adapt to the width of any stock) is drawn where the preview shows it, with a
  dotted outline. The first move on a face writes the measured place of **all** its unplaced
  elements into their `style` (with `margin:0; box-sizing:border-box`), so nothing jumps; from
  then on that face has fixed places for the stock it was drawn on.
- What an element shows comes from its content: `{{field}}` alone is a **field**, plain text a
  **text**, `{{{barcode_svg}}}` the **barcode** (give the element the class `bv-barcode`: the
  engine's base rule `.bv-barcode > svg { display: block; width: 100%; height: 100%; }` makes the
  bars fill it), `<img src="{{photo_url}}">` or a `{{#patron.has_photo}}` section around it the
  **photo**, `<img src="{{classification.image_url}}">` the **pictogram**,
  `<img src="{{#asset}}file{{/asset}}">` an **image**, an empty element a **box**; anything else
  is **free HTML**, whose content is edited as code in the panel while the box is moved and styled
  on the canvas.
- Writing back changes only the elements that changed; every other byte of the files — other
  attributes, classes, comments, sections, style declarations the drawing does not know,
  `style.css`, `template.json` — stays as it was.

Large background images are better set in `style.css` (embedded once per print job) than on the
face's root, where the drawing puts them (embedded once per card).

The preview renders the draft from a temporary copy of the folder exactly as printing does (sample
patron, sample copy, sample overdue groups); a draft that does not load or render — an unknown
field, a broken `template.json` — shows the problem and cannot be saved. Each save is one change
of the configuration history.

## What a folder contains

| File | Purpose |
|---|---|
| `template.json` | metadata (see the kinds below); validated at load time |
| `*.html` | [Mustache](https://mustache.github.io/mustache.5.html) templates of each face or cell |
| `style.css` | CSS in **millimetres**; the app scopes it to this template so it cannot affect anything else |
| `assets/` | images and fonts referenced with `{{#asset}}file.png{{/asset}}` (allowed: png, jpg, webp, svg, gif, woff, woff2, ttf) |

`{{#asset}}…{{/asset}}` works in the HTML and in `style.css`; the file is embedded as a data URL, so
previews and printouts never depend on the network. Paths with folders are refused.

Mustache in three lines: `{{field}}` prints a value (HTML-escaped), `{{{field}}}` prints it as is
(only for fields declared *raw* below), `{{#flag}}…{{/flag}}` shows the part when the flag is true,
`{{^flag}}…{{/flag}}` when it is false. Unknown fields are an **error** (the template is refused with a
message naming the field), so typos never print an empty box silently.

## Cards

Each card is a **unit** of two faces side by side, front on the left and back on the right, that
is cut out and folded on the shared short edge (CR80 faces, 85.6 × 53.98 mm; `cards.cardMm` in the
configuration). The sheet (A4 portrait, `cards.sheet.rows` units per page, margins, gaps, cut lines,
fold and crop marks) is drawn by the app, **not** by the template: the template only draws the two faces.

`template.json`:

```json
{
	"name": "default",
	"description": "Tessera come quella attuale",
	"patronTypes": ["student", "teacher"],
	"bleedMm": 0,
	"barcode": { "widthMm": 40, "heightMm": 7, "text": false }
}
```

- `patronTypes`: which patron types the template is meant for (informational; the configuration
  decides which template each type uses). A print job whose patron types use different templates
  prints the cards of each template on sheets of their own, at that template's size, one template
  after the other in the same document.
- `cardMm` (`{ "width": …, "height": … }`): the card's own size; left out, `cards.cardMm` of the
  configuration (85.6 × 53.98 by default). The designer sets it ("Card size": width,
  height, rotate, back to the default) and draws the faces at that size; a sheet takes the rows that
  fit the page. Front and back side by side must fit the A4 width inside the margins and one card
  the height: with the 6 mm margins of `cards.sheet.marginMm`, at most 99 × 285 mm. A larger size
  is refused when the template is saved, and the preview and the print say so.
- The marks on the sheet are not part of a template: every sheet of cards follows `cards.sheet` of
  the configuration (Administration → Configuration → Cards). The **crop marks**
  (`cards.sheet.cutMarks`, on by default) extend every cut line of the cards into the margins of the
  paper and the gaps between the cards — short black lines 1 mm away from the card, never over it —
  so a ruler laid on two marks cuts along the edge with a cutter; on a sheet printed on both sides
  they are on the page of the fronts. The fold of a side-by-side unit is marked the same way, dashed
  (`cards.sheet.foldMarks`, on by default). `cards.sheet.cutLines` draws a coloured outline on each
  card (off by default: `null`). The print dialog's cutting step follows the same settings.
- `barcode`: size and whether the number is printed under the bars by the barcode itself (the
  default template prints it separately); `symbology` (`code128` or `code39`) only to force a type:
  left out, the card follows `barcodes.patron.symbology` (Administration → Configuration → Barcodes).

Files: `front.html`, `back.html`, `style.css`, `assets/logo.png` and the background picture. The
root element of each face must carry the class `face` plus `front` or `back`; the app sizes `.face`
to the card format, positions inside it are absolute, in mm. The built-in fronts place each element
in its own `style` attribute, as the drawing does, and each face carries its background (colour and
picture) on its root element, where the drawing reads it; `style.css` keeps the rules common to the
faces (font, colour).

Three card templates are shipped (step 11.17): `default` (the library's card: logo, library name,
photo, name, class and barcode on the front, a full-page illustration on the back), `fronte-retro`
(text on both sides: the back names the library and the school year and asks whoever finds the card
to bring it back) and `verticale` (a portrait card, `cardMm` 53.98 × 85.6: a sheet takes the rows
that fit the page). Copy one to change it.

**Backgrounds.** `config/cards/backgrounds/` holds pictures ready for the cards
(`backgrounds.json` lists each with its orientation); the designer offers those of the face's
orientation ("Choose a background") and copies the chosen one into the template's `assets/` as
`background-<name>.webp`, or takes a picture uploaded from the computer ("Upload a picture").
Each shipped picture is the card plus 3 mm of bleed on every side, so the face writes it with
`background-size: calc(100% + 6mm) calc(100% + 6mm); background-position: center` (the trim of the
picture on the card, the extra part cut away); any other picture is written with
`background-size: cover`.

### Fields

| Field | Content |
|---|---|
| `{{library.name}}` | `library.name` from the configuration |
| `{{school_year}}` | e.g. `2026/2027` (from the print date and `library.schoolYearStart`), or `2026` where `library.schoolYearLabel` is `start` |
| `{{issued_on}}` | print date, `YYYY-MM-DD` |
| `{{valid_until}}` | print date + `cards.validityMonths` (empty when null) |
| `{{photo_url}}` | the patron photo as a data URL, or a neutral silhouette |
| `{{{barcode_svg}}}` | the card barcode as inline SVG (**raw**, triple braces) |
| `{{patron.first_name}}`, `{{patron.last_name}}` | names |
| `{{patron.card_number}}` | the 10-digit number |
| `{{patron.class_label}}` | the class as `school.classLabel` writes it: `3 A` (a teacher: the name of their group, `Docenti`) |
| `{{patron.level_label}}`, `{{patron.level_name}}` | the year: `3`, `Terza primaria` (empty for teachers) |
| `{{patron.group}}` | the name of the class or group: `A`, `Docenti` |
| `{{school.group_word}}` | `school.groupWord`, the word before the class name (`Sezione`) |
| `{{patron.class_line}}` | the class line of the card, `school.cardClass` filled in: `Sezione A` by default, `1年2組`, `Klasse 7b` (a teacher: the name of their group) |
| `{{words.teacher}}` | the word for a teacher in the installation's language (`Docente`, `Teacher`); the shipped templates print every fixed word from `words.*`, so they follow the language |
| `{{patron.patron_type}}` | `student` or `teacher` |
| `{{#patron.is_student}}…{{/patron.is_student}}` | section shown for students only |
| `{{#patron.is_teacher}}…{{/patron.is_teacher}}` | section shown for teachers only |
| `{{#patron.has_photo}}…{{/patron.has_photo}}` | section shown when a photo exists (`{{^patron.has_photo}}` otherwise) |

Everything is HTML-escaped except `barcode_svg`; a surname such as `D'Angelo <b>` prints literally.

### Checking a template

- `Administration → Configuration → Print templates` (`/admin/cards/templates`, permission `admin`)
  lists every folder with its source (shipped or configuration), its validation state (slips are
  checked against the slip schema of their `template.json`) and the templates the settings name,
  previews the selected card template at real size (100 % / 200 %) for a made-up
  sample patron or a real one found by name, shows a whole A4 sheet of the sample, and prints a
  **test page** (`/print/cards/test?template=<name>`: empty units drawn by the sheet code of the real
  cards, with the cut lines, fold and crop marks of the configuration, and a 10 cm ruler).
  A broken folder is listed with its error and cannot be previewed; the other templates keep
  working. "Reload templates" re-reads the folders after an edit: nothing is cached.
- The labels tab has a **calibration page** per adhesive stock
  (`/print/labels/calibration?stock=<id>`): every cell outlined with its index and size plus the
  ruler, to print on plain paper and hold against a sheet of labels.
- `/print/cards/<patron id>` renders one unit; `/print/cards?group=<class id>` a whole class (`&level=<code>` for one year of a pluriclasse);
  `?template=<name>` forces a template; `?missingCard=1` selects patrons whose card was never printed;
  `?list=<id>` a print list of patrons (a list of copies is refused, as a list of patrons is by the
  labels).
- After printing, "Mark as printed" on the patron page (or on the print list) records the date.
- Print with **scale 100 %** and no "fit to page": the printed unit must measure 171.2 × 54 mm with
  the fold at 85.6 mm. The crop marks are the cutting guide (a coloured outline only with
  `cards.sheet.cutLines`); the print dialog says what to cut along.
- **Two ways of printing** (step 9.27, Q127), chosen in the dialog of every "Print cards"
  (`layout=side-by-side|duplex` on the print address, `cards.layout` the default): **side by side**,
  front and back on one side of the sheet, cut and folded on the short edge (any printer, four or
  five per A4); or **on both sides of the sheet**, for a printer that prints both sides: a page of
  fronts (as many as fit inside the margins with the gaps, 2 × 5 on A4), then a page of backs at the
  mirrored places — the column mirrored when the sheet turns on its long edge, the row when it turns
  on its short edge (`cards.duplex.flip`, the same choice as in the print window) — moved by
  `cards.duplex.backOffsetMm`. The faces are never mirrored or turned: a template has nothing to
  change. Every card is placed in mm from the corner of the paper (`@page { margin: 0 }`).
- **Bleed and safe area**: printed on both sides, a face's background (the root element of the face,
  its `background` from the face's `style` or `style.css`) runs `bleedMm` (template or `cards.bleedMm`)
  past the edge, so a back moved by a millimetre leaves no white border (the picture keeps the face's
  size and centre: what shows past the edge continues the face); keep text and photos at
  least 2 mm inside the edge (the designer draws this safe area as a dashed line).
- **Calibration** (Administration → Configuration → Cards → "Calibrate two-sided printing",
  `/admin/cards/calibration`, administrators): `/print/cards/calibration` prints a 150 × 100 mm card on
  both sides — side 1 with its outline to cut along, side 2 with two rulers in mm behind its left and
  top edges. Cut side 1 out, read on side 2 where the cut edges cross the rulers, type the two values:
  they are added to the offset in use, and a second print shows the edges on 0.

## Labels

Book labels (step 3.8) use the same folder convention, but their **geometry comes from the adhesive
stock**, not from the template: `labels/stocks/<id>.json` describes each sheet product (label width
and height in mm, columns, rows, top and left margins, horizontal and vertical gaps, corner radius,
paper) and the renderer places the cells absolutely on an A4 page with `@page { margin: 0 }`. A
template only draws the **inside of one cell** (or of each cell of a unit); it is sized to the
stock's `labelMm` and scoped like a card template.

Three kinds ship, each with a built-in template and its own defaults in `labels.<kind>`
(`template` and `stock`):

| Kind | Template | Unit | What it is |
|---|---|---|---|
| `pair` (default) | `pair-default` | 2 cells stacked vertically: `top.html` (spine band) + `bottom.html` (barcode label) | the library's current printout: 70 × 96 mm per book on the `a4-70x48` sheet, 9 books per page |
| `barcode` | `barcode-default` | 1 cell, `label.html` | the internal barcode label alone (reprints) |
| `spine` | `spine-default` | 1 cell, `label.html` | the spine band alone (reclassifications); a compact colour-band layout on small stickers |

`template.json` of `pair-default`:

```json
{
	"name": "pair-default",
	"description": "Coppia impilata: fascetta dorso sopra, etichetta barcode sotto",
	"kind": "pair",
	"unit": { "cells": 2, "stack": "vertical", "files": ["top.html", "bottom.html"] },
	"stocks": ["a4-70x48", "a4-70x24"],
	"variants": {
		"full": { "minCellHeightMm": 40 },
		"compact": { "maxCellHeightMm": 39.9, "files": ["top-compact.html", "bottom-compact.html"] }
	},
	"barcode": { "widthMm": 50, "heightMm": 15, "text": false }
}
```

- `kind`: which job the template serves; the print dialog offers the template configured for each kind.
- `unit.cells`: how many consecutive cells (top to bottom, same column) one book occupies; the stock's
  `rows` must be a multiple of it, otherwise the stock is refused for that template. `unit.files`
  lists one HTML file per cell; without it the convention is `label.html` (1 cell) or `top.html` +
  `bottom.html` (2 cells).
- `stocks`: the stock ids the layout was designed for (informational; the first is the preview default).
- `variants`: layouts chosen by the **cell height** (`minCellHeightMm` / `maxCellHeightMm`, the first
  match wins); a variant may name its own files. This is how one template serves both the 48 mm and
  the 24 mm sheets.
- `barcode`: size and whether the human-readable text is drawn under the bars (the built-ins print it
  as a separate line); `symbology` (`code128` or `code39`) only to force a type: left out, the label
  follows `barcodes.item.symbology` (Administration → Configuration → Barcodes).

### Fields

| Field | Content |
|---|---|
| `{{item.barcode}}` | the copy's barcode (`2026-00427`, or a legacy number) |
| `{{item.call_number}}` | the copy's call number (segnatura), or the suggested one when empty |
| `{{item.item_type}}` | the item type code (`libro`, `dvd`, …), the record's: the same for every copy of the title |
| `{{call.head}}`, `{{call.rest}}` | the call number split at its last token: `B 4` + `DEL`, `590` + `ROS`, `B` + `DEL` |
| `{{biblio.title_short}}` | the title cut to `labels.titleMaxChars` characters (30) |
| `{{biblio.author_short}}` | the part of the author before the comma (`Rossi`) |
| `{{biblio.publication_year}}` | the year, or empty |
| `{{biblio.series}}` | the series (`Harry Potter`), or empty |
| `{{biblio.series_number}}` | the number in the series (`3`), or empty |
| `{{classification.kind}}`, `{{#classification.is_fiction}}…`, `{{#classification.is_nonfiction}}…` | `fiction` / `nonfiction` and the two sections |
| `{{classification.code}}`, `{{classification.label}}` | genre letter or class code, and its name (`Animali`) |
| `{{classification.image_url}}` | the pictogram as a data URL (a child class inherits its parent's; a generated disc with the code when no file exists) |
| `{{classification.color}}` | the node's colour (`#e53935`) or empty |
| `{{classification.reading_level}}` | the reading level of the record (its code, PLAN.md Phase 12.6), or of the copy when `classification.classPerItem` is on |
| `{{library.name}}` | the library name |
| `{{#labels.monochrome}}…{{/labels.monochrome}}` | section shown when `labels.monochrome` is on (black-and-white printer: the compact spine band hatches its colour stripe) |
| `{{{barcode_svg}}}` | the barcode as inline SVG (**raw**), sized by the template CSS |

### Measuring a sheet and checking the output

1. Write the stock: measure the first label's distance from the top and the left edge of the sheet
   (`marginMm`), one label (`labelMm`), and the space between two labels in each direction (`gapMm`);
   count columns and rows. Save it as `CONFIG_DIR/labels/stocks/<id>.json` (copy an existing file),
   or enter it in **Configuration → Labels → Adhesive label sheets**, where a drawing of the
   A4 page follows the numbers and a changed code is followed by the label jobs and by the
   `stocks` lists of the label templates in `CONFIG_DIR`.
2. Print the **calibration page** of the stock on plain paper (`Administration → Configuration → Print
   templates → Labels`, or `/print/labels/calibration?stock=<id>&kind=pair`): every cell is
   outlined with its index, the units of the kind in a heavier line, plus a 10 cm ruler. Hold it
   against a real sheet of labels; adjust the margins until the outlines sit on the labels. Print
   at **scale 100 %**, never "fit to page".
3. Preview the template on that stock in the same page (real size or 200 %, fiction or non-fiction
   sample) and print the **sample sheet** (`/print/labels/<kind>?sample=1&template=<name>&stock=<id>`).
4. Print for real from a print list, the catalogue selection, a record page or the dashboard tile
   (labels still to print): the dialog asks the kind, the stock and the **first free position** on a
   partially used sheet (counted in units: in pairs for the pair kind), opens the print page in a new
   tab and then offers "Mark as printed", which records `barcode_label_printed_at` /
   `spine_label_printed_at` (a pair sets both).

Pictograms: the library's existing images, named by code (`B.gif`, `500.gif`, `MMM.gif`, …), are
imported with `bun run classification:import-images <folder>` into `CONFIG_DIR/classification/images/`
(GIF and other rasters converted to PNG, SVG copied); the command lists the codes still without an image.

## Slips

Slips are the printed lists of the circulation desk (step 4.6). Three built-ins ship with the app:

| Folder | `kind` | Printed from | Content |
|---|---|---|---|
| `overdue-by-class` | `overdue` | Loans → Overdue notices → "Print notices" (`/print/overdues`) | the library's current overdue notice: one block per group (class and section, students without a class, `Docente`), heading `<group> - Solleciti biblioteca del <date>`, table *Nome · Titolo · Giorni ritardo* |
| `overdue-patron` | `overdue-patron` | "Print a reminder" on the patron page, the check-in desk and the checkout message about overdue books (`/print/overdues?patron=<id>`) | one patron's overdue books |
| `checkout-receipt` | `receipt` | "Print receipt" on the checkout desk, shown when `circulation.receipts` is on (`/print/receipt?loans=…`) | the books of one checkout with the date to return them |

`template.json`:

```json
{ "name": "overdue-by-class", "description": "…", "kind": "overdue", "page": "A4 portrait", "marginMm": 15 }
```

- `kind` must match the use (a receipt template cannot be used for the notices).
- `page`: `A4` or `A5`, `portrait` or `landscape`; `marginMm`: the page margin.
- `pageBreakPerGroup` (notices only, optional): overrides `circulation.overdueNotice.pageBreakPerGroup`;
  the operator can still choose on the page. The page break is added by the app around each block,
  the template does not need to handle it.

The file is `slip.html`, rendered once per block (once per group for the notices). The notices
template is chosen by `circulation.overdueNotice.template`; the other two are replaced by a folder
with the same name in `CONFIG_DIR/slips/templates/`. The shipped slips take their fixed words from
the installation's dictionary (`{{words.overdues_on}}`, `{{words.name}}`, …), so they print in its
language; a copy may keep them or write its own words.

### Fields

| Field | Content |
|---|---|
| `{{date}}` | the print date, `dd/MM/yyyy` |
| `{{library.name}}` | the library name |
| `{{group.label}}`, `{{group.kind}}` | notices only: `3 A`, `Docente`…, and `class` / `noclass` / `teacher` |
| `{{patron.full_name}}`, `{{patron.first_name}}`, `{{patron.last_name}}`, `{{patron.class_label}}` | the patron (inside `rows` for the notices, at the top for the reminder and the receipt); `class_label` is `3 A`, empty for teachers |
| `{{#rows}}…{{/rows}}` | one entry per loan, sorted by surname, first name and due date |
| `{{biblio.title}}`, `{{biblio.author_short}}` | inside `rows`: the title and the part of the author before the comma |
| `{{item.barcode}}` | inside `rows`: the copy's barcode |
| `{{due_date}}` | inside `rows`: the due date, `dd/MM/yyyy` |
| `{{days_overdue}}` | inside `rows`: calendar days after the due date |
| `{{words.title}}`, `{{words.code}}`, `{{words.due_by}}`, `{{words.due}}`, `{{words.name}}`, `{{words.days_overdue}}`, `{{words.loan_on}}`, `{{words.overdues_on}}`, `{{words.to_return}}`, `{{words.enjoy}}` | the fixed words of the shipped slips in the installation's language (`printing.words.*` of the dictionary): `Titolo`, `Codice`, `Da restituire entro il`, `Scadenza`, `Nome`, `Giorni ritardo`, `Prestito del 25/09/2026 a`, `Solleciti biblioteca del 25/09/2026`, `Libri da restituire alla biblioteca`, `Buona lettura!`; a copy may keep them or write its own words |

Preview a notices template without real data with `/print/overdues?sample=1&template=<name>`
(made-up groups; add `&date=2026-09-19` for a fixed date).

