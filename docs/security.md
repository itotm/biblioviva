# Security

BiblioViva is a staff-only application for a school library whose patrons are mostly minors. This
page records how the checklist of PLAN.md §3.15 is met, where each measure lives in the code and
which test keeps it in place (review of step 9.1). It is for maintainers; the school's
administrators find the operational part in the setup guides.

## Exposure

- **Network.** The app port is never published: in `docker/compose.yml` the app shares the network
  namespace of the Tailscale sidecar (`network_mode: service:tailscale`), which serves HTTPS on the
  tailnet only; Funnel is disabled in `docker/tailscale/serve.json` (`AllowFunnel: false`). Only
  the devices of the school's tailnet reach it.
- **Public demo.** The one installation on the internet is the public demo (`docs/demo.md`,
  `DEMO_PUBLIC=1`, a Cloudflare Tunnel): synthetic data only, accounts and password shown on the
  login page, rebuilt at every start and every night. Its guard refuses every configuration write,
  backups and restores, class pictures, SQL reports and large imports; what a visitor sends (text,
  pictures, import files) is replaced by an example in the services, so no visitor's content
  reaches another (`#lib/server/demo/content.ts`, ADR-035); metadata lookups use the
  mock provider (no outbound calls); writes, heavy downloads and new notes are limited per visitor
  address (`Cf-Connecting-Ip`), which is kept in memory only, never in the sessions or the audit
  log; nothing is indexed.
- **Container.** The image runs as the unprivileged `bun` user (`USER bun`), with a read-only root
  file system (`read_only: true`), `no-new-privileges` and every capability dropped; only the three
  volumes (`/config`, `/data`, `/backups`) and a tmpfs are writable.
- **Unauthenticated routes.** `/login`, `/healthz`, the static assets under `/_app/` and `/setup`
  while no account exists (`PUBLIC_PREFIXES` in `src/hooks.server.ts`); everything else redirects
  to the login page. Media (photos, covers, pictograms, template images) need a session too.

## Authentication and authorisation

- **Sessions.** Random tokens stored hashed (`#lib/server/auth/session.ts`); the cookie is
  `HttpOnly`, `SameSite=Lax`, `Secure` whenever the request came over HTTPS (always behind the
  Tailscale sidecar), with the lifetime of `security.sessionDays`. A deactivated account or a
  changed password ends its sessions.
- **Basic local-network mode** (step 8.8, `compose.lan.yml`). Plain HTTP on the school network:
  passwords and session cookies travel unencrypted there, the camera and the app installation are
  unavailable, nothing is reachable from outside. The front on `LAN_PORT`
  (`#lib/server/runtime/lan-front.ts`) replaces the `X-Forwarded-*` headers a client sends, so
  the scheme, the origin of the CSRF check and the address of the rate limiter cannot be forged.
  Offered for schools that refuse Tailscale; `docs/deploy.md` tells them to prefer the full mode.
- **Passwords.** argon2id (`Bun.password`), memory from the hardware profile. Staff accounts are
  edited from Administration → Staff accounts (step 11.7): the server hashes the new
  password and only the hash is written in the configuration.
- **Login rate limit.** Failed attempts are counted per client address and per username
  (`security.loginMaxAttempts` in `security.loginWindowMinutes`); a success resets both.
- **Permissions, not roles.** Every remote function calls `requireUser('<permission>')` first
  (`src/lib/remote/guards.test.ts`, static check of every `*.remote.ts`); every endpoint
  (`+server.ts`) and every admin or print page loader asks for a permission itself
  (`src/lib/remote/routes-guard.test.ts`), besides the redirect of the hook. The last active
  account holding `admin` can never be removed or demoted.
- **CSRF.** SvelteKit's origin check with no trusted extra origin (`csrf.trustedOrigins: []`);
  remote commands and forms are POST only.

## Headers

Set in `src/hooks.server.ts` and by SvelteKit (`csp` in `vite.config.ts`), checked by
`tests/e2e/security.spec.ts`:

- `Content-Security-Policy`: `default-src 'self'`; scripts from this origin with SvelteKit's nonce,
  `wasm-unsafe-eval` for the barcode reader and OpenCV, `unsafe-eval` for OpenCV.js (ADR-016);
  inline styles; images from this origin, data and blob URLs; connections (`fetch`) to this
  origin only (`connect-src 'self'`); `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'self'`. The e2e test visits the main pages and fails on any policy violation
  reported by the browser.
- One violation is expected, on purpose: when OpenCV.js loads (cover capture), it first tries to
  `fetch()` the WebAssembly embedded in its own file as a `data:` URL; `connect-src 'self'` blocks
  it (one console error, Chromium and Firefox) and the build decodes the base64 itself, which
  works everywhere. Allowing `data:` would open no way out of the page (a `data:` URL reaches no
  server) and silences the error, but Chromium's `fetch(data:)` is slower than the JavaScript
  decoding: measured, about +50 ms on a desktop and +200 to +375 ms with a
  4× slower CPU (a phone), Firefox about 20 ms faster (ADR-022). The cover e2e test
  (`tests/e2e/cover.spec.ts`) fails on any other violation during the OpenCV load.
- Any SVG response (pictograms, barcodes, placeholders, template images) gets its own
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`: opened on its
  own it runs nothing.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: same-origin`,
  `Permissions-Policy: camera=(self), microphone=(), geolocation=()`, and
  `Strict-Transport-Security` when served over HTTPS.

## Uploads and files

- **Images** (photos, covers, logo, pictograms) are decoded with a pixel cap (40 million) and
  re-encoded (JPEG/WebP or PNG); metadata such as EXIF/GPS is dropped; what is not an image, or
  claims huge dimensions, is refused (`src/lib/server/images/upload-fuzz.test.ts`: SVG with a
  script, HTML, random bytes, a PNG bomb of 60 000 × 60 000).
- **Template assets** are checked by content (PNG, JPEG, WebP, GIF signatures; SVG without
  `<script>`; fonts by extension), 5 MB at most, and served with the SVG sandbox above.
- **Archives** (configuration, language packs, full exports): the central directory is read before
  anything is inflated; absolute paths, `..`, backslashes, drive letters, symbolic links, unknown
  files and the history are refused; size and file-count limits; everything is unpacked into a
  staging folder under `DATA_DIR/tmp` and checked before it is applied.
- **CSV.** Imports read cells without control characters and apply the length caps of the forms
  to every text column (`#lib/shared/text-limits.ts`, the reason `tooLong`); the name of an
  uploaded file is reduced to letters, digits, `.`, `-` and `_`, 100 characters at most. Exports
  put a `'` before a text that a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab,
  carriage return), numbers stay numbers, and the imports drop that `'` again
  (`#lib/server/export/csv.ts`, `#lib/server/imports/csv.ts`).
- **Paths** from the browser (backup names, template names, asset names, report ids) are matched
  against strict patterns before they touch the file system.

## Reports

Report SQL runs on a separate read-only connection (`mode=ro`, `PRAGMA query_only`), after a
static check that allows one `SELECT`/`WITH` statement, no write or administrative keyword, only
declared `:name` parameters (`src/lib/server/reports/safety.ts`); values are always bound, never
concatenated; uploaded definitions are also compiled against the database before they are
installed. Tests: `safety.test.ts` (hidden second statements, case and comment tricks, quoted
keywords) and `run.test.ts` (an injection attempt in a text parameter changes nothing; the
connection refuses writes even if the check were bypassed).

## Privacy

Names, photos and card numbers are never logged; the audit log records accounts and ids, not
personal data; exports, backups and archives stay on the school's server unless an administrator
downloads them. Removing a patron anonymizes it at once and for good. Seed and test data are
synthetic.

## Secrets

Secrets live only in environment variables declared in `src/env.ts`, never in the configuration
folder or the repository: the Tailscale auth key (compose file) and, when the Google Books
providers are enabled, `GOOGLE_BOOKS_API_KEY` (step 9.1 moved it out of `metadata`; a key left in
`config.json` is ignored with a warning). The configuration archive and the backups never carry
them.

## Dependencies

Every dependency is pinned to an exact version (`bun.lock` committed); `bun audit` runs in the CI
workflow.

## Known trade-offs and future work

- `unsafe-eval` in the script policy exists only for OpenCV.js; running OpenCV in a dedicated
  worker with its own policy would allow dropping it.
- The Tailscale network is the perimeter: the app does not try to resist a compromised device of
  the tailnet beyond authentication and permissions.
