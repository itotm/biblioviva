# Language packs

One folder per language (`i18n-packs/<code>/`), the same files as `src/lib/i18n/en/` plus `pack.json`. The image ships
English and Italian only; each release attaches every pack as a zip, and an administrator installs the one wanted from
Administration → Configuration → Appearance and language (PLAN.md step 9.39, ADR-051).

```
i18n-packs/de/pack.json      name, nativeName, appVersion, translation: "machine" | "reviewed"
i18n-packs/de/common.json    …one file per namespace, the keys of the English ones
i18n-packs/de/glossary.json  the terms of this language (not part of the zip)
```

## Commands

| Command | What it does |
|---|---|
| `bun run i18n:status [--verbose]` | Validates every pack as the app does at startup and shows how much of it is translated. |
| `bun run i18n:check <folder>` | The same for one folder, line by line. |
| `bun run i18n:work split <code> <workdir>` | Cuts the English messages into chunks of about 200 (`<workdir>/<code>/in/<id>.json`, `key → {en, it}`). |
| `bun run i18n:work merge <code> <workdir> [--name English --native Native]` | Checks the translated chunks (`out/<id>.json`, `key → text`) and merges the good ones into the pack; the others go to `redo.txt`. |
| `bun run i18n:release [--out dist/i18n]` | Builds `biblioviva-i18n-<code>-<version>.zip` for every valid pack and `biblioviva-i18n-index.json`. |

## Rules for a translation

1. **Keys stay, values are translated.** Never rename a key. `{{placeholder}}` names and their number stay exactly as in
   English; the order of the words around them may change.
2. **Plural forms.** A message that counts things writes the words that agree with the number as
   `{{count}} {{count:plural; one:student; other:students;}}`. A translation gives **every form its language uses**
   (a missing form renders as an empty text): Russian, Ukrainian and Polish `one, few, many, other`; Czech and Slovak `one, few, other` (their `many` is for fractions);
   Slovenian `one, two, few, other`; Croatian and Romanian `one, few, other`; German, Dutch, Hungarian, Greek, the
   Nordic languages, Turkish, French, Spanish, Italian, Portuguese and Catalan `one, other`; Chinese, Japanese and
   Korean `other` only. The options may hold the whole phrase, nested placeholders included. `bun run i18n:status`
   refuses a pack that lacks a form.
3. **Brand and product names stay**: BiblioViva, Tailscale, rclone, Koha, SBN, OPAC, Docker, Raspberry Pi, Wi-Fi, ISBN,
   CSV, PDF.
4. **Register**: serious and plain, formal address where the language has one, instructions impersonal or in the
   imperative as the software of that language does; no jokes, no exclamation marks. Buttons and menu entries are short.
5. **Quotes and arrows**: the quotation marks of the language (« », „ “, 「 」…); `→` stays.
6. **Length**: a button or label should not be much longer than the English one; the page is checked at phone width.
7. **Terms** follow the glossary of the language (`glossary.json`) in every namespace: the same word for the same thing.

## The terms

What the program means by its words (the Italian original in brackets, since English alone is ambiguous).

| English | Meaning |
|---|---|
| copy («copia») | one physical copy of a book on the shelf, with its own barcode |
| record («scheda») | the catalogue entry of a title; a record has one or more copies |
| patron («utente») | a student or a teacher who borrows |
| card («tessera») | the library card of a patron, with a barcode |
| loan, return, renew («prestito», «restituzione», «rinnovo») | lending a copy, taking it back, extending the due date |
| overdue, reminder («in ritardo», «sollecito») | past the due date; the printed slip asking for the return |
| call number («segnatura») | the shelf mark on the spine (`B 4 DEL`, `590 ROS`) |
| spine band («fascetta del dorso») | the coloured label band on the spine, with a pictogram and the call number |
| label («etichetta») | an adhesive label with a barcode |
| class («classe») | a school class (`3 B`) that patrons belong to; a group of teachers is a group |
| reading level («livello di lettura») | the school year a book is meant for |
| genre, classification («genere», «classificazione») | how fiction and non-fiction are sorted |
| stocktaking («inventario») | checking the shelves against the catalogue |
| wish list («desiderata») | books a patron would like the library to have |
| census («censimento») | registering patrons with their photo |
| class upgrade («passaggio di classe») | moving every class up a year at the end of the school year |
| anonymise («anonimizzare») | erase the personal data of a patron for good |
| staff account («account del personale») | a shared login per role (loans, catalogue, cards, reports, administration) |
| backup, restore («copia di sicurezza», «ripristino») | a copy of the data; putting it back |
| language pack, colour set («pacchetto di lingua», «set di colori») | a translation of the interface; a palette of the interface |
| print list («lista di stampa») | a list of patrons or copies to print cards or labels for |
| scanner («lettore di codici a barre») | the USB barcode reader that types like a keyboard |
| wizard («procedura guidata») | the first-start sequence of questions |
| demo data («dati di esempio») | the invented school the program can fill itself with |

## Quality

A pack made by a program carries `"translation": "machine"` in `pack.json`: the app and the index say so until a
native speaker has read it. Anyone can fix a pack with a pull request: edit the file, run `bun run i18n:status`, and
change the field to `"reviewed"` when the whole pack has been read.

## Keeping packs in step

Packs are brought in step **at the release**, not at every commit: the English messages are frozen, the messages added
or changed since the last release are found (`git diff <tag> -- src/lib/i18n/en`), translated the same way (a chunk of
the new messages), merged, and `i18n:status` must be green before the tag. A pack that lags behind is still valid: the
missing messages show in English and the index says how much of the pack is translated.
