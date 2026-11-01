# Study — configurable barcode formats and school class structures

> **Status:** IMPLEMENTED — the chosen design became **Phase 12 of PLAN.md** (steps 12.1–12.9, Q90–Q102; ADR-023,
> ADR-024, ADR-025), which wins wherever this study differs. This study is kept for the survey of practices and the
> alternatives; the code and PLAN.md describe what was built.
> **Audience:** the owner (feasibility, cost, trade-offs, questions to answer) and a later coding agent that may expand
> the chosen options into steps of PLAN.md.
> **Context:** PLAN.md §3.7 (Q7, Q8, Q9, Q65) fixes the generated formats — items `YYYY-NNNNC`, cards 10 digits with a
> Luhn digit — and Q12 fixes the school structure (`library.schoolType`, `library.maxClassYear` ≤ 5,
> `library.sections` as uppercase codes). The owner asked to make both configurable: the barcode algorithms, **without
> ever allowing an item code and a card code to be confused**, and the way classes and sections are defined, following
> the practice of European and other school systems. Estimates are in agent-driven person-days (one day = one working
> session of the coding agent plus the owner's review), including tests and docs, excluding field testing.
> Facts about foreign school systems and library practice come from general knowledge and are marked `[VERIFY]` where a
> detail must be checked against an official source before it is shipped as a preset.

Part A covers barcodes, part B classes and sections, part C what the two have in common (the setup wizard, the
configuration editors, the plan). Questions are numbered `QBF…` (barcode formats) and `QSC…` (school classes); if the
study becomes a plan they take the next free numbers of PLAN.md §11 (Q90 onwards).

## Decisions

The owner's answers, as recorded in PLAN.md §11 (Q90–Q101) and planned as Phase 12. Where they differ from the
proposals below, they win; the sections below are kept as the reasoning and the survey.

- **Barcodes:** configurable for other schools and for this library, which will give new books a new format (legacy
  codes keep working). Presets plus the token pattern editor. The never-confused rule is binding: structural
  disjointness and at least one visible sign — length difference of 2, a letter in a different position, or a
  different separator. New default formats: copies **`YYYY-CNNNN`**, cards **`CNNNNNN`**, with the check character
  chosen among **Luhn, Damm and a check letter** (A2.1). `{lib}` supported but unused here; repair tables for six
  keyboard layouts.
- **School structure:** the **group (class) becomes its own object in the database**, no longer two patron attributes
  (B4.2 is superseded by the group model below and Phase 12.3). Italian presets by default, foreign presets ready;
  the comprensivo is one of the choices; infanzia like the other stages; pluriclassi as groups with several levels;
  label `3 B` by default, configurable; sections kept at promotion.
- **History is a photo:** loan snapshots never change, not even after a rename; reports on live data follow the
  renames. The "section renames that leave snapshots behind" listed among the defects in B1 is therefore **correct
  behaviour** and stays.
- **Reading levels:** an independent scale, not the school levels (QSC9); default one level per class for primaria,
  none for infanzia and secondaria.
- **Student import:** one format for the class (separate columns); to be studied further later (QSC7).
- **No compatibility** with the old columns before 1.0.
- **Wizard and demo data:** the school and code choices are wizard steps before the demo-data question; the demo data
  are generated from them (instead of the fixed classes `1…5`, sections `A…D` and fixed formats of the first
  `db/seed.ts`, which ignored the school type chosen in the wizard).
- **A new phase** of the plan (Phase 12), not a refinement of Phase 11.
- **Further answers:** the mod-23 letter is the default check character (Q92); Phase 12 is required for 0.9.0
  (Q98); groups are managed by `admin` only (Q99); groups are permanent cohorts, and
  teachers belong to a **teacher group**, a group of a special kind with no level, never promoted (Q100, details in
  Q102).

### Group model chosen for the database (Phase 12.3)

```
school_level        (code PK, position, label, name, stage, next_code)   -- mirrored from school.levels
class_group         (id PK, kind, name, stage, created_at,              -- data: "B", "Coccinelle", "Oak";
                     archived_at, notes)                                -- kind students | teachers ("Docenti")
class_group_level   (group_id FK, level_code FK, PK both)                -- one row; several for a pluriclasse
patron              (…, class_group_id FK NULL, level_code FK NULL)      -- group of the patron's kind; level (students) ∈ group's levels
loan                (…, level_snapshot, level_position_snapshot, stage_snapshot,
                     group_snapshot, class_label_snapshot)               -- the photo, never rewritten
view patron_class   (patron_id, level_code, level_position, stage, group_id, group_name, group_position, class_label)
```

Levels are configuration (the structure of the school, from a preset); groups are data (the classes of this school,
created in the wizard or by `admin` on the new Amministrazione → Classi page, and advanced by the class upgrade). A group is a **persistent cohort**
(Q100): at the class upgrade it advances with its pupils (`3 B` → `4 B`), and it is archived when its pupils
leave. The pupil's own level is stored on the patron because a pluriclasse hosts several levels; the service keeps it
among the group's levels. The alternative — a new group every school year — was set aside: it multiplies rows without
adding information, since the history lives in the loan snapshots.

---

# Part A — Barcode formats for copies and cards

## A1. Where the formats live today

| Piece | File | What is hardcoded |
|---|---|---|
| Generation | `src/lib/shared/barcodes.ts` | `CARD_COUNTER_DIGITS = 9`, `ITEM_COUNTER_DIGITS = 4`, `formatCardNumber`, `formatItemBarcode`, `isNewCardNumber` (`^\d{10}$` + Luhn), `isNewItemBarcode` (`^\d{4}-\d{5}$` + Luhn), `isLegacyItemBarcode` (`^\d{4}-\d{4}$`) |
| Check digit | `src/lib/shared/luhn.ts` | Luhn only |
| Counters | `src/lib/server/barcodes/cards.ts`, `items.ts`, `db/sequence.ts` | sequences `patron_card` and `item_<YYYY>`; "after legacy max" logic written for these two shapes (`floor(max / 10)`, `substr(barcode, 6, 4)`) |
| Recognition | `src/lib/shared/scan.ts` | `normalizeScan` (Italian-keyboard `'` → `-`, nine digits → item with the dash restored, eight digits starting 19/20 → `YYYY-NNNN`) and `recognise` (a fixed regex table: item, legacy item, ISBN-13, ISBN-10 with X, 10 digits → card unless below/above `counterStart` rules, other digits → ambiguous) |
| Callers | `BarcodeInput.svelte`, `scanner/index.ts` (camera), `services/circulation.ts` (`resolveScan`), `services/inventory.ts`, `services/catalog.ts` (search box), `imports/catalog.ts` (check digit of `YYYY-NNNNC` codes in the file), `imports/loans.ts`, `services/patrons.ts`, `services/library-codes.ts` (preview of the next codes), `db/seed.ts` | all assume the two shapes |
| Configuration | `src/lib/server/config/schema.ts` `barcodes.*` | already shaped for this study: `patron.totalDigits: literal(10)`, `patron.checkDigit: literal("luhn")`, `item.pattern: literal("YYYY-NNNNC")`, `item.checkDigit: literal("luhn")`, `item.yearSource: literal("current-calendar-year")` — literals waiting to become choices; `symbology`, `acceptLegacy`, `counterStart` are real settings |
| Database | `item.barcode` and `patron.card_number` | `UNIQUE` per table; nothing prevents the same string from being both a card and a copy |

How the two are kept apart today: an item is `NNNN-NNNNN` (a dash, 10 characters), a card is ten digits. Without the
dash (scanner on the wrong layout) an item is nine digits, still not ten. The plain legacy counters (old cards and the
oldest books) are the only real overlap and are resolved by context and a lookup in both tables (§3.7). This works, but
only because the two shapes were chosen by hand to differ; nothing in the code would stop a future setting from
producing two overlapping formats.

## A2. What libraries use around the world

| Practice | Where | Shape | Item vs card separation |
|---|---|---|---|
| **Codabar "14-digit library barcode"** | USA, Canada, Australia, many UK public libraries (Gaylord, Brodart, Demco labels) | `T LLLL NNNNNNNN C`: type digit, 4-digit institution code, 8-digit sequence, mod-10 check digit | the **first digit**: `2` = patron, `3` = item. The classic answer to exactly the owner's concern |
| **Koha `autoBarcode`** | Koha libraries (the school's current system) | `incremental` (1, 2, 3…), `annual` (`YYYY-0001`: the origin of the school's `YYYY-NNNN` legacy labels), `hbyymmincr` (branch code + `YYMM` + counter), `EAN13` (incremental EAN-13) | none built in: Koha card numbers (`autoMemberNum`) are plain counters, which is why the school's old cards and old books can collide |
| **Prefix letter + digits, Code 39** | UK, Germany, Austria, Switzerland, Nordic countries (common with Bibliotheca, Axiell, SISIS/OCLC systems) [VERIFY per system] | e.g. `M0012345` for media, `L12345678` or a letter-free 11-digit number for readers; often a mod-11 or mod-10 check | a fixed **letter prefix** per kind |
| **In-store EAN-13 (GS1 prefix 20–29)** | some European school and municipal libraries, bookshops | 13 digits starting `2x`, EAN check digit | a different `2x` prefix per kind; never confused with ISBN (978/979) or ISSN (977) |
| **Inventory number as barcode** | Italian SBN libraries | the *numero d'inventario*, sometimes with the library's ISIL/SBN code as a prefix (`IT-XX0123 00012345`) [VERIFY] | cards come from a separate regional card system |
| **RFID (ISO 28560)** | Netherlands, Scandinavia, France, large public libraries | the item identifier is any string; the barcode stays as a fallback | the RFID tag's data model carries the type |

Check digits in use: **Luhn** (mod 10, today's choice; misses the transposition `09` ↔ `90`), the **library mod 10** of
the Codabar standard (odd positions doubled from the left: on a 13-digit payload it is Luhn again), **EAN mod 10** (weights 1-3; misses transpositions of digits that differ by
5), **mod 11** (ISBN-10 and ISSN style; catches every transposition but needs `X`), **Damm** (one digit, catches every
single-digit error and every adjacent transposition, no `X`), **Verhoeff** (same strength, more complex), **ISO 7064
mod 97-10** (two digits, IBAN). Code 39 also has an optional mod-43 check character inside the symbol.

### A2.1 Check characters (digits and letters)

| Algorithm | Character | Catches | Notes |
|---|---|---|---|
| **Luhn** (mod 10) | digit | every single error, most adjacent transpositions (not `09` ↔ `90`) | today's choice; cards, Codabar library barcodes |
| **Damm** | digit | every single error and every adjacent transposition | a 10 × 10 quasigroup table; no `X`, same length as Luhn |
| Verhoeff | digit | same as Damm | dihedral-group tables; more complex, no gain over Damm |
| EAN / UPC (weights 1-3) | digit | single errors; misses transpositions of digits differing by 5 | needed only for EAN-13 symbols |
| ISO 7064 MOD 11-2 / ISBN-10 mod 11 | digit or `X` | single errors and all transpositions | the `X` makes it a letter sometimes: not usable when the letter must be a cue |
| ISO 7064 MOD 37,36 | `0-9` or `A-Z` | single errors and transpositions on alphanumeric data | the character can be a digit, so it cannot be relied on as a visible letter |
| **mod 23 letter** (Spanish DNI/NIF scheme) | letter | every single-digit error, every adjacent transposition, every jump transposition (`a b c` ↔ `c b a`), every twin error (`aa` ↔ `bb`) | the payload's value mod 23: those errors change the value by d·10ᵏ, 9·d·10ᵏ, 99·d·10ᵏ or 11·d·10ᵏ with 1 ≤ d ≤ 9, and the prime 23 divides none of them; BiblioViva maps the remainder onto the 23 letters without `I O Q`, which read as `1 0 0` |
| Italian *codice fiscale* control letter | letter | single errors only; some transpositions slip through | odd/even tables mod 26; weaker than mod 23 |

Shipped (owner decision): **Luhn, Damm, mod 23 letter**. The check character may stand anywhere in the pattern
(`YYYY-CNNNN`): it is computed over the payload digits in order, whatever their position.

Scanner keyboard layouts matter outside Italy too: a scanner left on the US layout types `'` for `-` on an Italian or
Spanish keyboard (handled today), `ß` on a German QWERTZ keyboard (which also swaps `Y` and `Z` in letter prefixes),
and on a French AZERTY keyboard it types `)` for `-` and `& é " ' ( - è _ ç à` for the digits `1 … 0` [VERIFY each
mapping with a real scanner]. Digits-only codes with one dash survive most of these once a per-layout table repairs them;
letter prefixes are the most fragile.

## A3. Principles (what "never confused" means, made testable)

1. **Disjoint by structure, never by check digit.** No string may be a valid code of both kinds. The check digit catches
   typing errors; it never decides whether a code is a card or a copy (today's rule for `counterStart`, generalised).
2. **Disjoint after normalisation.** The two kinds stay disjoint after the scanner repairs (dash lost or replaced,
   lower-case letters, the layout table of the configured keyboard). A card read without its dash must not look like a
   copy read without its dash.
3. **Disjoint from what the desk also scans.** Neither kind may match an ISBN-13/EAN-13 starting 978/979, an ISSN EAN
   (977), an ISBN-10, or the **legacy formats** declared for the *other* kind.
4. **Distinguishable by a person.** An operator reading a code aloud or typing it from a worn label must see at once
   which kind it is. The validator requires at least one visible signature: a different length (at least two characters
   apart), a different fixed prefix, or a different separator pattern (`2026-01234` vs `0001234567`).
5. **Old codes never change.** Changing a format affects only codes generated afterwards. The previous generated format
   becomes a **retired format** of the same kind: still recognised, still validated (check digit), never generated
   again. Legacy formats (plain counters, `YYYY-NNNN`) stay as they are.
6. **Never reuse a number.** Each format has its own counters; switching back to a former format continues after the
   highest code of that format found in the database.
7. **Fail at save time, not at the desk.** The configuration editor refuses a pair of formats that breaks 1–4 and
   explains why with two example codes that collide. `bun run config:check` and the startup validation do the same.

## A4. Proposed model

### A4.1 A small pattern language instead of free regexes

A non-technical administrator must not write regular expressions, and a regex cannot be checked for disjointness
cheaply. A format is a **pattern of tokens**, all fixed-width, so every format has a known length and a known
character class at every position:

| Token | Meaning | Example |
|---|---|---|
| `YYYY`, `YY` | calendar year of creation in `library.timezone` (today's `yearSource`); also school year start (`SY`, two digits) if asked | `2026`, `26` |
| `N…N` | the counter, zero-padded, as many digits as `N`s; it restarts every year when the pattern has a year, else it is global | `NNNN` → `0267` |
| `C` | one check digit over all the digits before it (algorithm chosen separately); `CC` for mod 97-10 | `1` |
| `{lib}` | the library code (`barcodes.libraryCode`, fixed digits or letters): disjoint numbering between plessi (see the multi-library study, §5) | `0042` |
| literal | digits and `-` as they are; upper-case letters in quotes (`'T'`), without `I O Q` (they read as `1 0 0`) | `'T'`, `2`, `-` |

Generated code = the tokens filled in. Validity of a scanned code = matches the pattern position by position **and** the
check digit is right. Disjointness of two patterns of fixed length is decidable by a direct comparison: different
lengths, or some position where the two character classes do not intersect (a literal `T` against a digit, a `-`
against a digit, literal `2` against literal `3`). The same comparison runs on the normalised forms (dashes removed)
for principle 2. The legacy formats are patterns too (`N{1,10}` plain counters are the one variable-length case, handled
by a length range), so principle 3 uses the same code.

### A4.2 Presets for the wizard and the editor

Presets fill the pattern pair; the advanced editor shows the patterns for the rare school that needs more.

| Preset | Copy | Card | Notes |
|---|---|---|---|
| **BiblioViva (default, today)** | `YYYY-NNNNC` (Luhn) | `NNNNNNNNNC` (Luhn) | the current formats, unchanged; separation by dash and length |
| **BiblioViva, stronger check** | `YYYY-NNNNC` (Damm) | `NNNNNNNNNC` (Damm) | same shapes, catches every adjacent transposition; old Luhn codes become a retired format and keep working |
| **Letter prefix** | `'L'-YYNNNNC` → `L-2602671` | `'T'-NNNNNNC` → `T-0012345` | the letters are the cue; the preset proposes letters of the installation's language (`L` libro and `T` tessera in Italian, `B` book and `P` patron in English) |
| **Library standard (Codabar 14)** | `3{lib}NNNNNNNNC` | `2{lib}NNNNNNNNC` | international convention; mod 10 of the standard; printable as Codabar (new symbology) or Code 128 |
| **In-store EAN-13** | `21NNNNNNNNNNC` | `22NNNNNNNNNNC` | EAN-13 symbol (new symbology), EAN check digit; very robust scanning on cheap scanners |
| **Koha "annual" compatible** | `YYYY-NNNN` | plain counter | *only to keep generating what an old Koha generated*; the editor warns that it has no check digit and that cards and copies may collide, and refuses it unless one side gets a prefix |

Year-based copies are kept as the default because the owner and Koha users read the year on the label. Card numbers
stay year-free because a card lasts the whole school career (no year or validity is printed today).

### A4.3 Configuration

```jsonc
"barcodes": {
  "libraryCode": "0042",                       // used by the L token, optional
  "keyboardLayout": "it",                      // scanner repair table: it, es, de, fr, uk, us
  "item": {
    "format": { "pattern": "YYYY-NNNNC", "check": "luhn" },
    "retired": [],                             // formats generated in the past, still recognised
    "legacy": ["YYYY-NNNN", "plain"],          // replaces acceptLegacy: which old shapes exist
    "symbology": "code128"
  },
  "patron": {
    "format": { "pattern": "NNNNNNNNNC", "check": "luhn" },
    "retired": [],
    "legacy": ["plain"],
    "counterStart": "afterLegacyMax",
    "symbology": "code128"
  }
}
```

`totalDigits`, `checkDigit`, `pattern`, `yearSource` and `acceptLegacy` disappear in favour of `format`, `retired` and
`legacy`; the loader migrates an old file once (the config file is the school's, so it gets a normal config
migration, not a database one). Every key gets its editor and its place in the configuration archive (Phase 11 rule).

### A4.4 Code changes

- `#lib/shared/barcodes/` (new folder replacing `barcodes.ts`): pattern parser, generator, validator, the check-digit
  algorithms (Luhn moves here; Damm, mod 11, EAN, library mod 10, mod 97-10 added, each with test vectors), and
  `compareFormats(a, b)` returning `disjoint` or a pair of colliding example codes.
- `#lib/shared/scan.ts`: `recognise(code, formats)` built from a **format table** compiled from the configuration (the
  current, retired and legacy formats of each kind plus ISBN/EAN/ISSN). The client gets the table in the layout data (a
  few hundred bytes), so `BarcodeInput` and the camera scanner keep recognising locally. `normalizeScan` uses the
  layout table and restores separators only when exactly one format matches the repaired code.
- `#lib/server/barcodes/`: counters named by format (`item:<pattern-id>:<year>`, `card:<pattern-id>`; today's
  `patron_card` and `item_<YYYY>` keep their names for the default format so nothing moves), "continue after the
  highest existing code" computed for any pattern.
- **Cross-table guard:** before storing a new card number or copy barcode (creation, import, manual edit) the service
  checks that the string is not already the other kind's code. The database keeps two separate `UNIQUE` indexes; a
  single `code` table is not worth the migration.
- Imports (`imports/catalog.ts`, `patrons.ts`, `loans.ts`): validation per format table (a code that matches a format of
  the *other* kind is an error with its explanation); `BARCODE_TEXT` and the `^\d{4}-\d{5}$` special case go.
- Rendering: `symbology` gains `codabar` and `ean13` only if those presets are kept (`@bwip-js/generic` renders both);
  the label and card templates are unchanged (`{{{barcode_svg}}}`, the text under it).
- Administration → Codici a barre: preset picker, the two patterns with ten example codes each, the verdict of the
  checks (green: "le tessere e le copie non si possono confondere"; red: the colliding example), a **"prova un
  codice"** box that runs the recognition table on a typed or scanned code, the next code of each kind (today's preview
  in `library-codes.ts`), and the list of retired and legacy formats with their counts in the database.
- Seed: uses the configured formats; tests generate 10 000 codes of each kind for every preset and assert that each is
  recognised as its own kind only, with and without the scanner mishaps of every layout.

### A4.5 Effort

| Step | Days |
|---|---|
| Pattern language, check digits, `compareFormats`, unit tests with vectors | 2 |
| Format table, `recognise`/`normalizeScan` generalised, layout tables, client data | 1.5 |
| Counters per format, cross-table guard, imports, seed | 1.5 |
| Config schema and migration of the old keys, archive part, coverage map | 0.5 |
| Administration page with presets, examples, verdict, test box; wizard step | 1.5 |
| Docs (PLAN §3.7, `config-reference.md`, admin guides it/en), e2e, desk regression | 1 |
| **Total** | **≈ 8** (≈ 5.5 without the Codabar and EAN-13 symbologies and with three presets only) |

## A5. Risks

- **Printed labels are permanent.** A wrong choice lives on thousands of spines; the editor must show printed examples
  and the label preview before saving, and the change of format is audited.
- **Ten digits are ten digits.** An ISBN-10 without `X` is ten digits like a default card number. Today the patron
  lookup wins and the ISBN check is only a fallback for numbers in the new range with a bad Luhn digit; any preset with
  a ten-digit all-numeric card keeps that behaviour and the validator reports it as an accepted, documented overlap.
- **Letters and keyboard layouts.** Letter prefixes break on German and French layouts unless the scanner is set to
  the right layout; the setup guide must say so, and the presets of those countries should prefer digits.
- **Scope creep.** A free regex editor would make principle 7 impossible to guarantee. The token language is the
  limit.

## A6. Questions for the owner

- [x] **QBF1 — Who needs it:** is the goal other schools (other countries, other library systems migrating to
  BiblioViva), or does this school want to change its own formats? *Default: other schools; this school keeps today's
  formats.*
  **Answer:** other schools in general, and this library will change format too; legacy codes keep working, new books get the new format.
- [x] **QBF2 — Freedom:** presets only, or presets plus the token pattern editor (A4.1) for advanced users? Free regexes
  are excluded in both cases. *Default: presets plus the pattern editor, behind an "Avanzate" disclosure.*
  **Answer:** presets by default plus full configurability; the never-confused rule is binding.
- [x] **QBF3 — Presets to ship:** which of A4.2? *Default: BiblioViva, BiblioViva with Damm, letter prefix, Codabar 14;
  EAN-13 only if asked (it adds a symbology).*
  **Answer:** copies `YYYY-CNNNN` (year, check character, zero-padded counter; the check can be an upper-case letter), cards `CNNNNNN`.
- [x] **QBF4 — Check digit of the default:** keep Luhn, or move new codes to Damm (stronger, same length)? Old Luhn codes
  would stay valid as a retired format. *Default: keep Luhn for this school (labels already printed), Damm offered.*
  **Answer:** the choice among Luhn, Damm and a check letter (A2.1: mod 23). The default is PLAN Q92.
- [x] **QBF5 — Human distinguishability rule:** is "two characters of length, or a different prefix, or a different
  separator pattern" the right minimum (principle 4), or must every pair differ by a visible **prefix**? *Default: the
  three-way rule.*
  **Answer:** part of the rule: a length difference of 2, a letter in a different position, or a different separator.
- [x] **QBF6 — Library code token:** add `{lib}` now (useful for several plessi on separate installations, see the
  multi-library study), or later? *Default: now, optional, empty by default.*
  **Answer:** supported, not used by this library.
- [x] **QBF7 — Scanner layouts:** add the repair tables for Spanish, German, French and UK keyboards now, or only when a
  school in those countries appears? *Default: now; small and tested by table.*
  **Answer:** yes, include the repair tables.

---

# Part B — School classes and sections

"Classes and sections" here means the school class of the patrons (`class_year` + `section`) and, because it uses the
same scale, the **reading class** of the books (`reading_class`, `classification.fictionByClass`). The library
classification of the books (genres, non-fiction taxonomy, Dewey/CDU) is already configurable (step 11.1) and is out
of scope.

## B1. Where the model lives today

A class is two fields: `patron.class_year` (integer `1 … library.maxClassYear`, at most 5) and `patron.section` (a code
of `library.sections`, `^[A-Z0-9]{1,8}$`); loans keep `class_year_snapshot` and `section_snapshot`. Teachers have
neither. `library.schoolType` (`primaria`, `secondaria-I`, `secondaria-II`) only presets `maxClassYear` in the
first-run wizard and has no other effect.

| Area | Files | Assumption |
|---|---|---|
| Labels | `ClassBadge.svelte:18`, `services/slips.ts:100`, `overdues.ts:44`, `loan-lists.ts:262`, `export/tables/open-loans.ts:46`, `circulation/loans/+page.svelte:126`, `patrons/+page.svelte:258`, `census/+page.svelte:77`, `admin/rollover/+page.svelte:180`, report charts | the label is built in ~12 places as `` `${y} ${s}` `` ("3 A") |
| Card | `services/cards.ts:139`, `config/cards/templates/default/front.html:9` | `patron.class_label` is `"3A"` (no space, a second format); the default card prints `Sezione {{patron.section}}` only, because in Italy the section does not change from one year to the next |
| Validation | `shared/patron-schema.ts:27-28`, `services/patrons.ts:71-97` | year is a number in range, section upper-cased and in the list |
| Import | `imports/patrons.ts:45-134, 190` | class and section must be separate columns; a register cell `3B` or `3^B` is rejected (`classOutOfRange`); format detection by `/^\d{1,2}$/` |
| Filters and URLs | `shared/loan-filters.ts:8`, `print/cards/+server.ts:23`, `census/+page.svelte:56`, `patron-schema.ts:49` | a **single-digit** year (`/^\d$/`) |
| Sorting | `patrons.ts:418, 679`, `rollover.ts:84`, `overdues.ts:70`, `loan-lists.ts:114`, `data-exports.ts:30`, report SQL | year numeric, then section by `ORDER BY` or `localeCompare("it")` |
| Class upgrade | `services/rollover.ts:70-234` | `class_year + 1`; at `maxClassYear` the student is a leaver and is anonymized (unless kept as repeating) |
| Reports | `reports/definition.ts:28-37`, `context.ts:17`, `run.ts:67-88`; 8 built-ins in `config/reports/` | parameter types `classYear` and `section`; SQL groups and orders by the raw columns |
| Reading class | `shared/classification.ts:18-24, 162-172`, `ClassificationPicker.svelte:137-158`, `services/catalog.ts:204-213, 420-436`, `batch-items.ts:80`, `labels.ts:434` | the same `1 … maxClassYear` scale; call number `B 4 DEL` |
| Configuration guards | `services/config-references.ts:57-87`, `library-codes.ts:76-86, 290-328` | a section in use cannot be removed without moving its students; renaming moves students but not loan snapshots; lowering `maxClassYear` ignores the books' reading classes |

Small defects found on the way, worth fixing whatever is decided: two label formats ("3 A" and "3A"), single-digit
years in three URL/filter parsers, `maxClassYear` lowered below books' reading classes. Two behaviours that looked like
defects are right by the owner's decision (Q95): overdue notices go to the **current** class while statistics use the
**snapshot**, and renaming a section leaves the snapshots as they were (history is a photo).

## B2. How school systems name classes

| Country / system | Levels (as written) | Group (section) | Typical label | Notes |
|---|---|---|---|---|
| **Italy** | infanzia: 3, 4, 5 anni or *piccoli/medi/grandi*; primaria 1ª–5ª; secondaria I 1ª–3ª; secondaria II 1ª–5ª | letter A, B, C… (stable through the cycle); secondaria II often letter + *indirizzo* | `3ª B`, `3B`, `4A LS` | **istituti comprensivi** put infanzia, primaria and secondaria I in one school (one library); **pluriclassi** in small primary schools; infanzia *sezioni* are often mixed-age and named (*Coccinelle*) |
| **France** | maternelle PS, MS, GS; élémentaire CP, CE1, CE2, CM1, CM2; collège **6e, 5e, 4e, 3e** (counting down); lycée 2de, 1re, Terminale | number or letter (`6e2`, `6e A`) | `6e B`, `CM1-CM2` | named levels, descending numbers; *cours doubles* (two levels in one class) common |
| **Germany / Austria** | Klasse 1–4 (Grundschule; 1–6 in Berlin and Brandenburg), 5–10/12/13; Oberstufe EF, Q1, Q2 or 11–13 [VERIFY per Land]; Austria restarts at 1 in Mittelschule, AHS 1–8 | **lower-case** letter | `5a`, `7c` | in the upper years there are courses, not classes |
| **Spain** | Infantil 3, 4, 5 años; Primaria 1º–6º; ESO 1º–4º; Bachillerato 1º–2º | letter | `2º ESO B` | the stage name is part of the label |
| **Portugal / Brazil** | Portugal 1.º–12.º ano (continuous); Brazil 1º–9º ano, then ensino médio 1ª–3ª série | letter, or Brazil's *turma* number `301` (year 3, group 01) [VERIFY] | `7.º B`, `301` | a section can be numeric and include the year |
| **United Kingdom** | England/Wales Reception, Year 1–13; Scotland P1–P7, S1–S6; Northern Ireland P1–P7, Year 8–14 | form/tutor group: letter, teacher initials, house name, or a named class (`Oak`, `Willow`) | `7R`, `Year 3/4 Oak` | mixed-year classes common in primary; groups often reshuffled at promotion |
| **Ireland** | Junior Infants, Senior Infants, 1st–6th Class; secondary 1st–6th Year (Transition Year optional) | letter or name | `4th Class`, `2nd Year B` | named infant levels |
| **Netherlands / Belgium** | basisschool groep 1–8 (1–2 are kindergarten); secondary klas 1–4/5/6 by track (vmbo/havo/vwo); Belgium P1–P6, 1re–6e | letter, often with the track | `groep 5/6`, `H4a`, `V5` | combination groups; the track is part of the label |
| **Nordic countries** | Sweden åk 1–9, Finland 1–9, Norway 1.–10. trinn, Denmark **0.**–9. klasse | letter | `7A`, `0.b` | Denmark has a year **0** |
| **Poland / Czechia / Hungary / Romania** | Poland klasa 1–8 written in **Roman numerals** (`IIIa`); Czechia 1.–9. třída; Hungary 1.–12. évfolyam; Romania *clasa a V-a* | letter (lower or upper case) | `IIIa`, `7.A`, `9.B` | Roman numerals; a dot after the year |
| **Greece / Cyprus** | year as a **Greek letter** (Α, Β, Γ…) | **number** | `Β2` | year and section inverted in kind |
| **Russia / Ukraine / Bulgaria** | 1–11 | **Cyrillic** letter (А, Б, В…) | `5 «А»`, `7-Б` | non-Latin section letters |
| **USA / Canada** | Pre-K, **K**, Grade 1–12 (high school also Freshman…Senior); Québec 1re–6e année, Secondaire 1–5 | homeroom: teacher name or room number, rarely a letter | `Grade 3 – Ms. Lee`, `Room 204` | cohorts called by graduation year (`Class of 2030`) |
| **Australia / New Zealand** | Foundation/Prep/Kindergarten, Year 1–12; NZ Year 0/1–13 | composite groups with a teacher code, or a room | `3/4M`, `Room 7` | composite classes are normal |
| **Japan / China / Korea** | 1–6, 1–3, 1–3 per stage | **number** | `3年2組`, `三年级二班` | numeric sections |
| **India** | Nursery, LKG, UKG, Class I–XII in Roman numerals | letter | `VII-B` | Roman numerals and named pre-primary levels |
| **Israel** | years as **Hebrew letters** (א׳–י״ב) | number | `ז׳2` | right-to-left labels [VERIFY rendering] |

## B3. What the variety means for the model

1. **A level is a name in an ordered list, not a number.** Levels can start at 0, K, Reception or "3 anni"; be written
   as ordinals (`3ª`, `3º`), Roman numerals, letters, names (`CM1`); count down (France); repeat across school stages
   (`1ª` primaria and `1ª` media in one istituto comprensivo). The model needs a stable **code**, an **order**, a short
   label for the class label and a full name.
2. **One library may serve several stages.** An istituto comprensivo has infanzia, primaria and secondaria I under one
   roof; the step from `5ª primaria` to `1ª media` is a promotion, **not** a departure. Today the pupil would be
   anonymized at `maxClassYear = 5`.
3. **A group (section) is a short text in any script**: upper or lower case, Cyrillic, Greek, digits, a name, a room.
   Case is significant for display (`5a`) but not for matching a typed value.
4. **The group can be per-level or school-wide.** In Italy the section is stable through the cycle (the card prints
   `Sezione B`); in the UK or the Netherlands groups are reshuffled at promotion; in France and Brazil the group number
   is local to the level.
5. **A group may span several levels** (pluriclassi, cours doubles, composite classes, `groep 5/6`): each pupil keeps
   their own level, the group is shared.
6. **The label is a composition** of level and group: `3B`, `3 B`, `3ª B`, `5a`, `6e A`, `7R`, `IIIa`, `Β2`, `301`,
   `2º ESO B`, or the group alone for a named composite class (`Oak`). One configurable template covers all of them.
7. **Order and promotion** come from the level list: each level has a next level (by default the following one) and the
   last level of the school has none (the pupil leaves). At promotion the group is kept, cleared (to be set by the next
   register import), or mapped.
8. **The reading class of books** uses the levels where reading classes make sense (in Italy the primaria levels), and
   its shelf mark (`4` in `B 4 DEL`) comes from the level.

## B4. Proposed model

### B4.1 Configuration

A new `school` section replaces `library.schoolType`, `library.maxClassYear` and `library.sections`:

```jsonc
"school": {
  "preset": "it-comprensivo",                      // informative: which preset it started from
  "levels": [
    { "code": "I3", "label": "3 anni", "name": "Infanzia, 3 anni", "stage": "infanzia" },
    { "code": "I4", "label": "4 anni", "name": "Infanzia, 4 anni", "stage": "infanzia" },
    { "code": "I5", "label": "5 anni", "name": "Infanzia, 5 anni", "stage": "infanzia", "next": "P1" },
    { "code": "P1", "label": "1ª", "name": "Prima primaria", "stage": "primaria", "readingClass": "1" },
    // … P2–P5 with readingClass "2"–"5"
    { "code": "S1", "label": "1ª", "name": "Prima secondaria", "stage": "secondaria-I" },
    { "code": "S3", "label": "3ª", "name": "Terza secondaria", "stage": "secondaria-I", "next": null }
  ],
  "aliases": { "P3": ["3", "III", "terza"] },     // extra spellings accepted by imports and filters
  "groups": {
    "values": [ { "code": "A" }, { "code": "B" }, { "code": "Coccinelle", "levels": ["I3", "I4", "I5"] } ],
    "word": "Sezione",                             // "Sezione B" on the card, "Form", "Klasse", "Turma"…
    "onPromotion": "keep"                          // keep | clear | ask
  },
  "classLabel": "{level}{group}"                   // "3ªB"; "{level} {group}", "{group}" for named groups…
}
```

- `next` defaults to the following level of the list; `null` means the pupil leaves. Stages are just a grouping for the
  pickers and reports ("tutta la primaria").
- A group with `levels` is restricted to those levels; without, it is valid for every level. A group used by several
  levels at once is a pluriclasse/composite class with no extra concept.
- `readingClass` marks the levels that can be a book's recommended class and gives the shelf mark printed in the call
  number; `classification.fictionByClass` stays as the switch.
- Validation: codes unique, labels unique within a stage, every `next` exists, no cycle, at least one level; every
  composed label + alias normalises (case, spaces, `ª º ° ^ . -`, Roman numerals) to one class only, otherwise the
  editor shows the two classes that would be confused (the same idea as part A).

### B4.2 Database (pre-1.0: the single initial migration is regenerated, ADR-011)

> Superseded by the group model of *Decisions* above (groups as objects, snapshots never rewritten).

- `patron.level` and `patron.group_code` (text codes) replace `class_year` and `section`; loans keep `level_snapshot`,
  `group_snapshot` **and `class_label_snapshot`**, so history reads right after a rename or a change of label template.
- Two small tables mirrored from the configuration at startup and on reload, like `staff_user`: `school_level(code,
  position, label, name, stage)` and `school_group(code, position, label)`. Reports join them to order by position
  and show labels; a view `patron_class(patron_id, level, level_position, group_code, group_position, class_label)`
  keeps report SQL short.
- Renaming a level or group code moves patrons **and snapshots** in the same configuration change (today's section
  rename does not move snapshots).

### B4.3 Code changes

- `#lib/shared/school.ts`: `classLabel(patron, school)`, `compareClass`, `parseClass(text, school)` (a lookup table of
  normalised labels and aliases, so `3B`, `3^B`, `3ª B`, `IIIb`, `6e A`, `5a` all resolve), `nextLevel`. Every label
  site of B1 calls `classLabel`; every sort calls `compareClass`; the single-digit parsers go.
- Patrons: form selects from the levels and the groups valid for the chosen level; validation by code; filters by
  level, stage or group; the census and card printing take codes in the URL.
- Register import: separate `classe;sezione` columns as today **plus** a single combined `classe` cell, both resolved by
  `parseClass`; unknown spellings are an error with the list of valid classes (§3.22, zero errors before import).
- Class upgrade: per-level `next`; promotion across stages keeps the pupil (comprensivo); leavers only from levels
  without `next`; groups kept, cleared or chosen per `onPromotion`; the preview groups by stage.
- Reports: parameter types `level`, `stage`, `group`; the eight built-ins that use class and section rewritten on the
  view; ordering by position.
- Overdue notices: one rule for the group (current class, as the paper notice goes to today's class) documented in
  PLAN; statistics stay on snapshots.
- Cards and slips: `patron.class_label`, `patron.level_label`, `patron.level_name`, `patron.group`, `school.groupWord`;
  the default card prints `{{school.groupWord}} {{patron.group}}` (unchanged look in Italy).
- Reading class: pickers show the levels with `readingClass`; `{{class}}` in the call number pattern is the shelf mark;
  the Koha import maps `items.location` values through the shelf marks.
- Setup wizard: "Paese e tipo di scuola" picks a preset (B4.4) instead of `schoolType` + `maxClassYear`; the sections
  question, missing today, is asked there.
- Administration → Classi e sezioni: one editor for levels, stages, groups, aliases, label template and promotion rule,
  with a live preview of labels (`3ªB`, `Sezione B`), the counts of pupils per class, and the plan of what a change
  does to existing patrons (the pattern of `library-codes.ts`). Coverage map and configuration archive updated.

### B4.4 Presets

Shipped as JSON files (like report definitions: built-in, overridable), each producing an ordinary editable
`school` section:

| Preset | Levels | Groups | Label | Promotion |
|---|---|---|---|---|
| `it-primaria` (default) | 1ª–5ª, reading classes 1–5 | A–E | `{level}{group}` without `ª` → `3B` | keep |
| `it-secondaria-I` | 1ª–3ª | A–H | `3B` | keep |
| `it-secondaria-II` | 1ª–5ª | A–H (indirizzo as part of the group, `A LS`) | `3A LS` | keep |
| `it-comprensivo` | infanzia 3–5 anni, primaria 1ª–5ª, secondaria 1ª–3ª | per stage | `3B`, `Coccinelle` | keep, across stages |
| `fr-elementaire`, `fr-college` | CP…CM2; 6e…3e | A, B… or 1, 2… | `6e A` | ask |
| `de-grundschule`, `de-sek-I` | 1–4; 5–10 | a, b, c… | `5a` | keep |
| `es-primaria`, `es-eso` | 1º–6º; 1º–4º ESO | A, B… | `2º B` | keep |
| `uk-primary`, `uk-secondary` | Reception, Year 1–6; Year 7–13 | named classes / form letters | `Oak`, `7R` | clear |
| `us-elementary`, `us-middle`, `us-high` | K, 1–5; 6–8; 9–12 | homeroom names | `Grade 3 – Lee` | clear |
| `pl-podstawowa` | I–VIII | a, b… | `IIIa` | keep |
| `generic` | 1…N (N asked) | A… | `3A` | keep |

Each preset needs its country's facts checked (`[VERIFY]` in B2) and a reviewer from that country before it is
advertised; the Italian ones can ship first.

### B4.5 Effort

| Step | Days |
|---|---|
| `school` schema, validation, mirror tables, view, database regeneration, seed | 2 |
| `#lib/shared/school.ts` (labels, sorting, parsing, aliases, Roman numerals) and its tests | 1.5 |
| Patrons: form, filters, census, card printing, register import with combined cells | 2 |
| Class upgrade across stages, groups on promotion | 1 |
| Reports (types, context, 8 built-ins), overdue notices, slips, cards, exports | 1.5 |
| Reading class on levels, call numbers, catalogue pickers, Koha mapping | 1 |
| Wizard step and Administration editor with plan and preview; coverage, archive | 2 |
| Presets (Italian first, then the others with verification) | 1 + 0.25 per foreign preset |
| Docs (PLAN §3/§4, `database.md`, `navigation.md`, config reference, admin guides it/en), e2e | 1.5 |
| **Total** | **≈ 13** with the Italian presets, **≈ 16** with the foreign ones |

## B5. Risks

- **The widest change of the two.** About ninety files mention the class year, the section or the reading class (B1); a shared module and a view
  keep it mechanical, but the e2e suite (census, rollover `*.final.spec.ts`, imports, reports) must be rerun in full.
- **Schools' own reports** in `CONFIG_DIR/reports/` that use `class_year`/`section` break. Before 1.0 that is acceptable;
  the view can expose a numeric `class_year` (the level position) for compatibility if the owner wants it.
- **Levels named in another language than the UI.** Labels are school data in the configuration, not dictionary text;
  a preset brings its country's words. Only the preset names and the editor's texts are in the i18n dictionaries.
- **Over-configuration.** The Italian primary school must still see one question in the wizard ("Primaria") and
  nothing else; everything else stays behind the editor.

## B6. Questions for the owner

- [x] **QSC1 — Target:** foreign schools, or Italian schools of every kind first (istituti comprensivi, infanzia,
  secondaria II)? *Default: Italian kinds first (`it-*` presets), the model ready for the others, foreign presets added
  on request with a local reviewer.*
  **Answer:** Italy by default, with ready presets for other countries.
- [x] **QSC2 — Istituto comprensivo:** must one library serve infanzia + primaria + secondaria with promotion across
  stages (B3.2)? *Default: yes, it is the most common Italian case the current model cannot represent.*
  **Answer:** yes, as one of the choices.
- [x] **QSC3 — Infanzia:** are infanzia children patrons of the library at all (they cannot read; teachers borrow for
  them)? *Default: optional stage, off in the default preset.*
  **Answer:** yes, infanzia is managed like the other schools.
- [x] **QSC4 — Pluriclassi:** model them as a group shared by several levels (B4.1)? *Default: yes, no extra concept.*
  **Answer:** yes.
- [x] **QSC5 — Class label in Italian:** `3B`, `3 B` or `3ª B`? Today the screens say `3 A` and the card field says `3A`.
  *Default: `3B` everywhere (one format), configurable.*
  **Answer:** `3 B`, configurable.
- [x] **QSC6 — Promotion of groups:** keep the section (Italy), or also offer "clear" and "ask"? *Default: keep, with
  "ask" for schools that reshuffle.*
  **Answer:** the default (keep).
- [x] **QSC7 — Combined register cell:** accept `3B` / `3^B` / `3ª B` in one `classe` column of the student import?
  *Default: yes, besides the separate columns.*
  **Answer:** one format only; the import will be studied further later.
- [x] **QSC8 — Snapshots on rename:** renaming a section or level also rewrites the loans' snapshots (statistics follow
  the new name), or history keeps the old name? *Default: rewrite the codes, keep the `class_label_snapshot` as it was
  printed.*
  **Answer:** history is a photo and never changes; reports on live data follow the renames.
- [x] **QSC9 — Reading class:** keep it tied to the levels (B3.8), or make it an independent scale (e.g. ages, `6+`,
  `9+`, as many publishers print)? *Default: tied to levels with a shelf mark; an age scale only if asked.*
  **Answer:** an independent scale; default one level per class for primaria, none for infanzia and secondaria.
- [x] **QSC10 — Compatibility column:** expose a numeric `class_year` in the view for old custom reports? *Default:
  no, pre-1.0.*
  **Answer:** no compatibility while in development.

---

# Part C — Common ground and recommendation

## C1. One "country and school" step

Both topics meet in the first-run wizard: a **country and school type** choice proposes the school preset (B4.4), the
barcode preset and the scanner keyboard layout (A4.2, A2), and the existing country-dependent settings (time zone,
week start, `calendar.autoItalianHolidays`, which today is Italy-only — a natural follow-up, not part of this study).
Everything stays editable afterwards in Administration, travels in the configuration archive, and is covered by the
coverage-map test (Phase 11 rule).

## C2. Shared technique

Both parts use the same safety idea: **validate a configuration by showing what it would confuse.** Barcode formats are
compared position by position; class labels are normalised and compared as a lookup table. In both editors a conflict
is shown as two concrete examples ("`2026-01234` sarebbe sia una copia sia una tessera", "`3B` indicherebbe sia 3ª B
primaria sia 3ª B secondaria"), and saving is refused until it is solved.

## C3. Recommendation (v0.1, before the owner's answers; superseded by Phase 12)

1. **Now (before 0.9.0, ≈ 1.5 days):** the cheap fixes that need no decision — one `classLabel` function and one label
   format, multi-digit years in the filters and URLs, section renames that also move snapshots, the `maxClassYear`
   guard on books' reading classes, the combined `3B` cell in the student import, and a unit test that proves today's
   item and card formats are disjoint (principles A3.1–3) so later changes cannot break it silently.
2. **Part B with the Italian presets (≈ 13 days)** before part A, if QSC2 is "yes": the istituto comprensivo is a real
   Italian case the current model cannot represent, and before 1.0 the schema change costs only a regenerated
   migration (ADR-011); after 1.0 it would need a data migration.
3. **Part A (≈ 5.5–8 days)** when a school with other formats appears (QBF1); today's formats are already safe, so
   nothing is at risk meanwhile. If it is done, the pattern language and the disjointness check come first, the
   presets second, the extra symbologies last.
4. **Foreign presets** of both parts one country at a time, each with a local reviewer, after the 0.9.x field test.

Both parts would become new steps of PLAN.md (a new phase after Phase 11, or steps 11.x if they must ship in 0.9.0),
with an ADR in `docs/DECISIONS.md` for the new configuration sections and, for part A, for the pattern language.
