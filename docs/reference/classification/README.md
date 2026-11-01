# Reference: the library's classification codes in Koha

Source: the Koha "Authorized values" list for category **CCODE** (collection code), exported from the library's Koha. The
library's own pictogram sheet was shown as an example only and is **not** kept in the repository (owner decision,
step 11.14): BiblioViva ships its own generated pictograms. In Koha a single list holds both the fiction
genres (letters) and the non-fiction classes (Dewey-like numbers, plus `MMM` for local history); the code is stored on
each item in `items.ccode` (MARC21 952$8 in the fast framework `FA`), and the label plugin picks the pictogram file
`<code>.gif`, using the Dewey hundred (`500.gif`) for numeric codes. The reading class is `items.location` (952$c,
labelled *Classe/Saggistica*, authorised values `1`…`5` and `S`); the call number is `items.itemcallnumber` (952$o).
Both are item-level fields in Koha, which is why BiblioViva offers the `classification.classPerItem` flag.

`koha-ccode.csv` is the list as exported (labels without the repeated code prefix). BiblioViva's `config.example.json`
(PLAN.md Appendix A) is built from it: letters → `classification.genres`, numbers → `classification.nonfiction`
grouped under their hundred, `MMM` → a top-level non-fiction node.

## Pictograms

BiblioViva ships generated pictograms, one per genre and per non-fiction hundred (`config/classification/images/<code>.svg`,
written by `bun run pictograms:generate` from `#lib/shared/pictograms.ts`): a disc in the node's colour from
`classification.json`, a dark outline and a Lucide icon in white or near-black, whichever reads better, so they stay legible
in black and white. A school that wants its own symbols uploads them from the classification editor (Administration →
Configurazione → Classificazione) or with `bun run classification:import-images <folder>`; they travel with the
classification part of the configuration archive.

| Code | Node | Icon |
|---|---|---|
| A | Romanzi e Racconti | book-open |
| B | Romanzi Storici - Educazione Civica | castle |
| C | Stampato Maiuscolo | case-upper |
| D | Avventura | compass |
| E | Fantasy | wand-sparkles |
| F | Miti e Leggende | swords |
| G | Favole e Fiabe | moon-star |
| H | Fantascienza e Scienza | rocket |
| I | Gialli e Horror | search |
| L | Racconti Umoristici | laugh |
| M | Fumetti | message-circle |
| N | Libri Game | dices |
| P | Lingua Straniera | languages |
| R | Poesia e Teatro | drama |
| 000 … 900 | Dewey hundreds | library, brain, church, users, message-square-text, flask-conical, cog, palette, feather, globe |
| MMM | Milano (local history) | landmark |

The label templates always print the call number next to the pictogram, so a black-and-white printout loses nothing.
