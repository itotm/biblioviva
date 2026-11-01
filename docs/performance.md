# Performance

How BiblioViva meets the budgets of PLAN.md §3.14, measured in step 9.2 on a
PC with an SSD (x86) with the synthetic demo data; the Raspberry Pi 4 numbers
come with the device checklist (9.4).

## Page weight

The budget is **250 KB of JavaScript, gzipped, on the core pages**; `tests/e2e/perf-budget.spec.ts`
measures every script a page loads and fails above it (and if the barcode reader or OpenCV appear:
they load only when a camera flow starts).

| Page | Scripts | JavaScript (gzip) |
|---|---|---|
| Dashboard | 51 | 144 KB |
| Circulation: checkout | 54 | 149 KB |
| Circulation: check-in | 45 | 132 KB |
| Patrons | 47 | 179 KB |
| Catalogue | 56 | 192 KB |

What changed in 9.2 to make the pages lighter:

- **Compression of dynamic responses** (`src/hooks.server.ts`): pages, page data, remote-function
  answers, SVG barcodes and CSV exports are gzipped when the browser accepts it (the static assets
  were already precompressed by the adapter). The dashboard went from 269 KB to 24 KB on the wire.
- **One dictionary per page instead of two**: a complete built-in language no longer carries the
  English fallback (only language packs need it), and the administration dictionaries (`admin`,
  `config`, the largest) load only on the pages that use them (`NAMESPACE_ROUTES` in
  `src/lib/i18n/index.ts`, guarded by `namespace-routes.test.ts`).
- **The root layout data is not fetched again at every navigation** (it no longer reads the
  pathname), so moving between pages does not download the dictionaries again.

The application style sheet is **not** inlined, and never was: `inlineStyleThreshold` (32 768)
is compared with the raw length of each CSS file, so it only inlines small route sheets (today
the 55 bytes of `Table.svelte`), while the app's sheet is 287 KB raw (21 KB brotli, 29 KB gzip).
Every number on this page was measured with the sheet as a linked file, and it stays one on
purpose: it is cached for a year (`immutable`) and, over HTTPS, precached by the service worker,
whereas inlined it would add about 30 KB (gzip) to every page response.

## Lighthouse (mobile, slow 4G and 4× CPU)

Measured with `bunx lighthouse@12` against the production build. Production is served by the
Tailscale sidecar over **HTTP/2 with TLS**, so the reference numbers go through a local HTTP/2 TLS
proxy in front of `bun ./build`; the first measurement of 9.2 went to `bun ./build` directly over
HTTP/1.1, where the fifty module requests of a page queue on six connections.

| Page | Simulated throttling (Lighthouse default) | DevTools throttling | HTTP/1.1, simulated (first 9.2 pass) | Before 9.2 |
|---|---|---|---|---|
| Dashboard | 100 | 93 | 89 | 52 |
| Checkout | 98 | 95 | 89 | 57 |
| Patrons | 98 | 93 | — | — |
| Catalogue (opened without a filter, Q83) | 96 | 93 | 64 | 42 |

Accessibility is 100 on dashboard, checkout and the catalogue start page and 95 on the pages that open with a data grid, where the
grid library numbers its rows from 0 (`aria-rowindex`, a known SVAR issue the axe helper of the
e2e tests also skips); best practices 100 everywhere.

What changed after the first pass:

- **The i18n merge made linear** (ADR-019): every i18n instance — one per request on the server,
  one per page load in the browser — copied its whole table at every key; the linear merge of
  `@sveltekit-i18n/base` removes about 200 ms of main-thread work per page load at 4× CPU.
- **Date formatters built once**: the catalogue built an `Intl.DateTimeFormat` for every row, and
  `formatDateTime` one per call; both now reuse one formatter.
- The mobile brand link's accessible name now contains the library name it shows.

The catalogue was the last page below the target: its hydration handed every matching title (up
to 2 000) to the grid in one task. Following the owner's decision (Q83) the page loads nothing
until a filter is chosen or the search has at least 3 characters (a code at any length), so it
opens at 96 / 93; a search that matches many titles still costs one longer task, bounded by the
2 000-row limit. Grouping the shared modules into fewer chunks with the bundler's code-splitting
groups broke the SvelteKit build (Vite 8.3 / Rolldown 1.2) and is not needed over HTTP/2.

## Database

`src/lib/server/db/hot-queries.test.ts` plans the hottest queries of the desk, the catalogue and
the dashboard with `EXPLAIN QUERY PLAN` and fails when one reads a whole table of copies, records,
loans or audit rows. 9.2 added the index `loan_item` (the loan history of a copy) and the partial
indexes `item_spine_pending` and `item_barcode_label_pending` (the labels still to print); the one
accepted scans are the patron name search inside names (`% word%`) and the approximate pass of a
patron search with mistakes (9.24, ADR-036: the names of the active patrons scored in memory), both
on a table bounded by the size of a school. The approximate pass of the catalogue reads the words
of the FTS index once per change of the catalogue and finds its candidates through FTS5; the
budgets of 5.1 and 5.2 are measured on it too.

## Cold start

| Where | Time to a healthy `/healthz` |
|---|---|
| `bun ./build`, x86 SSD, demo data | 0.3 s |
| Container (`podman run` of the image to a healthy `/healthz`), x86 SSD, first start with an empty data volume (database created, migrations, defaults copied) | 0.7 s |
| Container, later starts | 0.35 s |

The budget is 2 s on a PC with an SSD and 5 s on the Raspberry Pi 4; the Raspberry Pi figure is
recorded with the device checklist (9.4).

## Memory and load on the smallest hosts (steps 9.28–9.29)

The built server started by the launcher (`scripts/start.ts`) on **one core** (`taskset -c 0`, an
x86 core: a Raspberry Pi Zero 2 is several times slower per core), with the **largest library the
system is planned for**: 10 000 copies on 8 000 titles, 1 000 students, 100 teachers, 394 loans in
progress, 525 patron photos. For 60 s, **8 reading users** (a weighted mix: catalogue searches,
book and patron records, the dashboard, the open loans, a report, patron photos, the cards of a
class, 60 pairs of labels, the open loans and catalogue CSV) with a pause of 0.2–0.8 s between
requests, and **2 desk users** in a browser (card, copy, return): about 18 requests a second. The
engine is told the memory of a container of the profile's limit (`BUN_JSC_forceRAMSize`, three
quarters of it, as the launcher does from the container's cgroup).

| Profile, container | Requests | Errors | CPU (one core) | RSS median / peak | Anonymous median / peak |
|---|---|---|---|---|---|
| `micro`, 256m | 1 107 | 0 | 33 % | 165 / 234 MB | 120 / 188 MB |
| `micro`, 256m, 2 readers + 1 desk | 330 | 0 | 11 % | 152 / 218 MB | 107 / 173 MB |
| `small`, 512m | 1 131 | 0 | 26 % | 209 / 369 MB | 164 / 324 MB |

Times under the heavy load, `micro` (`small` alike): catalogue search 19 ms median, 56 ms p95; a
record 12 / 54 ms; a checkout (card and copy in the browser) 68 / 123 ms; the cards of a class
98 / 202 ms; the catalogue CSV of 10 000 rows 61 / 116 ms.

What moved the memory: without `BUN_JSC_forceRAMSize` the engine sized its heap after the host's
RAM (58 GB on the test host), and the same load peaked at 315–400 MB of anonymous memory; `--smol` made no
measurable difference in any run. The sheets of cards carried the back's picture and the logo once
per card (6.4 MB for a class, +67 MB while built): each picture of the styles is now written once
per document (`shareDataUrls`), and the class's cards take a third of the time. A password check
costs the memory of its hash (64 MB before 9.29, 16 MB now). The load test also found two downloads
of an export at once breaking each other (a shared SQLite statement), fixed in 9.29.

## Heavy jobs one at a time and the idle timeout (step 9.32)

The print sheets (cards, labels, overdue notices, receipts, the print view of a report, the test
and calibration sheets) and the exports (the CSV and ODS of the lists, the administrator's exports,
"Export everything", "Export configuration", the manual and nightly backups) run through a limiter of
their own, `heavyWork` (`#lib/server/runtime/limit.ts`): at most `performance.heavyConcurrency` at
once (micro 1, small 1, medium 2, large 4), the others waiting in the order they came. The server
hook takes the slot for every request of `HEAVY_REQUEST` (`#lib/server/runtime/heavy.ts`, the same
paths the public demo caps), so no route has to remember it, and holds it until the answer has been
sent: a streamed archive or a large sheet keeps its memory until its last byte, and the slot comes
back when the body ends, fails or is cancelled (the browser went away), or at once for a redirect,
an error or a HEAD request. The backups take their slot in the services (`backupNow`,
`archiveBackupNow`), since a remote function or the schedule starts them. Nothing that holds a heavy
slot asks for another, so one slot never waits for itself; a job may still take an image slot (the
faces of removed pupils painted before an archive), a limiter of its own. The desk's checkouts and
returns, the searches and the pages never queue behind the heavy jobs; they only share the
processor with the one running.

A connection that sends nothing is closed after `CONNECTION_IDLE_TIMEOUT` seconds (120 by default,
255 at most; Bun's own default is 10 s): set in the image, by the launcher when missing, and used by
the basic local-network front too, so a sheet that renders slowly or waits its turn is not cut
before its first byte.

### Measured on a Raspberry Pi 4 with half a core

A Raspberry Pi 4 with 2 GB (aarch64), the container
limited to half a core and 256 MB without swap (`--cpus 0.5 --memory 256m`), profile `micro`, the
basic local-network mode, **twice the largest library planned**: 20 000 copies on 16 000 titles,
2 000 students, 200 teachers, 1 191 loans in progress, 1 050 patron photos. The load of 9.29 from
another computer on the network (the reading users' weighted mix, the desk users in a browser:
card, copy, return), three runs before the limiter and the idle timeout and the same three after.
The server answers its health check 6 s after the container starts.

| Load | Before: requests, errors | After: requests, errors | Memory after (anonymous, average / peak) |
|---|---|---|---|
| 2 reading users and 1 desk user, 3 min | 306, 4 desk operations over 15 s | 341, none | 125 / 196 MB |
| 8 reading users and 2 desk users, 1 min | 110, 7 sheets cut at 10 s, 4 desk operations over 15 s | 166, 2 desk operations over 15 s | 115 / 181 MB |
| 8 reading users and 2 desk users, 3 min | stopped by the 256 MB limit after 2.5 min | 359, 4 desk operations over 15 s | 127 / 199 MB |

Times with 3 users at once after 9.32 (median / 95th percentile): catalogue search 0.5 / 1.9 s, a
record 0.3 / 1.2 s, the dashboard 0.6 / 1.7 s, a checkout (card and copy) 1.9 / 4.9 s (17 s before),
a return 0.9 / 2.9 s, the cards of a class 7.9 / 10.1 s, 60 pairs of labels 1.2 / 7.9 s. With 10
users at once the half core is always busy: pages take 2–4 s, and the sheets and exports wait their
turn (the cards of a class 39 s median, 49 s at most, inside the idle timeout). "Export everything"
of this library (35 MB) takes 5.4 s, and the check of its restore (`backup-restore`, in the same
container) 20 s.

### The same test with the one-field desk (9.13 round 33) and the switches of 9.38

The same Pi, data and load, with the image that has the checkout desk in one field and photos and
covers that can be switched off (both on here). The desk users type the card, then the copy, in the
same field; a student left at the loan limit by an earlier failed return gets the limit dialog and is
counted apart (3–5 per run), never as a slow loan. At its first start the container made the backup
the schedule had missed (9.33), during the first run.

| Load | Requests, errors | Memory (anonymous peak / container peak) |
|---|---|---|
| 2 reading users and 1 desk user, 3 min | 348, 1 return over 15 s | 192 / 214 MB |
| 8 reading users and 2 desk users, 1 min | 97, 2 returns over 15 s | 186 / 204 MB |
| 8 reading users and 2 desk users, 3 min | 319, 1 checkout and 2 returns over 15 s | 192 / 224 MB |

With 3 users at once (median / 95th percentile): catalogue search 0.7 / 1.4 s, a record 0.6 / 1.6 s,
the dashboard 0.9 / 2.0 s, a checkout 1.4 / 3.6 s, a return 1.3 / 2.6 s, the cards of a class
7.0 / 8.0 s, 60 pairs of labels 2.1 / 4.0 s. With 10 users at once a checkout takes 5.6 / 9.9 s and
the sheets wait their turn: the cards of a class 38 s median, 58 s the slowest, 60 pairs of labels
28 s median and 60 s the slowest, no connection closed — the reason the idle timeout is 120 s. No container
was stopped by the memory limit.
