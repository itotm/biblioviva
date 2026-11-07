# The public demo (technical)

A public BiblioViva anyone can try at `https://demo.biblioviva.org`, with made-up data, reset every
night (PLAN.md step 9.17, Q111, Q112, Q118, Q119, Q121, ADR-028, ADR-035). It is **never** a school's installation:
a school's BiblioViva stays on its tailnet or local network (`docs/deploy.md`).

## How it works

- `docker/compose.demo.yml` runs two containers: the app with `DEMO_PUBLIC=1` and `cloudflared`,
  the connector of a Cloudflare Tunnel. The connector dials out to Cloudflare, so the host opens no
  port; Cloudflare gives the browser HTTPS (the camera flows need it) and forwards each request to
  `http://app:3000`. Cloudflare ends TLS and sees the traffic in clear, which is acceptable only
  because every datum of the demo is synthetic.
- **Built at every start.** Before the server reads anything, it empties both of its volumes
  (`compose.demo.yml` sets `BACKUP_DIR=/data/backups`, so the only backup the demo makes, the one
  of a class upgrade, lives in the data volume and goes with it; no third volume) and builds
  the demo again as the first-run wizard would: the default school preset in Italian, the five
  wizard accounts with the password `biblioviva`, the demo data of the wizard (patrons, books,
  loans relative to today, notes, the class picture of the photo census), the generic library logo
  (`demo/library-logo.png`). It takes a few seconds. A folder that holds files but not the marker
  `.biblioviva-public-demo` is refused and the server stops: the flag set by mistake on a school's
  volume never empties it.
- **Reset every night.** At `DEMO_RESET_AT` (default `04:00`, on the library's clock
  `library.timezone`) the server ends itself; `restart: unless-stopped` starts it again on a
  freshly built demo. Sessions, notes and every change of the visitors go with it. Whoever is on
  the page then sees a few seconds of "service restarting".
- **What visitors see.** `/login` keeps the usual login card, with a box under it that says what BiblioViva is and what the demo holds, lists the five accounts with what each is for and gives the one password (typed in the form, like anywhere else), and says that text and pictures are replaced by an example; the app's pages carry no band of their own. `robots.txt` disallows everything and every
  response carries `X-Robots-Tag: noindex, nofollow`. The menu and Informazioni show as version
  the time the image was built, `yyyy.mm.dd.hhmm` on the library's clock (`BUILT_AT`,
  `#lib/shared/version.ts`), since the demo follows the main branch; archives and `/healthz` keep
  the release number.
- **The visitor's language** (Q120, ADR-047). The demo opens in the language of the cookie `bv_lang`, else in the
  browser's preferred language among the available ones (Italian and English), else in Italian (`ui.locale`).
  The login page (top right) and the top bar carry a switch, a globe and IT · EN, like the home page and the
  documentation; a click writes the cookie, shared on `biblioviva.org`, and opens the page again. The data stay
  in Italian: the school preset, the classes, the titles and the notes are data, not interface.
- **What is refused** (one guard, `assertNotDemo(feature)` in `#lib/server/demo/public.ts`). A
  refusal is never shown as a failure: it is answered as `403` (`#lib/server/demo/refusal.ts`),
  a notification saying what is off and why on the page that asked, or, for a print sheet or a
  download opened in a tab of its own, a small page with the same words and "Torna a BiblioViva":

  | Feature | Refused |
  |---|---|
  | `config` | every write of `CONFIG_DIR`: settings, staff accounts and passwords, taxonomy, templates, stocks, report definitions, logo, theme, language packs. Every page of Amministrazione opens and can be tried; "Salva" is refused. |
  | `sqlReports` | a report written in SQL is never tried, previewed, uploaded or saved (an endless statement cannot be interrupted, step 9.20). Guided reports run as usual. |
  | `restore`, `configImport` | restoring a backup or an archive; importing the configuration of an archive (any of them: one format). |
  | `backups` | manual backups and archives (the scheduled backups do not run). The class upgrade still takes its backup, one copy at a time. |
  | `pictures` | class pictures, except the two shipped demo class pictures (a scan and a photo), which the census offers (the other pictures are replaced, below). |
  | `importSize` | files to import over 1 MB. |
  | `archives` | downloading an archive or a backup: Esporta tutto, the archive of chosen parts, a stored backup, Esporta configurazione (the archive of the configuration parts); the buttons say so instead of downloading. |
  | `printSize` | sheets of labels or cards that fill more than 3 sheets of paper (`DEMO_PRINT_MAX_SHEETS`), refused before they are rendered: a sheet gives the turn to other requests while it is rendered, but a sheet of every copy would still take seconds of the demo's one CPU and megabytes of its memory from every visitor. |
  | `importExample` | a CSV file of the student, teacher or catalogue import other than the demo's example file. |
  | `notesLimit` | more than `DEMO_NOTES_PER_DAY` (default 5) new staff notes per visitor address and day. |
  | `demoData` | "Svuota dati dimostrativi" (the button is not shown in the demo either). |

  The metadata and cover lookups always use the mock provider (`METADATA_PROVIDER` is forced to
  `mock`): the demo never calls OPAC SBN or the cover sites, so it is never a public proxy to them.
  Changes to the library's data (patrons, books, loans, classes, print lists, inventory) are
  allowed and shared by every visitor until the reset.
- **What is replaced** (Q121, ADR-035): every flow can be tried to the end, but the server never
  keeps the content a visitor sends; `#lib/server/demo/content.ts`, called by the services, puts an
  example in its place, so it holds for a direct call of a remote function too.

  | What the visitor sends | What the demo stores |
  |---|---|
  | a patron photo, a cover photographed or uploaded, the photos of the ZIP import, a pictogram | the demo's placeholder: "DEMO" with the date and time of the save (`placeholder.ts`, a bitmap font of its own) |
  | a cover of a provider, sent back by "Nuovo libro" | the mock provider's cover, fetched again by the server |
  | a staff note | "DEMO – segnalazione del <data e ora>", with the colour and "In evidenza" chosen |
  | a notable date of the calendar: title, note | "Data demo del …", "Nota demo del …"; the days as chosen |
  | a patron's first name and surname; email, external id; notes | names from the fake-name generator; emptied; "Nota demo del …" |
  | a record's title, author, publisher; the other free texts | "Libro demo del …", "AA. VV.", "s.n."; emptied — the values of the mock provider's records stay |
  | a copy's call number, volume, notes | the call number of the configured format; emptied; "Nota demo del …" |
  | names of classes and groups, print lists, inventories; wishes; reasons | "Classe demo del …" (a section of one or two letters or digits stays), "Lista demo del …", "Inventario demo del …", "Desiderata demo del …", "Motivo demo del …" |
  | a shelf typed in the inventory | kept only when it is a shelf of the catalogue |
  | a CSV of students, teachers or the catalogue | only the example file the demo wrote at its start (`DATA_DIR/demo/imports/`, by SHA-256); the template download gives it; the loans import stays free |

  Kept as sent: codes from closed lists, dates, numbers, barcodes and card numbers validated by
  the format table, ISBN, ISSN, EAN, Dewey numbers; a value equal to the stored one. A save that
  replaced something answers with `X-BiblioViva-Demo-Replaced: 1`, and the browser shows "Nella
  demo il testo e le foto vengono sostituiti da un esempio".
- **Limits per visitor address**, on top of the login limiter: 60 requests that write per minute,
  20 exports, archives and print sheets per minute (`#lib/server/demo/limits.ts`); over the limit
  the answer is `429` with `Retry-After: 60`, which a page shows as a notification, or a tab of its own as the page of a refusal ("Troppe richieste"). The address is Cloudflare's `Cf-Connecting-Ip`
  (`ADDRESS_HEADER=cf-connecting-ip`), so the limits count visitors, not the tunnel. The address
  stays in memory for the limits: the demo never writes it in the sessions or the audit log. The container
  runs the `small` profile, limited to 512 MB and 1 CPU as on a Raspberry Pi: the demo behaves
  like a school's usual host (the even smaller `micro` profile is for one slow core and 512 MB). The two
  limits can be changed in `.env` (`DEMO_MEM_LIMIT`, `DEMO_CPUS`).

## Trying it locally

`bun run demo` starts the development server in demo mode on port 5174 with folders of its own
(`local/demo/config`, `local/demo/data`, the backups in `local/demo/data/backups`, rebuilt at every
start), so the development folders are never touched: <http://localhost:5174>.

## Settings

In `.env` next to `compose.demo.yml` (see `docker/.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `TUNNEL_TOKEN` | — (required) | the token of the Cloudflare Tunnel |
| `DEMO_RESET_AT` | `04:00` | daily reset, `HH:MM` on the library's clock |
| `DEMO_NOTES_PER_DAY` | `5` | new staff notes per visitor address and day |
| `DEMO_MEM_LIMIT` | `512m` | memory of the app's container |
| `DEMO_CPUS` | `1` | CPUs of the app's container, never more than the host's `nproc` |
| `BIBLIOVIVA_IMAGE` | `ghcr.io/itotm/biblioviva:latest` | the image; `:latest` is the highest stable release, `:main` the last run of `publish` on the main branch, a version tag pins a release |
| `LOG_LEVEL` | `info` | `debug` for the diagnostic log |

The configuration of the demo itself is not a setting: it is the wizard's, rebuilt at every start.

## The host: an Oracle Cloud Always Free instance (Q119)

1. **Account.** Sign up for Oracle Cloud Free Tier
   ([Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)).
   The home region chosen at sign-up is final, and the Always Free resources exist only there:
   pick one close to the visitors (e.g. Frankfurt, Milan).
2. **Upgrade to Pay As You Go**, staying inside the Always Free resources
   ([Managing account upgrades](https://docs.oracle.com/en-us/iaas/Content/Billing/Tasks/changingpaymentmethod.htm)).
   An Always Free tenancy reclaims an instance that stays idle for a week (CPU at the 95th
   percentile, network and, on A1 shapes, memory all under 20 %); a demo with few visitors is
   idle by that measure. Oracle charges only what goes over the Always Free limits. [VERIFY that
   a paid account's Always Free instances are exempt from the idle reclamation when the demo is set
   up.]
3. **Budget alert.** Billing → Budgets: a monthly budget of 1 € on the root compartment with an
   alert at 100 %
   ([Budgets](https://docs.oracle.com/en-us/iaas/Content/Billing/Concepts/budgetsoverview.htm)),
   so any charge is noticed at once.
4. **SSH key.** On your own computer, if you have none: `ssh-keygen -t ed25519`; the public half is
   `~/.ssh/id_ed25519.pub`.
5. **Instance.** Compute → Instances → Create
   ([Creating an instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm)),
   with image Canonical Ubuntu (the current LTS; the Minimal variant is fine), boot volume 50 GB,
   your SSH public key, and one of the two Always Free shapes:
   - **`VM.Standard.A1.Flex`** (Arm, [Arm-based compute](https://docs.oracle.com/en-us/iaas/Content/Compute/References/arm.htm)),
     2 OCPU and 12 GB, the aarch64 image: the preferred host. The console often says "Out of capacity": try another availability domain, or later
     (a pay-as-you-go account gets capacity more easily).
   - **`VM.Standard.E2.1.Micro`** (AMD, x86_64 image), 1 GB of memory and a fraction of a CPU:
     the host when no A1 capacity is available. The demo runs there with a swap file (below,
     "A 1 GB instance").

   Under Networking: the VCN and its **public subnet** (the wizard's "Create new virtual cloud
   network" makes one; the subnet's page says "Subnet Access: Public Subnet") and **"Automatically
   assign public IPv4 address"** on. The ephemeral public address is part of the free resources;
   leave "reserved public IP" alone.
6. **Why the public address is needed.** The tunnel connects out, but the instance still needs a
   way to the internet: apt, Docker's repository, the image on `ghcr.io` and Cloudflare. The private
   address (`10.0.0.x`) and its name `<host>.<subnet>.<vcn>.oraclevcn.com` work only inside the VCN;
   an instance with only those reaches the internet through a NAT gateway, which is not among the
   Always Free resources. If the instance was created without a public address, add one without
   recreating it: the instance → Networking → the VNIC → IP administration → the private address →
   ⋯ → Edit → Public IP type "Ephemeral public IP"
   ([Public IP addresses](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingpublicIPs.htm)).
   The instance's Details then show it under "Public IP address".
7. **Network.** The VCN's security list
   ([Security lists](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm))
   keeps only the ingress rule for SSH (TCP 22), restricted to your own address (`<your-ip>/32`)
   instead of `0.0.0.0/0`; if your home address changes, SSH stops answering until the rule is
   updated. No rule for 80 or 443. The subnet's route table keeps its rule `0.0.0.0/0` → Internet
   Gateway. Ubuntu's own firewall on Oracle images already rejects everything but SSH; leave it so.
8. **First login and updates.** `ssh ubuntu@<public-ip>`, then
   `sudo apt update && sudo apt full-upgrade -y`,
   `sudo apt install -y unattended-upgrades curl ca-certificates` (security updates applied every
   night; the Minimal image lacks some of these) and `sudo reboot`.

### A 1 GB instance (`VM.Standard.E2.1.Micro`)

1. **Swap**, so that pulling the image and building the demo do not run out of memory:

   ```sh
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   free -h        # "Swap: 2.0Gi"
   ```

2. The default container limits (512 MB, 1 CPU) fit; with several visitors at once the demo is
   slower than on the A1 shape.

## Docker

Install Docker Engine from Docker's repository
([Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/); the page's
convenience script, `curl -fsSL https://get.docker.com | sudo sh`, is enough for the demo), then let
the `ubuntu` user run it ([Linux post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/):
`sudo usermod -aG docker ubuntu`, then log out and in again) and check that it starts at boot
(`sudo systemctl is-enabled docker` says `enabled`).

The image is multi-arch (`linux/amd64` and `linux/arm64`, each built on a native runner,
`docs/deploy.md`): an A1 instance pulls the arm64 one, as a Raspberry Pi does, an E2 instance the
amd64 one. While the package is private, log in first: on GitHub, Settings → Developer settings →
Personal access tokens → Tokens (classic), a token with only `read:packages`
([Working with the Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-with-a-personal-access-token-classic));
on the instance, `docker login ghcr.io -u <github-user>` with the token as the password.

## The tunnel

1. **Domain on Cloudflare.** The tunnel's hostname must be in a zone that Cloudflare manages.
   `biblioviva.org` is registered with Cloudflare Registrar, so its zone and nameservers are
   Cloudflare's already and nothing needs doing. A domain registered elsewhere is added to the
   Cloudflare account first ([Full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)):
   copy its existing records — the GitHub Pages records of the presentation site
   (`docs/deploy.md`) as "DNS only" — and set Cloudflare's nameservers at the registrar.
2. **Tunnel.** Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared, named
   `biblioviva-demo`
   ([Create a remotely-managed tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/)).
   On the "Install connector" page choose Docker and copy only the token (the long string after
   `--token`) into `TUNNEL_TOKEN` in `.env`.
3. **Published application route.** In the tunnel's "Published application routes" tab → "Add a
   published application route" (in the newer dashboard, Networking → Tunnels → the tunnel →
   Routes → Add route → Published application;
   [Routes](https://developers.cloudflare.com/cloudflare-one/networks/routes/)): subdomain
   `demo`, domain `biblioviva.org`, service type `HTTP`, URL `app:3000` (the name of the app's
   container in the compose network). Cloudflare creates the DNS record by itself.
4. Optional, in the Cloudflare dashboard of the zone: Security → Bots → Bot Fight Mode on, and a
   rate limiting rule if the free plan offers one; the app's own limits stay in any case.

Cloudflare sends `Cf-Connecting-Ip` (the visitor's address), `X-Forwarded-Proto: https` and keeps
the public hostname in `Host`
([HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)): the
compose file reads exactly these.

## Starting, checking, updating

The host needs only two files: `compose.demo.yml` and its `.env`. Never the repository, so a
private repository needs no credentials on the host. On the instance:

```sh
mkdir ~/biblioviva-demo && cd ~/biblioviva-demo
cat > .env <<'EOF'
TUNNEL_TOKEN=<the token>
BIBLIOVIVA_IMAGE=ghcr.io/itotm/biblioviva:main
DEMO_RESET_AT=04:00
DEMO_NOTES_PER_DAY=5
DEMO_MEM_LIMIT=512m
DEMO_CPUS=1
LOG_LEVEL=info
EOF
chmod 600 .env
```

(`:main` while no release is tagged.)
From your computer, in the repository: `scp docker/compose.demo.yml ubuntu@<public-ip>:biblioviva-demo/`.
Then, on the instance:

```sh
docker compose -f compose.demo.yml config --quiet   # the file and .env are valid
docker compose -f compose.demo.yml up -d
docker compose -f compose.demo.yml logs -f app      # "[demo] public demo built", "next reset at …"
```

- Check from a phone on mobile data: `https://demo.biblioviva.org` shows the welcome box and
  the accounts; sign in as `prestiti`, lend a book; as `tessere`, the photo census with the demo class
  picture; the next morning, the reset has happened (`docker compose -f compose.demo.yml ps`
  shows the app restarted, `logs app` the build). A name typed for a new patron comes back as a
  made-up one, with the notification that the demo replaces text and pictures.
- **New code of the app** reaches the demo through the image: `:main` is built when the `publish`
  workflow is run by hand on `main` (Actions → publish → Run workflow, `docs/deploy.md`, ADR-054); a push builds
  nothing. When it has finished, `pull` and `up -d` as below.
- **Update to a new release:** set the tag in `BIBLIOVIVA_IMAGE`, then
  `docker compose -f compose.demo.yml pull && docker compose -f compose.demo.yml up -d`. Nothing
  needs migrating: the demo is built again by the new version. When `compose.demo.yml` changes in
  the repository, copy it again with `scp`.
- **Stop:** `docker compose -f compose.demo.yml down` (the volumes can go too, `down -v`: they are
  rebuilt at the next start).
- **When Oracle changes the Always Free allowance:** re-read the
  [Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
  page (A1 OCPU and memory hours, E2 Micro instances, boot volume, idle reclamation); a smaller
  shape still works with a swap file and `DEMO_MEM_LIMIT` and `DEMO_CPUS` lowered.
- Never put the school's data, a school's backup or a real `config.json` on the demo host.

## When it does not work

Check from the inside out; each line says what the symptom means and what to do.

| Where | Symptom | Cause and remedy |
|---|---|---|
| SSH | `ssh` waits and times out | no public address (instance Details, "Public IP address" shows `-`: add the ephemeral one, step 6), or the security list's SSH rule names an old home address (step 7) |
| SSH | `Permission denied (publickey)` | the key given at creation is not the one on your computer: recreate the instance with `~/.ssh/id_ed25519.pub`, or name the right key with `ssh -i <private key>` |
| Instance | `curl`, `apt` or `docker pull` cannot reach the internet | the subnet is private or its route table has no `0.0.0.0/0` → Internet Gateway rule (step 7) |
| Compose | `Range of CPUs is from 0.01 to N` | `DEMO_CPUS` above the host's CPUs: set it to `nproc` or less |
| Compose | `set TUNNEL_TOKEN in .env` | `.env` is missing or not next to `compose.demo.yml` |
| Pull | `denied`, `unauthorized` | `docker login ghcr.io` missing or the token lacks `read:packages` |
| Pull | `manifest unknown`, `not found` | the tag does not exist: `:latest` only after `publish` has run on a release tag, `:main` only after it has run on `main` |
| App | `docker compose -f compose.demo.yml ps` shows `app` restarting, `Exited (137)` | out of memory: on a 1 GB instance add the swap file; `free -h` and `sudo dmesg -T` (lines with "Out of memory") confirm it |
| App | stays `health: starting`, then `unhealthy` | `docker compose -f compose.demo.yml logs app` says why; `cloudflared` waits for a healthy app and does not start before |
| Tunnel | the tunnel shows "Inactive" or "Down" in Cloudflare's dashboard | `docker compose -f compose.demo.yml logs cloudflared`: an invalid token (copy it again, only the string after `--token`), or the app is not healthy yet |
| Browser | Cloudflare error 1033 | the tunnel has no connector running: as above |
| Browser | 502 Bad Gateway | the route's service is wrong: type `HTTP`, URL `app:3000` |
| Browser | `demo.biblioviva.org` does not resolve | the published application route is missing (the DNS record comes from it) |
