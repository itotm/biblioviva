# BiblioViva

<p align="center"><img src="docs/reference/branding/biblioviva-logo.png" alt="BiblioViva" width="360"></p>

> Lean, self-hosted library management for school libraries.
> Italiano: [README.it.md](README.it.md)

**Status: public beta.** The features are stable, but until version 1.0 an update is not guaranteed to stay compatible
with the data and settings of the previous version. The full specification lives in [PLAN.md](PLAN.md).

- Website: [biblioviva.org](https://biblioviva.org)
- Demo with sample data, reset every night: [demo.biblioviva.org](https://demo.biblioviva.org)
- Documentation: [docs.biblioviva.org](https://docs.biblioviva.org/en/) (manual, administration, installation, help,
  technical)

BiblioViva is a web application for the staff of a school library (up to about 10 000 books and 1 000 patrons).
It borrows the good ideas of [Koha](https://koha-community.org/) — bibliographic records separate from physical copies,
circulation rules, a calendar of closed days — and leaves out everything a school does not need. It runs as a single
container on a computer at the school, stores its data in one SQLite file, and is used from the browser of any
computer, tablet or phone on the school's network.

## What it does

- **Cataloguing in seconds**: read the ISBN with a USB barcode scanner, fetch the record from the Italian national
  catalogue (OPAC SBN, Z39.50, UNIMARC), get the cover by itself (or take a photo of it, automatically straightened),
  print barcode labels and spine bands.
- **School-library classification**: fiction by genre (fairy tales, mysteries, adventure…) with an optional class level
  for primary schools; non-fiction with a very simple taxonomy of one or two levels. Every genre and class has a pictogram.
- **Patrons**: students and teachers, organised by class (multi-year classes too). Cards with barcode, ID photos taken
  on the census page or cut out of a class picture, card printing from HTML templates (front and back side by side,
  ready to fold), CSV import from the school register with a start-of-year synchronisation, one-click class upgrade,
  immediate anonymisation of students who leave.
- **Circulation desk**: scan the card (or search by surname), scan the books, done. Renewals, configurable loan
  periods, weekends and holidays, overdue lists per class and printed reminders.
- **Print lists**: build lists of patrons or books from anywhere in the UI (search, class, selection, scanning) and
  print cards or labels from them.
- **Stocktaking**: scan the books on the shelf and BiblioViva tells you which are missing.
- **Reports and statistics**: predefined SQL reports defined in JSON files (extensible), charts, CSV and ODS export
  of every table.
- **Backup and restore**: a daily copy of the database, photos and covers into a folder that can live on a second
  disk or a USB drive, and an optional second copy with rclone (for example on the school's server); one archive with everything to download; restore from the first-run wizard too.
- **Everything is set from the administration pages**: loan rules, calendar, classes, barcode formats, card and
  label templates (with a visual editor), accounts and permissions; the configuration is exported and imported as one
  archive.
- **Multilingual** interface (Italian and English included, other languages with a translation pack), chosen once for
  the whole installation.

## What it does not do

- **No public catalogue (OPAC)** and no access for students or families: BiblioViva is for the library staff only.
  There are no patron accounts, holds or online requests.
- **No cloud for the data of students and teachers**: they stay on the school's computer, with the backups. No account
  with the project, no subscription, no usage statistics sent anywhere. Only book data leave the school: the ISBN (or
  title and author) being looked up, sent to OPAC SBN to fill in the record and to Amazon and Open Library for the
  cover (each source can be switched off).
- **No fines and no holds**, by design: a school does not need them.
- **No email or SMS**: overdue reminders are printed and handed out in class.
- **No direct link to the school register**: students and teachers are imported from a CSV file exported from it.
- **Not a system for large libraries or professional cataloguing**: one library per installation, a record with a
  few essential fields (no full MARC), no acquisitions, serials or interlibrary loans. Catalogues are imported from
  CSV (Koha included), not from UNIMARC files.

## What you need

- **A computer that stays on** while the library is open: an old PC with Linux is fine (the Windows path with Docker
  Desktop is in preparation); otherwise a Raspberry Pi 4 or 5 with at least 2 GB.
- **A USB barcode scanner**: the normal reader for cards, books and ISBNs; it types like a keyboard.
- **A printer** for labels, cards and reminders.

Optional:

- **Tailscale** (free account): gives BiblioViva an HTTPS address, use from a phone with its camera and access from
  outside the school. Without Tailscale BiblioViva is used from the school's network (`http://biblioviva.local:8080`)
  with every feature except the camera and access from outside; you can move to Tailscale later without losing data.
- **A phone or a tablet**: reads barcodes and takes photos and covers with its camera (it needs Tailscale, because
  browsers grant the camera to HTTPS pages only). Everything can be done without one: with the USB scanner or with pictures
  uploaded from a file.

## Installation

The step-by-step guide is the Installation section of the documentation,
[docs.biblioviva.org/en/install](https://docs.biblioviva.org/en/install/) (Italian:
[docs.biblioviva.org/it/install](https://docs.biblioviva.org/it/install/)). On a Linux computer
one command installs Docker when missing, asks a few questions (Tailscale or the local network, how powerful the
computer is) and starts everything:

```bash
curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang en
```

The same command, run again, updates BiblioViva. The technical notes (volumes, compose, Podman, off-site backups) are in the
[Technical](https://docs.biblioviva.org/en/tech/) section: [deployment](https://docs.biblioviva.org/en/tech/deploy/) and
[settings](https://docs.biblioviva.org/en/tech/config-reference/).

```yaml
# docker/compose.yml (excerpt, through Tailscale) — works with docker compose and podman compose
services:
  tailscale:
    image: docker.io/tailscale/tailscale
    hostname: biblioviva          # → https://biblioviva.<tailnet>.ts.net
    environment:
      - TS_AUTHKEY=${TS_AUTHKEY}
      - TS_SERVE_CONFIG=/config/serve.json
    volumes: [ts-state:/var/lib/tailscale, ./tailscale:/config:ro]
  app:
    image: ghcr.io/itotm/biblioviva:latest
    network_mode: service:tailscale
    volumes:
      - ./config:/config          # configuration, report definitions, print templates, pictograms
      - app-data:/data            # SQLite database, photos and covers, imported files
      - ./backups:/backups        # daily backups and the copy of the photos and covers
```

- The variant without Tailscale is `docker/compose.lan.yml`: the application alone, on port 8080 of the school's
  network.
- The database is backed up automatically every day into `./backups`, a plain folder beside the compose file:
  that is what you copy off-site (or keep on a second disk).
- With Tailscale, MagicDNS and HTTPS certificates must be enabled on the tailnet. In neither case is a port exposed to
  the Internet.

## Technology

Bun · TypeScript · SvelteKit 3 (remote functions) · Svelte 5 (runes) · Tailwind CSS 4 · Skeleton · SVAR DataGrid ·
Lucide icons · Drizzle ORM on `bun:sqlite` · sveltekit-i18n · Playwright and Vitest. One OCI image for `linux/amd64`
and `linux/arm64`. Details and pinned versions in [PLAN.md §2](PLAN.md#2-technology-stack).

## Development

```bash
bun install                 # Bun ≥ 1.4.4; exact versions pinned in package.json
bun run dev                 # http://localhost:5173, also reachable from the LAN: http://<pc-ip>:5173
bun run ci                  # lint, type-check, unit, component and e2e tests (Chromium)
bunx playwright install firefox webkit   # once: Firefox and WebKit for manual checks and test:browsers
bun run build && bun run start
```

From a phone on the same network the camera flows need HTTPS (browsers refuse `getUserMedia` on a plain
`http://<ip>` origin): test them through Tailscale `serve` or the deployed container; everything else works over plain
HTTP.

The first start opens the setup wizard (language, colours, library name, school and classes, staff passwords, optional
demo data). Local data lives under `./local/` (ignored by git).

### Commands

| Command | What it does |
|---|---|
| **Application** | |
| `bun run dev` | Development server on http://localhost:5173 (reachable from the LAN too) |
| `bun run demo` | The public demo locally (`local/demo/`, port 5174): sample data, language switch |
| `bun run build` / `bun run start` | Builds the application and starts the built server (`bun --smol` when the profile asks) |
| `bun run dev:reset --yes` | Starts over as on the first run: removes the database, backups, configuration, logo and history |
| `bun run db:seed` | Keeps the configuration and fills an empty database with synthetic data |
| **Checks and tests** | |
| `bun run ci` | Everything CI checks: lint, types, unit and component tests, end-to-end |
| `bun run check` / `bun run lint` / `bun run format` | Type check, style and lint, automatic formatting |
| `bun run test` / `bun run test:watch` | Unit and component tests (Vitest) with coverage / in watch mode |
| `bun run test:e2e` | End-to-end tests (Playwright, Chromium, computer and phone) |
| `bun run test:browsers` | Component and end-to-end tests on Chromium, Firefox and WebKit (on demand, required before 1.0) |
| `bun run test:report` | Rewrites `test-reports/index.html`: summary and links to the HTML reports |
| `bun run ui:audit` | Finds repeated sets of Tailwind classes that belong in one component |
| **Configuration and data** | |
| `bun run config:check [config.json] [--explain key]` | Checks the configuration folder without starting the server; `--explain` tells which file defines a key |
| `bun run config:export [file] [--only\|--except parts]` | Exports the configuration as an archive |
| `bun run config:import <zip> [--only\|--except parts] [--yes]` | Imports an exported configuration |
| `bun run backup:restore <zip\|db> [--only\|--except parts] [--yes]` | Restores a backup or a full archive |
| `bun run auth:hash-password` | Hashes a password for `security.users` |
| `bun run patrons:import-photos <folder\|zip> [--replace]` | Imports the patron photos exported from Koha (one file per card number) |
| `bun run classification:import-images <folder>` | Imports the library's existing pictograms, one per classification code |
| `bun run i18n:check <folder>` | Checks a language pack against English |
| **Book lookup** | |
| `bun run yaz:image` | Builds the `biblioviva-yaz` image with `yaz-client` once, when it is not installed |
| `bun run z3950:test <isbn>` | Tries the Z39.50 lookup on OPAC SBN from the terminal |
| `bun run metadata:test <isbn\|"title"> [sources]` | One lookup through every enabled source, with each one's outcome |
| **Website and documentation** | |
| `bun run home:build` / `bun run home:serve` | The biblioviva.org home page into `home/dist/` and a zip / served on http://localhost:5176 |
| `bun run docs:shots` | The documentation's screenshots, taken from the app (into `site/.shots/`) |
| `bun run site:build` / `bun run site:serve` | The documentation site into `site/dist/` / served on http://localhost:5175 |
| **Container** | |
| `bun run docker:build` / `bun run docker:build:multi` | Local image (Podman) / multi-architecture image |
| `bun run deploy:check <address>` | Checks an installation over the network: health, HTTPS and certificate, headers, login page |
| **Generators** (after a change to their source) | |
| `bun run db:generate` / `bun run db:migrate` | Regenerates the single migration from the schema / applies it |
| `bun run themes:generate` | The colour sets in `src/lib/themes/` |
| `bun run pictograms:generate` | The spine-band pictograms shipped with the app |
| `bun run templates:shipped` | The record of the shipped print templates' versions |
| `bun run i18n:locales` | The list of languages from the dictionary folders |
| `bun run deps:generate` | The library inventory of the About page |

**Trying the ISBN lookup.** The lookup runs `yaz-client` (Z39.50). If it is not installed on your machine
(`dnf install yaz`, `apt install yaz`), run it from the small container of `bun run yaz:image`:

```bash
YAZ_CLIENT=$PWD/scripts/yaz-client.sh bun run dev   # the app calls yaz-client through the container
```

Without network access, `METADATA_PROVIDER=mock bun run dev` answers with six synthetic records instead of OPAC SBN.
Barcodes to scan while testing: the cards and labels printed by the app (Printing, or the patron and record pages), the
sample sheets of Administration → Print templates, and the codes in `tests/fixtures/barcodes/`; a USB scanner works
as a keyboard (set it to the Italian layout or let the app fix `'` for `-`).

Contribution rules for humans and coding agents are in [CLAUDE.md](CLAUDE.md). Problems and proposals:
[GitHub issues](https://github.com/itotm/biblioviva/issues).

## How it is built

BiblioViva is designed and developed with the help of [Claude](https://claude.com) (Anthropic) as a coding agent,
working from the specification in [PLAN.md](PLAN.md) under the rules of [CLAUDE.md](CLAUDE.md). Design decisions,
reviews and every commit are the maintainer's.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).
