# Feasibility study — several libraries in one installation

> **Status:** STUDY. Not a plan: nothing here is approved or scheduled.
> **Audience:** the owner (feasibility, cost, trade-offs) and a later coding agent that may expand the chosen option
> into steps of PLAN.md.
> **Context:** PLAN.md Q41 decided "one library per installation, no branches" and §6 lists multi-branch as *skip*.
> This study reopens that decision only to measure it. Estimates are in agent-driven person-days (one day = one
> working session of the coding agent plus the owner's review), including tests and docs, excluding field testing.

## 1. What "several libraries" means for an Italian school

An *Istituto Comprensivo* (IC) has one head teacher, one office and one electronic register, but several **plessi**
(buildings), often with a primary school in one and a *secondaria di I grado* in another, sometimes a small library in
each. Typical situations, from the least to the most integrated:

| Scenario | Shelves | Staff | Patrons | Books move | Admin |
|---|---|---|---|---|---|
| S1 — Independent plessi | separate | separate volunteers/teachers per plesso | each plesso its own pupils | never | one person helps all |
| S2 — Federated plessi | separate | separate, one coordinator sees all | own pupils; teachers work in several plessi | rarely (a class set lent for a project) | one |
| S3 — One library, several rooms | separate rooms, one catalogue | shared | shared (any pupil borrows anywhere) | often (transfers, returns elsewhere) | one |
| S4 — Several schools (a network, *rete di scuole*) | separate | separate | separate | never | one technical helper |

Differences inside one IC that matter for BiblioViva: primary and middle school have **different** `library.schoolType`,
`maxClassYear` (5 vs 3), `sections`, `classification.fictionByClass` (on vs off), loan rules and card templates; the
calendar is usually the same; the register export (student import, step 2.6) contains **every plesso** of the IC.

### Questions for the owner

Numbered `QML…` here; if the study turns into a plan they take the next free numbers of PLAN.md §11.

- [ ] **QML1 — Real need:** which scenario (S1–S4) does the school actually have, or expect in the next two years? Is
  there a concrete second library today, or is this a possibility? *Default: S1, no concrete need yet.*
- [ ] **QML2 — Patrons:** does a pupil or teacher borrow in more than one plesso? Must a teacher have one card valid in
  every plesso? *Default: no; each plesso has its own patrons, a teacher may be enrolled in two.*
- [ ] **QML3 — Books moving:** are books lent from one plesso to another (class sets, transfers, return elsewhere)?
  *Default: no.*
- [ ] **QML4 — Visibility:** may the staff of plesso A see the catalogue of plesso B? Its patrons (minors)? *Default:
  catalogue yes if cheap, patrons never.*
- [ ] **QML5 — Staff:** one administrator for all libraries plus per-plesso operator accounts, or accounts shared across
  plessi? *Default: one admin for all, operator accounts per plesso.*
- [ ] **QML6 — Configuration:** which settings differ per plesso (name, logo, school type, classes, sections,
  classification, loan rules, calendar, templates, stocks, colour set, language)? *Default: everything may differ,
  the language and the colour set are per installation.*
- [ ] **QML7 — Reports:** are statistics needed across all libraries (the IC's annual report), or per library only?
  *Default: per library, with a CSV/ODS export the office can merge.*
- [ ] **QML8 — Barcodes and cards today:** are the plessi in one Koha today (unique barcodes across plessi) or in
  separate systems (barcodes and card numbers may collide)? *Default: unknown; ask at the Koha migration.*
- [ ] **QML9 — Hardware:** one Raspberry Pi / PC for the whole IC, or one per plesso? Is the network between plessi
  reliable (Tailscale works across sites, but a plesso offline cannot lend if the server is elsewhere)? *Default: one
  host per IC, reachable over the tailnet.*
- [ ] **QML10 — Timing:** before 0.9.0, during the 0.9.x field test, or after 1.0? *Default: after 1.0, with only the
  cheap "door open" measures of §5 before.*

## 2. Where the "one library" assumption lives today

The code is single-library by design (Q41). The assumption is concentrated in **three process-wide singletons** and
spread through **the data model** and **the configuration**.

### 2.1 Process-wide singletons (the key to option B)

| Singleton | File | Used by |
|---|---|---|
| `env()` — `CONFIG_DIR`, `DATA_DIR`, `DATABASE_PATH` | `src/lib/server/env.ts` | ~147 non-test call sites read these paths |
| `getConfig()` / `getLoadedConfig()` / `reloadConfig()` + reload listeners, SIGHUP handler | `src/lib/server/config/index.ts` | ~225 call sites (routes, remote functions, hooks); only one service reads it directly |
| `getDb()` — one `bun:sqlite` handle, migrated once | `src/lib/server/db/index.ts`, `client.ts` | 28 of 31 remote files, 17 route files, hooks |
| Read-only report connection | `src/lib/server/reports/connection.ts` | reports engine (§3.11) |
| Backup cron (`scheduled`, one job) | `src/lib/server/services/backup.ts`, `src/hooks.server.ts` (`scheduleBackups`) | daily `VACUUM INTO` + uploads mirror |
| Verified-password cache, login rate limiter | `src/lib/server/auth/config-users.ts`, `auth/login-limiter.ts` | login |
| i18n packs registry (`packsDir`), server i18n cache | `src/lib/server/i18n/registry.ts`, `src/lib/i18n/server.ts` | locale, language packs from `CONFIG_DIR/i18n/` |
| Session cookie `bv_session`, `Path=/` | `src/lib/server/auth/session.ts` | every request |

Good news: the services follow `(db, input, actor)` and receive configuration as arguments (only one service calls
`getConfig()` itself), so business logic is already tenant-agnostic; the singletons are read at the edges (hooks,
remote functions, routes, `+server.ts`, CLI scripts in `scripts/`).

### 2.2 Configuration (`CONFIG_DIR`, PLAN.md §3.6, `src/lib/server/config/schema.ts`)

- `library.*`: `name`, `contactEmail`, `schoolType`, `maxClassYear`, `sections`, `schoolYearStart`, `timezone`,
  `itemTypes` — all one value per installation.
- `barcodes.patron.counterStart`, `barcodes.item.*`; `circulation.*` (rules per patron type, item-type overrides,
  overdue notices, hard due date); `calendar` + `calendar.<year>.json`; `classification.json` (genres, non-fiction tree,
  `fictionByClass`, `classPerItem`, call-number patterns) and `classification/images/`.
- Print: `cards/templates/`, `labels/templates/`, `labels/stocks/`, `slips/templates/`; templates use
  `{{library.name}}` (`config/cards/templates/default/front.html`, slips `checkout-receipt`, `overdue-patron`).
- Branding: `CONFIG_DIR/branding/logo.png` (`services/branding.ts`); web manifest name
  `${library.name} · BiblioViva` (`services/web-manifest.ts`); ~30 files read `library.name` or `library.timezone`.
- `security.users` / `security.roles` (mirrored into `staff_user` by `auth/config-users.ts`), `ui.locale`, `ui.theme`,
  `ui.dashboard`, `performance`, `backup`, `privacy`, `z3950`, `metadata`, `covers`, `photos`.
- Phase 11 editors (`services/config-*.ts`, `taxonomy.ts`, `library-codes.ts`, `staff-config.ts`, `label-stocks.ts`,
  `template-editor.ts`), the coverage-map test and the configuration archive (`services/config-archive.ts`) all assume
  one folder.

### 2.3 Data model (`src/lib/server/db/schema.ts`, PLAN.md §4)

| Table | Single-library assumption | Needs `library_id` in option C |
|---|---|---|
| `biblio` + `biblio_fts` (`db/fts.ts`) | one catalogue; `isbn` UNIQUE | no if records are shared (Koha model); FTS filtered through items |
| `item` | `barcode` UNIQUE; `reading_class`, `call_number` from one classification; no location (Q73) | **yes**: home library (+ current library if transfers) |
| `patron` | `card_number`, `external_id` UNIQUE; `class_year`/`section` from one `library.*` | **yes** (or a join table if shared) |
| `loan`, `loan_event` | snapshots of class/section; one calendar for due dates | **yes** (issuing library; return library if returns elsewhere) |
| `sequence` | `patron_card`, `item_<YYYY>` counters | names per library, or one shared counter |
| `print_list`, `print_list_entry` | lists shared by permission (owner rule) | **yes** |
| `inventory`, `inventory_scan` | one open campaign (`services/inventory.ts`) | **yes** |
| `import_batch`, `audit_log` | one history | **yes** |
| `staff_user`, `session` | global accounts, roles only | scope table `staff_user_library`; `session.active_library_id` |
| `metadata_cache` | shared by nature | no |

### 2.4 Features that embed the assumption

- **Barcodes** (`server/barcodes/items.ts`, `cards.ts`, `shared/barcodes.ts`): `YYYY-NNNNC` and 10-digit cards from
  per-installation sequences. Two independent installations **will generate the same barcodes and card numbers**; only
  cards can already be kept apart today (`barcodes.patron.counterStart` with disjoint ranges); item counters cannot.
- **Reports**: 26 built-in SQL definitions in `config/reports/*.json` query whole tables; none has a library parameter.
- **Dashboard** (`services/dashboard.ts`), overdues and slips (`overdues.ts`, `slips.ts`), statistics: global counts.
- **Class upgrade** (`services/rollover.ts`): moves every student; per-plesso runs would need a scope.
- **Imports** (`server/imports/patrons.ts`, `catalog.ts`, `loans.ts`): the register export of an IC contains all
  plessi; there is no plesso filter.
- **Backups and restore** (`services/backup.ts`, `full-restore.ts`, `data-parts.ts`, `export-archive.ts`): one
  database, one uploads tree, one configuration archive; parts are cut by table, not by library.
- **Media** (`services/media.ts`, `covers.ts`, `routes/(app)/media/*`): `DATA_DIR/uploads/{patrons,covers}/<id>`.
- **Deployment** (`docker/compose.yml`, `docker/tailscale/serve.json`): one sidecar, `TS_HOSTNAME=biblioviva`, one
  `https://biblioviva.<tailnet>.ts.net`, the app on `127.0.0.1:3000`; `setup.sh` and the setup guides assume one.
- **UI**: the app shell shows one logo and name; the first-run wizard (`services/setup.ts`) creates one library;
  `docs/navigation.md` has no library level.

## 3. Architecture options

### Option A — One installation per library (status quo)

Each library is its own compose stack: its own sidecar and hostname (`biblioviva-rodari`, `biblioviva-collodi`), its
own `/config` and `/data`, its own accounts. Possibly a tiny **launcher**: a static page, or a configurable list of
"other libraries" links in each instance (`library.siblings`, UI-editable), so the admin jumps between them.

- **Data model / config:** no change. Every setting stays per library, already editable and exportable.
- **Permissions:** unchanged; the admin has an account in each instance (same password is their choice).
- **UI:** none, or the siblings menu in the user menu (S).
- **Printing, backups, restore, archive:** unchanged, per library; the off-site rclone target gets a per-instance path.
- **Deployment:** `setup.sh` and the guides learn "add another library" (a second folder, a second auth key, a second
  hostname). Separate hostnames are required: cookies ignore ports, so two instances on one hostname with different
  ports would overwrite each other's `bv_session` [VERIFY if ever tried].
- **Migration:** none. Barcode clashes between plessi are harmless while they never share data.
- **Testing:** a compose smoke test with two instances; nothing else.
- **Pi 4 (2 GB):** each instance is one Bun process (RSS roughly 100–150 MB [VERIFY on the device, 9.4]) with its own
  16 MB SQLite cache; `MEM_LIMIT` 512m is a ceiling, not a use. Three instances fit; five are tight on 2 GB. A PC is
  fine for any IC.
- **Limits:** N logins, N tailnet devices, N updates (one `compose pull` each), no cross-library search, statistics
  merged by hand, a book or patron moving between plessi is an export + import.
- **Effort:** **S — 2–4 days** (docs, `setup.sh` multi-instance, per-instance names, optional siblings links).
- **Risk:** very low. **Leanness:** untouched.

### Option B — Several tenants in one process (one database + config folder per library)

One container, one Tailscale hostname, one login; a small **installation layer** lists the libraries, each with its own
`CONFIG_DIR` and `DATA_DIR` (e.g. `/config/libraries/<code>/`, `/data/libraries/<code>/`). The request resolves the
active library, and `getDb()`, `getConfig()`, paths, the report connection and the backup job become **per-tenant**
lookups. All features work unchanged inside a tenant.

- **Tenant resolution:** (1) **active library in the session**, chosen after login with a switcher (recommended: no URL
  change, fits remote functions that must not read `event.url`); (2) URL prefix `/l/<code>/…` through the `reroute`
  hook — every link and `resolve()` would need the prefix, invasive; (3) hostname per library — one sidecar per
  hostname proxying to the app, or Tailscale Services [VERIFY], operationally heavier.
- **Code:** a `TenantContext { code, env paths, config, db, reportDb }` resolved in `hooks.server.ts` into
  `event.locals.library`; `getDb()`/`getConfig()` read it through `getRequestEvent()` (SvelteKit already uses
  AsyncLocalStorage) and throw outside a request; CLI scripts take `--library <code>`; SIGHUP and the backup cron loop
  over tenants; i18n stays per installation.
- **Data model:** no `library_id`; one identical schema per file, migrated at startup for every tenant.
- **Configuration:** new `installation.json` (the libraries: code, name, folders, order; installation-wide `ui.locale`,
  `ui.theme`, `performance`, cross-library accounts). Owner rule: it needs its own editor (**Amministrazione →
  Biblioteche**: add, rename, archive a library, create from a copy of another's configuration) and its own part in the
  archive; per-library configuration and its Phase 11 editors stay as they are.
- **Permissions:** accounts per library (today's `security.users`), plus installation accounts with a list of libraries
  they may enter (the admin: all). `can()` unchanged; `requireUser()` also checks that the user may use the active
  library.
- **UI:** a library switcher in the app bar next to the library logo (desktop) and in the user sheet (mobile), shown
  only with two or more libraries; a "choose the library" step after login; the dashboard of each library unchanged.
- **Printing:** unchanged per tenant (its own templates, stocks, logo).
- **Backups:** per tenant as today, one schedule each; "Esporta tutto" per library plus an installation archive (all
  tenants + `installation.json`).
- **Cheap extras on top:** a read-only **union search** ("which plesso has this title?") by opening the other tenants'
  files read-only (`ATTACH` or a second read-only handle) — M; moving a copy or a patron between tenants as a guided
  export/import — M each.
- **Migration:** an existing installation becomes tenant `default` without moving files (its current folders are
  referenced by `installation.json`); merging two Option A installations = moving folders.
- **Testing:** a tenant-isolation suite (no request of tenant X ever touches Y's database, files, cache or backup);
  Playwright with two tenants in the shared test setup (switcher, login scope, deep links); every CLI with `--library`;
  the coverage map extended to `installation.json`. Most existing tests run unchanged against one tenant.
- **Pi 4:** one process for all; each open database costs its page cache (16 MB on `small`, could be lowered per tenant),
  N × WAL files, N cron jobs. Better than A in memory; five small plessi fit comfortably [VERIFY].
- **Effort:** **L — 15–25 days** (context refactor across ~90 files 5–8, installation layer + editor + archive 4–6,
  switcher and login scope 2–3, backups/CLI/deploy 2–3, tests and docs 3–5).
- **Risk:** medium: a missed singleton leaks data between plessi (privacy of minors), mitigated by throwing outside a
  tenant context and by the isolation suite. **Leanness:** the single-library installation still looks exactly as today
  (switcher hidden), but every future feature must think "per tenant".

### Option C — True multi-library in one database (Koha "branches")

One database, shared bibliographic records, `library_id` on copies, patrons, loans and the operational tables; staff
scoped to libraries; optional shared patrons, transfers and returns elsewhere; per-library configuration overlays.

- **Data model:** new `library` table; `item.home_library_id` (+ `current_library_id` with transfers), `patron` home
  library (or `patron_library` for shared patrons), `loan.library_id` (+ return library), `print_list`, `inventory`,
  `import_batch`, `audit_log` with `library_id`; sequences per library or global; unique indexes rethought
  (`card_number`, `external_id`); a `transfer` table if books move.
- **Configuration:** base configuration + `libraries/<code>/` overlays deep-merged per library for `library.*`,
  `classification`, `circulation`, `calendar`, templates, stocks, logo. Every Phase 11 editor gains a scope ("all
  libraries" / "this library"), the coverage map doubles, the archive gains per-library parts. The classification is
  the hard part: one shared `biblio` with a primary `fictionByClass` taxonomy and a middle-school one means either a
  shared taxonomy or classification moved to the copy.
- **Permissions:** `can(user, permission, libraryId)`; every query filtered by the active library; the reports get a
  `:library` parameter (26 SQL files) and cross-library variants.
- **UI:** switcher plus library columns/filters in catalogue, copies, loans, reports; transfer screens; circulation
  messages (Appendix I) for "copy belongs to another plesso".
- **Printing:** templates resolved per library; labels could carry the plesso.
- **Backups/restore:** one database, but restore of "one library's data" becomes row-level surgery (`data-parts.ts`).
- **Migration:** existing installation = library #1 (a data migration, not just a schema change — after 1.0 this breaks
  the single-migration rule Q82); merging separate installations needs id remapping, barcode/card collision handling and
  patron deduplication.
- **Testing:** every service test gains library fixtures; a scoping test per remote function; every e2e flow checked
  with two libraries. The largest test impact of the three.
- **Pi 4:** one database with the sum of the collections (five plessi × 10 000 = 50 000 copies) exceeds the sizing of
  §1 (≤ 10 000 books); FTS and the hot queries must be re-measured, the `small` cache re-tuned.
- **Effort:** **XL — 40–70 days**, plus a longer field test.
- **Risk:** high (every query, every editor, privacy scoping). **Leanness:** contradicts Q41 and the "skip multi-branch"
  line of §6; brings Koha's complexity back.

### Hybrids worth considering

- **A + launcher** (S): the cheapest answer to "one admin, several plessi".
- **B + union search** (L + M): isolation by construction, plus the one cross-library question staff actually ask.
- **B + shared staff accounts only** (inside the L): one password for the admin, per-plesso accounts for volunteers.
- **"C-lite"** (`library_id` on items and patrons, one shared configuration, no transfers): tempting but pays most of
  C's cost (queries, reports, scoping) without solving the different-classification problem; not recommended.

### Summary

| | A — one per library | B — tenants in one process | C — one database |
|---|---|---|---|
| Effort | S (2–4 d) | L (15–25 d) | XL (40–70 d) |
| Scenarios covered | S1, S4 | S1, S2, S4 (S3 partly with extras) | S1–S4 |
| Isolation of patrons | total (separate systems) | total (separate files) | by query filters |
| One URL / one login | no | yes | yes |
| Cross-library search/stats | manual | union search (M) | native |
| Books/patrons moving | export + import | guided move (M) | native |
| Config editors | unchanged | unchanged + installation editor | all gain a scope |
| Pi 4 2 GB | 3 instances | 5+ tenants | sizing to re-verify |
| Risk | very low | medium | high |

## 4. Recommendation

1. **Now and through the 0.9.x field test: Option A**, documented as the supported way to run several libraries.
   It costs almost nothing, keeps the lean single-library product intact, keeps minors' data of each plesso physically
   separate, and every setting stays editable and exportable per library as the owner requires.
2. **After 1.0, only if QML1–QML5 describe S2 (one admin, shared staff, separate shelves and patrons): Option B**, with
   the union search as the first extra. It reuses every feature unchanged, keeps backups and archives per library,
   migrates an existing installation without touching its data, and hides itself completely when there is only one
   library.
3. **Option C only if the school truly works as S3** (shared patrons, books moving often, one catalogue). It is a
   different product (Koha branches), would reopen Q41, and should be weighed against simply running Koha for that
   school.

Reasoning: the concrete need is not yet established (QML1); the difference between A and B is convenience (one login,
one URL, one update), not capability; the difference between B and C is a rewrite of the data model and of every
configuration editor. B's refactor is contained because the services are already `(db, input, actor)`.

### Phased outline for option B (if chosen after 1.0)

1. **B.1 Tenant context** — `TenantContext` in `event.locals`, `getDb()`/`getConfig()`/paths/report connection
   resolved per request, throwing outside a context; CLI `--library`; one tenant = today's behaviour.
2. **B.2 Installation layer** — `installation.json` (libraries, installation-wide settings, cross-library accounts),
   Valibot schema, loader, `config:check`, migration of an existing installation as tenant `default`.
3. **B.3 Administration → Biblioteche** — create (empty or from a copy of another library's configuration), rename,
   archive; installation part in the configuration archive; coverage map extended.
4. **B.4 Login scope and switcher** — library choice after login, switcher in the app bar and mobile user sheet, access
   check in `requireUser()`, audit of switches.
5. **B.5 Per-tenant operations** — backup schedules, off-site paths, restore and "Esporta tutto" per library and for the
   whole installation; SIGHUP and reload per tenant.
6. **B.6 Isolation and e2e suite** — tenant-isolation unit tests, two-tenant Playwright project, docs (deploy, admin
   guide, setup guides, `docs/navigation.md`).
7. **B.7 Union search (optional)** — read-only "available in other libraries" on the catalogue and the desk.

## 5. Keeping the door open cheaply (without implementing anything)

Low-cost habits and small changes that make B possible later and do not add complexity now:

- **No new process-wide singletons.** New caches and handles go behind the existing accessors (`getDb()`,
  `getConfig()`, `env()`) or into objects passed down, never into new module-level `let` in routes or remote files.
- **Paths through one helper.** Read `CONFIG_DIR`/`DATA_DIR` through a small `paths()` accessor instead of
  `env().DATA_DIR` at each call site (today ~147 sites); a mechanical refactor that can be done at any time.
- **Services stay pure** `(db, input, actor)` with configuration passed in (already the rule; keep it).
- **Remote functions never cache** config or database handles in module scope; they call the accessors per request.
- **Disjoint numbering between instances.** Cards: document `barcodes.patron.counterStart` ranges per plesso (already
  possible). Items: consider an optional per-installation counter start for `item_<YYYY>` so two plessi never print the
  same `YYYY-NNNNC` — a small, UI-editable setting, to be decided with QML8.
- **Register import filter:** a plesso/class filter in the student import (2.6) helps option A immediately, since the
  register exports the whole IC.
- **Names:** keep "library" as the term for the installation's library in code (`library.*`), so a future
  `installation.*` layer reads naturally; do not hardcode the `biblioviva` hostname outside `docker/` and the guides.
- **Session cookie name** from one constant (already `SESSION_COOKIE`), so a per-instance or per-tenant name is a
  one-line change.
