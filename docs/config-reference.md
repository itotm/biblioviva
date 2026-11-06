# Configuration reference

Generated from the shipped folder [`config/`](../config/) (`config.example.json` + `classification.json` +
`labels/stocks/*.json`, merged) by `bun run scripts/config-reference.ts`; do not edit by hand. The schema
(`src/lib/server/config/schema.ts`) validates every key at startup and `bun run config:check` checks a
folder without starting the server, as "Import configuration" does with an archive (the schema, the templates,
the pictograms, the reports, the language packs). Keys starting with `_comment` are ignored. Secrets never
live here (environment variables, see `src/env.ts`).

## The configuration folder

`CONFIG_DIR` (the `/config` volume) is a folder, not one file (PLAN.md §3.6, Q78). Everything below is
merged at startup and on every reload into the single document described by the table; the merge is
deterministic and `bun run config:check --explain <key.path>` prints which file defines a key.

| Path | Contents | Merge rule |
|---|---|---|
| `config.json` | the core sections (written by the first-run wizard) | base document |
| `<section>.json` (e.g. `classification.json`, `circulation.json`) | one top-level section | deep-merged over the same section of `config.json`; the fragment wins (a warning says so when both define it) |
| `calendar.<year>.json` | `holidays` and `closedRanges` of one year | appended to `calendar` |
| `labels/stocks/<id>.json` | one adhesive stock (`id` defaults to the file stem) | appended to `labels.stocks`, replacing a stock with the same `id` |
| `{cards,labels,slips}/templates/<name>/` | one print template per folder | discovered by name, never merged into JSON |
| `reports/<name>.json` | the school's own report definitions; a file with the `id` of a built-in replaces it (the built-ins are read from the application, ADR-014) | discovered by `id` |
| `classification/images/` | pictograms, uploaded from Administration → Configuration → Classification or copied by hand | discovered by code |
| `branding/logo.png` | the library's logo (step 4.10), uploaded from Administration → Appearance and language | shown at the top left of the app when present |
| `history/<change>/` | the previous version of every file a change from the admin UI touched, with `change.json` (step 11.1); the last 50 changes are kept | never loaded; used to restore a previous version |

The editors of Administration → Configuration (Phase 11) write each section back to the file it
comes from, atomically, after validating the whole folder with the same schema; the classification
(`classification.json` and its pictograms) is the first one (step 11.1). Editing the files by hand
keeps working.

To add a stock or a template, copy a file or a folder and edit it. The defaults are copied into
`CONFIG_DIR` at the first start when missing; `config.json` alone is never enough on its own because the
`classification` section lives in its fragment.

## Keys

| Key | Example / type | Notes |
|---|---|---|
| **`library`** | section |  |
| `library.name` | `"Biblioteca dell'Istituto"` |  |
| `library.contactEmail` | `"biblioteca@scuola.example"` |  |
| `library.schoolYearStart` | `"09-01"` |  |
| `library.schoolYearLabel` | `"span"` |  |
| `library.timezone` | `"Europe/Rome"` |  |
| `library.weekStart` | `"monday"` |  |
| `library.itemTypes` | array of 4 object(s), e.g. `{"code":"libro","label":"Libro"}` |  |
| **`school`** | section | Phase 12 (Q94): the levels of the school in order, grouped in stages, from the preset it-primaria (config/school-presets/). The classes themselves (1 A, 3 B, the teachers group) are data, created in Administration → Classes. |
| `school.preset` | `"it-primaria"` |  |
| `school.stages` | array of 1 object(s), e.g. `{"code":"primaria","name":"Primaria"}` |  |
| `school.levels` | array of 5 object(s), e.g. `{"code":"1","label":"1","name":"Prima primaria","stage":"primaria"}` |  |
| `school.classLabel` | `"{level} {group}"` |  |
| `school.groupWord` | `"Sezione"` |  |
| `school.cardClass` | `"{word} {group}"` |  |
| `school.promotionWithinStage` | `"keep"` |  |
| `school.promotionAcrossStages` | `"ask"` |  |
| **`catalog`** | section | Q73: author and publisher are mandatory; these special values are offered as quick picks when there is no personal author or the publisher/place is unknown. |
| `catalog.specialAuthors` | array, e.g. `["Anonimo","AA. VV."]` |  |
| `catalog.unknownPublisher` | `"s.n."` |  |
| `catalog.unknownPlace` | `"s.l."` |  |
| **`barcodes`** | section | Phase 12 (Q90-Q93): new copies YYYY-CNNNN and new cards CNNNNNN with a mod-23 check letter (2026-E0267, U012345). The codes of the old system keep working: copies YYYY-NNNN, cards of 10 digits, plain numbers up to plainMaxLength digits [VERIFY at the Koha migration]. |
| `barcodes.keyboardLayout` | `"it"` |  |
| `barcodes.cameraSound` | `"confirm"` |  |
| `barcodes.plainMaxLength` | `9` |  |
| `barcodes.item` | object |  |
| `barcodes.item.format` | object |  |
| `barcodes.item.format.pattern` | `"YYYY-CNNNN"` |  |
| `barcodes.item.format.check` | `"mod23"` |  |
| `barcodes.item.legacy` | array of 1 object(s), e.g. `{"pattern":"YYYY-NNNN","check":"none"}` |  |
| `barcodes.item.symbology` | `"code128"` |  |
| `barcodes.patron` | object |  |
| `barcodes.patron.format` | object |  |
| `barcodes.patron.format.pattern` | `"CNNNNNN"` |  |
| `barcodes.patron.format.check` | `"mod23"` |  |
| `barcodes.patron.legacy` | array of 1 object(s), e.g. `{"pattern":"NNNNNNNNNN","check":"none"}` |  |
| `barcodes.patron.symbology` | `"code128"` |  |
| `barcodes.patron.counterStart` | `"afterLegacyMax"` |  |
| **`circulation`** | section | Q13 resolved: students 15 days / 1 loan / 5 renewals, teachers 15 days / 4 loans / 5 renewals. Q68: DVDs 5 days and 1 renewal, whoever borrows them. |
| `circulation.rules` | object |  |
| `circulation.rules.student` | object |  |
| `circulation.rules.student.loanDays` | `15` |  |
| `circulation.rules.student.maxLoans` | `1` |  |
| `circulation.rules.student.maxRenewals` | `5` |  |
| `circulation.rules.student.renewalDays` | `15` |  |
| `circulation.rules.teacher` | object |  |
| `circulation.rules.teacher.loanDays` | `15` |  |
| `circulation.rules.teacher.maxLoans` | `4` |  |
| `circulation.rules.teacher.maxRenewals` | `5` |  |
| `circulation.rules.teacher.renewalDays` | `15` |  |
| `circulation.itemTypeOverrides` | object |  |
| `circulation.itemTypeOverrides.dvd` | object |  |
| `circulation.itemTypeOverrides.dvd.loanDays` | `5` |  |
| `circulation.itemTypeOverrides.dvd.maxRenewals` | `1` |  |
| `circulation.itemTypeOverrides.dvd.renewalDays` | `5` |  |
| `circulation.dueDateMode` | `"datedue"` |  |
| `circulation.renewFrom` | `"today"` |  |
| `circulation.allowRenewalWhenOverdue` | `true` |  |
| `circulation.overdueNotice` | object |  |
| `circulation.overdueNotice.template` | `"overdue-by-class"` |  |
| `circulation.overdueNotice.pageBreakPerGroup` | `false` |  |
| `circulation.overdueNotice.minDays` | `5` |  |
| `circulation.blockIfOverdue` | `false` |  |
| `circulation.hardDueDate` | `null` |  |
| `circulation.receipts` | `false` |  |
| **`calendar`** | section |  |
| `calendar.weeklyClosedDays` | array, e.g. `[0,6]` |  |
| `calendar.autoItalianHolidays` | `true` |  |
| `calendar.holidays` | array, e.g. `["2026-11-02"]` |  |
| `calendar.closedRanges` | array of 2 object(s), e.g. `{"from":"2026-12-23","to":"2027-01-06","reason":"Vacanze di Natale"}` |  |
| **`z3950`** | section |  |
| `z3950.defaultTarget` | `"sbn"` |  |
| `z3950.timeoutMs` | `15000` |  |
| `z3950.maxRecordsIsbn` | `20` |  |
| `z3950.maxRecordsSearch` | `20` |  |
| `z3950.targets` | array of 1 object(s), e.g. `{"id":"sbn","name":"OPAC SBN","host":"opac.sbn.it","port":2100,"database":"nopac` |  |
| **`metadata`** | section | Q26 resolved: only the public OPAC SBN Z39.50 service by default. Optional providers: openlibrary, googlebooks, sbn-json (undocumented mobile gateway). |
| `metadata.providers` | array, e.g. `["sbn"]` |  |
| `metadata.cacheDays` | `30` |  |
| `metadata.timeoutMs` | `8000` |  |
| **`performance`** | section | Q22, step 9.28: micro = one slow core and 512 MB; small = Raspberry Pi 4 with 2 GB and SD card (default); medium = old PC with a spinning hard disk; large = PC with plenty of RAM and SSD. Any key below overrides the profile default (the values of each profile: src/lib/shared/performance.ts). |
| `performance.profile` | `"small"` |  |
| `performance.sqliteCacheMb` | `null` |  |
| `performance.sqliteMmapMb` | `null` |  |
| `performance.walAutocheckpointPages` | `null` |  |
| `performance.imageConcurrency` | `null` |  |
| `performance.yazConcurrency` | `null` |  |
| `performance.heavyConcurrency` | `null` |  |
| `performance.argon2MemoryMb` | `null` |  |
| `performance.smol` | `null` |  |
| **`cards`** | section | Defaults reproduce the library's current cards (docs/reference/cards): four units per A4, crop marks in the margins and gaps, one template for every patron type. |
| `cards.defaultTemplate` | `"default"` |  |
| `cards.templateByPatronType` | object |  |
| `cards.layout` | `"side-by-side"` |  |
| `cards.duplex` | object |  |
| `cards.duplex.flip` | `"long-edge"` |  |
| `cards.duplex.backOffsetMm` | object |  |
| `cards.duplex.backOffsetMm.x` | `0` |  |
| `cards.duplex.backOffsetMm.y` | `0` |  |
| `cards.cardMm` | object |  |
| `cards.cardMm.width` | `85.6` |  |
| `cards.cardMm.height` | `53.98` |  |
| `cards.bleedMm` | `0` |  |
| `cards.sheet` | object |  |
| `cards.sheet.paper` | `"A4"` |  |
| `cards.sheet.rows` | `4` |  |
| `cards.sheet.marginMm` | `6` |  |
| `cards.sheet.gapMm` | `3` |  |
| `cards.sheet.foldMarks` | `true` |  |
| `cards.sheet.cutMarks` | `true` |  |
| `cards.sheet.cutLines` | `null` |  |
| `cards.validityMonths` | `12` |  |
| `cards.showPhoto` | `true` |  |
| **`labels`** | section | Adhesive stocks live one per file in labels/stocks/<id>.json (Q78): copy a file to add a new stock. |
| `labels.default` | `"pair"` |  |
| `labels.titleMaxChars` | `30` |  |
| `labels.monochrome` | `false` |  |
| `labels.pair` | object |  |
| `labels.pair.template` | `"pair-default"` |  |
| `labels.pair.stock` | `"a4-70x48"` |  |
| `labels.barcode` | object |  |
| `labels.barcode.template` | `"barcode-default"` |  |
| `labels.barcode.stock` | `"a4-70x48"` |  |
| `labels.spine` | object |  |
| `labels.spine.template` | `"spine-default"` |  |
| `labels.spine.stock` | `"a4-70x48"` |  |
| `labels.stocks` | array of 4 object(s), e.g. `{"id":"a4-70x24","name":"Etichette 70 × 24 mm (3 × 12, mezza altezza)","paper":"` |  |
| **`photos`** | section | enabled: false switches patron photos off altogether (9.38). Step 3.11: every patron photo is stored at exactly width × height (cropped at the centre when the browser has not cropped it) in `format` (jpeg or webp) with `quality` 1–100. required: false hides every reminder that photos are missing (they can still be taken and printed). |
| `photos.enabled` | `true` |  |
| `photos.required` | `true` |  |
| `photos.width` | `480` |  |
| `photos.height` | `640` |  |
| `photos.format` | `"webp"` |  |
| `photos.quality` | `80` |  |
| `photos.maxUploadBytes` | `8000000` |  |
| `photos.sheet` | object | Phase 13: pictures with many faces for the photo census (the photographer's sheet, the class's cards on a table). maxUploadBytes: the largest file accepted; maxPixels: the longest side kept; maxFrames: at most this many photos per picture; minAspect / maxAspect: the height / width of a photo frame. |
| `photos.sheet.maxUploadBytes` | `32000000` |  |
| `photos.sheet.maxPixels` | `4000` |  |
| `photos.sheet.maxFrames` | `60` |  |
| `photos.sheet.minAspect` | `1` |  |
| `photos.sheet.maxAspect` | `1.6` |  |
| **`covers`** | section | enabled: false switches book covers off altogether (9.38). Step 3.11: covers keep their proportions (never cropped): `width` in pixels, optional `maxHeight`, `format` jpeg or webp, `quality` 1–100. Q27: cover providers tried in this order, each with its own flag. Amazon has no API (may stop working); Google Books needs the GOOGLE_BOOKS_API_KEY environment variable, hence off by default. |
| `covers.enabled` | `true` |  |
| `covers.width` | `600` |  |
| `covers.maxHeight` | `null` |  |
| `covers.format` | `"webp"` |  |
| `covers.quality` | `80` |  |
| `covers.maxUploadBytes` | `12000000` |  |
| `covers.providers` | array of 3 object(s), e.g. `{"id":"amazon","enabled":true}` |  |
| `covers.country` | `"IT"` |  |
| `covers.minWidth` | `300` |  |
| `covers.autoFetch` | `true` |  |
| `covers.timeoutMs` | `6000` |  |
| **`privacy`** | section | Removal of a patron anonymizes it immediately (Q32/Q33); there is no retention timer. |
| `privacy.auditRetentionMonths` | `24` |  |
| **`backup`** | section |  |
| `backup.cron` | `"0 3 * * *"` |  |
| `backup.catchUp` | `true` |  |
| `backup.keepDays` | `30` |  |
| `backup.offsite` | object |  |
| `backup.offsite.enabled` | `false` |  |
| `backup.offsite.remote` | `"/offsite/biblioviva-backups"` |  |
| **`security`** | section | Accounts are normally shared per role. passwordHash from `bun run auth:hash-password`; a plain `password` key is accepted with a warning. At least one active account must hold `admin`. |
| `security.sessionDays` | `14` |  |
| `security.loginMaxAttempts` | `5` |  |
| `security.loginWindowMinutes` | `15` |  |
| `security.auth` | object |  |
| `security.auth.mode` | `"config"` |  |
| `security.users` | array of 5 object(s), e.g. `{"username":"admin","displayName":"Amministratore","roles":["admin"],"passwordHa` |  |
| `security.roles` | object |  |
| `security.roles.admin` | array, e.g. `["*"]` |  |
| `security.roles.circulation` | array, e.g. `["loans"]` |  |
| `security.roles.cataloging` | array, e.g. `["catalog"]` |  |
| `security.roles.membership` | array, e.g. `["patrons"]` |  |
| `security.roles.reporting` | array, e.g. `["reports"]` |  |
| **`ui`** | section | locale: a built-in language (en, it) or the code of a language pack in CONFIG_DIR/i18n/<code>/ (validated at startup, English fills the gaps). theme: the colour set; dashboard: the sections of the start page (quick actions always first), each true or false. Both are chosen in Administration → Appearance and language. |
| `ui.locale` | `"en"` |  |
| `ui.theme` | `"ocean"` |  |
| `ui.dashboard` | object |  |
| `ui.dashboard.quickActions` | `true` |  |
| `ui.dashboard.tiles` | `true` |  |
| `ui.dashboard.inventory` | `true` |  |
| `ui.dashboard.installHint` | `true` |  |
| `ui.dashboard.dueThisWeek` | `true` |  |
| `ui.dashboard.todayActivity` | `true` |  |
| `ui.checkoutIdleSeconds` | `120` |  |
| `ui.setupCompleted` | `true` |  |
| **`classification`** | section | Scheme taken from the library's Koha CCODE list (docs/reference/classification): single-letter genres for fiction, Dewey-like codes grouped by hundred for non-fiction, one pictogram per genre and per hundred (children inherit). The shipped pictograms are generated (bun run pictograms:generate, step 11.14) in the colour of each node; replace them from the classification editor. |
| `classification.fictionByClass` | `true` |  |
| `classification.readingLevels` | array of 5 object(s), e.g. `{"code":"1","label":"1ª"}` |  |
| `classification.classPerItem` | `false` |  |
| `classification.genres` | array of 14 object(s), e.g. `{"code":"A","label":"Romanzi e Racconti","image":"A.svg","color":"#e8231b"}` |  |
| `classification.nonfiction` | array of 9 object(s), e.g. `{"code":"000","label":"Generalità","image":"000.svg","color":"#f6c744","children` |  |
| `classification.deweyMap` | array of 48 object(s), e.g. `{"prefix":"004","code":"004"}` |  |
| `classification.callNumber` | object | The segnatura is computed from these patterns (Q143): genre, class (the reading level), code, author3 (the author's first three letters; the title's for a special author), title1, text (one written part per title, proposed by `text`), copytext (one per copy). The first-run wizard and Amministrazione → Configurazione → Classificazione choose them; every copy is recomputed when they change. |
| `classification.callNumber.fiction` | `"{{genre}} {{author3}}"` |  |
| `classification.callNumber.fictionWithClass` | `"{{genre}} {{class}} {{author3}}"` |  |
| `classification.callNumber.nonfiction` | `"{{code}} {{author3}}"` |  |
| `classification.callNumber.text` | `"author3"` |  |
