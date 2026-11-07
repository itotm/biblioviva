# Deployment notes (technical)

This file collects the operational details for the people who run the container. The
step-by-step installation guide lives in `docs/<lang>/setup/` (step 8.7). Sections
marked *pending* are filled in by the steps of Phase 8.

## Installing, updating, logs (step 8.5)

The step-by-step guide is the Installazione section of the documentation
([`docs/it/setup/`](it/setup/README.md), step 8.7). On Raspberry Pi OS, Debian or Ubuntu, `setup.sh` does the steps
below by itself:

```sh
curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash
```

It asks for the way (Tailscale or the local network), the hardware profile and, with Tailscale, the auth key (or
takes them as `--network tailscale|lan`, `--profile micro|small|medium|large`, `--key <key>`), installs Docker when
missing, writes `~/biblioviva/` (`compose.yml` of the chosen way, `.env`, `config/`, `backups/`, the profile as
`config/performance.json`), starts the stack and prints the address. Run again, it updates; `--network` moves an
installation to the other way, keeping its volumes. By hand, the short version:

1. A 64-bit Linux host that stays on: Raspberry Pi OS (64-bit) on a Raspberry Pi 4/5, Debian or
   Ubuntu, or Fedora. Install Docker Engine with the compose plugin
   ([docs.docker.com/engine/install](https://docs.docker.com/engine/install/)), or use Podman with
   `podman compose`.
2. Prepare the tailnet (see "The stack with Tailscale" below) and create a tagged auth key. Without
   Tailscale, see "Basic local-network mode" below (no camera, no remote access).
3. Make a folder with the stack: `mkdir -p ~/biblioviva/tailscale ~/biblioviva/config
   ~/biblioviva/backups`, copy `docker/compose.yml` there, `docker/tailscale/serve.json` into
   `tailscale/` and `docker/.env.example` as `.env`; fill in `TS_AUTHKEY` and `MEM_LIMIT` (the
   hardware profile). `config/` and `backups/` must belong to uid 1000 (see "Permissions").
4. While the package is private: `docker login ghcr.io` (see "The container image").
5. `docker compose up -d`, then open `https://biblioviva.<tailnet>.ts.net` from a device on the
   tailnet (the first request may take a few seconds while tailscaled obtains the certificate).

**First run.** The app copies its defaults into `/config` (the classification, label stocks, card,
label and slip templates, the Italian language pack as an example) and creates the database in
`/data/db`; the backups go to `/backups`, the folder `backups/` beside `compose.yml`. Without `config.json` it opens the first-run wizard (language, colours, library, the
passwords of the shared accounts, demo data or not), which writes `config.json`. Accounts in
`config.json` with a plain `password` instead of a `passwordHash` work but are listed as a warning
in the log at every start.

**Updating.** `docker compose pull && docker compose up -d`. Database migrations run at start-up;
take a backup first (Administration → Backups → "Back up now") when the release notes mention
them. To stay on a version, set `BIBLIOVIVA_IMAGE=ghcr.io/<owner>/biblioviva:1.2.3` in `.env`.

**Logs.** `docker compose logs -f app` (and `tailscale`). The app logs to standard output only (no
files on the SD card); lines start with the area: `[config]`, `[auth]`, `[startup]`, `[report]`,
`[backup]`. Names, card numbers and photos never appear in the log.

**Diagnostic log.** With `LOG_LEVEL=debug` in `.env` (then `docker compose up -d`) the app writes
`[debug]` lines that let a session be followed step by step:

- `http` — every request: account, method, path (query values only for codes such as `ids` or
  `list`; a search text shows as its length), the remote function called, status, time, and for
  remote functions whether the answer was an error, a redirect or a form refused field by field;
- `error` — every error while serving, with its route and stack;
- `desk` — scans at the circulation desk (card numbers masked), checkouts, renewals and returns
  with their outcome and reason codes;
- `metadata`, `covers` — every lookup and every cover provider tried (ISBN, provider, hits or
  image size, time, error);
- `import`, `backup` — validations, imports, backups and restores with their counts;
- `client:*` — what happens only in the browser: pages opened, script errors, the camera starting
  or refusing, every code read by the camera (`scan`) or typed/scanned into a code field (`code`),
  cover corners found and by which pass, photos and covers taken, the stages of "New book".

No names, photos or card numbers are written: ids, codes, sizes and flags only. Read them with
`docker compose logs -f app | grep debug`; set `LOG_LEVEL=info` again when done.

**Helpers inside the container** (bundled in `/app/cli`, no sources needed):

| Task | Command |
|---|---|
| Hash a password for `config.json` | `docker compose exec app bun cli/hash-password.js` |
| Check the configuration folder | `docker compose exec app bun cli/config-check.js` |
| Restore a backup or an archive (backup, "Export everything", "Export configuration") | put the file in `backups/` beside `compose.yml`, then `docker compose run --rm --entrypoint bun app cli/backup-restore.js /backups/<file> --yes` (app stopped) |
| Export the configuration as one archive | `docker compose exec app bun cli/config-export.js /backups/configurazione.zip`: the file appears in `backups/` beside `compose.yml` |
| Check, then import the configuration of an archive (any of them) | `docker compose cp <file>.zip app:/data/imports/` and `docker compose exec app bun cli/config-import.js /data/imports/<file>.zip` (add `--yes` to import), then reload |
| Reload the configuration without a restart | `docker compose kill -s HUP app` |

**Troubleshooting.**

- *The address does not open*: the device is not on the tailnet (Tailscale app logged in with the
  school's account), or MagicDNS is off in the admin console.
- *The tailscale container restarts with "requested tags [tag:biblioviva] are invalid or not
  permitted"*: the access controls have no `tagOwners` entry for `tag:biblioviva` (and the auth key
  is not tagged). Add `"tagOwners": { "tag:biblioviva": ["autogroup:admin"] }` in the admin
  console's Access controls and create a tagged key; or, for a quick test, join untagged with a
  `compose.override.yml` next to `compose.yml` that sets `TS_EXTRA_ARGS=` for the `tailscale`
  service (the node then belongs to the key's user and its key expires after 180 days).
- *No padlock, or the certificate is not issued*: HTTPS certificates are not enabled on the DNS
  page of the admin console; `docker compose logs tailscale` says so.
- *The camera does not start* (census, covers, scanning with the phone): the page is not on HTTPS;
  use the `https://…ts.net` address, never an IP.
- *The scanner types `'` instead of `-`*: the scanner and the computer use different keyboard
  layouts; the app accepts both, but set the scanner to the computer's layout (Italian) anyway.
- *The app restarts in a loop*: `docker compose logs app` — a volume it cannot write is reported
  with the command that fixes it (see "Permissions"); an invalid `config.json` is reported with the
  file and the key.
- *Forgotten admin password*: in `config/config.json` replace the admin's `passwordHash` with
  `"password": "a-temporary-one"`, reload (`docker compose kill -s HUP app`), log in, then set a real
  hash with `cli/hash-password.js` (or the helper of Administration → Staff accounts) and
  reload again.

## The container image (steps 8.1–8.2)

`docker/Dockerfile` builds a self-contained image: the adapter-bun bundle (no `node_modules`),
the shipped defaults (`config/`) and the migrations (`drizzle/`) under `/app`, `yaz-client` for
Z39.50, user `bun` (uid 1000), volumes `/config`, `/data` and `/backups`, a `HEALTHCHECK` on `/healthz`. The
runtime is `oven/bun:1.4.4-distroless` (ADR-020): no apt and no Debian userland, only
`yaz-client` with the libraries it links and a static BusyBox, both taken from the Debian trixie
packages. About 145 MB on amd64 and 155 MB on arm64, about 64 MB to download.

- A shell for troubleshooting: `docker compose exec app sh` (BusyBox: `ls`, `cat`, `less`, `vi`,
  `ps`, `top`, `df`, `du`, `wget`, `tar`, `unzip`, …). Nothing can be installed in the container;
  `/tmp` is the only writable place outside the volumes.
- Environment set in the image: `PORT=3000`, `HOST=0.0.0.0`, `BODY_SIZE_LIMIT=32M` (see
  Uploads), `CONNECTION_IDLE_TIMEOUT=120`, the forwarded headers (see Reverse proxy and origin),
  `DATA_DIR`, `CONFIG_DIR`, `BACKUP_DIR`, `DATABASE_PATH`. `CONNECTION_IDLE_TIMEOUT` is how many seconds a
  connection may send nothing before the server closes it (adapter-bun, at most 255; Bun's own
  default is 10 s, which cut print sheets a slow host takes longer to start answering, step 9.32);
  the launcher (`cli/start.js`, also `bun run start`) sets 120 when it is missing, and the basic
  local-network front follows the same value. The print sheets and the exports run at most
  `performance.heavyConcurrency` at once and the others wait their turn (`docs/performance.md`), so
  a sheet may wait for another before its first byte: keep the timeout above the longest sheet.
- The server bundle has no source maps: stack traces (`LOG_LEVEL=debug`, area `error`) point to
  `/app/build/server/chunks/<file>.js:<line>`, which is readable (not minified) and starts each
  module with a `// <source path>` comment.

- Local build: `bun run docker:build` (`podman build --format docker …`: the OCI format would drop
  the health check). With Docker: `docker build -f docker/Dockerfile -t biblioviva:dev .`.
- Both platforms at once: `bun run docker:build:multi` builds `linux/amd64` and `linux/arm64`
  into the manifest `biblioviva:multi` (`podman manifest inspect biblioviva:multi`). The build
  stage always runs on the build host's platform, so Bun is never emulated (it crashes under
  QEMU); only the arm64 `apt-get` of the stage that collects YAZ and BusyBox runs under QEMU
  (`qemu-user-static` with binfmt). The arm64 image can be smoke-tested on an amd64 host: `podman run --rm --platform
  linux/arm64 -p 3102:3000 biblioviva:multi` answers on `/healthz`. Under QEMU, BusyBox pipelines
  in `sh` fail with "applet not found" (binfmt does not keep `argv[0]`); on a real arm64 host they
  work.
- Publishing: `.github/workflows/publish.yml` runs by hand only (Actions → publish → Run workflow, ADR-054):
  on a tag `v*` for a release, on `main` for the `:main` image. Each
  platform builds on a native runner (`ubuntu-24.04`, `ubuntu-24.04-arm`) and pushes by digest,
  then one job joins the digests into a manifest list on `ghcr.io/<owner>/biblioviva` with the tags
  `main` (on the branch), and on a tag `sha-…`, `1.2.3` and `1.2`; `latest` goes only to the highest
  stable version tag `vX.Y.Z` of the repository (a pre-release or an older tag never gets it). If arm64 runners are not available
  to the repository, set the repository variable `ARM64_RUNNER` to `ubuntu-24.04`: the arm64 image
  is then built with QEMU for the YAZ and BusyBox stage only.
- While the repository (and so the package) is private, a host must log in before pulling:
  `docker login ghcr.io -u <github-user>` with a personal access token that has the
  `read:packages` scope. Once the package is public no login is needed.

## The stack with Tailscale (step 8.3)

`docker/compose.yml` runs two containers: `tailscale` (tailscaled, the node `biblioviva` of the
school's tailnet) and `app`, which shares the sidecar's network namespace (`network_mode:
service:tailscale`), so it has no published port: it is reachable only through the tailnet, at
`https://biblioviva.<tailnet>.ts.net`. tailscaled serves HTTPS with a Let's Encrypt certificate it
obtains and renews by itself (`docker/tailscale/serve.json`: 443 → `http://127.0.0.1:3000`, Funnel
off; port 80 answers every request with a 301 to `https://biblioviva.<tailnet>.ts.net` and the same
path, so `http://biblioviva/` or a bookmark with `http://` lands on the secure page with the full
name its certificate covers) and forwards `X-Forwarded-Proto`, `X-Forwarded-Host` and `X-Forwarded-For`, which the app
reads (ADR-007). Settings go in `.env` next to `compose.yml` (`docker/.env.example`): the
Tailscale auth key, the memory limit of the hardware profile, the image tag, the off-site remote,
and `GOOGLE_BOOKS_API_KEY` when the Google Books providers are used (secrets never go in the
configuration folder; see `docs/security.md`).

Tailnet prerequisites (admin console): MagicDNS and HTTPS certificates enabled on the DNS page;
`"tagOwners": { "tag:biblioviva": ["autogroup:admin"] }` in the access controls; a reusable,
pre-approved auth key tagged `tag:biblioviva` (Settings → Keys), or an OAuth client with the
`auth_keys` scope. The identity headers tailscaled adds are ignored: staff log in with passwords.

The `app` service is hardened: read-only root file system with `/tmp` in memory, all capabilities
dropped, `no-new-privileges`, `init`, a memory limit (`MEM_LIMIT`: 256m for the micro profile, 512m small,
1g medium, 2g large; the server reads its own profile, `performance.profile`, starts with
`bun --smol` under micro and small and sizes its heap after the container's limit), 35 s to stop gracefully. It starts only once the sidecar is healthy.

```sh
cd ~/biblioviva            # compose.yml, .env, tailscale/serve.json, config/, backups/
docker compose up -d       # or: podman compose up -d
docker compose logs -f app
```

Without a tailnet (to try an image or a change): `TS_AUTHKEY=unused docker compose -f
compose.yml -f compose.smoke.yml up -d` replaces tailscaled with a busybox that answers its health
check and publishes the app on `http://127.0.0.1:3103`.

### Permissions

The app runs as uid 1000. `config/` and `backups/` are bind mounts and must belong to that user:
on Raspberry Pi OS the first user is uid 1000 already; otherwise `sudo chown -R 1000:1000 config
backups`. With rootless Podman the container's uid 1000 is a sub-uid of the host user: `podman
unshare chown -R 1000:1000 config backups`. On SELinux hosts (Fedora and friends) the bind mounts
carry `:Z` in `compose.yml`, `backups/` a shared `:z` because the `offsite` service mounts it too
(Docker ignores both where SELinux is off). When the app cannot write `/config` or `/data` it says
so in the log with the command to run, instead of a bare `EACCES`, and stops; when it cannot write
`/backups` it says so at start and keeps serving, and the backups fail until the folder is fixed.

With Podman, `podman compose` (docker-compose as provider) and `podman-compose` both handle
`network_mode: service:tailscale` (checked with podman-compose 1.6.0 and podman 5.8.7); the fallback is
one pod for both containers or Quadlet units.

## Volumes

| Volume | Env | In the compose files | Contents |
|---|---|---|---|
| `/config` | `CONFIG_DIR` | `./config` | `config.json`, calendars, reports, templates, classification images |
| `/data` | `DATA_DIR` | the named volume `app-data` | `db/biblioviva.db` (+ WAL), `uploads/`, `imports/`, `tmp/` |
| `/backups` | `BACKUP_DIR` | `./backups` | the database copies and the archives of chosen parts (`biblioviva-*.db`, `biblioviva-*.zip`), `uploads/` (the copy of the photos and covers), `offsite.json` |

The backups have a volume of their own, so a data volume removed or damaged does not take them
with it, and they are a plain folder beside `compose.yml` that can be copied without knowing Docker.
`/data` stays a named volume: SQLite's locking needs a local file system that the container owns.
In development the three folders are `local/config`, `local/data` and `local/backups`.

### Backups on a second disk or a USB drive

`backups/` can be any folder of the host: to keep the backups on a second disk, or on a USB drive
that stays plugged in, mount that disk (an `/etc/fstab` line with `nofail`, so the host starts
without it) and point the compose file at it, for example `- /mnt/backup-disk/biblioviva:/backups:z`
instead of `- ./backups:/backups:z` (in `app` and in `offsite`), with the folder owned by uid 1000
(see "Permissions"; a FAT or exFAT drive has no owners: mount it with `uid=1000,gid=1000`). Then
`docker compose up -d`. When the disk is missing the app says at start that `/backups` cannot be
written and keeps serving; the backups resume once the disk is back and the app restarted.

## Backups (step 1.9)

- The app writes a consistent copy of the database with `VACUUM INTO` to
  `BACKUP_DIR/biblioviva-YYYYMMDD-HHmm.db` at the time given by `backup.cron`
  (default `0 3 * * *`, interpreted in `library.timezone`). Copies older than `backup.keepDays`
  (default 30) are deleted after each run; the newest copy is never deleted.
- **Backup at start** (step 9.33, `backup.catchUp`, default `true`): a host switched off at night
  (a desk PC) never reaches the time of `backup.cron`. At start the app works out the last time the
  expression should have fired, in `library.timezone`, and compares it with the newest database
  copy (`.db`, by its modification time) of the backups folder; when that copy is older, it makes
  **one** backup (never one per missed day) a minute after the start, through the same run as the
  scheduled and the manual backup (heavy-job limiter, audit row `backup.create` with
  `scheduled: true, catchUp: true`). The backups page marks it "Made up at start". A folder
  with no database copy at all counts as missed. Nothing happens with the setting off or in the
  public demo, which keeps no backups. Alternatively, move `backup.cron` into the opening hours.
- Administrators can run a backup at any time and download any copy from **Administration →
  Backups** (`/admin/backups`). Every run and download is recorded in the audit log.
- **Photos and covers are mirrored** (step 1.9b): after every database copy the app mirrors
  `DATA_DIR/uploads` into `BACKUP_DIR/uploads` (only new or changed files are copied, files
  that disappeared are removed), so the off-site service below carries the images as well. Imported
  files under `DATA_DIR/imports` are not mirrored (they are the operator's originals, re-importable).
- **Export everything** (`/admin/backups/export`, button "Export everything"): one ZIP streamed on demand
  with `db/biblioviva.db` (a fresh `VACUUM INTO` snapshot), `uploads/**`, `config/**` (the whole
  `CONFIG_DIR`: `config.json`, fragments, label stocks, card and label templates with their images,
  classification images; never `history/`) and `manifest.json` (app version, date, library, counts,
  the parts it holds). Nothing is buffered in memory; the snapshot is deleted once sent. The
  download is recorded in the audit log.
- **One archive format**: every archive the app writes has this layout and holds only the parts
  asked for — "Export everything", a backup or an export of chosen parts, and "Export configuration"
  (`/admin/config/export`, `biblioviva-configurazione-YYYYMMDD-HHmm.zip`: the configuration parts
  under `config/`, no `db/`, no `uploads/`). So any of them can be restored, and any of them can be
  given to "Import configuration". The reader refuses, before writing anything, an archive without
  BiblioViva's manifest, an unsafe path or link, an entry the format does not know, and contents far
  beyond the archive's size.

### Restore

Everything is restored from **Administration → Backups** (step 11.12): "Restore…" on a backup of
the list (a nightly database copy `.db`, or an archive of chosen parts `.zip` made with "Create
backup"), or "Upload an archive" for any archive — "Export everything", "Export configuration", a
backup from another installation — (up to 30 MB through the browser; a
larger archive is copied into `backups/` beside `compose.yml` (`/backups` in the container) with a
name like `biblioviva-YYYYMMDD-HHmm.zip` and chosen from the list). The file is staged in `DATA_DIR/tmp/restore/` and checked first — the parts
it holds with checkboxes (patrons, catalogue and copies, loans and history, print lists, photos,
covers, activity log, the settings of each section, classification, stocks, calendar, reports, card,
pair, barcode, spine and slip templates, language packs, logo), how many rows each data part has
now and in the file, rows that would point at missing patrons or copies (with the part to add), a
database of another version, the configuration problems — and only a clean check is restored:
the data parts in one transaction, photos and covers swapped, the configuration as one change of
the history. The parts not chosen stay exactly as they are. An archive of the configuration alone
offers only its configuration parts.

On a new installation the same archive is restored from the first screen of the first-run wizard
(**Restore from a backup**, step 9.43), only while no configuration has been completed and never
in the public demo: the archive (up to 30 MB through the browser) is staged and checked like the
restore above, it must hold the settings of the library, its accounts, the patrons and the
catalogue and come from the same or an older version, then everything it holds is restored in
one go, the accounts of its configuration are mirrored and the login page opens. A larger archive
is restored from the command line below once the wizard has been completed.

The same from the command line, preferably with the app stopped:
`bun run backup:restore <file.zip|file.db> [--only parts] [--except parts]` prints the check, and
with `--yes` restores. Parts are ids (`data:catalog`, `section:library`, `config:reports`…) or
groups (`data`, `settings`, `config`), for example `--only data --except data:audit`. In the
container, put the file in `backups/` beside `compose.yml` (a backup of the list is already there)
and run the bundled helper:
`docker compose run --rm --entrypoint bun app cli/backup-restore.js /backups/<file> --only data --yes`.

A backup or an export of chosen parts is made from the same page ("Backup or export of some
parts"); `config:export [file] [--only …] [--except …]` writes the archive of the configuration
parts, and `config:import <zip> [--only …] [--except …] [--yes]` checks and imports the
configuration parts of any archive (a backup or "Export everything" too: its database and uploads are
not unpacked; an archive without configuration parts is refused). An import takes only the chosen
parts; the others stay as they are.

### Off-site copies (optional, `offsite` compose profile)

The optional `offsite` service (official `rclone/rclone` image, `profiles: ["offsite"]`) mounts
`./backups` at `/backups`, the folder `OFFSITE_DIR` at `/offsite` and a read-only `./rclone/`, and
runs `rclone sync /backups "$OFFSITE_REMOTE" --min-age 1m` every hour. After every run it writes
`/backups/offsite.json` (`{"status":"ok"|"error","at":"<ISO>"}`), which the backups page shows as
"Last off-site copy"; a result older than 48 hours is flagged. Set `backup.offsite.enabled = true`
(and `remote`, the same destination) in the configuration so the page expects the file. Start it
with `docker compose --profile offsite up -d`.

**The destination is any place rclone can write to.**

- **By default, a folder of another disk**: `OFFSITE_REMOTE=/offsite/biblioviva-backups` with
  `OFFSITE_DIR` in `.env` set to where that disk is mounted on the host — a second disk, a USB drive,
  or a shared folder of the school's server or NAS mounted on the computer (e.g.
  `OFFSITE_DIR=/mnt/copia`). No rclone configuration is needed. The folder must be writable by the
  container (it runs as root; on SELinux hosts the `:z` label is already in the compose file).
- **Any other destination rclone supports** ([the list of
  providers](https://rclone.org/overview/)): the school's server over SFTP or SMB, or a storage
  service the school **already has an account with** (its Microsoft 365 OneDrive, its Google
  Workspace Drive, its Nextcloud through WebDAV, …); nothing requires a particular provider.
  Make the destination once with `rclone config` on any computer, following [rclone's
  documentation](https://rclone.org/docs/) for that provider (`rclone authorize` for the ones that
  log in through a browser), copy the resulting `rclone.conf` into `./rclone/` on the server and
  set `OFFSITE_REMOTE=<name>:biblioviva-backups` in `.env`.

The backups hold the data of students and teachers: a destination outside the school is the
school's choice, under its own account and its own data-protection rules.

## Uploads

`BODY_SIZE_LIMIT` (adapter-bun, default 512K) must be higher than `photos.maxUploadBytes` and
`covers.maxUploadBytes`, otherwise the server refuses large photos before the app can explain why.
The compose file sets `16M`. Photos and covers are re-encoded server-side with `Bun.Image` in `photos.format` /
`covers.format` (JPEG by default, WebP possible; EXIF/GPS dropped) under `/data/uploads/patrons/<nn>/`
and `/data/uploads/covers/<nn>/`; photos are always stored at exactly `photos.width × height`,
cropped at the centre on the server when the browser did not crop them (Koha imports, files the
browser cannot decode). Files written before a format change keep their extension and keep working.

## Resetting an installation (back to the first-run wizard)

Everything the app knows lives in the three volumes. To start over on a deployed container:

1. `docker compose stop app`
2. Remove `/data/db`, `/data/uploads`, `/data/imports`, the content of `backups/` (keep a copy first if in doubt) and
   `/data/demo-data.json`; remove `/config/config.json`, `/config/branding` (the library's logo) and `/config/history` (the other files
   under `/config` are defaults and templates and can stay).
3. `docker compose start app` and open the app: the wizard runs again.

Demo data alone is removed from **Administration → Clear sample data** without touching the configuration.
In development `bun run dev:reset --yes` does the same for `./local/` (`local/backups` included).

## Reverse proxy and origin (step 8.4)

The app is only ever reached through the Tailscale sidecar, which terminates HTTPS and forwards
`X-Forwarded-Proto`, `X-Forwarded-Host` and `X-Forwarded-For`. The container reads them through
adapter-bun's `PROTOCOL_HEADER`, `HOST_HEADER`, `ADDRESS_HEADER` and `XFF_DEPTH=1` (set in the image
and in `compose.yml`); there is no `ORIGIN` variable (ADR-007). Consequences:

- the public origin (`https://biblioviva.<tailnet>.ts.net`) is known per request, so SvelteKit's
  CSRF check works with `csrf.trustedOrigins` empty: a form posted from another site gets 403;
- cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` whenever the request came over HTTPS (always,
  behind the sidecar; not in the basic local-network mode below);
- HTTPS responses carry `Strict-Transport-Security: max-age=31536000` (one year, this host only);
- the client address is the device's tailnet IP: the login rate limiter uses it and the audit
  log records it with every login (`auth.login`, detail `ip`). Reached without the sidecar (for
  example with `compose.smoke.yml`) the address is `unknown`, and the login still works.

The end-to-end tests run with the same headers (see `playwright.config.ts`); the basic
local-network mode below is the only access without the tailnet (Q89).

From any device on the tailnet, `bun run deploy:check https://biblioviva.<tailnet>.ts.net`
checks a deployment: HTTPS with a certificate the client accepts, `/healthz`, the login page, HSTS
and the other security headers, and where an anonymous visit lands (the login, or the first-run
wizard on a new installation).

## Basic local-network mode, without Tailscale (step 8.8)

For a school that does not want Tailscale, `docker/compose.lan.yml` runs the app alone and
publishes it on the host: `http://<address of the host>:8080` from any device of the school
network (`LAN_PORT` in `.env` changes the host port; `TS_AUTHKEY` is not needed). It is plain
HTTP, and browsers keep some features for secure pages only, so this mode is limited:

| Works | Does not work |
|---|---|
| Everything at the desk and in the catalogue with a **handheld barcode scanner** (it types like a keyboard) | The **camera**: scanning with the phone or tablet, patron photos and covers taken with the camera (a file can still be uploaded) |
| Uploads of photos, covers and import files; printing; reports; administration | **Installing as an app** on phones and computers, and the offline cache of the service worker |
| Copying the password hash and report links (the browser's older copy command) | Access from **outside the school** (home, another building): only the local network |

The traffic is not encrypted on the local network (passwords included): use it on a network the
school trusts, and prefer the Tailscale mode as soon as the camera or remote access is needed —
the two modes use the same volumes, so switching is `docker compose -f compose.lan.yml down`
followed by `docker compose up -d` with the Tailscale stack.

```sh
cd ~/biblioviva            # compose.lan.yml, .env, config/
docker compose -f compose.lan.yml up -d       # or: podman compose -f compose.lan.yml up -d
docker compose -f compose.lan.yml logs -f app # "[lan] plain http on port 8080 (basic mode…)"
```

How it works: adapter-bun reads the scheme from `X-Forwarded-Proto` and assumes `https` when the
header is missing, so an app reached directly over HTTP would compute an `https://` origin, refuse
every form through the CSRF check and set a `Secure` cookie the browser drops. With `LAN_PORT`
set (the compose file sets `LAN_PORT=8080` inside the container) the app opens a small front on
that port (`#lib/server/runtime/lan-front.ts`) that stands in for the sidecar: it forwards each
request to the app on `127.0.0.1:3000` with `X-Forwarded-Proto: http`, `X-Forwarded-Host` (the
address the browser asked for) and `X-Forwarded-For` (the device's address, used by the login
rate limiter and the audit log), replacing any value the client sent. Port 3000 is not published.
The front closes a silent connection after `CONNECTION_IDLE_TIMEOUT` seconds, like the app (120 by
default).
The session cookie then lacks `Secure` and no HSTS header is sent, since both follow the scheme.

The installation guide (step 8.7) presents this as the basic option and Tailscale as the full one.

## Shutdown

On `SIGTERM`/`SIGINT` the server drains requests, then the app stops the backup schedule and
closes the database (`sveltekit:shutdown`).

## Public demo (step 9.17)

`docker/compose.demo.yml` runs the public demo (`DEMO_PUBLIC=1`, a Cloudflare Tunnel, the demo
built afresh at every start and every night): never on a school's host. Host, tunnel and
operation are described in [`demo.md`](demo.md).

## Home page and documentation (`biblioviva.org`, `docs.biblioviva.org`)

Two static sites (PLAN.md §3.23, ADR-039); the zone of `biblioviva.org` is registered with Cloudflare
Registrar, so its DNS page is Cloudflare's.

**Home page** (`home/`, `biblioviva.org`): plain files uploaded by hand to Cloudflare Pages; Cloudflare
never sees the repository nor builds anything.

1. `bun run home:build` writes the pages into `home/dist/` and the same files into
   `home/biblioviva-home.zip`; `bun run home:serve` shows them on http://localhost:5176 first.
2. The first time: Workers & Pages → Create → Pages → **Upload assets**
   ([Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)), a project name
   (e.g. `biblioviva-home`), upload the zip, **Deploy site**. Then under **Custom domains** add
   `biblioviva.org` (and `www.biblioviva.org` if wanted): Cloudflare writes the DNS records itself, since
   the zone is on Cloudflare.
3. Every later change: the project → **Create new deployment** → upload the new zip. Each deployment
   replaces the whole site; the earlier ones stay in the list and can be restored with **Rollback**.

A project made by direct upload can never be connected to a repository later, which is the point: the
repository can move (9.36) without touching the home page. [`home/README.md`](../home/README.md) describes the
files.

**Documentation** (`site/`, `docs.biblioviva.org`): published to GitHub Pages by
`.github/workflows/pages.yml`, only by hand: **Actions → pages → Run workflow**, on the release's tag (or on
`main` for a correction of the text); a push never publishes it (ADR-050). The workflow builds the application,
takes the pictures (`bun run docs:shots`) and builds the site (`bun run site:build`). GitHub Pages needs the
repository to be public (step 9.36). One-time setup on GitHub, before the first run (without it the workflow
stops at `configure-pages` with "Get Pages site failed ... Not Found"):
**Settings → Pages → Source: GitHub Actions**, then **Custom domain: `docs.biblioviva.org`** (the
`site/CNAME` file keeps it) and tick *Enforce HTTPS* once the certificate is issued. One DNS record
in Cloudflare, "DNS only" (GitHub issues the certificate only when it sees its own address):

| Type | Name | Value |
|---|---|---|
| `CNAME` | `docs` | `itotm.github.io` |

Check the current instructions in the GitHub Pages documentation before changing the zone.

