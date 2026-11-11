# Architecture decision records

Short records of decisions taken while executing [PLAN.md](../PLAN.md). The plan's §11 holds the owner's decisions;
this file holds the agent's, in the format context / decision / consequences.

## ADR-000 — Plan accepted (2026-09-19)

**Context.** PLAN.md v0.10 with all 77 questions resolved by the owner.

**Decision.** Implement the plan phase by phase, one commit per step, following CLAUDE.md.

**Consequences.** Any deviation from the plan is recorded here before it lands in code.

## ADR-001 — `yaz-client` through a container wrapper on the development host (2026-09-19)

**Context.** A development host may run an immutable system such as Fedora Kinoite. Installing the `yaz` package needs
`rpm-ostree` and a reboot, or a toolbox. The plan (§3.9) drives `yaz-client` as an external process, so only the
executable's location matters.

**Decision.** The Z39.50 driver resolves the executable from the `YAZ_CLIENT` environment variable (default
`yaz-client`). In development it points to `scripts/yaz-client.sh`, which runs the CLI inside a small Debian container
(`docker/yaz.Dockerfile`, image `biblioviva-yaz`) with the working directory mounted. The production image installs the
Debian package as planned.

**Consequences.** Live Z39.50 tests on such a host need podman and the `biblioviva-yaz` image
(`bun run yaz:image`). Unit tests use recorded `.mrc` fixtures and never spawn the process.

## ADR-002 — Skeleton v5 on the SvelteKit 3 RC, light-only variant, contrast overrides (2026-09-19)

**Context.** Skeleton 5.0.1 documents SvelteKit 2 as its minimum; the plan required a check in step 0.3. Skeleton's
base CSS switches light/dark through Tailwind's `dark` variant and `light-dark()`; the preset themes use tinted
"contrast" colours on filled 500 surfaces that fail WCAG AA (3.6:1 on primary, 2.7:1 on error).

**Decision.** Skeleton 5.0.1 works unchanged with `@sveltejs/kit` 3.0.0-next.27 (Dialog, Toast, Combobox, Tabs,
Pagination verified with keyboard and axe in `tests/e2e/dev-ui.spec.ts`). The `dark` variant is redefined in
`src/app.css` as `[data-mode='dark']`, which the app never sets, so no dark style can ever apply. The 500-level
contrast tokens are overridden to white or `surface-950`; step 0.9 replaces this with the project theme.

**Consequences.** No fallback to shadcn-svelte needed. Any new theme must keep 4.5:1 on every filled preset
(unit test in 0.9).

## ADR-003 — `#lib` imports carry a file extension (2026-09-19)

**Context.** SvelteKit 3 replaces `$lib` with Node subpath imports; specifiers must name the file (`#lib/x.js` for
`src/lib/x.ts`, `#lib/Y.svelte` for components).

**Decision.** Always import with the extension: `.js` for TypeScript modules, `.svelte` for components. Documented in
CLAUDE.md.

**Consequences.** ESLint/TypeScript flag extension-less `#lib` imports as unresolved, which is the desired signal.

## ADR-004 — SVAR DataGrid offline: vendored icon font, theme mapping, known aria bug (2026-09-19)

**Context.** The SVAR `Willow` theme loads the Open Sans font and its `wx-icons` icon font from `cdn.svar.dev`
at runtime; the plan requires the app to work without internet access and with the system font stack. SVAR 2.7.3
also renders the first data row with `aria-rowindex="0"`, which axe reports as a critical ARIA violation.

**Decision.** `DataGrid.svelte` renders `<Willow fonts={false}>`; the icon stylesheet and `wx-icons.woff2`
(MIT, part of SVAR) are vendored in `src/lib/assets/wx-icons/` and imported from `app.css`, where the `--wx-*`
variables are mapped to the Skeleton tokens. Grid labels come from `@svar-ui/core-locales` (`it`, `en`) plus our
Italian translation of the grid words. The `aria-rowindex="0"` violation is filtered in the shared axe helper
(`tests/e2e/helpers/axe.ts`) as a known upstream issue, to be re-checked at every SVAR upgrade.

**Consequences.** No network request from the grid. Pages import only `#lib/components/DataGrid.svelte`.

## ADR-005 — Unit tests run Vitest under the Bun runtime (2026-09-19)

**Context.** The `vitest` CLI runs on Node by default, where `bun:sqlite` does not exist; services are tested against
an in-memory `bun:sqlite` database (PLAN.md §7).

**Decision.** `bun run test` executes `bun --bun vitest run --coverage`: the `server` project (services, shared
modules, i18n, scripts) runs inside Bun with the real SQLite; the `client` project (browser mode, Chromium through
`@vitest/browser-playwright`) works the same way. Verified: FTS5 available, v8 coverage reported, thresholds enforced
(95 % lines on `src/lib/server/**` and `src/lib/shared/**`). Playwright keeps running under Node (Q37).

**Consequences.** If a future Vitest release breaks under Bun, the fallback is `bun test` for the server project.

## ADR-006 — i18n wiring: per-request instance, every namespace on every route, test-only override (2026-09-19)

**Context.** One locale per installation (Q52) but tests need both languages; sveltekit-i18n documents a
per-request server instance whose `snapshot()` is narrowed to the current route.

**Decision.** `+layout.server.ts` builds a fresh instance per request (cheap: loaders are cached dynamic imports),
loads every namespace (no `routes` filters, so the snapshot is complete and there is no cross-request race), and the
client hydrates from the snapshot (`+layout.ts`, one instance per browser session) and provides it through Svelte
context (`useI18n()`). `?lang=it|en` overrides the configured locale only when `dev` or `ALLOW_LANG_OVERRIDE=1`
(set by the Playwright web server). Until step 1.1 the configured locale is read from `UI_LOCALE`.

**Consequences.** Components never import a module-level instance. Adding a namespace means adding it to
`NAMESPACES` and both JSON files (the parity test fails otherwise).

## ADR-007 — Request origin comes from proxy headers, never from a build-time ORIGIN (2026-09-19)

**Context.** `@sveltejs/adapter-bun` 1.0.0-next.2 computes the request origin from `PROTOCOL_HEADER` /
`HOST_HEADER` / `PORT_HEADER` (or `paths.origin` baked at build time) and assumes `https` when nothing is set. It
does not read a runtime `ORIGIN` variable. SvelteKit rejects remote-function POSTs and form posts whose `Origin`
header differs from that origin ("Cross-site remote requests are forbidden").

**Decision.** The image never bakes an origin (one image for every school). In production the Tailscale sidecar
terminates TLS and forwards `X-Forwarded-Proto` / `X-Forwarded-Host`, so the container runs with
`PROTOCOL_HEADER=x-forwarded-proto` and `HOST_HEADER=x-forwarded-host`. The Playwright test server runs with
`PROTOCOL_HEADER=x-forwarded-proto` and the browser sends `x-forwarded-proto: http` on every request. The `ORIGIN`
environment variable is dropped from `src/env.ts`; `csrf.trustedOrigins` stays empty (same-origin only).

**Consequences.** Step 8.4 verifies the headers end to end behind Tailscale; `docs/deploy.md` documents them.

## ADR-008 — Four accessible light themes for `ui.theme` (2026-09-19) — superseded by ADR-010

**Context.** PLAN.md step 1.11 lets the first-run wizard choose "a handful of Skeleton light presets".
Skeleton ships 24 presets; measured against the filled 500 tones, the light surfaces and the
primary-700 accent (the checks of `src/lib/ui/theme-contrast.test.ts`), only four reach WCAG AA
once the contrast colour of each tone is set to white or dark: `cerberus`, `crimson`, `rosepine`
and `wintry`. The others fail on at least one tone or on the accent-on-background ratio.

**Decision.** `ui.theme` is a picklist of those four (`#lib/shared/themes.ts`); `src/lib/theme.css`
holds one override block per theme and the contrast test runs for every theme. The wizard shows
them as swatches and previews the choice live; `hooks.server.ts` writes `data-theme` on `<html>`.

**Consequences.** Adding a theme means adding an override block that passes the test. Colour is
never the only cue (§3.18), so the choice is cosmetic and safe for black-and-white printing.

## ADR-009 — Configuration as a folder of files (2026-09-19, owner decision Q78)

**Context.** `config.json` was growing into one 900-line document; the owner asked for card and
label templates (and similar bulky sections) as distinct files that can be copied to create new ones.

**Decision.** `CONFIG_DIR` is a folder: `config.json` keeps the core sections; any top-level section
may live in `<section>.json` (deep-merged over `config.json`, fragment wins); label stocks are one file
each under `labels/stocks/`; templates are one folder each under `{cards,labels,slips}/templates/`
and are discovered, never merged into JSON; `calendar.<year>.json` and `reports/*.json` keep their
existing rules. Validation reports the originating file. Implemented in step 2.4a; the wizard writes
only `config.json`; Phase 11 writes each section back to its own file.

**Consequences.** Copy-and-paste customisation (a new template = a copied folder); smaller diffs;
one more merge layer to test; `config:check` and the admin UI must name files, not just JSON paths.

## ADR-010 — Generated colour sets instead of Skeleton presets (2026-09-19, owner review)

**Context.** Skeleton presets differ in radius, spacing and typography as well as colours, so the
wizard's theme choice moved things around; the owner wants a theme to change colours only, six
well-chosen sets, and a warmer look than the bare defaults.

**Decision.** Themes are palettes (`#lib/shared/theme-palette.ts`: hue and chroma per tone plus a
surface tint) expanded by `scripts/generate-themes.ts` into `src/lib/themes/<name>.css`, colour
tokens only; the shared shape and type tokens live in `src/lib/theme.css`. Status tones are fixed
across sets. The contrast test regenerates each file in memory and fails when a committed file is
stale or any pair drops below 4.5:1. `ui.theme` accepts `ocean` (default), `forest`, `grape`,
`sunset`, `cherry`, `lagoon`, `silver` (light grey with a soft blue),
`graphite` (charcoal accents with amber — still on light surfaces, there is no dark mode) and
`apricot` (golden orange with sky blue), asked for by the owner at the second review. Grey accents
use the palette's `deep` offset, which darkens shades 400–950 and leaves 50 and 100 near white so
tiles and hover backgrounds stay light.

**Consequences.** New colour sets are a few numbers plus a regeneration; Skeleton preset files are
no longer imported; installations that referenced `cerberus` must switch to `ocean` (none existed).

## ADR-011 — One migration until version 1.0 (2026-09-20, owner decision; confirmed for the 0.9.x field tests 2026-09-27, Q82)

**Context.** Every schema change was producing a new Drizzle migration (table rebuilds for SQLite CHECK
changes), while no installation exists yet and the development database is throwaway.

**Decision.** Until 1.0 the `drizzle/` folder holds a single migration, regenerated from `schema.ts`
whenever the schema changes (`bun run db:generate`, folder renamed to `<YYYYMMDD>000000_initial`). Existing
development databases are reset (`bun run dev:reset --yes`) and reseeded. Incremental migrations start
with the first released version.

**Consequences.** No migration history to review before 1.0; the e2e and unit databases are always
created from the current schema; a schema change is a one-line regeneration.


## ADR-012 — Which copies circulate (2026-09-25, default applied in step 4.2)

**Context.** Appendix I refuses a checkout with `item_status_unavailable` but does not list the
statuses. The plan defines five: available, damaged, in repair, lost, withdrawn.

**Decision.** `available` and `damaged` copies can be lent (a worn book still goes home with a
pupil); `in_repair`, `lost` and `withdrawn` cannot, unless an administrator overrides with a reason
(Appendix I). A copy flagged not-for-loan is refused the same way. The item type's own `maxLoans`, when
set in `circulation.itemTypeOverrides`, is a second limit counting only the copies of that type; the
patron type's `maxLoans` always counts every loan.

**Consequences.** Marking a copy damaged is information for the librarian, not a block; to stop a
damaged copy from circulating, set it "in riparazione". The owner can ask to block damaged copies
too: it is one line in `circulation-rules.ts`.

## ADR-013 — Check-in: lost copies, "Rinnova invece" and renewals that change nothing (2026-09-25)

**Context.** Step 4.4 lists the check-in cases of Appendix I but leaves three details open: what
happens to a copy marked lost when it is scanned, what "Rinnova invece" does on a return, and what a
renewal does when it would not move the due date (renewing from today on the day of the loan gives
the same date, which the rules of 4.2 reported as `renewal_hard_due_date`).

**Decision.** Scanning a lost copy at check-in closes its open loan if any, puts the copy back to
`available` straight away (a `found` event on its last loan, audit `item.status`) and shows
`was_lost_now_found`; "Conferma" only acknowledges the message. "Rinnova invece" is offered on
every return of the session: it reopens the loan returned today and renews it with the usual rules;
when they refuse, the return stays registered. A renewal that would not extend the loan is not
counted and changes nothing (so "Rinnova invece" on the day of the loan simply takes the return
back); `renewal_hard_due_date` is reported only when the hard due date caps the new date. After a
return the desk offers "Segna danneggiato" only: a copy just handed back cannot be lost.

**Consequences.** No renewal is wasted by an early click; the count of renewals reflects real
extensions. Marking a copy lost stays on the copy card (step 4.8).

## ADR-014 — Built-in reports are read in place, not copied (2026-09-25, step 6.1)

**Context.** §3.11 said the built-in report definitions are copied into `CONFIG_DIR/reports/` at
the first start and that files there override the built-ins by `id`. Combined, the two rules
freeze every installation on the reports of its first start: a corrected query or a new column
shipped with an update would stay hidden behind the old copy.

**Decision.** The built-ins are read from the application's `config/reports/` and never copied.
`CONFIG_DIR/reports/` holds only the school's own definitions; a file there with the `id` of a
built-in replaces it (to customise a built-in, copy its file there and edit it). Report texts may be
one string or one string per language, so the built-ins speak Italian and English.

**Consequences.** Updates improve the built-in reports everywhere; a school that customised one
keeps its version. The configuration archive (11.3) exports only the school's files. The report
library editor (11.9) shows both, marking which is which.

## ADR-015 — Staff accounts edited from the UI; the sign-in mode stays shown, not chosen (2026-09-26, step 11.7)

**Context.** Step 11.7 makes `security.users` and `security.roles` editable from Amministrazione →
Account del personale, and the completeness rule of Phase 11 asks that every setting be reachable
from the UI. `security.auth.mode` has two values, but only `config` exists: personal accounts
(`database`) are Phase 10.1, after 1.0 (Q20).

**Decision.** Accounts are created, renamed, deactivated, removed once inactive and given a new
password from the UI; the password is hashed on the server (argon2id with the memory of the hardware
profile) and only the hash is written, replacing a clear `password` key. A renamed account keeps its
`staff_user` row (sessions and audit follow it). Roles are edited as a matrix over the fixed
permission list; a renamed role is followed by the accounts, a role in use cannot be removed. Every
change must leave an active account holding `admin`. The sign-in mode is **shown** on the page with
its explanation and is not offered as a choice while `database` has no implementation; step 10.1
turns it into a choice. The coverage map counts it as handled by the accounts page.

**Consequences.** Nobody needs to edit `config.json` or run `auth:hash-password` to manage staff
accounts (the hash helper stays, folded, for hand editing). A password change or a deactivation
signs that account out, as a hand edit followed by a reload already did.

## ADR-016 — Content Security Policy with `unsafe-eval` for OpenCV.js (2026-09-26, step 9.1)

**Context.** Step 9.1 adds a Content Security Policy (SvelteKit `csp`, mode `auto`: a nonce on
every script SvelteKit writes). The cover capture (3.7) evaluates the official OpenCV.js build,
which compiles its JavaScript bindings at start with `new Function`: without `unsafe-eval` the
runtime never starts. A policy is fixed when a document loads, and the record page that captures
covers is reached through client-side navigation from every list, so a policy relaxed on that
route alone would not apply.

**Decision.** `script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'` plus the nonce, everything else
from this origin only (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`,
`form-action 'self'`, `base-uri 'self'`); inline styles allowed (Svelte style attributes, the
sandboxed print previews); images from data and blob URLs.

**Consequences.** No script from another origin and no inline script without the nonce can run;
the app never passes user input to an evaluating sink, so `unsafe-eval` only matters if another
flaw lets code run already. Moving OpenCV into a dedicated worker with its own policy would allow
dropping it (future work, noted in `docs/security.md`).

## ADR-017 — Dictionaries by route and without the English fallback for built-in languages (2026-09-26, step 9.2)

**Context.** ADR-006 loads every dictionary namespace on every page, so the server snapshot is
complete whatever the page. Every page therefore carried the Italian and the English dictionaries
(English being the fallback locale) — 269 KB of HTML for the dashboard — and the root layout data
was fetched again at each navigation because it read the pathname.

**Decision.** A complete built-in language (the parity test guarantees every key) is created
without the fallback locale; language packs keep English behind them. The administration
namespaces (`admin`, `config`) carry a route filter (`NAMESPACE_ROUTES`) and load only under
`/admin` (and the two other pages that use `admin` keys); the server helpers that translate
messages load every namespace. The root layout no longer reads the pathname (only `?lang=`), so
its data — and the dictionaries — are fetched once per visit. Dynamic responses are gzipped.

**Consequences.** The dashboard HTML is 103 KB before compression, 24 KB on the wire, and page
changes no longer download the dictionaries. A page outside the admin routes cannot use `admin.*`
or `config.*` keys (`namespace-routes.test.ts` fails when one does); a component shared with such a
page takes its strings from another namespace.

## ADR-018 — The complete plan is 0.9.0; 1.0.0 after field testing (2026-09-26, owner decision; migrations revised 2026-09-27, Q82)

**Context.** The plan called its final release 1.0.0. The owner expects a few months of use at the
school before the application can be called finished.

**Decision.** The complete version of PLAN.md is released as **0.9.0** (step 9.6); fixes found in
the field are 0.9.x patch releases; **1.0.0** is tagged when the owner closes the field test (step
9.10). Migrations (Q82, owner decision): the single regenerated migration of ADR-011
lasts until the real 1.0, through the 0.9.x field tests; a database in use during the field test is
carried across a schema change by exporting its data and restoring it into a fresh database.

**Consequences.** "Before 1.0" in older notes and ADRs means before 0.9.0. The version in
`package.json` moves to 0.9.0 at the release step; the About page and the image tags follow it.

## ADR-019 — A patch to `@sveltekit-i18n/base` for its quadratic merge (2026-09-26, step 9.2)

**Context.** Profiling the pages found that building an i18n instance spent most of its time in
`mergeTranslations` of `@sveltekit-i18n/base` 3.0.0: it copies the whole accumulated table at every
dot-notation key, so a dictionary of 1 200 keys took 25 ms on a PC, far more with the admin
dictionaries, on a Raspberry Pi 4 (every request builds one on the server) and on a phone (every
page load builds one in the browser, about 200 ms at Lighthouse's 4× CPU slowdown).

**Decision.** Patch the function with `bun patch` (`patches/@sveltekit-i18n%2Fbase@<version>.patch`,
`patchedDependencies` in `package.json`, `patches/` copied into the image build before
`bun install`): one copy of the target, then filled key by key, with `Object.defineProperty` so a
literal `__proto__` key stays an own property as before. No new dependency; behaviour unchanged.
`src/lib/i18n/merge-speed.test.ts` builds an instance from 20 000 keys and fails if it is slow
again (it fails without the patch). The fix should be offered upstream by the maintainer; when a
release carries it, the patch is dropped at the next deliberate upgrade.

**Consequences.** Instance creation is linear; the dashboard's Lighthouse score over HTTP/2 went
to 100. Upgrading `sveltekit-i18n` requires checking whether the patch still applies: `bun install`
fails loudly when the patched file changed, but when the upgrade brings a new version of
`@sveltekit-i18n/base` the entry keyed on the old version is ignored silently (the speed test is
what notices).

Update: `sveltekit-i18n` 3.3.0 brings `@sveltekit-i18n/base` 3.2.0, which still merges
quadratically; the same change was recreated for it as `patches/@sveltekit-i18n%2Fbase@3.2.0.patch`.

Update: `sveltekit-i18n` 3.4.1 brings `@sveltekit-i18n/base` 3.3.2, whose `mergeTranslations` is
linear upstream (one null-prototype copy filled in place); the patch, the `patches/` folder,
`patchedDependencies` and the image's copy of the folder are gone. `merge-speed.test.ts` stays as
the guard.

## ADR-020 — A distroless runtime image with yaz-client and a BusyBox shell (2026-10-02, owner request)

**Context.** The image built on `oven/bun:1.4.2-slim` was 270 MB (about 108 MB to download). Most of
it was not BiblioViva: the Debian userland (apt, perl, the shell and its tools, 93 MB) and the
whole `yaz` package with its dependencies (53 MB, of which 37 MB ICU that `yaz-client` does not
link). The bundle carried 13 MB of server source maps.

**Decision.** The runtime stage starts from `oven/bun:1.4.2-distroless` (same Bun, Debian trixie
glibc, CA certificates, time zones, gconv). An intermediate `debian:trixie-slim` stage installs
the Debian packages `yaz` and `busybox-static` and copies into the image only `yaz-client` with the
shared libraries `ldd` lists for it (glibc excluded, it is in the base) and the static BusyBox with
a link for each applet, so `docker compose exec app sh` still gives a minimal shell (`ls`, `cat`,
`vi`, `wget`, `ps`, …). The user stays `bun`, uid 1000, so existing volumes keep working. The
server bundle is built without source maps (see the note below for how since adapter-bun 1.0): checked
on the built image, the maps point to the intermediate `.svelte-kit/output` files, never to
`src/`, and the bundle is not minified, so a stack trace without them names a readable file and
line that exist in the container (Bun does read external maps: with them the trace names files
that do not exist there). No new npm dependency; BusyBox (GPL-2.0) is listed on the About page.

**Consequences.** The image is 144 MB on amd64 and 155 MB on arm64, about 64 MB to download. There
is no apt in the container: a tool that is not a BusyBox applet cannot be added at runtime. A new
Debian `yaz` that loads a library at run time (not linked) would be missed by `ldd`; the build
prints `yaz-client -V` and the smoke test runs a real search. Under QEMU (an arm64 image on an
amd64 host) BusyBox pipelines fail with "applet not found" because binfmt drops `argv[0]`; on a
real arm64 host they work.

Update, adapter-bun 1.0.0: the server is now built by Vite, not by a second `Bun.build`, and
the packages under `dependencies` are left external. The image has no node_modules, so a build-only
plugin in `vite.config.ts` sets `ssr.noExternal: [/./]` (read by the adapter) and every package is
bundled as before; `buildOptions` now applies only to single executables, so the maps are turned
off with `build.sourcemap: false` (SvelteKit 3.0 writes server maps unless told). The adapter also
copies `build/server/_app`, the server build's copies of the client assets (~12 MB, OpenCV.js and
the barcode WebAssembly): the Dockerfile deletes it, the server needs only their URLs.

## ADR-021 — HTML test reports and `@vitest/ui` (2026-10-02, owner request)

**Context.** `bun run ci` printed only the last lines of each task. The owner asked for HTML reports.
Playwright had one only on GitHub, the coverage report was a separate folder, and Vitest had none:
its `html` reporter lives in the `@vitest/ui` package, which is not in PLAN.md §2.

**Decision.** Add `@vitest/ui` **5.0.2** (exact, same version as Vitest; MIT; a dev dependency,
never in the image). Vitest writes `html` as one self-contained file (`singleFile`, so it opens from
disk) in `test-reports/vitest/`, with the coverage written inside it (`test-reports/vitest/coverage/`,
shown in the report's Coverage tab, plus `json-summary`) and `json` results next to it. Playwright
writes its `html` report (`open: never`) to `test-reports/playwright/` and `json` results, locally
and on GitHub. `scripts/test-report.ts` (`bun run test:report`, run by `bun run ci` at the end, pass
or fail) writes `test-reports/index.html`: counts per project, failures, the coverage totals and the
files under the 95 % line target, with links to the reports. The folder replaces `coverage/` and
`playwright-report/` in `.gitignore`, `.dockerignore` and the workflows; GitHub's CI uploads it as
the `test-reports` artifact on every run.

**Consequences.** One page to open after `bun run ci`. Each run replaces the previous reports; a run
of a single test file rewrites the Vitest report with that file only. Upgrading Vitest means
upgrading `@vitest/ui` in the same commit.

## ADR-022 — OpenCV.js 5.0.0 (2026-10-03, owner decision)

**Context.** Cover straightening (step 3.7, Q6, ADR-016) runs the official OpenCV.js build, vendored in `src/lib/vision/vendor/opencv.js` (4.13.0 since phase 3). OpenCV 5.0.0 is out (and 4.14.0 after it). A study compared the builds with a browser harness running the app's unchanged `detectQuad`/`warpQuad`/loader under the app's CSP. It used 222 seeded synthetic photos with known corners in Chromium and Firefox, plus timing with CPU throttling.
- **Detection:** bit-identical in 4.13.0, 4.14.0 and 5.0.0 (same quads, same pass, same intermediate results).
- **Warp:** `warpPerspective` differs by at most 3 grey levels; 5.0 rounds correctly where 4.13.0 is off by one on ~1.5 % of values.
- **APIs:** every API used exists with a compatible signature, and only symbolic type constants are used. OpenCV 5 renumbered the CV_* depth codes, so this matters.
- **Cost:**
  - size 10.96 → 16.21 MB raw, 2.56 → 3.32 MB brotli;
  - init in Chromium with a 4× slower CPU ~560 → ~830 ms;
  - detection time and Firefox unchanged.
- **Build:** like 4.13.0, 5.0.0 is built with an old Emscripten, without SIMD or threads, and still needs `unsafe-eval`.

**Decision (owner).** Move to OpenCV 5.0.0: at equal performance the project follows the new major version, and a few hundred KB more are acceptable. The vendored file is the `js/bin/opencv.js` of the GitHub release archive `opencv-5.0.0-docs.zip` (sha256 bf6130c3d755915e5d005b69e574225817f98dc5556fe640628f8f18c1eb568f, 16 211 109 B; `getBuildInformation()` reports 5.0.0). It is not the file at docs.opencv.org/5.0/opencv.js, which is a "5.0.0-pre" snapshot 30 commits before the tag. The type package follows: `@techstark/opencv-js` 5.0.0-release.1, a dev dependency used for types only. The About page lists OpenCV.js among the system components.

Two related changes:
- `orderCorners` now orders the four points clockwise around their centroid, starting from the smallest x + y. Sorting by x + y could pair two adjacent corners of a cover rotated about 45° and return a self-intersecting quad (8 of 222 images, which the warp would twist). Now 0, ordinary covers keep their order, and 93 → 97 of 200 photos are within 2 % with the corner order kept.
- The CSP keeps `connect-src 'self'`. Every OpenCV.js load first `fetch()`es the wasm embedded in its own file as a `data:` URL; the CSP blocks it (one console violation) and the build decodes the base64 itself. Allowing `data:` opens no way out of the page (a data: URL reaches no server) and removes the violation. But Chromium's `fetch(data:)` is slower than the JavaScript decode: that step takes ~105 instead of ~55 ms on a desktop and ~400 instead of ~185 ms with a 4× slower CPU (total load +150–375 ms); Firefox gains ~20 ms. The violation is therefore accepted. `tests/e2e/cover.spec.ts` fails on any other violation during the OpenCV load.

**Consequences.**
- The first cover capture downloads ~0.76 MB more (once; cached as immutable and precached by the service worker) and starts ~0.3 s later on a slow phone. Detection quality and speed are unchanged.
- Updating OpenCV.js means taking `js/bin/opencv.js` from the release's docs archive, checking its build information, and bumping the TechStark types in the same commit.
- Dropping `unsafe-eval` would still take a custom build (modern Emscripten, `-sDYNAMIC_EXECUTION=0`, embind AOT) or a dedicated worker (future work in `docs/security.md`).
- If a future build stops fetching its own data: URL, or `data:` is allowed later, the e2e filter still passes.

## ADR-023 — Barcode formats as token patterns with a choice of check characters (2026-10-04, Phase 12, Q90–Q93)

**Context.** Until Phase 12 the copy barcodes (`YYYY-NNNNC`) and the card numbers (10 digits, Luhn) were fixed in the code, and scanner input was classified by hand-written regexes. The owner wants the formats configurable for other schools and for this library's own change of format, with one binding rule: copy and card codes can never be confused, by the computer or by a person reading them (Q90).

**Decision.**
- A format is a **token pattern** (`#lib/shared/barcodes/pattern.ts`): `YYYY`/`YY` (the year), a run of `N` (the counter, fixed width), `C` (the check character), `{lib}` (a library code), digits, `-` and quoted letters without `I`, `O`, `Q`. Patterns compile to a shape used to generate, recognise and compare codes.
- Three **check algorithms** (`check.ts`): Luhn (a digit, the old default), Damm (a digit that catches every single error and adjacent transposition) and **mod 23** (a letter from 23 unambiguous capitals; it also catches jump transpositions and twin errors). The default of new installations is `YYYY-CNNNN` for copies and `CNNNNNN` for cards, both with the mod-23 letter.
- The configuration holds, per kind, the **current** format, the **retired** ones (generated in the past) and the **legacy** shapes (imported from older systems); `buildCodeTable` compiles them once and `scan.ts` recognises through that table only.
- `compareFormats`/`checkCodeTable` refuse a configuration where two kinds share a code (with or without the dashes, against plain numbers or ISBNs) or **look alike**: the formats must differ by at least two characters of length, a letter in another position or other separators (the visible-sign rule, Q93). A card number may never equal a stored copy barcode (checked by the services and imports).
- Counters are named per format and year (`sequence`), and a new format continues above the numbers of the older ones of the same shape.
- Keyboard repair tables (`layouts.ts`) normalise what scanners type under the configured keyboard layout.

**Consequences.** Recognition, generation and validation share one implementation and one table; the first-run wizard and the "Formato dei codici" editor show examples and the verdict of the rule before anything is saved. A legacy shape that collides with a new format is dropped by the wizard and refused by the editor. Adding an algorithm or a token means extending the compiler and the comparison together, with their generated tests.

## ADR-024 — Classes are groups of the database; the years are configuration (2026-10-04, Phase 12, Q94–Q102)

**Context.** The patron carried `class_year` and `section`, which fixed the Italian primaria model (a number and a letter) into the schema, could not represent pluriclassi, infanzia sections of mixed ages or a comprensivo, and made the class upgrade rewrite every student. The owner asked for the class as a separate object, with attention to how it is stored (Q94), and for permanent cohorts (Q100).

**Decision.**
- The **years** of the school (`school.levels`, grouped in `school.stages`, with an optional `next`) are configuration, edited on the "Scuola" settings page; their code is what the patrons store. They are mirrored into `school_level` (and the label template into `school_setting`) so SQL — the reports and the view `patron_class` — can order and label them.
- The **classes** are rows of `class_group` (`students` or `teachers`) with their years in `class_group_level` (several for a pluriclasse). A student has a group and a level hosted by it; a teacher has a teachers group (Q102). Groups are permanent: the upgrade changes a group's level (`3 B` becomes `4 B`, the same row) and archives the emptied ones; they are never deleted. Only `admin` manages them (Amministrazione → Classi, Q99).
- **Loans keep a photo** of the class at issue time (level, position, stage, group id and name, label) that is never rewritten (Q95); live screens and reports read `patron_class`, history reads the snapshots.
- A year in use cannot leave the configuration silently: the reference guard refuses it, and the editor moves its pupils and classes to another year in the same change (12.9).

**Consequences.** Any school structure of the presets (and custom ones) fits without schema changes; labels follow `school.classLabel` everywhere through `#lib/shared/school.ts` and the view. Queries on classes join the group (or the view) instead of reading two columns. Before 1.0 there was no compatibility layer (Q95): the single migration was regenerated and every built-in report rewritten.

## ADR-025 — School presets are built-in files read from the application (2026-10-04, Phase 12, Q91, Q97)

**Context.** The wizard and the "Scuola" settings page propose ready-made structures for Italian and foreign schools (stages, years, labels, class names, teachers group, reading levels). They could be configuration files of `CONFIG_DIR` or data shipped with the application.

**Decision.** Like the built-in reports (ADR-014), the presets are JSON files in the application's `config/school-presets/`, validated when read (`#lib/server/school/presets.ts`; an invalid file is skipped with a warning) and **never copied** into `CONFIG_DIR`: they are a starting point, not configuration. Choosing one writes an ordinary `school` section (and the reading levels into `classification.json`); afterwards the configuration is the source of truth. The configuration folder test treats `school-presets/` as a built-in-only folder (`BUILTIN_ONLY_FOLDERS`): no editor, no archive part.

**Consequences.** New or corrected presets reach every installation with an update without touching any school's configuration; a school that wants a structure of its own edits the `school` section. The seed generates demo data from the preset's classes (pluriclassi included) through `seedOptionsFromConfig`.

## ADR-026 — Class pictures: frames found in the browser, straightened on the server, deleted with the year and with a removed pupil (2026-10-04, Phase 13, Q103–Q109)

**Context.** The photo census takes photos one at a time (2.4). Schools often have pictures with many faces already: the photographer's sheet, the class's cards on a table. The owner wants such a picture uploaded for a class (or a patron list), its photos found, and each one assigned with a drop-down, one patron per photo and one photo per patron. The pictures are personal data of minors, often with names printed on them.

**Decision.** (1) The frames are found **in the browser** with the OpenCV.js build already vendored for the covers (ADR-022), reusing their passes and side scoring (`#lib/vision/frames.ts`): a frame needs three clear sides (a white shirt on white paper leaves no bottom edge), portrait proportions from `photos.sheet`, no clear side going on past a corner, and a size near the others'; no face detection and no OCR (Q107, future 10.11). (2) The browser sends only the corners: the **server straightens** each frame into a photo of exactly the configured size with a homography in plain TypeScript (`#lib/server/images/warp.ts`, no new dependency) and keeps it next to the picture, so the crop shown is the photo saved. (3) The choices are **drafts** in the database (`class_photo_frame`), checked by the service (members of the class or list only, one frame per patron across its pictures); "Salva le foto" writes the new files first, then one transaction for patrons, frames and audit, then removes the replaced files. (4) A picture is kept **until the class upgrade** (which deletes them all), goes with its patron list, and **removing a patron paints over their frames** in the pictures (owner, Q106; for one day the picture was deleted instead, then the owner went back to painting): inside the removal's transaction the frame becomes `erased` and its photo file is deleted; the painting, which needs the asynchronous image codecs, runs right after the transaction (`paintErasedFrames`, one run at a time), and again before the picture route serves a picture, before a backup and an export, and at startup, so a removed pupil's face is never shown or copied while the picture stays with its class. (5) Archives carry the pictures with the `photos` data part (rows and files).

**Consequences.** No server-side image analysis beyond resampling; a slow phone pays only the OpenCV download it already pays for covers (detection of a 12 MP picture ~230 ms on a desktop, ~610 ms with the CPU slowed four times). The census offers only the classes and lists where a photo is missing (Q108). A pupil removed in the middle of a year leaves a grey frame in the class picture; the photos of the others stay. The picture route answers with an ETag of the stored file and `no-cache`, so a browser never keeps the face after the painting.

## ADR-027 — An opt-in run on Chromium, Firefox and WebKit (2026-10-04, Q110)

**Context.** The tests ran on Chromium only (Q49, Q77). Firefox is a common browser, the school's phones may be iPhones (WebKit), and before 1.0 the app should be known to work on the three engines; the everyday runs must stay as fast as they are.

**Decision.** `BV_BROWSER=chromium|firefox|webkit` chooses the engine of the Vitest `client` project (`vite.config.ts`) and of the Playwright projects (`desktop-<engine>`, `mobile-<engine>`, `playwright.config.ts`); Chromium is the default. `bun run test:browsers [engines…]` (`scripts/test-browsers.ts`) builds once, then for each engine runs the component tests and the whole Playwright suite on a fresh server and database, and prints one line per engine. Visual comparisons stay Chromium's (their fonts are the baselines'). Firefox has no mobile mode (`isMobile`), from which the specs take their phone branches, so it runs the desktop project only; the phones are covered by Chromium and WebKit (Safari's engine, with a mobile mode). Each engine runs its desktop and phone projects, then the `final` flows with `--no-deps`, so a failure does not hide the flows after it. Files downloaded by a spec are saved with `saveAs` (`tests/e2e/helpers/download.ts`), which also works with a browser served elsewhere. Chromium-only checks (the DevTools protocol: CPU throttling, the PWA installability check) are skipped on the other engines. WebKit needs Ubuntu's libraries: on a host without them the script starts Playwright's own container image (`mcr.microsoft.com/playwright:v<version>-noble`, podman or docker, the host's network) and the tests connect to its browser server (`BV_PW_WS`), while the app and the test runner stay on the host.

**Consequences.** `bun run ci` and GitHub's workflow are unchanged. The fake cameras differ: Chromium plays the fixture video with the barcodes, Firefox shows its own test pattern, WebKit has none, so the camera flows that read codes are expected to fail outside Chromium; the three-engine run is read with that in mind and its other failures are fixed or explained before 1.0 (9.10).

## ADR-028 — A public demo behind a Cloudflare Tunnel; the school stays on the tailnet (2026-10-05, Q111, Q112)

**Context.** The owner asked whether BiblioViva could be reached through a Cloudflare Tunnel and suggested a public demo with the generated data, emptied every day. A tunnel (`cloudflared`, a container image, not an npm dependency, but a new component of the deployment) connects out to Cloudflare, so no port is opened, and the browser gets HTTPS. Cloudflare ends TLS: it sees every request and answer in clear. The school's data are names, classes and photos of minors, and the installation is reachable only from the tailnet (Q18, Q21) behind shared role accounts.

**Decision.** (1) The school's installation does not offer a Cloudflare Tunnel: a public login page and a third party reading the traffic in clear are not acceptable for that data; Tailscale and the local-network mode (Q89) remain the two ways in. (2) A **public demo** uses the tunnel (step 9.17): `docker/compose.demo.yml` with a `cloudflared` sidecar pinned to an exact tag; the client address from `cf-connecting-ip`, so the login limiter counts visitors and not the tunnel; both volumes built afresh at every start, as the first-run wizard would with the generated demo data seeded with the day's date (a folder without the demo's marker is refused, never emptied), the process exiting at the reset time so Docker restarts it (Q119); `DEMO_PUBLIC=1` adds the credentials and the reset time in a box on the login page (the app's pages carry no band), `noindex`, and one guard that blocks what would let one visitor spoil the demo for the others or make the server a public relay (staff accounts, configuration import, backups and their restore, class pictures, real metadata lookups); what a visitor sends is replaced by an example (ADR-035).

**Consequences.** The demo can carry only synthetic data, and nothing typed into it survives the night. The guard is a list of features checked in the services, so a new feature that writes shared state or calls out must be reviewed against it. The demo runs on an Oracle Cloud Always Free virtual machine (Q119: the Arm shape, or the 1 GB AMD shape with swap when no Arm capacity is available) with the `small` profile and the container limited to 512 MB and 1 CPU, so it shows a school's usual host at work; a per-address limit on writes and heavy downloads, the profile's concurrency limits and Cloudflare's protection keep it usable for several visitors at once. If Q111 is ever answered the other way, the same compose file is the starting point, with Cloudflare Access in front made mandatory.

**What a visitor may change (Q118).** The administration is open to look at and try, but the configuration is never written in demo mode (one guard on the configuration writers); the library's data are shared by every visitor and freely changed until the nightly reset; the staff notes have a daily limit per address; reports in SQL are off, because `bun:sqlite` cannot interrupt a statement and one that never ends would freeze the server for everyone — the guided reports, made of bounded pieces, stay. The compose file limits memory and CPU and restarts the app when its health check fails.

## ADR-029 — Segnalazioni: a seventh area for every account, notes written once and managed by the administrator (2026-10-05, Q113)

**Context.** The owner asked for staff notes like post-its: any account leaves one, only the administrator archives them and can put some at the top of the dashboard, in a section of their own before the reports, shown as tiles. §3.18 allowed at most six areas in the sidebar, every area has its own top-bar colour (9.16), and the accounts are shared per role, so the author of a note is an account, not a person. The text is free and is read by every account, while the patrons are mostly minors.

**Decision.** A seventh area, **Segnalazioni** (`/notes`), between Stampe and Report, shown to every account with no new permission: reading and writing need a staff session only, while pinning to the dashboard, archiving, restoring and deleting check the `admin` permission. A note is never edited, not even by the administrator (owner): a wrong note is archived and written again, so the text shown is always the text written by the account under it. The pinned notes stay on the dashboard until the administrator takes them off; they also head the checkout desk of the accounts that open there and never see the dashboard. Notes are a data part of their own in backups and restores (`notes`), the audit records ids only, and the form warns against writing pupils' personal data; there is no automatic clean-up, so the administrator deletes archived notes for good when needed. The area's colour is petrol blue (hue 210), the one hue left with enough distance from the six areas and the status colours in all fifteen colour sets.

**Consequences.** The sidebar grows to seven items on a desktop (the phone keeps four in the bottom bar, Segnalazioni goes under "Altro"). Free text read by everyone is a privacy risk that only the hint and the administrator's deletion contain; anonymizing a patron does not search the notes. The public demo (9.17) keeps notes writable, since the daily reset clears them.

## ADR-030 — Step numbers never change; no dates in the plan and the documents (2026-10-08, owner decision)

**Context.** Phases 11–13 were added while building and carried out before the remaining steps of Phase 9 (hardening,
documentation, release), so the numbers no longer follow the order of the work. Renumbering the plan in that order was
tried and withdrawn: the commit messages and `docs/STATUS.md` cite the steps by number, and new numbers would make them
point at the wrong steps. The plan and the documents also carried the dates of decisions and changes, which describe
history rather than the current state.

**Decision.** Step and phase numbers never change: a step keeps its number even when it runs earlier or later than its
place, a new step or phase takes the next free number, and PLAN.md §0 rule 2 says when it runs. PLAN.md, CLAUDE.md, the
READMEs, `docs/` and code comments carry no dates or history of decisions and changes (PLAN.md §0 rule 15); history
lives in git, in the Date column of `docs/STATUS.md` and in the titles of these ADRs. Dates that are data (example
codes, holidays, sample calendars) stay.

**Consequences.** The order of the work is read from §0 rule 2, not from the numbers.

## ADR-031 — Copies of the built-in templates that were never edited follow the application (2026-10-09)

**Context.** The built-in print templates are copied into `CONFIG_DIR` at the first start, so they can be edited as
files and travel in the configuration archive; a copy is never touched again. When the application changes a
built-in — a field renamed by Phase 12, the card rewritten for the designer by 11.16 — an installation keeps the old
copy, which may no longer print (the development card still used `{{patron.section}}`) and never gets the
improvements, although nobody ever edited it.

**Decision.** At every start, a copy whose every file is a version the application shipped is replaced by the current
built-in. The shipped versions are recorded per template folder and file path in
`src/lib/server/templates/shipped.json`, written from the git history and the working tree by
`bun run templates:shipped`; text files (HTML, CSS, JSON) are compared without their formatting, so a version that
differs only in spaces and line breaks counts as shipped. A copy with any other file (edited by hand or in the
designer, an asset uploaded, a `design.json`) is left alone, and the template page shows its problems if it no longer
loads. A unit test fails while a file of the current built-ins is missing from the record.

**Consequences.** Changing a built-in template needs `bun run templates:shipped` in the same commit. The replacement
is logged at start (`[templates] … replaced by the current built-in`); it is not a change of the configuration history,
because nothing the school wrote is lost. Built-ins are still copied, so the file workflow of `CONFIG_DIR` is unchanged.

## ADR-032 — Import columns are English, chosen by the operator; students and teachers are imported apart (2026-10-16, Q115)

**Context.** The import templates had Italian headers written in the code, and the reader accepted a mix of Italian,
English and Koha names, some of them ambiguous across imports (`classe` was the school year for patrons and the reading
level for the catalogue, `tipo` the patron type or the item type). The templates could not be shaped, and every key
looked mandatory although most can be generated.

**Decision.** One column catalogue per import (`#lib/shared/import-columns.ts`) with English `snake_case` names, the
only accepted headers; each column is required, a key or optional. The operator generates the template with the
columns they want (header only); a key left out is allowed and announced with what replaces it. Students and teachers
have two imports; the student class is one `class` column matched against the labels of the existing classes, or
`level` + `section`.

**Consequences.** Files made with the old Italian headers, and Koha exports with Koha names, are mapped by hand or
regenerated: the Koha queries in `docs/import/` output the English names. No alias table to keep in step with the
fields.

## ADR-033 — Reports: guided definitions and pivot tables in the same file format (2026-10-16, Q116)

**Context.** Reports were JSON files with hand-written SQL, changed outside the application, and a table with dynamic
columns (class year × section with totals) could not be expressed, because the columns of a definition are static.

**Decision.** A definition carries either `sql` or `query` (source, filters, rows, optional columns, measure); a
`query` is compiled on the server from a fixed catalogue of dimensions and measures into SQL that passes the same checks
and runs on the read-only connection. A `pivot` block turns the long rows into a table whose columns come from the data,
with totals. The editor shows a guided view and an SQL view over the same file; a guided report can be turned into an
SQL report, never the reverse, so no edit is made in one view that the other cannot show. Built-ins stay read in place
(ADR-014): a customised copy has the same `id`, a duplicate a new one.

**Consequences.** The builder catalogue is code and tested on both seeded school presets; built-ins use the guided form
wherever it can express them, so they are editable without SQL.

## ADR-034 — A record may be unclassified; its copies do not circulate until it is classified (2026-10-16, Q117)

**Context.** Entering a book and classifying it are often two moments: a file from another system without
classification, a pile of new books typed in at the desk and classified later by the librarian. A mandatory kind
forces a guess that nobody corrects.

**Decision.** `biblio.kind` may be null, with no genre, class or reading level: the record is "da classificare".
Every entry point (import, record form, fast add) may leave it so; a tab of the Catalogo area lists these records
and proposes them one after another for classification. The desk refuses their copies (`item_unclassified`, not
forceable); the barcode label prints, the spine band and the call number wait for the classification.

**Consequences.** Every reader of `kind` handles the null value (labels, call numbers, reports, catalogue filters);
reports show one value "Da classificare". Imported open loans of such copies are accepted, since they already exist.

## ADR-035 — The public demo replaces what a visitor sends with an example (2026-10-18, Q121)

**Context.** In the public demo every visitor shares the data and the administrator's account (Q118). A name, a
title, a note or a photo sent by one visitor is shown to every other visitor until the nightly reset; the demo looks
like a school's installation, with pupils and their photos, and a word filter is easy to get around and refuses
real titles. The alternative, a private copy of the database per visitor, would keep each visitor's content away
from the others but would make every request pick its database and turn the shared demo of Q118 into many.

**Decision.** The data stay shared; the server never keeps the content a visitor sends. In the services, next to the
guard of the demo, a few functions of `#lib/server/demo/content.ts` replace it on the way in: free text becomes an
example ("Libro demo del …", "DEMO – segnalazione del …", names from the fake-name generator), pictures become the
demo's placeholder with the date and time of the save drawn on it, and the CSV imports with free text accept only the
example file generated with the demo. What the visitor cannot shape stays as sent: codes from closed lists, dates,
numbers, barcodes and card numbers validated by the format table, ISBN; a value equal to the stored one is kept,
and so are the values of the mock provider's records, so a lookup still fills a record with real-looking data. The
login box says it, and a save that replaced something answers with a header the browser turns into a notification.

**Consequences.** Every flow can be tried to the end and nothing a visitor types or photographs reaches another
visitor. A new feature that stores text or pictures must pass its input through `content.ts` (the guard of ADR-028
lists what is refused, this module what is replaced). The demo shows how BiblioViva behaves, not the visitor's own
data: trying an import with one's own file is not possible in the demo, by design, which also keeps real lists of
pupils off a public server.


## ADR-036 — Search that forgives typing mistakes, written in the project over the FTS vocabulary (2026-10-20, Q124)

**Context.** A title, an author's surname or a patron's name typed with a mistake found nothing: the catalogue search
makes every word a required prefix (FTS5 `unicode61`), the patron search a prefix of a word of the name. The owner
wants the closest books and patrons, every word counting and those with every word first, and asked to look first for
existing JavaScript components. SQLite offers no edit distance in Bun's build: `spellfix1` and `editdist3` are
missing, and a loadable extension would be a native library per architecture (§2.8); the `trigram` tokenizer finds
substrings, not mistakes. The survey compared MiniSearch 7.2.0, uFuzzy 1.0.19, Fuse.js 7.5.0, fuzzysort 4.0.2,
FlexSearch 0.8.212, Orama 3.1.18, mnemonist 0.40.6 (SymSpell, BK-tree) and fastest-levenshtein 1.0.16 on 10 000
titles with Italian queries: fuzzysort matches subsequences and missed swapped and doubled letters; Fuse.js scans the
whole list per word (about 40 ms per query on a desktop, several hundred on a Raspberry Pi); Orama has one tolerance
for the whole search and ranked unrelated records first; uFuzzy allows at most one mistake and drops a record that
misses a word; SymSpell fixes the distance when its index is built and needs tens of MB; MiniSearch can limit the
mistakes by word length but counts two swapped letters as two, and like every library keeps a second index of the
titles and names that must follow every write, import, removal and restore.

**Decision.** No dependency: `#lib/shared/fuzzy.ts` (a bounded optimal-string-alignment distance, where an insertion,
a deletion, a change or two swapped letters count as one; no correction under four letters or in articles, one up to
six letters, two from seven; the closeness of a record: words found, then mistakes). The exact search runs first;
below three results the approximate ones follow, marked "Simile" and counted apart. Books: the words of the titles,
original titles and authors are read from the FTS index through a `fts5vocab` table of the connection's temporary
schema, kept until the catalogue changes; the corrected words give the candidates through FTS5, which are scored by
their title, original title and author. Patrons: the names of the active patrons (at most a thousand) are scored in
memory. Exports carry the exact results only.

**Consequences.** The rule of the owner is matched exactly and the FTS index stays the only one, so a removed
patron's name or a deleted book can never linger in a second index. The cost is about 200 lines with their unit
tests and the budgets of 5.1 and 5.2 (50 ms on 10 000 records, 20 ms on 1 000 patrons) measured on the approximate
path too. A mistake in the first letters of a word that is also short (four letters, one mistake allowed) can still
miss; a trigram index could add candidates there if the field tests ask for it.

## ADR-037 — Generated screenshots instead of live figures in the documentation (2026-10-23, Q114)

**Context.** §3.23 showed BiblioViva's screens in the manual and on the site as live figures: Svelte files composing
the app's components with typed demo data, prerendered by the site. Reviewing the step before building it, the owner
judged it too complex for what it gives: the site would need the app's `#lib` imports, its i18n setup and a frame
redrawing the app shell; every component that loads its own data would be split into a view and a loader; a figure
recomposes a page by hand, so a change of the page's layout leaves it behind with no failing check; charts (canvas),
the virtual data grid, the camera and open menus or dialogs do not draw without JavaScript; and every refactor of a
component would break figures to mend, all before 0.9.0.

**Decision.** Screenshots generated from the running app (`bun run docs:shots`): a Playwright run on the test setup
(deterministic demo data, the e2e font configuration, the default colour set) after a shot list `docs/shots.ts`
(page, desktop 1280 × 800 at scale 1 or phone 412 × 915 at scale 2, steps, an optional element to crop to), taken in
every language of the site, never by hand. Format: lossless WebP, encoded by `Bun.Image` (measured on three phone
screens: 32–45 KB against 80–103 KB as PNG, the decoded pixels identical to the PNG's; lossy WebP at quality 90 was
larger than lossless on these flat screens; AVIF is not available in Bun's image backend on a development
host). The pictures are not committed: the site build writes them to `site/.shots/` and each release keeps them in
the archive branch. The rest of §3.23 stays: Markdown as the source of the prose with figure markers, the bold-label
check against the dictionaries, the static, versioned site.

**Consequences.** The pictures show the real pages, charts, dialogs and camera overlays included, with no change to
the app's components; a change that breaks a picture's steps fails `bun run ci` (which takes the Italian pictures),
while a picture that only looks different is taken again at the next build. The pictures are bitmaps: they are not
text in the PDF and blur when zoomed far in, and each release adds a few MB of pictures to the archive branch.

## ADR-038 — Windows hosts through Docker Desktop (2026-10-26, Q130) — superseded by ADR-057

**Context.** The plan supported Linux hosts only (Q63): a Raspberry Pi or a PC with Debian, Ubuntu or Fedora. In
many schools the only computer available to the library is the desk PC, and it runs Windows; asking a school to
reinstall it with Linux, or to buy a second computer, keeps BiblioViva out of those libraries. The image is built for
`linux/amd64` and `linux/arm64` and needs a Linux kernel; Bun, `bun:sqlite` and `yaz-client` have no part to play on
the Windows side.

**Decision.** Windows 10 and 11 64-bit are supported through Docker Desktop with the WSL 2 back end, which runs the
same `linux/amd64` image in a Linux virtual machine (step 9.34). The compose files stay the same; the configuration
and the data are named volumes inside the virtual machine, never bind mounts of Windows folders, because SQLite's
locking and the files' owner are not reliable on the Windows file share; the backups folder (step 9.35), which holds no
live database, is a folder of the PC. A PowerShell script, `setup.ps1`, mirrors `setup.sh`; the setup
guide gains a Windows path. No code of the app becomes Windows-aware.

**Consequences.** A school can run BiblioViva on the desk PC it already has, Docker Desktop and the browser on the
same machine. BiblioViva runs while a user is signed in to Windows (Docker Desktop is not a service), and the
computer may be switched off at night, which the backup at start of step 9.33 (Q129) covers. The data live inside the
WSL 2 virtual machine, so backups and moves go through the app's archives, not through Windows folders. Docker
Desktop's licence terms and the memory of the virtual machine have to be checked on a real host and documented; a
school that cannot use Docker Desktop keeps the Linux path.

## ADR-039 — The home page on Cloudflare Pages, the documentation on GitHub Pages (2026-10-27, Q131, Q132)

**Context.** §3.23 placed the presentation and the versioned documentation in one static site on `biblioviva.org`,
built from `site/` and published by GitHub Pages. The owner wants the home page on `biblioviva.org`, the documentation
on `docs.biblioviva.org` and the demo, as it is, on `demo.biblioviva.org`. GitHub Pages serves one domain per
repository. The home page the owner shaped on a mock is one long page with scroll effects that need a few lines of
script, while the documentation is many pages of prose generated from `docs/`, one set per release.

**Decision.** Two sites. The home page is `home/`: two hand-written pages, Italian at `/` and English at `/en/`, with
the same markup (a test keeps them mirrors), built by `scripts/home-build.ts` (`bun run home:build`) into
`home/dist/` and uploaded by hand to Cloudflare Pages (a direct-upload project, never built from the repository), the host the demo's tunnel already uses; one inline script drives the
scroll effects and the page is complete without it. The documentation stays the SvelteKit static app of `site/`,
published by GitHub Pages as `docs.biblioviva.org`, sent without SvelteKit's client; its only scripts are the version
selector's few lines and the search (Pagefind, Q134). The screenshots of `docs:shots` come in three windows:
computer 1280 × 800, tablet 834 × 1194 and phone 412 × 915.

**Consequences.** The home page needs no versions and no build of the documentation to change; it is plain files any
static host could serve. Two hosts to look after instead of one, both free: the owner manages the Cloudflare Pages
project and the domains. The help icons of the app open `docs.biblioviva.org/<version>/<lang>/…`. A third window
makes `docs:shots` take about half as many pictures again.

## ADR-040 — 0.9.0 as a public beta from a fresh repository; migrations from 1.0.0 (2026-10-27, Q133, Q82)

**Context.** The repository's history holds commit messages, working hours and old pictures the owner does not want
public; rewriting it was judged too much work, and making the existing repository public would also expose its old
Dependabot pull requests, Actions runs and commits reachable by their hash. The field test of 9.10 needs a date for
1.0.0, and until 1.0.0 a schema change is carried by export and restore (Q82), which real use cannot rely on.

**Decision.** The private repository becomes `itotm/biblioviva-archivio` with the whole history; a new public
`itotm/biblioviva` starts from one snapshot commit of the tree and development continues there (step 9.36). 0.9.0 is
released from it as a public beta for the school year 2026/27, until June 2027; 1.0.0 is released for the start of
the school year 2027/28 (September 2027). From 1.0.0 the single migration is the frozen baseline and every schema
change is a new migration, applied at start after a backup, with an upgrade test from every release (step 9.37).

**Consequences.** The public history starts at the snapshot; the archive keeps the old one for the owner. Patch releases
0.9.x during the beta may still change the schema through export and restore; after 1.0.0 every release must be
upgradable in place, which adds a fixture database per release and the upgrade test to the suite.

## ADR-041 — A beep on a camera read, generated in the browser (2026-10-28, Q137, Q40)

**Context.** Q40 kept the application silent: the desk speaks with colour, icon and text. With the phone's camera the
operator looks at the book, not at the screen, and cannot tell when a code was taken; the USB scanner beeps by itself.
The owner tried ten sounds on a mock, generated with Web Audio, beside a recorded sample.

**Decision.** One exception to Q40: a short beep when the camera takes a read, never for a bad read, never for the USB
scanner, never for a message of the desk. The sounds are generated in the browser (`#lib/scanner/sound.ts`, Web
Audio): no audio file to ship, decode or trim, the same sound on every phone, and a new sound is a few lines. Four are
offered — Cassa, Lettore, Conferma, Arpeggio — or none (`barcodes.cameraSound`), Conferma by default. A recorded file
was set aside: an MP3 starts with the encoder's silence and lags the read, an Ogg file does not play on older iPhones.

**Consequences.** The test that kept the application silent now allows Web Audio in that one module. The browser
opens the audio context only after a gesture, so the tap that opens the camera opens it too. The sound follows the
phone's media volume; an iPhone on silent stays silent.

## ADR-042 — One documentation, without versions (2026-10-31, Q114)

**Context.** The documentation site was planned with one frozen path per release, a version selector on every page,
`/latest/`, `/dev/` and an archive branch, so that a school that had not updated would read the manual of what it ran.
Old versions of BiblioViva are not supported, and an update is always painless: `setup.sh` again or `docker compose
pull`, the migrations at start.

**Decision.** The site describes the current release only, under `/<lang>/…`, built from the release's tag and
published at every release (again by hand for a correction of the text); no selector, no paths per release, no
archive. The app's help icons open `docs.biblioviva.org/<lang>/…` in the installation's language
(`#lib/ui/help-links.ts`); the PDFs of the manual are attached to each release.

**Consequences.** A school that has not updated may read a page that describes a newer screen; the answer is to
update. The site build, its search index and the Pages workflow handle one tree per language, not one per release.

## ADR-043 — The documentation site built by a Bun script (2026-10-31, Q114, Q131)

**Context.** The documentation site was planned as a second SvelteKit app prerendered with `@sveltejs/adapter-static`.
Its pages are Markdown converted to HTML in the layout of the approved mock, with no interaction beyond the search:
nothing needs components, routing or a client.

**Decision.** `scripts/site-build.ts` builds the site with `Bun.markdown` and a thin layer of its own (figures, notes,
variant blocks, the pages of each installation path, links, side menus from the sections' READMEs) into `site/dist/`;
`scripts/site-serve.ts` serves it locally. `@sveltejs/adapter-static` is not added.

**Consequences.** One script to read and test instead of a second app and workspace; the site shares the mock's
stylesheet (`site/assets/`), not the app's Tailwind build. A later need for components would reopen the choice.


## ADR-044 — Inter and JetBrains Mono served by BiblioViva (2026-10-31)

**Context.** The app, the home page and the documentation used the system font stack (`system-ui`): Segoe UI on
Windows, San Francisco on Apple devices, Roboto on Android, whatever the desktop sets on Linux. The look changed from
one device to the next, and the documentation's screenshots needed a font configuration of their own to come out the
same on every computer. The owner wants one look everywhere.

**Decision.** Two variable fonts under the SIL Open Font License 1.1, from the Fontsource packages
`@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` (5.3.0, exact versions): **Inter** for every
text (made for screens: tall lower case, distinct figures), **JetBrains Mono** for codes and code areas (Tailwind's
`font-mono`). The app imports their style sheets in `src/app.css`, so Vite emits each subset as a hashed file served
by BiblioViva itself with an immutable cache header; the browser downloads a subset only when the page uses its
characters (unicode ranges), about 50 KB for an Italian or English page. The home page and the documentation copy the
Latin subsets from the same packages (`scripts/web-fonts.ts`). No font is fetched from another site, so the app works
on a school network without internet. Print templates keep the fonts their style sheets name.

**Consequences.** The same letters on every computer, tablet and phone, and screenshots that no longer depend on the
fonts of the machine that takes them; about 230 KB more on the home page and the site (only the subsets read are
downloaded), about 1 MB more of font files in the image and in the service worker's cache. The fonts are updated
with the other dependencies.

## ADR-045 — Pagefind for the search of the documentation (2026-10-31, Q134)

**Context.** The documentation site is static (ADR-043): there is no server to search. Q134 chose Pagefind and asked
for an ADR when the dependency is added.

**Decision.** `pagefind` 1.5.2 (MIT, a development dependency with a prebuilt binary per platform) indexes
`site/dist/` at the end of `bun run site:build`, one index per `<html lang>`, into `site/dist/pagefind/`. Only the
text of a page's `<main>` is indexed, without the breadcrumbs and the placeholders of missing pictures; a step shared
by several installation paths is indexed once, in its first path. The header's search button, Ctrl K and `/` open a
dialog with Pagefind's default interface in the site's colours (`site/assets/search.js`, loaded with every page, a
few lines; Pagefind's script and the index are fetched the first time the dialog opens). Without JavaScript, or
without the index, the button leads to the A–Z index, which the dialog also links.

**Consequences.** Search without a server and without any outside service, in Italian and English; the index weighs
about 0.7 MB on the server and the browser fetches only the fragments a query needs. A step found by the search
opens in its first path; the reader switches path from the installation's pages.

## ADR-046 — Mocks instead of screenshots taken by hand (2026-10-31, owner, Q114)

**Context.** The screens of BiblioViva come from `bun run docs:shots`; the pages of other programs that the
installation shows (the Tailscale admin console's key and DNS pages, Raspberry Pi Imager's customisation, the phone's
install prompt) were to be screenshots taken by hand by the owner into `docs/setup/img/`. They would depend on one
person, an account and the look of other programs on the day, and could not be made again by the build.

**Decision.** The documentation is self-contained. A page of another program is a **mock**: an HTML page in
`docs/mocks/<area>/<name>.html` (the area and name of its marker, `<!-- screenshot: tailscale/dns | … -->`) that draws
only what the step needs — the fields, buttons and labels named on the official page, in the program's language for
that reader, without logos or brand marks — and that `docs:shots` takes in every language like the app's screens. A
screen of BiblioViva that the test setup cannot bring to its state may be a mock too, until the shot list reaches it.
`docs/setup/img/` is not used.

**Consequences.** Every picture of the site is made again by the build; no account, no device and nobody's screen is
needed. A mock is checked against the official page when the step is reviewed, since the other program may change
its screen; the text keeps linking the official page.

## ADR-047 — The visitor's language in the public demo, one cookie for biblioviva.org (2026-11-01, owner, Q120)

**Context.** An installation at a school has one language for every device (Q52, Q120). The public demo is
different: its visitors come from the home page and the documentation of `biblioviva.org`, which already have an
Italian and an English version and a switch between them, and many do not read Italian. A demo only in Italian
sends them away; a choice made on one of the three sites and lost on the next is a nuisance.

**Decision.** Only with `DEMO_PUBLIC=1`, the language of a request is the cookie `bv_lang` when it names an
available language, else the first available language of `Accept-Language`, else `ui.locale`
(`resolveLocale` in `#lib/i18n/server.ts`, `browserLanguage` in `#lib/shared/demo-language.ts`). A switch —
a globe and the codes of the languages, IT · EN, the installation's first — sits on the login page and in the top
bar (`LanguageSwitch.svelte`); a click writes the cookie and opens the page again. The home page (`home/home.js`)
and the documentation (`site/assets/lang.js`) have the same switch and write the same cookie: `path=/`, one year,
`SameSite=Lax`, `Domain=biblioviva.org` on that domain and its subdomains (the host's own elsewhere), not
`HttpOnly`, since two of the sites are static pages. The home page's Italian address and the documentation's root
open in the cookie's language, else in the browser's. With more languages the switch becomes a drop-down. The
messages, exports and print sheets built on the server take the request's language (`requestLocale()`); the data
(the school preset, the classes, titles and notes) keep the language they were written in. A school's installation
has no switch and reads no cookie.

**Consequences.** One technical cookie, no consent needed. A visitor's choice follows them across the three sites;
a link from the app to the documentation already carries the language in its address. Server code no longer reads
`getUiLocale()` to translate: `requestLocale()` is the installation's language everywhere except in the demo.

## ADR-048 — The public beta starts with the public repository (2026-11-01, owner, Q133)

**Context.** ADR-040 tied the public beta to the release of 0.9.0, made from the public repository of 9.36. The
repository goes public before 0.9.0 (it is needed for the documentation site on GitHub Pages), and from then on the
code, the demo and the home page are open to anyone: calling that state "early development" would undersell it,
calling it 0.9.0 would claim steps still open.

**Decision.** The public beta starts when the public repository is published (9.36). From then on the READMEs carry
the status "public beta" — the features are stable, but until 1.0.0 an update is not guaranteed to stay compatible
with the data and settings of the previous version (no field test or dates named) — with what BiblioViva does
and what it does not do (no OPAC, no cloud for the data of students and teachers — only book data such as the ISBN leave the school —, no fines or holds, no
email, no direct link to the school register, not for large libraries), and Tailscale and the phone described as
optional. The home page ends with a short public-beta notice under the footer. 0.9.0 (9.6) is the first tagged
release of the beta; the plan, the field test (9.10) and the migrations from 1.0.0 (9.37) do not change.

**Consequences.** Problems may be reported on the public repository from the start of the beta; the notice on the home
page and the READMEs' status change again only at 1.0.0.

## ADR-049 — The second copy of the backups goes by default to another disk, any rclone destination allowed (2026-11-01, owner, Q35)

**Context.** The optional `offsite` service (rclone, Q35) copied the backups by default to `gdrive:biblioviva-backups`,
a Google Drive of the school's Workspace, and the guides described that provider. The backups hold the data of
students and teachers, which BiblioViva keeps out of any cloud by default (ADR-048); many schools have another
account (Microsoft 365, a NAS, a server) or none at all.

**Decision.** The default destination is a folder of another disk: compose mounts `OFFSITE_DIR` (a second disk, a USB
drive, a folder of the school's server mounted on the computer) at `/offsite` and `OFFSITE_REMOTE` defaults to
`/offsite/biblioviva-backups`, which needs no rclone configuration. Any destination rclone supports can replace it,
made once with `rclone config` (`./rclone/rclone.conf`) and named in `OFFSITE_REMOTE`; the documentation recommends an
account the school already has, names no provider as the default and sends to rclone's own documentation for the
details. `backup.offsite.remote` in the example configuration follows the new default.

**Consequences.** A school gets a second copy without any account; one that wants it outside the building chooses the
provider and stays responsible for it. The service keeps its name and the backups page its wording ("copia esterna").

## ADR-050 — The documentation site is published by hand only (2026-11-01, owner, Q114)

**Context.** ADR-042 publishes the site at every release; the Pages workflow ran on every published release and by
hand. The build takes every picture from the app and the site is meant to change only when the owner wants it to.

**Decision.** The Pages workflow (`.github/workflows/pages.yml`) has only a manual trigger (Run workflow): the owner
runs it on the release's tag after a release, or on `main` for a correction of the text. No push and no release
publishes the documentation.

**Consequences.** A release does not update the documentation by itself: publishing it is one more step of the
release, written in its checklist (9.6).

## ADR-051 — Language packs: real plural forms, machine translation with a glossary, packs brought in step at the release (2026-11-01, owner, Q136)

**Context.** Step 9.39 publishes 25 language packs with each release. The dictionaries wrote counts in the plural only
("{{count}} students", so "1 students") and a few messages used the old selector `{{n; 1:x; default:y;}}`, which cannot
express the forms Russian, Polish, Czech or Slovenian need. The parser (Curly, in `sveltekit-i18n`) selects by the
locale's plural rules with `{{n:plural; one:…; few:…; many:…; other:…;}}`, but renders an EMPTY text when a form is
missing. The owner chose real plural forms (option B) and left the keyboard layouts and fonts as they are.

**Decision.**
1. Every message that counts things writes the agreeing words as `{{count}} {{count:plural; one:…; other:…;}}`
   (number outside, or the whole phrase in the options with a nested `{{count}}`); the old selectors were converted, and
   a test renders every plural message of English and Italian for 0, 1, 2, 5 and 21. A pack gives every form its
   language uses (`neededPluralCategories`: the categories of the numbers 0–1000; the `many` of Italian, French or
   Spanish only starts at a million); the pack validator refuses a missing form (error) and warns of a message with
   no selector where English has one. Placeholders are compared by name, not by how many times a name appears.
2. Translations are made in chunks of about 200 messages (`bun run i18n:work split` / `merge`), by Haiku with a
   per-language glossary written by Sonnet (`i18n-packs/<code>/glossary.json`), every chunk checked on merge (keys,
   placeholders, plural forms, text left in English, much longer text) and the failing ones redone. A blind pilot of
   Haiku against Sonnet on the 176 messages of the wizard in German, Russian, Hungarian and Japanese found them close
   (of the strings where they differ: Haiku better in 25 %, Sonnet in 35 %, equal in the rest; both with a few real errors
   and an inconsistent terminology without a glossary), so Haiku drafts and Sonnet reads what is flagged. A pack made
   this way says `"translation": "machine"` in `pack.json` and in the release index until a native speaker has read it.
3. Packs live in `i18n-packs/<code>/`, validated in CI (`bun run i18n:status`); the workflow `i18n-packs.yml` attaches
   `biblioviva-i18n-<code>-<version>.zip` and `biblioviva-i18n-index.json` (name, how much is translated, size,
   SHA-256) to the release of every tag `v*` (`bun run i18n:release`). Packs are brought in step at the release, not at
   every commit: `bun run i18n:sync <last tag>` lists the English messages added or changed (and drops the changed ones
   from the packs), `i18n:work split --missing` cuts what is left to translate.

**Consequences.** A change to an English message that is not a typo makes 25 translations stale until the next release;
the index says how much of each pack is translated and missing messages show in English. The 22 packs beyond the three
pilot languages are made the same way. Right-to-left languages stay out.


## ADR-052 — Audit: `minimatch` overridden, one advisory without a fix ignored (2026-11-01)

**Context.** `bun audit` in CI failed on two advisories in build-time dependencies: `minimatch` 10.2.6 (moderate, fixed
from 11.0.1; required by ESLint and typescript-eslint) and `deepmerge` 4.3.1 (low, prototype poisoning in
`mergeObject()`; no patched release exists, 4.3.1 is the last; required by `@sveltejs/vite-plugin-svelte`).

**Decision.** `package.json` overrides `minimatch` to the exact version 11.0.3. The `deepmerge` advisory
(`GHSA-gcqx-w48m-w2h4`) is ignored in the CI step (`bun audit --ignore`): it is not in the shipped image, and the plugin
merges its own configuration, not input from users.

**Consequences.** Remove the override when ESLint and typescript-eslint require `minimatch` 11 themselves, and the
ignore when the plugin leaves `deepmerge` or a patched release appears. New advisories still fail the step.

## ADR-053 — Mermaid draws the diagrams of the documentation at build time (2026-11-06, owner, Q146)

**Context.** `docs/database.md` and `docs/navigation.md` draw the database and the pages as Mermaid blocks. GitHub
renders them, but the documentation site showed them as code. The owner wants well-made ER diagrams in the technical
documentation.

**Decision.** `mermaid` (exact version, a development dependency) draws every ```` ```mermaid ```` block of `docs/` into
an SVG file in the build's browser: `bun run docs:diagrams` (Playwright, Chromium, the documentation's Inter font for
the measures) writes `site/.diagrams/<hash of the code>.svg`, and `site:build` puts each drawing in its page in place
of the code (the code stays where a drawing is missing, with a warning). The Pages workflow runs it before the build.
The site carries no script for the diagrams and loads nothing from elsewhere. A unit test keeps the diagrams of
`docs/database.md` in step with `schema.ts` (every table and column drawn, nothing drawn that does not exist).

**Consequences.** One more development dependency with its own dependencies (none of it in the image). A diagram
changed in the Markdown is drawn again by the next `docs:diagrams`; the files are not committed.

## ADR-054 — No workflow starts by itself; `latest` goes to the highest stable release (2026-11-07, owner)

**Context.** `ci` ran on every push and pull request, `publish` on every push to `main` and every tag, `nightly` every
night and on every tag, `i18n-packs` on every tag. `bun run ci` already runs the same checks on the developer machine
before a push, and the rest only matters at a release or when the demo needs a new image. The `latest` tag was added by
the metadata action's default to any stable tag, even an older one run again.

**Decision.** Every workflow has only a manual trigger (Run workflow): `ci`, `publish`, `i18n-packs`, `pages`, and
`slow` (the former `nightly`: the visual snapshots, the slow suites and the audit). `bun run ci` is run locally before
every push. The coding agent says when one of them is needed (the `main` image for the demo after a push, `publish`,
`i18n-packs`, `pages` and `slow` at a release, `ci` for a check on a clean machine) and asks the owner before starting
it; it never starts one unasked. `publish` sets `latest` only when it runs on the highest stable tag `vX.Y.Z` of the
repository (`flavor: latest=false` plus an explicit rule), so a pre-release or a tag run again never takes it.
`i18n-packs` refuses to run outside a tag.

**Consequences.** A push builds nothing: the demo's `:main` image is as old as the last run of `publish` on `main`. The
release checklist (9.6) lists the runs: `publish`, `i18n-packs`, `pages` (and `slow`) on the tag.

## ADR-055 — Accessibility target WCAG 2.2 AA (2026-11-07, owner, Q147)

**Context.** An Italian state school is a public administration: Legge 4/2004 and the AgID guidelines require the
requirements of EN 301 549 v3.2.1, i.e. WCAG 2.1 AA, also for applications used on an intranet, and an employee with a
disability must be able to work with the tools of the job. EN 301 549 v4.1.1, published in 2026, moves to WCAG 2.2.
The study `docs/studies/adoption.md` measured the gap.

**Decision.** BiblioViva, its documentation site and its home page target **WCAG 2.2 AA** (which includes 2.1 AA).
`docs/accessibility.md` is the conformance page: the target, how it is tested, what is met, the known limits. The
open gaps are step 9.54. Required fields carry an asterisk after the label, read as «obbligatorio», explained by one
line above the form (the default taken for Q147).

**Consequences.** Every new screen is built to 2.2 AA: keyboard alternatives to dragging, visible focus not hidden by
the sticky bars, targets of at least 24 px, the help in the same place, no cognitive test at login. The contrast test
covers the field tokens; axe runs on more states. The manual checks (screen readers, zoom) are repeated before each
release that changes the screens.

## ADR-056 — `publiccode.yml` for the Developers Italia catalogue (2026-11-07, owner, Q148)

**Context.** Administrations choosing software must consider open-source and reusable solutions (CAD art. 68–69);
they look in the Developers Italia catalogue, filled by a crawler from the `publiccode.yml` file of public
repositories.

**Decision.** The repository carries a `publiccode.yml` (standard version `0`) with descriptions in Italian and English
in the documentation's plain tone, checked by a unit test against the standard's mandatory keys and limits. The
release checklist sets its `softwareVersion` and `releaseDate`. The owner registers the repository on Developers Italia
once it is public (9.36).

**Consequences.** One more file to keep in step with the README when BiblioViva changes what it does.

## ADR-057 — BiblioViva installed natively on desk computers (2026-11-07, owner, Q149)

**Context.** BiblioViva ran only as containers: on Linux hosts, and on Windows through Docker Desktop (ADR-038), which
needs virtualization enabled in the BIOS (often locked on school PCs), a WSL 2 virtual machine that users report at
1.5–3 GB of memory even idle, and a signed-in user. The owner asked for an installable program with the least use of
the computer's resources. The study `docs/studies/installable.md` built a prototype: `adapter-bun`'s `compile` option
puts the Bun runtime, the server and every page asset in one executable (133 MB on Linux, 139 MB on Windows, about
50 MB compressed), cross-compiled from Linux, which starts with 70 MB of memory and serves the app as the container
does.

**Decision.** BiblioViva is also shipped as **one executable per system** (step 9.56; targets
`bun-windows-x64-baseline`, `bun-linux-x64-baseline`, `bun-linux-arm64`). On **Windows** an NSIS installer puts it on
the PC with `yaz-client.exe` and runs it as a **Windows service** (WinSW) from start-up (9.57); Docker Desktop is no
longer a supported path. On **Linux** an **AppImage** serves a desk computer (9.58), and a **Debian package** with a systemd service a dedicated
computer, a Raspberry Pi or a Linux PC, without Docker (9.62); neither updates itself, a notice says that a release
exists (9.60), and no APT repository is built. **macOS is not supported:** the
executable cross-compiles for it, but a program that macOS accepts needs Apple's signing and notarization (a yearly
fee), a launchd service, its own `yaz-client` and a Mac to test on, for a platform few Italian school libraries use. The window is the browser in app
mode (Edge on Windows, Chrome or Chromium when present on Linux, otherwise the default browser): `http://localhost` is
a secure context, and the web manifest already lets it be installed as an app. **No Tauri** (it adds a web view of its
own and a Rust toolchain, and saves no memory), **no Electron** (a bundled Chromium and an unused Node), **no Flatpak**
(Flathub accepts neither console software nor prebuilt binaries). The advised host: the package of its system when the
library has one computer; a dedicated computer that stays on, with Docker or the Debian package, when several computers use BiblioViva or it
must answer while the desk computer is off (in a library with Windows PCs only, the installer on the PC that stays on).
The container image and the Debian package are the ways for servers and the Raspberry Pi.

**Consequences.** The code stops assuming a container: no `execve` and no cgroup limit at start (the hardware profile
sets the heap), no symbolic links, renames safe on Windows, default folders per system, `BV_PACKAGE` naming the package
the app runs in. The unit tests run on a Windows runner too, and each executable has a smoke test. NSIS, WinSW, YAZ for
Windows and `appimagetool` are build inputs, not packages of `package.json`; their versions are pinned in PLAN.md §2.6.
The installer is unsigned until the SignPath Foundation signs it (Q150, 9.61). The setup guide gains the `windows-*`
and `appimage-*` paths, and `choose-computer.md` the choice of host.

## ADR-058 — The backups folder is a setting in the native packages (2026-11-07, owner, Q151)

**Context.** In the container the backups go to the `/backups` volume, the folder `./backups` beside the compose file,
and the optional `offsite` service copies them elsewhere with rclone (1.9, 9.35). A native package has no compose file
and no second container, and rclone would be one more program to explain to a school.

**Decision.** In a native package the operator chooses the folder of the automatic backups in Configurazione → Backup
(`backup.dir`: a second disk, a USB drive, a network folder), checked before it is saved; `backupsDir()` returns it
when set and `BACKUP_DIR` otherwise, and stays the only place that knows the folder. The field is not shown in the
container, where the folder is the volume. The Amministrazione page shows a reminder, "Backup da configurare", while no
folder has been chosen or confirmed in a native package, or, in every installation, while the folder cannot be written
or the last automatic backup failed. The `offsite` service stays with the container.

**Consequences.** A backup on a USB drive depends on the drive being plugged in at the time of the backup: the reminder
says so when it is not. The backups made before a change of folder stay in the old folder. The setting is a path of one
computer, so the configuration archive treats it as a part an import on another computer can leave out (9.59).

## ADR-059 — A documentation section for the rules, with a PDF (2026-11-08, owner, Q154)

**Context.** A state school is a public administration: before adopting BiblioViva its head teacher, DSGA, DPO and
Responsabile per la transizione digitale must know what data protection, accessibility, the CAD and the ICT security
rules ask, and what BiblioViva does about each (`docs/studies/adoption.md`). Those facts were spread over technical
pages in English and a study.

**Decision.** A sixth section of the documentation, **Norme** (`docs/<lang>/compliance/`, `/<lang>/compliance/`),
between Aiuto and Tecnica, written by the method of 9.5 with a kind of page of its own (what the rule asks, what
BiblioViva does, what the school does, ready texts, references to the official texts). The whole section is also one
PDF per language, printed by Chromium (`bun run docs:pdf`, Playwright on the built site) from a print page that
`site:build` writes, and published with the site by the Pages workflow; the section's first page links it. The home
page sums the section up after the part on the data that stay at school. The technical conformance page
`docs/accessibility.md` stays in Tecnica, linked from the section.

**Consequences.** Every change that alters a fact of these pages (what is stored, what leaves the school, the
security measures, the exports) updates them in both languages, as any other page. The PDF is not committed: it is
built with the site. No new dependency (Playwright is already the tool of `docs:shots` and `docs:diagrams`).

## ADR-060 — The installation questions; Docker advised with Tailscale (2026-11-11, owner, Q158)

**Context.** With the native packages (ADR-057) the installation has many paths: the Windows installer, the
AppImage, the Debian package and Docker, each with Tailscale or the local network. A table of paths and two pages of
comparison ask the reader to understand all of them before choosing one.

**Decision.** The first page of Installazione asks the questions one at a time, as selects that open when the
previous one has its answer, and composes the path from the answers: the package, the network, the profile, what
works, the steps with an estimated time, what is needed and the way to install. On a dedicated Linux computer the
method is a question for experts with the advised answer chosen in advance: Docker with Tailscale, because the
compose file with the Tailscale container is ready and shown to copy, as many projects show theirs; the Debian
package on the local network, where no sidecar is needed. The logic is a TypeScript module of `scripts/` with unit
tests, bundled by the site build; the flow is drawn in the technical page `docs/install-choices.md`.

**Consequences.** The site carries a second small script (the first is the search). The Docker files shown are read
from `docker/` at each build, so they never drift from the repository. A path whose page does not exist yet (the
native packages before 9.57, 9.58 and 9.62) is shown with its steps and a note that its guide is being written. A
change of the paths, the steps or the advice updates `logic.ts`, its tests and `docs/install-choices.md`.
