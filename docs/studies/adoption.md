# Study — what a wide adoption in Italian schools requires

> **Status:** STUDY. Not a plan: nothing here is approved or scheduled. The proposals that the owner accepts become
> steps of PLAN.md and questions of §11.
> **Audience:** the owner (what the law asks of a school that adopts BiblioViva, what is missing, cost) and a later
> coding agent that may expand the chosen proposals into steps.
> **Context:** BiblioViva is free software (GPL-3.0-or-later), installed by the school on its own computer, used by the
> library staff only (PLAN.md §0). An Italian state school is a public administration (D.Lgs. 165/2001, art. 1 c. 2:
> «gli istituti e scuole di ogni ordine e grado»), so the rules for public administrations apply to the tools it
> adopts. Sources are listed at the end; what could not be checked on the official text is marked `[VERIFY]`.
> Estimates are in agent-driven person-days (one day = one working session of the coding agent plus the owner's
> review), tests and docs included.

## 1. Summary

| Area | Rule | Where BiblioViva stands | Proposal | Priority |
|---|---|---|---|---|
| Accessibility | Legge 4/2004, AgID guidelines → EN 301 549 v3.2.1 = WCAG 2.1 AA (also on intranets) | good base; six gaps fixed, six open (§2.3); conformance page `docs/accessibility.md` | close the gaps in 9.3, WCAG 2.2 AA as the target | **high** (0.9.0) |
| Data protection | GDPR, D.Lgs. 196/2003, Garante's school guidance | strong by design (data at school, anonymization, no logs of names) | a page for the head teacher and the DPO with the facts they must write down | **high** (0.9.0, docs only) |
| School inventory | D.I. 129/2018 art. 31: library books are inventoried assets | not covered: no inventory number, no value, no acquisition source | optional inventory fields and the two lists the office needs | **medium**, owner decision |
| Open source in the PA | CAD art. 68–69, AgID guidelines on acquisition and reuse | GPL, public repository | `publiccode.yml` and listing in the Developers Italia catalogue | **medium**, cheap |
| Interoperability and exit | CAD art. 68 (portability), library practice | CSV/JSON exports, Z39.50 and UNIMARC import of records | MARC export (and import) of the catalogue | **medium** |
| Security | AgID minimum ICT security measures (Circolare 2/2017) | accounts, roles, audit log, backups, updates | say so in the documentation; nothing to build | low |
| Cloud | ACN regulation on cloud for the PA | self-hosted: not concerned | warn whoever would host it for schools | low |
| European Accessibility Act | D.Lgs. 82/2022 | not concerned (not a consumer product or service) | none | — |
| Inclusion | L. 170/2010 (DSA), L. 104/1992 | item types and reading levels are configurable | presets for accessible books (high readability, CAA symbols, audiobooks, large print) | low, cheap |

## 2. Accessibility

### 2.1 What the law asks

- **Legge 4/2004** («Legge Stanca»), as amended by D.Lgs. 106/2018 (transposing Directive (EU) 2016/2102), binds the
  public administrations, schools included. Its **AgID guidelines** («Linee guida sull'accessibilità degli strumenti
  informatici», 2022 edition) set the technical requirements by reference to **EN 301 549 v3.2.1** (UNI CEI EN 301549):
  for web content, chapter 9, i.e. **WCAG 2.1 level AA**; for software, chapter 11.
- The guidelines extend the web requirements to applications used on an **intranet** (§2.2: «I requisiti del
  presente paragrafo si applicano anche nei casi in cui i soggetti obbligati … erogano servizi mediante applicazioni
  Internet rese disponibili su reti Intranet»). BiblioViva, opened from the browser on the school's network or its
  tailnet, is such an application.
- **Employees with disabilities** (L. 4/2004 art. 4 c. 4; guidelines §2.7): the employer provides the hardware,
  software and assistive technology the employee needs. A teacher or a collaboratore scolastico who uses a screen
  reader or a magnifier must be able to work at the desk with BiblioViva: this is the concrete case that matters for a
  staff-only program.
- The **accessibility statement** («dichiarazione di accessibilità», on AgID's form, reviewed every 23 September) and
  the yearly **accessibility goals** (by 31 March) concern the school's websites and mobile apps (guidelines §4.1). An
  internal tool such as BiblioViva is most likely not the subject of a statement of its own `[VERIFY: with AgID or a
  school's RTD]`, but the school is responsible for what it adopts, and a conformance self-assessment from the project
  saves it the work.
- **The standard is moving.** EN 301 549 **v4.1.1**, aligned with **WCAG 2.2**, was published by ETSI/CEN/CENELEC in
  September 2026; it becomes the legal reference once the Commission cites it in the Official Journal (expected by the
  end of 2026) and AgID updates its guidelines `[VERIFY: citation in the OJ]`. WCAG 2.2 adds, at A/AA: focus not
  obscured (2.4.11), dragging movements (2.5.7), target size minimum (2.5.8), consistent help (3.2.6), redundant entry
  (3.3.7), accessible authentication (3.3.8); it drops 4.1.1 Parsing. Building to **WCAG 2.2 AA now** costs little more
  and avoids a second pass.
- The **European Accessibility Act** (Directive (EU) 2019/882, D.Lgs. 82/2022, in force from 28 June 2025) covers
  products and services offered to consumers (computers, e-commerce, banking, e-books, transport …). A free program
  that a school installs for its staff is none of these: BiblioViva is not concerned.

### 2.2 What BiblioViva already does

A code audit against WCAG 2.2 AA (read-only, then checked) found a good base, now recorded in
[`docs/accessibility.md`](../accessibility.md): `<html lang>` per installation; a title and one `<main>` per page;
desk messages announced (`aria-live`, `role="alert"`/`"status"`) with colour, icon and text; the desk usable with the
keyboard and the USB scanner alone (e2e test); the camera never required; Zag dialogs that trap and return the focus;
translated names on icon buttons; login with `autocomplete` and no paste blocking (3.3.8); sliding sessions of days
(2.2.1); `prefers-reduced-motion`; `rem` sizes and no zoom lock; the template designer usable with arrow keys and
numeric fields (2.5.7); the help button in the same place everywhere (3.2.6); axe on 29 pages at both sizes; a
contrast test on all fifteen colour sets.

### 2.3 Gaps, and what is already fixed

Fixed with this study (in the working tree, tests included):

| Gap | WCAG | Fix |
|---|---|---|
| no skip link in the app | 2.4.1 | a link to `<main id="main">`, the first Tab stop (e2e test) |
| the arrows in a data grid opened the row (keyboard users could not move through a list) | 2.1.1, 3.2.2 | arrows select only; Enter or a click opens (component test) |
| field hints and errors not tied to the control | 1.3.1, 3.3.1 | `aria-describedby` and `aria-invalid` from `Field` (component test) |
| field borders 1.5:1 and placeholders 2.5:1 on white, in every colour set | 1.4.11, 1.4.3 | border `surface-500` (≥ 4.2:1), placeholder `surface-600` (≥ 6.4:1), in the contrast test |
| no global focus style (browser default only); weak focus on the list search | 2.4.7 | a 2 px primary outline on `:focus-visible`; a ring on the search box |
| the phone's bottom bar labelled «Altro», the sidebar not a navigation landmark | 4.1.2 | both labelled «Menu principale» |

Still open (medium effort, for step 9.3):

- the top bar (title, help, account menu) comes after the page in the DOM: the reading and Tab order differ from the
  visual order (1.3.2, 2.4.3) — about ½ day, careful with the sticky layout;
- required fields have no visible mark before an error (3.3.2) — a visible change, owner's choice of the mark
  (asterisk with a note, or «(obbligatorio)»);
- cropping a photo, a cover or a class picture is drag-only (2.5.7): arrow keys on the canvas and on the corner
  handles — about 1 day;
- the phone's full-screen camera is not a modal dialog (focus, Escape, `inert` behind) — small;
- long page titles clamped to one or two lines at large zoom (1.4.4) — small;
- book titles in another language have no `lang` (3.1.2) — needs a language field, which the lean model dropped
  (Q73): accept as a documented limit.

Manual checks no code review can replace: NVDA (Windows, Firefox/Chrome) and Orca (Linux) on the desk, forms with
errors, grids, dialogs, toasts; zoom 200 % and 400 %; text spacing; Windows contrast themes (`forced-colors`).

### 2.4 Proposal

Take the open items into step 9.3 with WCAG 2.2 AA as the target (QA1), extend axe to the states it does not see
today (open dialogs, forms with errors, the camera overlay), run the manual screen-reader and zoom checks once
before 0.9.0, and keep `docs/accessibility.md` as the project's conformance page (QA2). About **2–3 days** besides
what is already fixed.

## 3. Data protection

### 3.1 What the law asks of the school

The school (the head teacher as its legal representative) is the **controller** of the patrons' data (GDPR art. 4,
24). Processing for the school library is an institutional task (art. 6 c. 1 e), so no consent is needed for the
register data; the school must still:

- list the processing in its **record of processing activities** (art. 30): purposes, categories of data and of
  people, recipients, retention, security measures;
- give the **information notice** (art. 13) to families and staff — usually the school's general notice, which should
  name the library;
- apply **data minimisation and storage limitation** (art. 5), **privacy by design and by default** (art. 25), and
  **security** (art. 32);
- answer **access and erasure requests** (art. 15, 17);
- decide with its **DPO** whether a DPIA is needed (art. 35); for a school library with photos of minors it most
  likely is not, but it is the DPO's call.

The Garante's vademecum for schools («La scuola a prova di privacy», 2023 edition, updated 2025) repeats the same
principles: only the data that are needed, care with minors' pictures, no publication of personal data.

### 3.2 Where BiblioViva stands

Very well, by design: the data stay on the school's computer (no cloud service, no processor to appoint under art. 28
when the school installs it itself); the patron record has only what a loan needs; photos and covers can be switched
off (step 9.38); names, photos and card numbers are never written to the logs; removing a patron anonymizes it at once,
and the class upgrade removes the pupils who leave (storage limitation); permissions limit who sees what; the audit
log records accounts and ids, not personal data; the export page reminds how to answer a request about one person;
exports and backups stay on the school's computer unless an administrator downloads them or sets up the offsite copy.
The backup files are not encrypted: where the copies are kept is part of the school's security measures, and the
documentation should say so.

Points a DPO will ask about, which the documentation should answer plainly:

- **Tailscale** (when chosen): the traffic is end-to-end encrypted (WireGuard) and Tailscale does not see the
  content, but it is a US company that processes the staff's login and the devices' metadata. The local-network way
  avoids it entirely. The page should say both.
- **Lookups on the internet**: the ISBN or the title goes to OPAC SBN (Italian state), Amazon and Open Library for
  records and covers; no personal data leave the school.
- **Loan history**: it is kept as long as the patron is in the school, and stays anonymous after removal (counts per
  class for the reports). The retention is therefore the school career, which a DPO can write in the record.

### 3.3 Proposal

A page in the **Administration** section (Italian and English), «Protezione dei dati e accessibilità» or two pages,
for the head teacher, the DSGA and the DPO: what BiblioViva stores, where, for how long, who sees it, what leaves the
school, how to answer an access or erasure request, and a **ready text for the record of processing** (art. 30) and
for the paragraph of the **information notice** that the school can copy. No code. About **1 day** (Sonnet writers,
owner review).

## 4. The school inventory of library books

### 4.1 What the rule says

The accounting regulation of state schools, **D.I. 129/2018**, art. 31, lists «libri e materiale bibliografico» among
the inventories of the school's assets (patrimonio indisponibile). The schools' own regulations (art. 29 c. 3) repeat
the requirements of art. 31: each item is entered **in chronological order, with a progressive and uninterrupted
number**, with what establishes its **origin** (purchase, gift), **place**, **condition** and **value** (the invoice
price, or an estimate for a gift). Books of **classroom libraries** and periodicals are not inventoried; for them «la
rilevazione avviene attraverso gli strumenti di gestione del prestito della biblioteca di istituto». Lost, stolen or
worn-out items leave the inventory only by a **decree of the head teacher** («provvedimento di discarico»); a
commission checks the assets at least **every five years** and renews the inventories every ten.

In practice the inventory register is kept by the DSGA in the school's accounting software, often with a separate
register for the library; many school libraries write the inventory number inside the book and use it as the loan
code.

### 4.2 Where BiblioViva stands

BiblioViva has no inventory number, no price (dropped on purpose, Q73) and no acquisition source; it has the
acquisition date, the withdrawal of a copy with its reason, and the stocktaking campaigns (step 9.8). The
library therefore cannot hand the office what the office needs from it: the list of copies withdrawn in the year, for
the head teacher's decree, and the reconciliation with the inventory register at the five-yearly check.

### 4.3 Proposal (owner decision)

Optional, off by default, so the lean model stays the default (`catalog.inventory.enabled`):

1. on the copy: **inventory number** (free text, unique when set; the barcode can be the same number, as many
   libraries do), **origin** (purchase / gift / other, a configurable list) and **value** (euro, optional);
2. two lists in Reports: **copies withdrawn in a period** with inventory number, reason and value (the annex to the
   discharge decree), and **copies entered in a period** (what the office must register);
3. the stocktaking report gains the inventory number column, for the five-yearly check.

About **2–3 days** (schema, form, import/export columns, reports, docs). It reopens Q73 for the price: hence a question
for the owner.

## 5. Open source in the public administration

The CAD (D.Lgs. 82/2005) asks every administration, before acquiring software, for a **comparative evaluation** that
considers open-source and reusable solutions (art. 68), and the AgID «Linee guida su acquisizione e riuso di software
per le PA» explain how; the **Developers Italia catalogue** is where administrations look. A project gets listed by
putting a **`publiccode.yml`** file at the root of its public repository (an OSI-approved licence is required; GPL-3.0
is one) and registering the organisation; a crawler then imports it. For BiblioViva it is the cheapest visibility
there is among the people who choose software for schools.

Proposal: add `publiccode.yml` (Italian and English descriptions, screenshots from the docs, the maintainer as
contact, `softwareType: standalone/web`, categories `library-management` `[VERIFY: the category list]`), validate it
with the official validator, and ask for the listing once the public repository exists (step 9.36). About **½ day**.

## 6. Interoperability and the way out

A school chooses more easily a program it can leave. BiblioViva exports CSV and JSON and reads UNIMARC records from
OPAC SBN, but cannot hand its catalogue to Koha, SebinaNEXT, Clavis or a regional network in the format they all read:
**MARC (ISO 2709 or MARCXML)**. The parser and the UNIMARC map already exist (`#lib/server/marc/`), so:

- **export** of the catalogue in UNIMARC and MARC21 (one record per title, copies in 995/952 as Koha expects)
  — about **1½ days**;
- **import** of a MARC file in the catalogue import (same validate-first rules as the CSV, §3.22), which also eases
  the move from older Italian school programs that export ISO 2709 — about **2 days**.

## 7. Other rules checked

- **Security** — the AgID minimum ICT security measures (Circolare 2/2017) apply to schools; BiblioViva already
  provides what concerns an application (authentication, roles, audit log, hashed passwords, automatic backups,
  updates by image). One paragraph in the Administration page of §3.3.
- **Cloud** — the ACN regulation on cloud services for the PA (2024) requires qualified services when a school buys
  a hosted service. A school that installs BiblioViva on its own computer is not concerned; whoever would offer
  BiblioViva as a hosted service to schools would need the ACN qualification. One sentence in the technical docs.
- **Ministry programmes** (PNSD «biblioteche scolastiche innovative», reading promotion) impose no software
  requirement that could be found; the yearly report of a library is covered by the reports.

## 8. Inclusion beyond the law

Not required, but asked by school librarians (DSA pupils, L. 170/2010; pupils with disabilities, L. 104/1992): the
catalogue should let a teacher find the **accessible books** — high-readability editions, books in symbols (CAA),
audiobooks, large print, tactile books. BiblioViva can already do it with item types or subjects; the proposal is a
**preset** of these values in the wizard's defaults and a filter in the catalogue (about **½ day**), with a line in
the manual.

## 9. Questions for the owner

Numbered here; if accepted they take the next free numbers of PLAN.md §11.

- **QA1** — Accessibility target: WCAG 2.1 AA (the legal reference today) or **WCAG 2.2 AA** (the reference of the
  new EN 301 549, little extra work)? *Proposal: 2.2 AA.*
- **QA2** — Keep the conformance page `docs/accessibility.md` (technical section, written with this study) with the
  state, the known gaps and how the project tests it? *Proposal: yes, updated with 9.3.*
- **QA3** — The page for the head teacher and the DPO (§3.3), with ready texts for the record of processing and the
  information notice? *Proposal: yes, for 0.9.0.*
- **QA4** — Optional inventory fields (inventory number, origin, value) and the two lists for the office (§4)? This
  reopens Q73 for the price. *Proposal: yes, optional and off by default.*
- **QA5** — `publiccode.yml` and the Developers Italia listing after 9.36? *Proposal: yes.*
- **QA6** — MARC export, and MARC import? *Proposal: export for 0.9.0, import after.*
- **QA7** — A preset for accessible books (§8)? *Proposal: yes, small.*

## Sources

- Legge 9 gennaio 2004, n. 4, and D.Lgs. 10 agosto 2018, n. 106 — [Normattiva](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2004-01-09;4)
- AgID, *Linee guida sull'accessibilità degli strumenti informatici* (PA edition, 21/12/2022) —
  [agid.gov.it](https://www.agid.gov.it/sites/agid/files/2024-06/Linee%20Guida%20sull%27accessibilit%C3%A0%20degli%20strumenti%20informatici%20-%20PA.pdf)
- EN 301 549 v4.1.1 and WCAG 2.2 — [Level Access](https://www.levelaccess.com/compliance-overview/en-301-549-compliance/),
  [W3C, What's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- D.I. 28 agosto 2018, n. 129, art. 29–34 — quoted through a school's inventory regulation
  ([example](https://istitutosalutaticavalcanti.edu.it/sitovecchio/wp-content/uploads/2021/10/Regolamento-inventari-2021.pdf))
  `[VERIFY: the decree's own text on Normattiva]`
- Garante per la protezione dei dati personali, *La scuola a prova di privacy* —
  [garanteprivacy.it/temi/scuola](https://www.garanteprivacy.it/temi/scuola)
- Developers Italia, publishing software and `publiccode.yml` — [developers.italia.it](https://developers.italia.it/en/reuse/publication)
- AgID, *Linee guida su acquisizione e riuso di software per le PA* —
  [docs.italia.it](https://docs.italia.it/italia/developers-italia/gl-acquisition-and-reuse-software-for-pa-docs/en/master/software-acquisition/introduction-and-legislative-context.html)
- ACN, regulation on infrastructures and cloud services for the PA (2024) —
  [Agenda Digitale](https://www.agendadigitale.eu/infrastrutture/il-nuovo-regolamento-per-il-cloud-della-pa-novita-e-impatti/)
