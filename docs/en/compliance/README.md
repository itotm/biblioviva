# Compliance

This section gathers what the rules ask of a school that adopts BiblioViva, what BiblioViva does about it and what is
left to the school. It is written for the head teacher, the school's administrative manager (DSGA), the data
protection officer (DPO) and the officer for digital transition (RTD).

The pages give the facts useful for the school's evaluations, each one checked in BiblioViva's code; the decisions
belong to the school and its DPO, and the pages are not legal advice. Where the rule leaves a point open, the page says
so.

## Why these rules

A state school is a public administration: [D.Lgs. 165/2001 (legislative decree), article 1, paragraph
2](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2001-03-30;165~art1) (in Italian) includes
"educational institutions and schools of every type and level" among the administrations of the State. For this
reason the rules on public administrations apply to the tools the school adopts, in particular those on software, on
accessibility and on IT security, in addition to the data protection rules that apply to every data controller.

The Codice dell'amministrazione digitale (CAD, the Digital Administration Code) assigns to every administration an
officer for digital transition ([article
17](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82~art17), in Italian), the
office or the person who follows digital matters, among them security, accessibility and the purchase of software. In
schools this is the person who usually evaluates, with the head teacher and the DPO, a software such as BiblioViva.

## The rules at a glance

The table lists the rules that concern a school that adopts BiblioViva. The column "What BiblioViva does" says what the
software does today; the page named in the last column gives the details, what is left to the school and the official
references.

### Data protection

| Rule | What it asks | What BiblioViva does | Page |
|---|---|---|---|
| Regulation (EU) 2016/679 (GDPR) | From the school, as data controller: record of processing activities, information notice, minimisation, security measures, answers to the requests of data subjects | Keeps the data on the school's computer; the patron's record holds only what lending needs; removal deletes the identifying data at once; exports the data of one person; the page gives the texts for the record and the notice | [Personal data protection](data-protection.md) |
| D.Lgs. 196/2003 (Personal Data Protection Code, "Codice privacy"), amended by D.Lgs. 101/2018 | The Italian rules that complete the GDPR, among them the legal basis for processing in the public interest | As above; photos and covers can be switched off, and the choice of the legal basis for photos is left to the school and its DPO | [Personal data protection](data-protection.md) |

### Accessibility

| Rule | What it asks | What BiblioViva does | Page |
|---|---|---|---|
| Law 4/2004 and AgID guidelines (AgID is the Agency for Digital Italy) | Accessible IT tools, even when used on an internal network; assistive technologies for an employee with a disability | Aims at WCAG 2.2 level AA, checked with automatic and manual tests; the known limits are written down | [Accessibility](accessibility.md) |
| EN 301 549 | The technical reference of the guidelines: version 3.2.1 for WCAG 2.1 AA, 4.1.1 for WCAG 2.2 | WCAG 2.2 AA includes the criteria of 2.1 AA; the checks are the project's own, not a certification by a third party | [Accessibility](accessibility.md) |

### Inclusion

| Rule | What it asks | What BiblioViva does | Page |
|---|---|---|---|
| Law 170/2010 (specific learning disorders) | From the school, teaching and tools suited to pupils with specific learning disorders | Configurable reading levels, types of material and accessible formats of books; accessible interface | [Inclusion](inclusion.md) |
| Law 104/1992 (persons with disabilities) | From the school, the integration and the right to education of pupils with disabilities | As above | [Inclusion](inclusion.md) |

### Asset inventory

| Rule | What it asks | What BiblioViva does | Page |
|---|---|---|---|
| D.I. 129/2018 (interministerial decree), article 31 | Books and bibliographic material among the assets inventoried by the school, with serial number, origin, place, condition and value | With the school inventory on (optional) records on each copy the inventory number, origin and value, and offers the lists of the copies entered and withdrawn in a period; records the date of acquisition and the withdrawal of the copy, with its day and reason; the inventory register stays with the school | [The school's inventory of assets](school-inventory.md) |

### Software in public administration

| Rule | What it asks | What BiblioViva does | Page |
|---|---|---|---|
| CAD, articles 68 and 69 | Comparative evaluation before acquiring software; reuse of software developed for public administrations | Free software under the GPL-3.0-or-later licence, public code, no licence cost; exports in open formats, including the catalogue in MARC 21 and UNIMARC | [Free software in public administration](open-source.md) |
| AgID guidelines on acquisition and reuse | How to make the evaluation and how to publish software for reuse | Has the `publiccode.yml` file in the repository, required for the Developers Italia catalogue | [Free software in public administration](open-source.md) |

### IT security

| Rule | What it asks | What BiblioViva does | Page |
|---|---|---|---|
| AgID minimum ICT security measures (Circular 2/2017) | From the school, measures on the inventory of systems, configurations, administrator users, backups | Accounts with permissions, passwords stored as a hash, audit log, nightly backup; does not update itself; the AgID form is filled in by the school | [IT security](security.md) |
| GDPR, article 32 | Technical and organisational measures appropriate to the risk | The same measures; backups are not encrypted | [IT security](security.md) |

### Cloud

| Rule | What it asks | What BiblioViva does | Page |
|---|---|---|---|
| ACN regulation on cloud services for public administrations (ACN is the National Cybersecurity Agency) | Cloud services qualified by the ACN for the data and services of the administration | Is installed on the school's computer, is not a cloud service; Tailscale and the external copy are optional choices of the school | [IT security](security.md) |

## Rules that do not concern BiblioViva

Some rules may be believed to apply to school software. [Other rules](other-rules.md) says for each one what it asks
and why it does not concern BiblioViva, or concerns it only in part.

| Rule | Outcome |
|---|---|
| European Accessibility Act (directive (EU) 2019/882) | Concerns products and services for consumers: not BiblioViva |
| NIS 2 (directive (EU) 2022/2555, D.Lgs. 138/2024) | Schools are as a rule outside its scope, according to the ACN FAQ |
| SPID and CIE (CAD, article 64) | Concern online services to citizens: BiblioViva has none |
| pagoPA (CAD, article 5) | Concerns payments to the public administration: BiblioViva handles no payments |
| Copyright (Law 633/1941) | Concerns in part the book covers: whether to keep them is for the school to decide |
| Electronic documents and their preservation (AgID guidelines) | Concern the school's official records: BiblioViva keeps the library's working registers |

The whole section can be downloaded as a single PDF file from the documentation site.

## Related pages

- [Overview](../features.md)
