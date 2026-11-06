# What is left

The short checklist of the work still open, for the owner and the coding agent. [PLAN.md](../PLAN.md) stays the
source: every item names its step or question there, and this list is updated in the same commit as the plan (a
step ticked, added or moved, a check asked of the owner). Done items are ticked here and removed when the next
release is made. The owner's checks carry a number in their title so they can be named by it; a check keeps its number until the
list is cleared at a release, and a new one takes the next.

## Checks only the owner can make

- [x] **1. Overdue notices in Firefox**: print one with the browser's margins set to "Nessuno" and check the white
  border around the tables on every page (9.13 round 33; checked in Chromium only).
- [x] **2. Phone keyboard on the Xiaomi** (Firefox): the field being typed in stays visible, the bottom bar steps aside,
  a long dialog scrolls (9.13 round 33; Playwright can only simulate the keyboard).
- [ ] **3. Cards without the photo**: print one card from each shipped template of `config/cards/templates-no-photo/`
  (default, fronte-retro, verticale) and judge the layout (9.38).
- [x] **4. Publish the home page**: `bun run home:build`, then `home/biblioviva-home.zip` uploaded by hand to a
  Cloudflare Pages project made by direct upload, domain `biblioviva.org` ([deploy.md](deploy.md), 9.7). The links to the
  documentation and to GitHub are left out until those sites are online (`ONLINE` in `scripts/home-build.ts`).
- [ ] **5. Fresh host walkthrough**: install on a new computer following only the documentation (8.5).
- [ ] **6. Windows 11**: the acceptance of 9.34 on a real PC, once the step is built.
- [x] **7. Open questions**: Q120 (one language per installation; only the public demo follows its visitor, ADR-047) and
  Q134 (Pagefind for the documentation's search) answered.
- [ ] **8. Close the UI reviews** of 9.13 when nothing more is asked.
- [ ] **9. Round 38 on the phone and the computer**: the help icon in the top bar (it opens nothing until
  `docs.biblioviva.org` is online), the one wait over the page only, the desk's narrower field with today's loans
  and returns side by side, no box past the right edge, Stampe with "Nuova lista utenti" / "Nuova lista libri"
  and the classes under the lists, the account `tessere` without the catalogue, the lists without "Modifica le
  copie" (9.13).
- [ ] **10. The school presets of the other countries** (9.41): each marked [VERIFY] until a teacher of the
  country confirms its years, class labels, school year and customs (most doubtful: Brazil's turma numbers, the
  Dutch tracks, Catalonia's ordinals, Ukraine's `5-А`); the Scuola page with a year that leads to a choice.
- [ ] **11. Read the drafts of the documentation**, Italian first: Installazione (`docs/it/setup/`, English mirror
  written too), Manuale (`docs/it/manual/`), Amministrazione (`docs/it/admin/`), Aiuto (`docs/it/help/`, English
  mirror written too); each section starts from its README. The wording, the `[VERIFY]` items, the questions of the
  writers; then the English mirrors of Manuale and Amministrazione (8.7, 9.5).
- [ ] **12. One language on biblioviva.org**: after the next update of the demo and upload of the home page, choose
  EN on the home page and open the demo (English, EN pressed), switch it to IT and open the home page again (the
  Italian page stays); the documentation the same once online. The cookie `bv_lang` is shared only on the real
  domain, so this cannot be tried locally (Q120, ADR-047).
- [x] **13. Three choices for the next steps**: the help button (Q140), the icon of the problem boxes (Q141), the item
  type on the record and the segnatura on the copy (Q139).

## Steps left for 0.9.0, in the order of the plan

- [ ] 9.34 Windows: BiblioViva in Docker Desktop (`setup.ps1`, the Windows path of the guides).
- [ ] 8.7 Guided setup for non-technical administrators, Italian and English: `setup.sh` is in (Tailscale or the
  local network, the profile, the key; `scripts/setup-sh.test.ts`); the Italian installation section
  (`docs/it/setup/`) is written and reviewed, its English mirror written, waiting for the owner's reading; the mocks of
  Tailscale, Raspberry Pi Imager and the phone are in `docs/mocks/` (ADR-046); left: the `/admin/setup` checklist page
  and the runs on a PC and a Raspberry Pi.
- [ ] 9.5 Documentation and the user manual: the Italian drafts of Manuale (30 guides, 19 screens),
  Amministrazione (first steps, 25 guides, 13 screens) and Aiuto are written, Aiuto in English too; left: the owner's
  reading; reviewed against the code and reviewed again for the text (the four sections, IT and EN); English mirrors written;
  `docs:shots` takes all 116 computer pictures (112 of the app, 4 mocks of other programs), none missing; left: the
  tablet and phone windows and the English pictures.
- [ ] 9.36 The public repository from a snapshot, the start of the public beta (ADR-048): READMEs with the status, what
  BiblioViva does and does not do, Tailscale and the phone optional, the commands; the home page's beta notice; the
  original logo back in `docs/reference/branding/` (C2PA stripped). Left: the archive, the snapshot, the settings.
- [x] 9.42 What the documentation showed: demo data removed keeping the classes, labels and class cards marked
  printed, the segnatura edited by hand puts the spine band back to print, the accounts not imported without a confirmation, one
  name per account.
- [x] 9.43 Restore from the first-run wizard ("Ripristina da un backup" on its first screen).
- [ ] 9.5b Help icons that open the manual on `docs.biblioviva.org` (the top bar's icon is in; the icons
  in the trickier spots and the anchors check wait for the manual).
- [ ] 9.7 The documentation site on `docs.biblioviva.org`: `bun run site:build` / `site:serve` build it locally from
  `docs/` (ADR-043) with the search (Pagefind, ADR-045), the home page shows four real screenshots; the Pages workflow builds the
  pictures and the site, run by hand only (ADR-050); left: `site:check`, the figure switch, the PDFs, the first
  publication is done (`docs.biblioviva.org` is online). `ONLINE.docs` and `ONLINE.repo` are on: upload the home page
  again (`home/biblioviva-home.zip`) for the GitHub link in the header and the Project column in the footer.
- [ ] 9.3 Accessibility and UX review pass.
- [ ] 9.4 Device checklist.
- [x] 9.17 Public demo: running on `demo.biblioviva.org`.
- [x] 9.40 A beep when the phone's camera reads a code (four sounds, Conferma by default, Q137).
- [x] 9.44 Authors as "Surname, Name" in the demo data (the seed draws "Name Surname"; the segnature follow).
- [x] 9.45 The item type belongs to the record: edited in "Modifica scheda", no longer on each copy; the segnatura
  stays on the copy (Q139).
- [x] 9.46 Problem boxes everywhere in the documentation: every "Possibili problemi" as one box per problem, one life
  buoy on the heading (Q141).
- [x] 9.47 A help button that is seen: "Guida" with text in the top bar on the computer, a round button beside the
  title on the phone, in the primary colour (Q140).
- [x] 9.48 A language pack from the first-run wizard: installed on the first screen, the wizard goes on in it (Q142).
- [x] 9.49 "Consultazione" is not a material: a reference copy is a copy excluded from loans; "Materiali" in the
  interface.
- [x] 9.50 The segnatura computed from a scheme chosen in the wizard (order: genre and level, level and genre, genre
  only, free; end: initials computed, editable or none); stored on the copies, recomputed by the server (Q143).
- [x] 9.51 Personal accounts beside the shared ones: own password change, change at the first login, roles as the
  profiles (Q144).
- [x] 9.52 A loan right after a return: the return on the Prestito desk chooses the borrower; "Presta a" on the
  Restituzione desk (Q145).
- [x] 9.53 Database diagrams as pictures on the site and the libraries in a technical page linked from Informazioni
  (Q146).
- [ ] 9.6 Release 0.9.0, the first tagged release of the public beta (ADR-048).

## After 0.9.0

- [ ] 9.10 Field test at the school through the school year 2026/27; 1.0.0 for September 2027.
- [ ] 9.37 Updates with database migrations from 1.0.0 (during the field test).
- [x] 9.41 Class names and school years for the countries of the language packs (a label template per stage, `next`
  with choices, the school year's start and name, the card's class line and the shipped cards and slips without
  Italian words, order and register matching per language, presets for every country; Q138).
- [ ] Presets still missing for 9.39: the upper secondary schools of Greece, Romania, Hungary, Japan and Korea.
- [ ] 9.39 Language packs downloaded from each release and installed from Aspetto e lingua (25 languages, Q136).
  Done: real plural forms (ADR-051); the tools (`i18n:work`, `i18n:status`, `i18n:sync`, `i18n:release`), the glossaries
  and **all 25 packs** (automatic translation by Haiku from the glossaries, checked by the tools: keys, placeholders,
  plural forms, scripts; `"translation": "machine"`); the workflow that attaches the zips and the index to a release;
  the app side (the list of the release's packs, "Installa" and a link to the release page in Interfaccia → Pacchetti di
  lingua, refused in the public demo) and the guide `add-a-language`.
  The language is added in Aspetto e lingua (a list of the release's languages, the zip upload), the release run with the
  packs attached and the e2e against a local release are done.
  Open: a native speaker's reading of each pack; a Sonnet reading of what the checks flag (long texts, terms, register);
  the translation of the messages added since each release (`i18n:sync`); the shot `admin/language-packs` with a list in it.

## Housekeeping

- [ ] Rounds 27–32 of 9.13 are recorded only in [STATUS.md](STATUS.md): list them in the step like the others.
- [ ] The `[VERIFY]` items of PLAN.md (22), each resolved when its step is reached.
- [ ] TypeScript 7: waits until `svelte-check` and `@sveltejs/kit` accept it (their peer range stops at 6).
- [ ] At the next Raspberry Pi load test, measure again how long the print sheets wait with 10 users at once (the
  slowest took 60 s; the idle timeout is 120 s, [performance.md](performance.md)).
