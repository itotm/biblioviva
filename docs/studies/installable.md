# Study — an installable BiblioViva for Windows and Linux desk computers

> **Status:** STUDY. Not a plan: nothing here is approved or scheduled. The proposals that the owner accepts become
> steps of PLAN.md, questions of §11 and ADRs.
> **Audience:** the owner (which packaging, what it costs in work and in the PC's resources) and a later coding agent
> that may expand the chosen proposals into steps.
> **Context:** BiblioViva is a server (SvelteKit on Bun, SQLite, `yaz-client`) used from browsers: the desk PC,
> tablets and phones of the library staff (PLAN.md §0). Today it is installed as Docker containers: on Linux and the
> Raspberry Pi through `setup.sh`, on Windows through Docker Desktop with WSL 2 (step 9.34, ADR-038). This study asks
> whether it can instead be **one program installed like any other** — an AppImage or Flatpak on Linux, an installer
> on Windows — with the **smallest possible use of the PC's resources**. Sources are listed at the end; what could
> not be checked is marked `[VERIFY]`. Estimates are in agent-driven person-days (one day = one working session of the
> coding agent plus the owner's review), tests and docs included.

## 1. Summary

**Yes, and without Tauri.** BiblioViva can already be built as **one native executable** that holds the Bun runtime,
the server and every page asset: `@sveltejs/adapter-bun` has a `compile` option for exactly this, and a prototype
(§3) built it for Linux and, cross-compiled from Linux, for Windows; the Linux one started, ran the first-run wizard
and served its assets from inside the file. The window around it does not need a framework: the app is already a PWA,
and `http://localhost` is a secure context, so the desk PC opens it in **Edge or Chrome in app mode** (a window of its
own, an icon in the taskbar, the camera allowed) at no cost in download or memory beyond the browser itself.

| Option | Extra download | RAM on the desk PC (server + window) | Work | Verdict |
|---|---|---|---|---|
| **Today on Windows:** Docker Desktop + WSL 2 | Docker Desktop (~0.5 GB) + the image | WSL 2 virtual machine 1.5–3 GB reported idle, + Docker Desktop's own UI | done (9.34 open) | heaviest; needs virtualization in the BIOS |
| **A. Native server + browser app window** (recommended) | ~55 MB installer | server ~70 MB idle, 150–250 MB in use (§3); the window is an Edge/Chrome window | ~10 days | lightest; one code base |
| B. Tauri shell around the same server | ~60 MB | as A + the Tauri process (~10–20 MB) + its own WebView2/WebKitGTK processes, never shared with the browser | A + 3–4 days, plus Rust in the build | more "app-like" (tray, updater), not lighter |
| C. Electron | ~150 MB+ | as A + a bundled Chromium + an unused Node | A + 3 days | excluded: the heaviest native option |
| D. Electrobun (Bun-based desktop shell) | ~60 MB | close to B | uncertain | young; ties the Bun version to the framework's |

On Linux: **AppImage yes, Flatpak no** — Flathub accepts neither console-only software nor prebuilt binaries
(§6). Servers (Raspberry Pi, a Linux box in a cupboard) stay on Docker.

## 2. What "installable" must mean for BiblioViva

BiblioViva is not a desktop program that one person opens and closes: it is a small server that **several devices**
use at once, and the desk PC is only one of them. Whatever the packaging, it must keep these properties:

- **The server runs while the PC is on**, not only while a window is open: closing the window must not stop the
  phones and the second desk PC. On Windows this means a **service** (or a task at start-up), not just a program in
  the Start menu.
- **HTTPS for the other devices**: the camera of a phone works only in a secure context. Today the Tailscale sidecar
  terminates HTTPS; installed natively, the same comes from the **Tailscale client of the PC** (`tailscale serve`).
  The PC itself needs no HTTPS: `http://localhost` is a secure context, so the camera works there too.
- **The local-network mode** (step 8.8, `LAN_PORT`) keeps working: the small front listens on all interfaces, the app
  on the loopback; the installer opens that port in the Windows firewall for private networks only.
- **The USB barcode scanner** is a keyboard: nothing to package.
- **Printing** goes through the browser's print dialog (cards, labels in mm, "actual size"): the window must be a real
  browser engine with a reliable print path — Chromium (Edge, Chrome, WebView2) is the engine the print layouts are
  tested on.
- **`yaz-client`** (Z39.50, needed by the default metadata provider OPAC SBN, ADR-001) ships with the package.
- **The three folders** (`CONFIG_DIR`, `DATA_DIR`, `BACKUP_DIR`) live on the PC's own disk, in the places the system
  expects, and survive an update or an uninstall.
- **Lowest possible footprint**, as the owner asks: no virtual machine, no second browser engine when one is already
  there, a heap sized after the hardware profile (steps 9.28–9.29).

## 3. The prototype (measured)

Built from the repository as it is, on the development PC (Fedora, x86-64), with a temporary Vite configuration that
only changed the adapter's options:

```ts
adapter({ buildOptions: { minify: true, compile: { outfile: "…/biblioviva" } } })
// for Windows, cross-compiled from Linux:
adapter({ buildOptions: { minify: true, compile: { target: "bun-windows-x64-baseline", outfile: "…/biblioviva.exe" } } })
```

| | Linux x64 | Windows x64 (baseline) |
|---|---|---|
| Build time | ~5 s after the Vite build | ~5 s + a one-time download of the Windows runtime |
| Executable | 133 MB | 139 MB (PE32+, console) |
| Compressed (xz / zstd -19) | 47 / 51 MB | 49 MB (xz) |
| Of which the Bun runtime | ~100 MB | ~105 MB |
| Started | yes: `/healthz` 200, the wizard at `/setup`, page assets 200 | not run (no Windows host) `[VERIFY]` |
| Memory (RSS) | 71 MB idle; 150 MB after 30 server-rendered pages, no heap limit | — |

Findings:

- **Compiling the plain build is not enough.** `bun build --compile build/index.js` starts, but every static asset
  answers 500: the adapter looks for them next to its own module, which is inside the executable's virtual file
  system. The adapter's **`compile` option** embeds them and serves them by identity path: that is the supported way,
  and it worked at the first try.
- **Precompression is lost** (the adapter's documentation: `precompress` is ignored with `compile`). On `localhost`
  this does not matter; for phones on Wi-Fi the first visit is heavier (the style sheet is ~290 KB raw against 21 KB
  in brotli) until the service worker has cached it. A small compression step for text assets in `hooks.server.ts`,
  or the precompressed files embedded beside the plain ones, would close the gap `[VERIFY]`.
- **The shipped files are still read from the working folder** (`config/` defaults, `drizzle/` migrations, `demo/`):
  they must either be embedded (`bun build --asset <dir>`) or read from the executable's folder. `MIGRATIONS_DIR`
  already exists; the example configuration (`EXAMPLE_CONFIG_DIR = "config"`) needs the same.
- **The memory numbers match the container's**: the same engine, so the measurements of `docs/performance.md`
  (120–190 MB anonymous memory at the peak with the `micro` and `small` profiles) hold, provided the heap is told its
  size (`BUN_JSC_forceRAMSize`), which in a container comes from the cgroup limit and natively must come from the
  hardware profile.
- **Baseline builds**: Bun's default x64 build needs AVX2 (Intel Haswell and later, 2013); the `-baseline` targets run
  on older CPUs, the PCs a school library often gets. The installable builds should always be baseline.
- **The helper commands** (`backup-restore`, `hash-password`, `config-check`, `config-export`, `config-import`) become
  subcommands of the same executable (`biblioviva restore …`), so the package holds one program.

## 4. The options compared

### 4.1 A — native server, the browser as the window (recommended)

The package holds the BiblioViva executable, `yaz-client` and its libraries, and a launcher. The server runs in the
background (a Windows service, a Linux autostart entry); the "BiblioViva" icon opens the address in **app mode**:

- Windows: `msedge.exe --app=http://localhost:3000` — Edge is part of every Windows 10 and 11, Chromium-based, the
  engine the print layouts are tested on; the window has no address bar or tabs and its own taskbar icon.
- Linux: Chrome or Chromium with `--app=` when present, otherwise the default browser (`xdg-open`).
- In both, the operator can also **install it as an app** from the browser's menu: the web manifest is already there
  (`display: standalone`) and `localhost` qualifies as secure.

Resources: the server alone (§3) plus a browser window. When Edge or Chrome is already open, the window shares its
processes; nothing else runs.

### 4.2 B — Tauri

Tauri 2 is a Rust shell that shows web pages in the system's web view (WebView2 on Windows, WebKitGTK on Linux) and
can start a "sidecar" binary — here the same BiblioViva executable. It brings real advantages: a tray icon, start at
login, single instance, a built-in updater, and bundlers for NSIS/MSI on Windows and AppImage/deb/rpm on Linux.

It does **not** save resources: the server is the same process as in A, and the web view is a browser engine of its
own (on Windows, WebView2 processes that are never shared with Edge). Measured comparisons of Tauri against Electron
range from "a few tens of MB" to "within 5 %", depending on the app; for BiblioViva the web view's memory is set by
the pages, not by the shell. The costs are concrete: a Rust toolchain in the build and in CI, a new language in the
repository, a second code path for the window (camera permissions in WebKitGTK and WebView2, the print dialog of
WebKitGTK, which the print layouts are not tested on) `[VERIFY]`, and the rule that the server must outlive the
window, which Tauri has to emulate with a tray icon.

### 4.3 C — Electron

Electron ships its own Chromium and Node: a larger download (100 MB and more), more memory, and a Node runtime that
BiblioViva would not use, since the server is Bun. Excluded.

### 4.4 D — Electrobun

A desktop framework whose main process is Bun itself, with the system web view: in principle the server could run in
the shell's own process. It reached its first stable release recently; the platforms other than macOS are less
proven, and the Bun version would be the framework's, not the one pinned in `package.json`. Worth watching, not worth
adopting now.

### 4.5 E — Docker Desktop (today's Windows path)

Same image as Linux, no Windows code — that was ADR-038's reason. Its costs fall on the school: virtualization enabled
in the BIOS (often locked on managed school PCs), 4 GB of RAM as a practical minimum, a WSL 2 virtual machine that
users report at 1.5–3 GB even idle, and BiblioViva running only while someone is signed in (Docker Desktop is not a
service). Option A removes all four.

## 5. Windows design (option A)

- **Installer**: Inno Setup or NSIS (both free, both scriptable from CI); the Tauri bundler is not needed for this.
  Installs to `C:\Program Files\BiblioViva\`; the three folders under `C:\ProgramData\BiblioViva\` (`config`,
  `data`, `backups`), kept on uninstall unless the operator ticks "remove the data too". Asks the same questions as
  `setup.sh`: network mode (Tailscale or local network), hardware profile, port.
- **Service**: BiblioViva runs as a Windows service from start-up, before anyone signs in, restarted if it stops. A
  plain executable cannot talk to the Service Control Manager, so either a small wrapper (WinSW, MIT; its stable 2.x
  needs the .NET Framework 4 that Windows 10/11 include; 3.x is still a pre-release) or a scheduled task "at start-up,
  whether a user is signed in or not" (Task Scheduler, nothing to ship, weaker restart handling) `[VERIFY: which is
  more robust on managed school PCs]`.
- **Window**: a Start menu and desktop shortcut "BiblioViva" that opens Edge in app mode (§4.1).
- **Firewall**: an inbound rule for the local-network port, private profile only; none with Tailscale.
- **Tailscale**: the operator installs Tailscale for Windows from the official page and signs in with the school's
  account; the installer (or the setup checklist page) runs `tailscale serve --bg http://127.0.0.1:3000` so that
  `https://<pc>.<tailnet>.ts.net` reaches BiblioViva. This replaces the sidecar and its tagged auth key on this path.
- **YAZ**: Index Data publishes Windows installers of YAZ (5.38.1 is the latest in `pub/yaz/win64/`); the package
  carries `yaz-client.exe` and the DLLs it needs, under YAZ's BSD licence, and sets `YAZ_CLIENT` to it `[VERIFY: the
  DLL list]`.
- **Backups**: the folder is local; a USB drive is visible to the service by its letter, a network share only by its
  UNC path (mapped drive letters belong to a user session). The off-site copy (rclone, a compose profile today) has no
  native equivalent yet: either rclone is downloaded on request, or that feature stays with Docker `[open]`.
- **Requirements**: Windows 10 1809 or later, 64-bit (Bun's minimum); any x64 CPU with the baseline build.
- **Signing**: an unsigned installer meets SmartScreen's "Windows protected your PC" and, for Bun-compiled
  executables, sometimes an antivirus false positive `[VERIFY]`. The **SignPath Foundation** signs open-source
  projects for free (OSI licence, builds from CI, a manual approval per release — which fits ADR-054); the alternative
  is Azure Artifact Signing (about USD 10 a month) `[VERIFY: eligibility of an individual maintainer in Italy]`.
  SmartScreen reputation still grows with downloads.

## 6. Linux

- **AppImage — yes, for the desk PC.** One file, no runtime to install, no sandbox in the way of `yaz-client`, the
  listening port or the backup folder on a USB drive. Content: the executable, `yaz-client` with its libraries
  (collected the way the Dockerfile already does with `ldd`), the shipped files, and an `AppRun` that sets the folders
  under `~/.local/share/biblioviva/`, starts the server if it is not running and opens the window. Built with the new
  **static type-2 runtime**, it does not need `libfuse2` on recent distributions (Ubuntu 24.04 ships only fuse3).
  "Start BiblioViva at login" writes an entry in `~/.config/autostart` (or a systemd user unit). Limit: like Docker
  Desktop, it runs while a user is signed in — fine for a desk PC, not for a server.
- **Flatpak — no.** Its value is Flathub (discovery, automatic updates), and Flathub refuses BiblioViva on two counts:
  console software is not accepted, and source-available submissions must be built entirely from source, Bun
  included. A Flatpak outside Flathub has the sandbox's costs (ports, folders, the background portal for autostart,
  whose effect depends on the desktop) without the benefit. A window built with Tauri would answer the first rule, not
  the second.
- **Which host.** The AppImage, like the Windows installer, suits a library with **one computer**. When **several
  computers** use BiblioViva, or it must answer while the desk computer is off, a dedicated computer that stays on is
  the better host: a Raspberry Pi or a Linux PC with Docker. On Windows the installer's service answers from start-up
  with nobody signed in, so in a library with Windows PCs only it can serve the others from the PC that stays on.
- **Servers stay on Docker** (Raspberry Pi, a dedicated Linux box): `setup.sh`, the Tailscale sidecar and `offsite`
  are already there and tested. A `.deb` with a systemd service is the native equivalent and may save the Docker
  daemon's memory on a 2 GB Raspberry Pi `[measure]`: *accepted (PLAN.md Q153, step 9.62)*, beside Docker, with
  `Depends: yaz` instead of a bundled `yaz-client`, no APT repository (it would update BiblioViva with the system's
  upgrades) and a notice only.
- **macOS — left out (Q153).** The executable cross-compiles from Linux (tried: `bun-darwin-arm64` 115 MB,
  `bun-darwin-x64` 123 MB, both Mach-O). A package macOS accepts needs more: Apple's signing and notarization (the
  Apple Developer Program, about USD 99 a year `[VERIFY]`; without it Gatekeeper blocks the program and the operator
  must allow it by hand in the system settings), a launchd service, `yaz-client` and its libraries built for the Mac
  (Homebrew's, not Debian's), an `.app` or `.pkg`, and a Mac to try it on (GitHub offers macOS runners). About 4–5 days
  `[estimate]` and a yearly fee, for a platform few school libraries use.

## 7. What changes in the code

All small, and none of it Windows-only in spirit: it removes assumptions about the container.

- **Build**: a `compile` switch in `vite.config.ts` (target and output from the environment), baseline targets,
  `--asset` for `config/`, `drizzle/` and `demo/` or a lookup next to the executable; the helper scripts as
  subcommands of the server's entry.
- **Start** (`scripts/start.ts`): `process.execve` and the cgroup limit do not exist on Windows. The heap size and
  `--smol` come from the hardware profile; since `BUN_JSC_forceRAMSize` must be set before the engine starts, the
  executable relaunches itself once with the right environment (Bun has `--compile-exec-argv` and `BUN_OPTIONS` for
  the flags).
- **Paths and files**: the default folders per system (ProgramData, XDG); `symlinkSync` in
  `services/template-editor.ts` (a symbolic link on Windows needs a privilege: copy or a directory junction instead);
  the three `rename` sites (Windows refuses to replace a file another handle holds open); archive entries always with
  `/`; `tmpdir()` is fine.
- **Settings**: the port, the network mode and the profile must stay editable from the admin UI (the completeness
  rule); the installer's answers are only the first values.
- **Update notice**: the About page compares the version with the latest GitHub release and links the download; no
  silent self-update (that would be Tauri's updater or a signed updater of our own).

## 8. Tests

- A **smoke test of each package** in a manual workflow (ADR-054): start the executable on a fresh folder, `/healthz`,
  the wizard, a page asset, `yaz-client` found and answering `z3950:test` against the mock.
- The **unit tests on a Windows runner** (GitHub's `windows-latest`), once, to find the path and file assumptions; the
  Playwright suite against the Windows build in the same manual workflow, Chromium only.
- The owner's check on a real school PC, like 9.34's acceptance: install, restart Windows without signing in and reach
  BiblioViva from a phone, backup and restore, update to a newer installer with the data kept, uninstall keeping the
  data.

## 9. Effort and effect on the plan

| Work | Days |
|---|---|
| Single executable: compile switch, embedded shipped files, subcommands, start without `execve` | 1.5 |
| Portability fixes and the unit tests on Windows | 2–3 |
| Windows installer: folders, service, firewall, shortcut, YAZ, upgrade and uninstall | 2 |
| Signing (SignPath application and workflow; then 1–2 weeks of waiting) | 0.5 |
| AppImage: `AppRun`, autostart, YAZ libraries, static runtime | 1–1.5 |
| Debian package: control files, systemd unit, maintainer scripts, `biblioviva setup`, tests on a runner, measures on a Raspberry Pi | 2–2.5 |
| Smoke-test workflow | 0.5 |
| Documentation: the setup paths `windows-*` and `linux-*` rewritten for the installers, both languages, mocks of the installer's pages (ADR-046) | 2 |
| **Total, option A** | **~10**, and 2–2.5 more with the Debian package |
| Tauri on top (option B) | +3–4, and Rust in the toolchain |

Effect on the plan if option A is accepted:

- **Step 9.34** (Docker Desktop) changes subject: the Windows path becomes the native installer; Docker Desktop stays
  possible but undocumented, or is dropped. ADR-038 is superseded by a new ADR; §3.21 and Q63/Q130 are updated.
- The setup guide (8.7) and the installation section of the site (9.7) gain the `windows` paths on the installer and a
  `linux-desk` path on the AppImage; the Raspberry Pi and server paths are unchanged.
- `publish` (ADR-054) gains the packages as release assets, built in CI; nothing starts by itself.
- A dependency-free change for the app: Inno Setup or NSIS, WinSW and appimagetool are build tools, not packages of
  `package.json`, but each still gets a line in the ADR.

## 10. Questions for the owner

Numbered here; if accepted they take the next free numbers of PLAN.md §11.

- **QI1** — Replace Docker Desktop on Windows with a native installer (option A) for 0.9.0? *Answered: yes (PLAN.md
  Q149, steps 9.56–9.57, ADR-057).*
- **QI2** — Tauri for the window, or the browser in app mode? *Answered: the browser in app mode, no Tauri (Q149).*
- **QI3** — Linux desk PCs: AppImage, and no Flatpak? *Answered: yes; the AppImage is the advised choice when the
  library has one computer, Docker on a dedicated computer that stays on when several computers use BiblioViva (Q149,
  step 9.58).*
- **QI4** — On Windows, a real service from start-up (WinSW) or a start-up task? *Answered: a service (9.57).*
- **QI5** — Sign the Windows installer through the SignPath Foundation? *Answered: yes (Q150, step 9.61).*
- **QI6** — Off-site copies (rclone) in the native packages: download rclone on request, or keep that feature for
  Docker installations? *Answered: no rclone in the native packages; the operator chooses the folder of the automatic
  backups, and Amministrazione reminds the administrator while it is not configured (Q151, step 9.59, ADR-058).*
- **QI7** — A "new version available" notice on the About page, with a link to the download? *Answered: yes, nothing
  automatic (Q152, step 9.60).*

## Sources

- `@sveltejs/adapter-bun` options `compile` and `precompress` — `node_modules/@sveltejs/adapter-bun/index.d.ts`;
  `bun build --help` (`--compile`, `--asset`, `--compile-exec-argv`, cross-compilation targets)
- Tauri 2, Windows installer and WebView2 options — [v2.tauri.app/distribute/windows-installer](https://v2.tauri.app/distribute/windows-installer/);
  sidecar issues — [tauri#15134](https://github.com/tauri-apps/tauri/issues/15134)
- Tauri and Electron memory, divergent measurements —
  [OpenReplay](https://blog.openreplay.com/comparing-electron-tauri-desktop-applications/),
  [DEV Community](https://dev.to/devtoolpicks/tauri-vs-electron-for-indie-hackers-in-2026-honest-comparison-o0e)
- Electrobun — [blackboard.sh/blog/electrobun-v1](https://blackboard.sh/blog/electrobun-v1/),
  [electrobun-2-0](https://blackboard.sh/blog/electrobun-2-0/)
- Docker Desktop and WSL 2 memory, user reports — [docker/for-win#8742](https://github.com/docker/for-win/issues/8742),
  [Docker forum](https://forums.docker.com/t/docker-desktop-idle-memory-usage/138540),
  [microsoft/WSL#8725](https://github.com/microsoft/WSL/issues/8725)
- Flathub requirements (console software, building from source) —
  [docs.flathub.org](https://docs.flathub.org/docs/for-app-authors/requirements);
  background portal — [Flatpak mailing list](https://lists.freedesktop.org/archives/flatpak/2022-August/002276.html)
- AppImage static type-2 runtime — [github.com/AppImage/type2-runtime](https://github.com/AppImage/type2-runtime)
- YAZ for Windows — [ftp.indexdata.com/pub/yaz/win64](https://ftp.indexdata.com/pub/yaz/win64/)
- WinSW — [github.com/winsw/winsw](https://github.com/winsw/winsw)
- SignPath Foundation terms — [signpath.org/terms](https://signpath.org/terms); Azure Artifact Signing pricing —
  [DevClass](https://devclass.com/2026/01/14/code-signing-windows-apps-may-be-easier-and-more-secure-with-new-azure-artifact-service/)
