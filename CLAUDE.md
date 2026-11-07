# CLAUDE.md — rules for coding agents working on BiblioViva

BiblioViva is a lean, staff-only library management system for a school library (≤ 10 000 books, ≤ 1 000 patrons).
The authoritative specification is [PLAN.md](PLAN.md): read §0–§4 before writing code, execute the open steps of §5 in
order (BiblioViva is a **public beta** from the moment the fresh public repository of step 9.36 is published; the
complete version of the plan is released as **0.9.0**, step 9.6, the first tagged release of the beta, for the school
year 2026/27; 1.0.0 comes for September 2027, step 9.10, with database migrations from then on, step 9.37),
and treat the numbered questions in §11 as decisions of the owner (apply the stated default when a question is still open
and record it in `docs/DECISIONS.md`). This file is the short version of those rules; when the two disagree, PLAN.md wins
and this file must be updated.

## Language and communication

- Code, comments, commit messages, documentation and this file: **English**.
- Product UI: **Italian and English**, both complete for every screen, through sveltekit-i18n dictionaries in
  `src/lib/i18n/{it,en}/*.json`. Never hardcode UI text in components. Key sets of the two locales must stay identical.
- The owner writes in Italian; answer them in Italian, keep files in English.
- Documentation for the school (in `docs/<lang>/`: setup guide `setup/`, administration `admin/`, user manual `manual/`, help `help/`) is for
  **non-technical readers**, written after [docs/writing-guide.md](docs/writing-guide.md) (sections, tone, kinds of page,
  markers, hand-over), section by section by Sonnet agents (PLAN.md 9.5, Method): Italian first, English as a faithful mirror, numbered steps, links to the official pages of
  Tailscale, Docker and Raspberry Pi Imager rather than paraphrases. Technical docs (`deploy.md`, `config-reference.md`)
  stay in English. The texts never stress what the reader does not know ("anche senza esperienza", "per chi non ha
  competenze informatiche", "non-technical"): at most they say once that BiblioViva and its guides are meant to be
  simple, also for people who seldom use a computer.
- **A wording or tone correction of the owner applies everywhere** (owner rule): the same fix goes through the home
  page, the documentation (both languages), the site's own strings (`scripts/site-build.ts`), the READMEs and the app's
  dictionaries in the same change, and `docs/writing-guide.md` gains the rule when it is a general one.
- **Screenshots generated from the app** (PLAN.md §3.23): BiblioViva's screens are shown in the docs by pictures that
  `bun run docs:shots` (Playwright, demo data, fixed fonts, three windows — computer 1280 × 800, tablet 834 × 1194,
  phone 412 × 915 —, every language) takes from the running app after the shot list `docs/shots.ts`, in lossless WebP,
  never committed and never taken by hand; the pages of other programs (Tailscale, Raspberry Pi Imager) are mocks
  drawn in `docs/mocks/` and taken the same way, so the documentation is self-contained (ADR-046). Two static sites, never
  served by BiblioViva (ADR-039): the **home page** of `biblioviva.org` is `home/` (`it.html` and `en.html`, the same
  markup, built by `bun run home:build` into `home/dist/` and a zip uploaded by hand to Cloudflare Pages); the **documentation** of
  `docs.biblioviva.org` is built from the Markdown of `docs/` by the Bun script `scripts/site-build.ts` into
  `site/dist/` (`bun run site:build`, `bun run site:serve` on port 5175; ADR-043), GitHub Pages, sections Manuale, Amministrazione, Installazione, Aiuto, Tecnica, not versioned (the current
  release only, published by hand with the manual Pages workflow, normally after each release, ADR-042, ADR-050); the app's help icons open it in the installation's language;
  no accent stripe on the left of boxes. The
  documentation's tone is serious and plain (Italian instructions in the infinitive, headings as nouns, no jokes); the
  home page uses *tu*; the USB barcode scanner is the normal reader everywhere, the phone an optional extra.

## Stack (exact versions are pinned in `package.json`, see PLAN.md §2)

- Runtime **Bun** (≥ 1.4.4) with `bun:sqlite`; no Node-only APIs unless wrapped in `#lib/server/runtime/`.
- **SvelteKit 3** (`@sveltejs/kit`, stable since 3.0.0) with the official `@sveltejs/adapter-bun`; **Svelte 5 runes only**
  (no legacy stores or `export let` in project code); **remote functions** (`query`, `form`, `command`) for all
  client–server calls; no `svelte.config.js` (everything in `vite.config.ts`); `#lib` instead of `$lib`, always with the file
  extension in the specifier (`#lib/server/db/client.js` for a `.ts` module, `#lib/components/X.svelte`).
  Internal links and `goto()` are checked against the routes: `resolve("patrons/7")` from `$app/paths` for a raw
  `<a href>` or `goto()`, a `ResolvedPathname` for the `href` of the UI components (`#lib/ui/href.ts`); outside
  addresses carry `rel="external"`.
- **TypeScript 6.x** strict (`noUncheckedIndexedAccess`); TypeScript 7 only when Svelte tooling supports it.
- **Tailwind CSS 4** + **Skeleton v5** (`@skeletonlabs/skeleton`, `@skeletonlabs/skeleton-svelte`, Zag.js components).
- **SVAR DataGrid** (`@svar-ui/svelte-grid`) for every data table, wrapped once in `DataGrid.svelte`.
- **Inter** and **JetBrains Mono** (`@fontsource-variable/*`, ADR-044), served by the app and copied into the home page
  and the documentation: one look on every device; print templates name their own fonts.
- **Lucide** icons through `@lucide/svelte`, imported per icon (`@lucide/svelte/icons/<name>`), one icon per concept
  (`#lib/ui/icons.ts`). No Iconify.
- **Drizzle ORM/Kit 1.0 RC** for schema and migrations; raw SQL allowed for FTS5 and reports.
- **Valibot** schemas for every input (remote functions, config, report definitions).
- **sveltekit-i18n** for localisation: one server instance for the single configured locale, rebuilt on config reload
  (PLAN.md §3.16).
- Barcodes: `barcode-detector` (camera), `@bwip-js/generic` (rendering); Z39.50 through the `yaz-client` CLI (permanent,
  no pure-TS client); metadata from OPAC SBN only by default; covers from Amazon → Open Library by default, Google Books available but off (it needs an API key), each provider with its own flag;
  UNIMARC parsing with `marcjs`; CSV with `papaparse`; templates with `mustache`; dates with `date-fns` + `@date-fns/tz`;
  ODS export with `fflate`; charts with `chart.js` (bar, line, doughnut only, lazy-loaded).
- Never add a dependency that is not in PLAN.md §2 without an ADR in `docs/DECISIONS.md`. Never use anything in the
  "Do not use" list (PLAN.md §2.8): Flowbite, daisyUI, Paraglide, svelte-i18n, Iconify, ApexCharts, sharp, exceljs/xlsx,
  node-gyp add-ons, Lucia, dark-mode code paths.

## Dependency policy

- Every entry in `package.json` is an **exact version** (no `^`, `~`, `>=`, `latest`). `bun.lock` is committed.
- Upgrades are deliberate, separate commits, normally at phase boundaries. Latest stable release is the rule; Drizzle 1.0 RC
  is the accepted exception. Before each phase check for newer patch releases of the pinned packages.

## Product rules that shape the code

- **Staff only.** No public catalogue, no patron accounts, no self-service. Every route except `/login` and `/healthz`
  requires a staff session. Media routes (photos, covers, classification images) require a session too.
- **Patrons are students and teachers only** (`patron_type`), stored in the database. Library operators are **staff
  accounts defined in `config.json`** (`security.users`, normally one shared account per role) and mirrored into
  `staff_user` at startup; no Tailscale identity login. No fines, no holds/reservations, ever. DVDs and other media are
  item types (`library.itemTypes`), classified like books.
- **Lean data model** (PLAN.md §4, aligned with the library's Koha fast framework): no contributors, edition, language,
  summary, page count, item location or price (series and number in the series exist, typed by hand, Q84); `physical_description` is one string; `author` and `publisher` are
  mandatory with the special values of `catalog.*` (`Anonimo`, `AA. VV.`, `s.n.`, `s.l.`). The reading level (a code of
  the independent scale `classification.readingLevels`, Q96) lives on the record, or on each copy when
  `classification.classPerItem` is on (never both).
- **Imports validate first** (PLAN.md §3.22): validate the whole file, ask the questions, enable "Importa" only with zero
  errors, commit in one transaction. No partial imports, no "skip errors". Column names are English only (`#lib/shared/import-columns.ts`:
  required, keys, optional); templates carry the columns the operator chooses; a missing key is announced (Q115).
- **Permissions, not roles, in code.** Check `can(user, 'loans' | 'patrons' | 'patrons.import' | 'catalog' |
  'catalog.import' | 'reports' | 'anonymize' | 'admin')`. Roles are bundles of permissions defined in `config.json`.
  `requireUser('<permission>')` is the first line of every remote function; never pass a role name.
- **Configuration lives in JSON** (`CONFIG_DIR/config.json`, validated with Valibot at startup, reloadable), and by 0.9.0
  **every setting must be editable from the admin UI** (Phase 11 completeness rule, coverage map test in 11.2/11.11);
  the whole configuration folder is exported and imported as one archive (11.3). Secrets only
  in environment variables declared in `src/env.ts`. Time zone is `library.timezone`; never rely on the container clock.
- **Hardware profile** in `performance` (`small` default: Raspberry Pi 4 with 2 GB and SD card; `medium`: old PC with a
  spinning disk; `large`: PC with SSD); every
  host-dependent setting (SQLite cache/mmap, image and yaz concurrency, argon2 memory) reads from it, never hardcoded.
- **Three volumes**: `CONFIG_DIR` (`/config`: config, reports, templates, classification images), `DATA_DIR`
  (`/data`: SQLite database, uploads, imported files, temporary files; a named volume) and `BACKUP_DIR` (`/backups`:
  the backups, their copy of the pictures, `offsite.json`; the folder `./backups` beside the compose file). Only
  `backupsDir()` (`#lib/server/services/backup.ts`) knows where the backups are. In development all three live under
  `./local/` (gitignored).
- **School structure** (Phase 12, ADR-024): the stages and years are configuration (`school.*`, presets in
  `config/school-presets/`, read from the application); the **classes are groups of the database** (`class_group`,
  `class_group_level`: a pluriclasse hosts several years; teachers belong to a teachers group), permanent cohorts that
  the class upgrade moves up (`3 B` becomes `4 B`). A patron stores `class_group_id` and `level_code`; labels and order
  always come from `#lib/shared/school.ts` or the view `patron_class`, never from string concatenation. Loans keep a
  snapshot of the class that is never rewritten. Only `admin` manages classes.
- **Barcodes** (Phase 12): formats are configuration (`barcodes.*`, token patterns): new copies `YYYY-CNNNN`, new
  cards `CNNNNNN`, both with a mod-23 check letter by default (Luhn and Damm selectable); retired and legacy formats
  (plain counters, `YYYY-NNNN`, 10-digit cards) must keep working everywhere. **Copies and cards can never be
  confused** (owner rule, Q90): the configuration is refused when the two kinds could share a code or look alike,
  and a card number may never equal a copy barcode. Recognition always goes through the format table
  (`#lib/shared/scan.ts`), never through hand-written regexes; scanner input is normalised with the configured
  keyboard layout.
- **Public demo** (`DEMO_PUBLIC=1`, step 9.17, ADR-028, ADR-035): what would let a visitor spoil it is refused by
  `assertNotDemo(feature)`; what a visitor sends (free text, pictures, import files) is replaced by an example in the
  services through `#lib/server/demo/content.ts`. A new feature that stores text or pictures passes its input through it.
- **Photos and covers can be switched off** (`photos.enabled`, `covers.enabled`, step 9.38): any code that takes,
  shows, imports or looks up a patron photo or a book cover checks `photosOn()` / `coversOn()` (`#lib/ui/features.ts`)
  in the page and calls `requireFeature()` (`#lib/server/features.ts`) in its pages and remote functions; switching
  off deletes nothing. The shipped card templates have a version without the photo (`config/cards/templates-no-photo/`,
  same names): change both when changing one.
- **Privacy**: patrons are mostly minors. Never log names, photos or card numbers; never commit real data; seed data
  is synthetic and deterministic. Removing a patron anonymizes it immediately and irreversibly (names erased, everything
  else kept); there is no retention timer and no `left` state.
- **One language per installation** (`ui.locale`, chosen in the first-run wizard, changeable later in Administration → Appearance and language); no per-user language, no language switch, no language cookie. The **public demo only** follows its visitor (Q120, ADR-047): the cookie `bv_lang` shared on `biblioviva.org` (home page, documentation, demo), then the browser's language; a switch (globe, IT · EN) on the login page and in the top bar. Server code that builds text for the user takes `requestLocale()` (`#lib/i18n/server.ts`), never `getUiLocale()`. The list of languages is **built from the dictionary folders** (`src/lib/i18n/<locale>/`, generated into `locales.ts` by `bun run i18n:locales`, checked by the parity test) **plus the valid language packs** in `CONFIG_DIR/i18n/<code>/` (`#lib/server/i18n/`, validated against English at startup, `bun run i18n:check <folder>`); English always exists and comes first.
- **Circulation desk messages** come from the catalogue in PLAN.md Appendix I (reason code → i18n key → text → action
  button); every anomaly is explained with what happened and what to do. No sounds at the desk: the only sound of
  the application is the short beep of a camera read (`barcodes.cameraSound`, Web Audio in `#lib/scanner/sound.ts`
  only, Q137).
- **Barcodes are rendered as Code 128**; scanning accepts Code 39 too (old cards and labels).
- **Printing** (cards, labels, slips) is template-based: folders with Mustache HTML, CSS in mm, assets inlined as data
  URLs; card units are front + back side by side (fold on the short edge); label geometry comes from the configured
  adhesive stock. The default label job is the **pair**: spine band on top, barcode label below, one unit of two
  stacked 70 × 48 mm labels per book, reproducing the library's current printout kept in `docs/reference/labels/`.
  The built-in card template reproduces the library's current cards (layout in `docs/reference/cards/README.md`).
  Label templates adapt to the stock (variants by cell height) and stay legible in black and white; colour is never the
  only cue. Call numbers: `{{author3}}` is the segnatura; labels show `B 4 DEL`, `B DEL` or `590 ROS` by configuration.
  Every print route accepts `list=<id>` (print lists) as well as `ids=`.
- **Templates are edited by drawing and by code over the same files** (11.16): the HTML of the faces is the only
  source (no layout file beside it); an element carries its place (mm) and look in its own `style` attribute;
  the designer reads the files into elements and writes back only the elements that changed, every other byte
  kept. Never make an edit in one view that the other cannot show or would drop.

## UX rules (PLAN.md §3.18)

- **Light theme only.** No dark mode, no `prefers-color-scheme` handling.
- Simple, modern, colourful, icon-rich; status is always colour + icon + text; scan-first and keyboard-first at the
  circulation desk; progressive disclosure and sensible defaults; one layout pattern per job (`PageHeader`,
  `ListToolbar`, `FormLayout`, `DetailLayout`, `EmptyState`, `StatusBadge`); `/dev/ui` is the living style guide.
- Mobile is a first-class client (bottom navigation, 44 px touch targets, full-screen camera flows).
- Italian microcopy uses operator vocabulary ("copia", "segnatura" for the call number — the owner's word, never
  "collocazione"), with the technical term in tooltips.

## Testing (PLAN.md §7)

- **Vitest 5** for unit tests (next to the code, `*.test.ts`) and component tests in browser mode (Chromium).
- **Playwright** for end-to-end tests (`tests/e2e/<area>/<flow>.spec.ts`, page objects in `tests/e2e/pages/`):
  projects `desktop-chromium` (1280 × 800) and `mobile-chromium` (412 × 915 CSS px viewport, scale factor 2, touch).
  Chromium is the browser of every everyday run; mobile is tested by viewport size only, never with devices or emulators.
  `bun run test:browsers` runs the component tests and the whole Playwright suite on **Chromium, Firefox and WebKit**
  (`BV_BROWSER`, a fresh database per engine; WebKit through Playwright's container on hosts without Ubuntu's
  libraries): an opt-in mode, required before 1.0 (step 9.10), never part of `bun run ci`.
  Playwright runs under Node; everything else under Bun.
- Every service or pure module gets unit tests; every user-facing flow gets a Playwright spec; print layouts get
  visual snapshots; axe runs on main pages. Coverage gate: 95 % lines on services and shared code. The i18n key-parity
  test is a hard error.
- **Bugs are fixed test first** (simplified TDD, owner rule): when the owner reports a bug, first write a test that
  reproduces it (unit or Playwright, whichever reaches the fault) and run it to see it fail; then change the code and
  run it again to see it pass. The test stays in the suite.
- Camera flows use Chromium fake devices with fixture videos; external providers are mocked with `METADATA_PROVIDER=mock`.
- Flows that change every patron of the shared test database (the class upgrade) live in `*.final.spec.ts` and run
  once in the Playwright project `final`, after `desktop-chromium` and `mobile-chromium` have finished.
- Everyday automated tests run on Chromium only; **Playwright's Firefox and WebKit must be installed too**
  (`bunx playwright install firefox webkit`) for `bun run test:browsers` and for one-off manual checks (Firefox is
  a common browser; e.g. camera and upload flows behave differently). A Chromium-only check in a spec (the DevTools
  protocol) is guarded with `browserName === "chromium"`.

## Working conventions

- Commands: `bun run dev`, `bun run build`, `bun run start` (the built server, `bun --smol` when the hardware profile asks), `bun run check`, `bun run lint`, `bun run test`,
  `bun run test:e2e`, `bun run ci`, `bun run test:report`, `bun run db:generate`, `bun run db:migrate`, `bun run db:seed`, `bun run dev:reset --yes`, `bun run demo` (the public demo locally, `local/demo/`, port 5174), `bun run config:check`, `bun run config:export [file] [--only|--except parts]`, `bun run config:import <zip> [--only|--except parts] [--yes]`,
  `bun run auth:hash-password`, `bun run themes:generate`, `bun run home:build` (the home page of biblioviva.org into `home/dist/` and `home/biblioviva-home.zip`), `bun run home:serve` (`home/dist/` on port 5176), `bun run docs:shots` (the documentation's screenshots into `site/.shots/`), `bun run docs:diagrams` (the Mermaid diagrams of `docs/` drawn into `site/.diagrams/`), `bun run site:build` / `bun run site:serve` (the documentation site into `site/dist/`, served on port 5175), `bun run i18n:locales`, `bun run deps:generate` (after any dependency change: the About page inventory), `bun run classification:import-images`, `bun run pictograms:generate` (the shipped spine-band pictograms), `bun run templates:shipped` (after changing a built-in print template: the record of shipped versions), `bun run z3950:test`, `bun run metadata:test`, `bun run backup:restore <zip|db> [--only|--except parts] [--yes]`.
- **Database migrations before 1.0** (through the 0.9.x field tests too, owner decision Q82): `drizzle/` holds a **single** migration (the initial one). When the schema
  changes, delete it and regenerate it with `bun run db:generate` (rename the folder to `<YYYYMMDD>000000_initial`: the day and a zero time, so the name never shows an hour); never
  add incremental migrations. Development databases are reset with `bun run dev:reset --yes` and reseeded (owner
  decision, ADR-011). **From 1.0.0** (step 9.37) the single migration is the frozen baseline: every schema change is a
  new migration from `bun run db:generate`, committed with the change, and a released migration is never edited or
  deleted.
- **GitHub workflows run only by hand** (owner rule, ADR-054): `ci`, `publish`, `i18n-packs`, `pages` and `slow` have a
  manual trigger and nothing else; a push builds nothing. `bun run ci` runs locally, on its own, before every push.
  The agent says when a workflow is needed (the `main` image after a push that the demo must get, `publish` +
  `i18n-packs` + `pages` at a release, `slow` before one, `ci` for a clean-machine check) and **asks the owner before
  starting it**; it never starts one unasked. `publish` gives `latest` only to the highest stable tag `vX.Y.Z`.
- **TypeScript style:** tabs (4 columns), double quotes, trailing commas everywhere, and braces on every `if`/`else`/
  loop body even when it is one statement (`curly: all`). Prettier and ESLint enforce it: run `bun run lint`.
- A step of PLAN.md is done only when its acceptance criteria hold, the required tests exist and `bun run ci` is green.
  Then tick the checkbox in PLAN.md, add a line to `docs/STATUS.md`, commit as `phase X.Y: <summary>`.
- **`docs/TODO.md`** is the short checklist of what is left (the owner's checks, the steps open for the next release,
  housekeeping): update it in the same commit as PLAN.md whenever a step is ticked, added or moved, or a check is
  asked of the owner.
- Commits and pull requests carry **no AI attribution** (no `Co-Authored-By` trailer, no "Generated with" footer): the use
  of Claude is disclosed in the READMEs, and the maintainer is the only contributor on record.
- Do not take product decisions on your own; use the defaults in PLAN.md §11 and record them in `docs/DECISIONS.md`.
- Mark unverified facts with `[VERIFY]` and resolve them when you reach the step.
- **No dates or history in the plan, the documents and code comments** (owner rule): PLAN.md, CLAUDE.md, the READMEs,
  `docs/` and comments describe the current state, never when or in which order something was decided or changed (no
  "owner decision 2026-…", "since …", "until …", "numbered … before", "then called …"). History lives in git, in the
  Date column of `docs/STATUS.md` and in the ADR titles of `docs/DECISIONS.md`. Dates that are data (example codes,
  holidays, sample calendars) are fine.
- **Step and phase numbers never change** (owner rule, ADR-030): commits and `docs/STATUS.md` cite them, so a step keeps
  its number even when it is carried out earlier or later than its place; a new step or phase takes the next free
  number, and PLAN.md §0 rule 2 says when it runs.
- Business logic lives in `#lib/server/services/*` as plain functions `(db, input, actor)`, or `(ctx, input, actor)`
  with a `ServerContext` (`#lib/server/context.ts`, a `Pick` of it when only part is needed) when they also need the
  configuration or the volumes; remote functions are thin: validate → authorize → call service → return DTO. Remote
  function files are `*.remote.ts` under `src/lib/remote/` (never inside a `server/` directory).
- **Keep the reference docs in step with the code** (owner rule): every change that adds, moves or
  removes a page, a link, a tab or a permission on a page updates `docs/navigation.md` (trees, route index, user
  paths); every schema change updates `docs/database.md` (Mermaid diagrams, table sections, conventions). The
  update belongs to the same commit as the change.
- **Tell the owner when the published documentation goes stale** (owner rule): a change that alters what the
  documentation describes or shows — a screen, a label or message quoted in a page, a flow or its steps, a setting,
  a command, the installation, `setup.sh`, the compose files, the home page's facts — updates the pages of `docs/`
  (both languages) and the shot list in the same commit, and the final message to the owner says plainly that the
  documentation site must be published again (Actions → pages → Run workflow, ADR-050) and, when the home page changed,
  that it must be built and uploaded again. Never publish either one yourself.
- Keep it lean: SSR first, client JS only where interaction needs it, heavy libraries (barcode WASM, OpenCV) lazy-loaded
  only on the pages that use them. Budget: ≤ 250 KB gzipped client JS on core pages.
- Source files start with `// SPDX-License-Identifier: GPL-3.0-or-later`. The project license is GPL-3.0-or-later.
