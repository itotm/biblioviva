# Accessibility

This page covers the rules on the accessibility of the IT tools of public administrations, that is, Law 4/2004 and the
guidelines of AgID (the Agency for Digital Italy). It is written for the head teacher, the officer for digital
transition (RTD) and whoever at the school evaluates BiblioViva before adopting it.

## What the rule asks

- Law 4/2004 (the «Legge Stanca», the Italian accessibility law), amended by D.Lgs. 106/2018 (legislative decree), which
  transposes Directive (EU) 2016/2102. It obliges public administrations, state schools included, to make their IT tools
  accessible.
- AgID guidelines on the accessibility of IT tools. They refer to the European standard EN 301 549, version 3.2.1. For
  web content the rule requires conformance to WCAG 2.1 level AA. The WCAG (Web Content Accessibility Guidelines) are
  the W3C's international guidelines: a list of verifiable criteria, such as colour contrast, use with the keyboard
  alone, understandable error messages. Level AA is the intermediate level, the one required.
- Applications on an internal network. The guidelines (paragraph 2.2) extend the web requirements to internet
  applications made available on intranet networks. BiblioViva is opened from the browser on the school's network or on
  the private Tailscale network: it is a web application used on an internal network. As a precaution it is advisable
  to treat it as subject to the requirements, because it falls within the description in the guidelines.
- Employees with disabilities (Law 4/2004, art. 4, paragraph 4). The employer gives the employee with a disability the
  hardware, software and assistive technologies suited to their work. A member of staff who uses a screen reader or a
  magnifier must be able to work at the library desk with BiblioViva.
- Version 4.1.1 of EN 301 549. It has been published and is aligned with WCAG 2.2. It becomes the legal reference when
  it is cited in the Official Journal of the European Union and AgID updates its guidelines. WCAG 2.2 includes the
  criteria of WCAG 2.1.
- European Accessibility Act (Directive (EU) 2019/882, D.Lgs. 82/2022). It covers products and services offered to
  consumers. Free software that a school installs for its own staff is not one of these: the rule does not apply to
  BiblioViva.
- Accessibility statement. It is the document, filled in on AgID's form, in which an administration says how far the
  accessibility of its websites and mobile applications has got. The guidelines do not expressly provide for a statement
  for an internal tool such as BiblioViva. If the school decides to make one, this page and the [technical
  page](../../accessibility.md) are the material to start from.

## What BiblioViva does

The aim of the project is conformance to WCAG 2.2 level AA, which includes the level AA of WCAG 2.1 required today. It
applies to the application, to the documentation site and to the presentation page.

### How it is checked

- Every main page is checked by an automatic accessibility testing tool at every run of the project's tests, both in
  the computer window and in the phone window. The same check is made on a form with errors, on an open dialog and on
  the camera opened on a phone. The project admits no serious violations.
- The circulation desk is tried with the keyboard alone, as happens with the USB barcode scanner, which types like a
  keyboard. Also tried are the link to skip to the content, which the first Tab key reaches, the visible mark of where
  the keyboard is and moving through lists with the arrow keys.
- Eleven main pages are tried at a width of 320 pixels, that of a page zoomed to 400 %, and no element may go outside
  the window.
- Colour contrast is checked for each of BiblioViva's colour sets: texts, buttons, field borders and hint text.
- In forms, the hint and the errors of a field are tied to the field itself, so that a screen reader reads them
  together with it. A screen reader is software that reads aloud what appears on the page, used by people who cannot
  see or who see little.

These are checks of the project itself. Automatic tools do not cover all the criteria. For this reason the project
also provides manual checks before every version that changes the screens: a screen reader on the circulation desk (NVDA
with Firefox or Chrome, Orca on Linux), a form with errors, the lists, the dialogs and the notifications; zoom at 200 %
and 400 %; text spacing; the Windows high-contrast themes.

### What is respected

- The language of the page follows that of the installation. Every page has a title of its own, a single main area, a
  link to skip to the content and menus with a name.
- The circulation desk messages are announced by screen readers and always say what happened with colour, icon and
  text: colour is never the only cue. After every read the cursor stays in the read field.
- The camera is never indispensable. Every code can be typed or read with the USB scanner, and every photo or cover can
  be uploaded as a file.
- No operation requires dragging with the mouse: the crop of a photo, the corners of a cover and the frames of a class
  picture are moved with the arrow keys and with a tap. In the drawing of the print templates the positions are set with
  the arrow keys and with numeric fields.
- Dialogs keep the keyboard inside them, close with the Esc key and return the keyboard to where it was before. Buttons
  with only an icon have a name that screen readers can read.
- The login page accepts the password manager and pasting the password, and it proposes no memory or arithmetic tests.
- A login lasts days and is renewed with use: no time limit interrupts the work.
- Text sizes follow those of the browser and zoom is never blocked. On the phone the buttons are at least 44 pixels
  large. If the system asks for less motion, the animations are switched off.

### Known limits

- On the computer the top bar shows the page title on a single line; the whole title is in the description that appears
  when the mouse passes over it and in the page heading. On the phone, and therefore with any strong magnification, the
  title is shown in full.
- The Tab key reaches the menu first, then the page and finally the buttons of the top bar (help, account): it is the
  order of the document.
- A title in a language different from that of the installation, for example the title of an English book in an Italian
  record, is not flagged as such to screen readers, because a book's record has no field for the language.

The detail of the criteria and of the tests is in the technical page [Accessibility](../../accessibility.md), in
English.

## What the school does

- Take this page and the [technical page](../../accessibility.md) as a self-assessment of the software, to cite in the
  evaluation of BiblioViva.
- Decide with the officer for digital transition whether the school wants an accessibility statement that includes
  BiblioViva. The guidelines do not expressly ask for one, as said above.
- Give the member of staff who needs it the assistive technology necessary for the work at the desk: a screen reader, a
  magnifier, a suitable keyboard.
- Try BiblioViva with the assistive technology the school already has, and report the problems found.
- Report an accessibility problem by opening an issue among the [project's issues on
  GitHub](https://github.com/itotm/biblioviva/issues): a GitHub account is needed, which is free.

## References

- [Law 9 January 2004, no. 4](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2004-01-09;4), on Normattiva
  (in Italian).
- [Legislative Decree 10 August 2018, no. 106](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2018-08-10;106),
  on Normattiva (in Italian).
- [Directive (EU) 2016/2102](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016L2102), on EUR-Lex.
- [Accessibilità e usabilità](https://www.agid.gov.it/it/ambiti-intervento/accessibilita-usabilita), the AgID page with
  the guidelines and the statement form (in Italian).
- [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/), the English text, which is the
  authoritative one. An [Italian translation](https://www.w3.org/Translations/WCAG22-it/) is authorised by the W3C.
- [EN 301 549 v3.2.1](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf) and
  [EN 301 549 v4.1.1](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/04.01.01_60/en_301549v040101p.pdf), on
  ETSI.
- [Accessibility](../../accessibility.md): BiblioViva's technical page, in English.
