# Other rules

This page lists the rules that may be believed to apply to a school that adopts library software, but that do not
concern BiblioViva, or concern it only in part. For each one it says what the rule asks and why it does not apply, or
what BiblioViva does about it. It is written for the head teacher, the DSGA, the DPO and the officer for digital
transition (RTD).

## European Accessibility Act

Directive (EU) 2019/882, transposed in Italy by D.Lgs. 82/2022 (legislative decree), sets accessibility requirements
for certain products and services offered to consumers: for example computers, e-commerce, banking services, e-books
and transport. Free software that a school installs for its own staff is neither a product nor a service for consumers,
and the directive does not concern BiblioViva. The accessibility rules that apply to the school are those of Law
4/2004, described in the page [Accessibility](accessibility.md).

## NIS 2

Directive (EU) 2022/2555 (NIS 2), transposed by D.Lgs. 138/2024, asks the entities within its scope to register on the
platform of the Agenzia per la cybersicurezza nazionale (ACN, the National Cybersecurity Agency), to adopt security
measures and to notify significant incidents. Among public administrations, those listed in annex III of the decree are
included, whatever their size.

The ACN's frequently asked questions (answer AMB.PU.1, on the scope) list schools among the entities that, as a general
rule, are outside the scope. The list is called indicative and not exhaustive, and the exception concerns entities that
carry out activities of annexes I and II of the decree or that receive a notice of designation from the ACN. The same
result is reported by
[ItaliaOggi](https://www.italiaoggi.it/settori/scuola/nuove-regole-per-la-cybersecurity-scuole-fuori-gdnx5m35) (in
Italian): primary and secondary schools are outside the scope and do not have to register on the ACN platform. Unless
the ACN designates it, NIS 2 therefore creates no obligation for the school that concerns BiblioViva. The AgID minimum
ICT security measures and article 32 of the GDPR remain, described in the page [IT security](security.md).

## Digital identity, SPID and CIE

Article 64 of the CAD (the Digital Administration Code) provides that public administrations, when an online service
requires the identification of the user, do it with SPID (the Public Digital Identity System) or with the electronic
identity card (CIE). The rule concerns the services that the administration offers to citizens online. BiblioViva has
no access for pupils, families or other citizens: only the library staff log in, with an account defined in the
configuration or created by the administrator. The rule does not concern BiblioViva.

## pagoPA

Article 5 of the CAD obliges public administrations to accept payments in their favour by electronic means, through the
national platform pagoPA. BiblioViva handles no payments: it provides no fines, penalties or other amounts for delays
or lost books (for a delay it shows only the days), and the value that the school inventory records on each copy gives rise to no payment. The rule does not concern
BiblioViva.

## Copyright and covers

Law 633/1941 (the Italian copyright law) protects copyright. Book covers are images that may be protected, and
BiblioViva treats them as follows:

- By default it looks up the cover by ISBN at Amazon and Open Library and saves it on the school's computer, usually
  reduced to 600 pixels in width; Google Books is available but off (`covers.providers` in
  `config/config.example.json`). The operator can also photograph or upload the cover of a copy.
- Covers are shown only in the catalogue pages, after logging in with a staff account: BiblioViva has no public
  catalogue and does not publish them elsewhere.
- Covers are switched off with the setting **Book covers** (`covers.enabled`): they are no longer looked up online,
  photographed or uploaded, and the catalogue does not show them. Switching them off does not delete the files already
  saved. The procedure is in the guide [Switch off photos or covers](../admin/guides/switch-off-photos-or-covers.md).

The law does not expressly provide for this internal use of covers, that is, showing them only to staff inside a library
catalogue. BiblioViva gives no answer: the decision to keep covers on is the school's, which can ask the opinion of its
DPO or of a lawyer.

BiblioViva itself is free software under the GPL-3.0-or-later licence; the libraries it contains keep their own
licences, and the page [About](../manual/screens/about.md) lists them in the section **Libraries used**. The licence is
covered in the page [Free software in public administration](open-source.md).

## Electronic documents and preservation

The AgID guidelines on the creation, management and preservation of electronic documents regulate how public
administrations create, register, keep and preserve their documents: the school's document management system, with its
electronic registry and the preservation of records.

BiblioViva is neither a document management system nor a preservation system. It keeps the library's working
registers: the patron records, the catalogue, the loans, the lists and the reports. An official act of the school, for
example the decree by which the head teacher removes an asset from the inventory, is created, registered and preserved
with the school's registry system. A list exported from BiblioViva in CSV or ODS can accompany the act, if the school
so decides.

The rule does not say expressly whether the registers of a school library, such as the loan history, are to be treated
as administrative documents to be preserved: the answer is for the school, its document management officer and its
DPO. The retention time of the data of patrons and loans is described in the page [Personal data
protection](data-protection.md).

## References

- [Directive (EU) 2019/882](https://eur-lex.europa.eu/eli/dir/2019/882/oj/eng), on EUR-Lex, and the
  [D.Lgs. 27 May 2022, no. 82](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2022-05-27;82),
  on Normattiva (in Italian).
- [Directive (EU) 2022/2555 (NIS 2)](https://eur-lex.europa.eu/eli/dir/2022/2555/oj/eng), on EUR-Lex, and the
  [D.Lgs. 4 September 2024, no. 138](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2024-09-04;138),
  on Normattiva (in Italian).
- [NIS](https://www.acn.gov.it/portale/nis), the ACN page, and its
  [frequently asked questions on the scope](https://www.acn.gov.it/portale/faq/nis/ambito) (answer AMB.PU.1), both in
  Italian.
- [Nuove regole per la cybersecurity, scuole fuori](https://www.italiaoggi.it/settori/scuola/nuove-regole-per-la-cybersecurity-scuole-fuori-gdnx5m35),
  article in ItaliaOggi (in Italian, partly behind a paywall).
- CAD, [article 5](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82~art5)
  (payments) and [article 64](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82~art64)
  (digital identity), on Normattiva (in Italian).
- [SPID](https://www.spid.gov.it/), [CIE](https://www.cartaidentita.interno.gov.it/) and
  [pagoPA](https://www.pagopa.gov.it/), the sites of the three systems (in Italian).
- [Law 22 April 1941, no. 633](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1941-04-22;633), on
  Normattiva (in Italian).
- [Guidelines](https://www.agid.gov.it/it/linee-guida) of AgID, with the guidelines on the creation, management and
  preservation of electronic documents (in Italian).

## Related pages

- [Compliance](README.md)
- [Accessibility](accessibility.md)
- [IT security](security.md)
- [Free software in public administration](open-source.md)
