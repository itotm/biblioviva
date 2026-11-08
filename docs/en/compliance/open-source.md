# Free software in public administration

This page covers the rules of the Digital Administration Code on the choice and reuse of software in public
administrations. It is written for the head teacher, the DSGA and the officer for digital transition (RTD), who have to
give reasons for adopting software.

## What the rule asks

- Codice dell'amministrazione digitale (CAD, the Digital Administration Code, D.Lgs. 82/2005), article 68. Before
  acquiring software, the administration makes a comparative technical and economic evaluation among the available
  solutions. The article lists them: software developed on behalf of the public administration, reuse of software of
  other administrations, free or open source software, cloud software, proprietary software under a license of use, and
  combinations of these solutions. The evaluation takes into account the total cost, the use of open data formats and
  interoperability standards, and the supplier's guarantees on security, data protection and service levels.
- CAD, article 69. It covers reuse: an administration that owns software developed to its own specifications must make
  its source code available, with the documentation, in a public repository and under an open license. It does not
  concern a school that uses existing software, such as BiblioViva.
- AgID guidelines on the acquisition and reuse of software for public administrations. They explain how to make the
  comparative evaluation and how to publish the software to be reused.
- Developers Italia catalogue. It is the list of free software that administrations can reuse. Software enters it
  with a description file, `publiccode.yml`, in the software's public repository.

The rule does not say whether and how to document the comparative evaluation for software that is downloaded free of
charge: it is a decision of the school.

## What BiblioViva does

### License

BiblioViva is free software, under the GNU General Public License version 3 or later (GPL-3.0-or-later). The license
allows anyone, a school included, to:

- use the software for any purpose, without paying any license;
- study its source code;
- modify it;
- redistribute it, also modified, under the same license.

The source code is public on [GitHub](https://github.com/itotm/biblioviva). The license and the address of the code can
also be read in BiblioViva's [About](../manual/screens/about.md) page; the same page lists the **Libraries used**, that
is, the programs by others that are inside BiblioViva.

### The publiccode.yml file

In the main folder of the repository there is the file
[publiccode.yml](https://github.com/itotm/biblioviva/blob/main/publiccode.yml). It is written according to the
[publiccode.yml](https://yml.publiccode.tools) standard (version `0`) and describes the software so that a catalogue
can read it by itself: the name, the address of the code and of the documentation, the license, the category (integrated
library system), the type (web application), the development status (beta), the scope (education, Italy), the
descriptions in Italian and in English, the contact of whoever maintains the project and the dependency on Docker.

The Developers Italia catalogue reads the file from public repositories. Whether BiblioViva is in the catalogue is
checked on the [Developers Italia](https://developers.italia.it) site. A test of the project checks that the file
respects the mandatory fields and the values allowed by the standard.

### Data usable outside BiblioViva

The data stay in the following formats, readable without BiblioViva (the [Exports](../admin/screens/exports.md) page
describes the entries).

- Lists in CSV, from **Administration** → **Exports**: students, teachers, catalogue (one row per copy), loans in
  progress and loan history. The first four are in the format of BiblioViva's imports.
- A single JSON file with patrons, catalogue, loans and lists, «to move to another installation or program».
- The data of a single person, in JSON, from the patron's record, to answer an access request.
- The tables and reports that are downloaded from their lists, in CSV or in ODS (the open spreadsheet format of
  LibreOffice).
- The configuration as a single ZIP archive, from **Administration** → **Configuration**.
- The backups: the database is an SQLite file, an open and documented format, and **Export everything** downloads a ZIP
  archive with the database, the photos, the covers and the configuration. They are restored on another installation of
  BiblioViva.

The catalogue is not exported in the MARC format, which many library programs read: to take it elsewhere, CSV is used,
which the other program must be able to import.

## What the school does

- The comparative evaluation of article 68 stays with the school, which compares BiblioViva with the other solutions it
  considers possible and gives reasons for its choice.
- In the evaluation the school can cite: the free license and the absence of a license cost; the public code; the
  documentation, which is public; the `publiccode.yml` file, with the presence or not in the Developers Italia
  catalogue; the export formats described above, which meet the criterion of open data formats.
- Consider in the total cost also what the free software does not include: the computer to install it on, whoever
  manages it and how support is obtained; the `publiccode.yml` file declares community maintenance.
- The guarantees on security and data protection that article 68 asks of suppliers are, for BiblioViva, those that the
  school itself provides on its own computer: see [IT security](security.md) and [Personal data
  protection](data-protection.md).

## References

- [Codice dell'amministrazione digitale (D.Lgs. 7 March 2005, no. 82)](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82),
  on Normattiva (in Italian), with
  [article 68](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82~art68) and
  [article 69](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82~art69).
- [Guidelines on the acquisition and reuse of software for public administrations](https://www.agid.gov.it/it/design-servizi/riuso-open-source/linee-guida-acquisizione-riuso-software-pa),
  on the AgID site (in Italian).
- [Developers Italia](https://developers.italia.it), the catalogue of free software for public administration (in
  Italian).
- [publiccode.yml standard](https://yml.publiccode.tools).
- [GNU General Public License, version 3](https://www.gnu.org/licenses/gpl-3.0.html), the text of the license.
- BiblioViva's code on [GitHub](https://github.com/itotm/biblioviva).
