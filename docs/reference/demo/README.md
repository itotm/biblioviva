# Demo pictures

Synthetic cartoon faces (no real person) used by the demo data and by the photo census of Phase 13.

| File | Use |
|---|---|
| `portraits-sheet.jpg` | 30 portraits in a 5 × 6 grid. Each tile was cut once, at 3:4 inside the coloured background, into `demo/photos/NN.jpg` (numbered in reading order). `demo/photos/photos.json` tags each face with `sex` and `age`; the seed (`src/lib/server/db/seed-photos.ts`) gives about half of the patrons one of them, stored like a real photo, and leaves class 2 C without photos. |
| `class-cards.jpg` | Ten cards on a sheet, four of them without a name: the picture of a class for the photo census from class pictures (PLAN.md Phase 13, Q109), the sample of a **scan** (the cards lie flat, each turned a little, Q126). Shipped as `demo/census/class-cards.jpg` ("Esempio da scanner" in the census, only while the demo data are loaded, `/media/demo/class-picture?kind=scan`; it opens as "Scansione"), copied as the e2e and browser-test fixture `tests/fixtures/images/class-cards.jpg` with its measured frames, and the source of the guide's illustrations: upload it to class 2 C, the seeded class without photos. |
| `class-cards-photo.jpg` | The same sheet laid on a table and photographed at an angle: the sample of a **photo** (perspective, Q126, step 9.26). Made from `class-cards.jpg` by `node scripts/make-class-photo.ts` (a CSS projection, so its frames are the measured ones carried through it); shipped as `demo/census/class-cards-photo.jpg` ("Esempio da foto", `?kind=photo`; it opens as "Foto") and copied as `tests/fixtures/images/class-cards-photo.jpg` with its `.frames.json`. |
| `library-logo.png` | A generic library logo (an open book on a blue disc, no text, drawn for BiblioViva) for trying "Logo della biblioteca" in Amministrazione → Aspetto e lingua and for the public demo (step 9.17); a 256 px copy is the placeholder logo of the built-in card template (`config/cards/templates/default/assets/logo.png`). |

`docs/` is not part of the container image; `demo/` (the cut portraits and the sample class picture) is.
