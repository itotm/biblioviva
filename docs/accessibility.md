# Accessibility

BiblioViva is used by the staff of a school library, and an Italian state school is a public administration: the
accessibility rules for public administrations apply to the tools it adopts. This page records the target, how the
project tests it, what is met and what is still open. It is for maintainers and for whoever, at a school, has to
assess the program (the head teacher, the Responsabile per la transizione digitale); the reasoning behind it is in
[the adoption study](studies/adoption.md).

## The rules and the target

- **Legge 4/2004** («Legge Stanca»), amended by D.Lgs. 106/2018 (Directive (EU) 2016/2102), and the **AgID
  guidelines** on the accessibility of IT tools require of public administrations, schools included, the
  requirements of **EN 301 549 v3.2.1**: for web content, conformance to **WCAG 2.1 level AA**. The guidelines apply
  the web requirements also to applications offered on an intranet (§2.2), which is how a school uses BiblioViva.
- The employer gives an employee with a disability the hardware, software and assistive technology the job needs
  (L. 4/2004 art. 4 c. 4): a member of staff who uses a screen reader or a magnifier must be able to work at the desk.
- **EN 301 549 v4.1.1**, aligned with **WCAG 2.2**, has been published and becomes the legal reference once cited in
  the Official Journal of the EU and adopted by AgID.
- The **European Accessibility Act** (D.Lgs. 82/2022) does not concern BiblioViva: it is not a consumer product or
  service.

**Target: WCAG 2.2 level AA** for the application, the documentation site and the home page; it includes WCAG 2.1 AA.
The light theme only (no dark mode) is a product rule and is not an accessibility requirement.

## How it is tested

- **axe** (`@axe-core/playwright`) on 29 main pages at both window sizes, in every e2e run: no serious or critical
  violation (`tests/e2e/a11y.spec.ts`, helper `tests/e2e/helpers/axe.ts`).
- **Keyboard**: the circulation desk used with the keyboard alone, as with a USB scanner; the first Tab reaches the
  link that skips to the page; the focus is visible; no motion when the system asks for less (same spec). The data
  grid opens a row with Enter and moves with the arrows without opening (`src/lib/components/DataGrid.svelte.spec.ts`).
- **Contrast**: every colour set is checked in a unit test (`src/lib/ui/theme-contrast.test.ts`): text on every
  surface, filled and tonal colours at 4.5:1, the border of the fields at 3:1, the placeholder at 4.5:1.
- **Forms**: a field's hint and errors are tied to its control (`aria-describedby`, `aria-invalid`;
  `src/lib/ui/Field.svelte.spec.ts`).

## What is met

- The language of the page follows the installation (`<html lang>`), every page has its own title, one `<main>`, a
  skip link and labelled navigation.
- The desk messages are announced (`aria-live`; `role="alert"` for errors, `role="status"` otherwise) and always say
  what happened with colour, icon and text; the scan field keeps the focus after each scan.
- The camera is never required: every scan can be typed or read with a USB scanner; every photo or cover can be
  uploaded as a file.
- Dialogs trap and return the focus and close with Escape; icon buttons have a translated name; decorative icons
  are hidden from screen readers.
- The login allows the password manager and pasting (`autocomplete`, no cognitive test: WCAG 3.3.8).
- Sessions last days and slide with use: no time limit interrupts the work (WCAG 2.2.1).
- Sizes in `rem`, zoom never disabled, 44 px touch targets on phones; the sticky bars leave room for the focused
  element (WCAG 2.4.11).
- The print template designer moves elements with the arrow keys and numeric fields as well as by dragging
  (WCAG 2.5.7); the help button is in the same place on every page (WCAG 3.2.6).
- The documentation site and the home page have a skip link, `lang`, labelled navigation, visible focus and no
  motion when the system asks for less.

## Known gaps

To be closed in step 9.3 of PLAN.md:

- the top bar (page title, help, account menu) comes after the page in the DOM: a screen reader meets the title after
  the content (WCAG 1.3.2, 2.4.3);
- required fields carry no visible mark before an error (WCAG 3.3.2);
- cropping a patron photo, a cover or a class picture is done by dragging only (WCAG 2.5.7, 2.1.1); uploading a file
  is the alternative today;
- the full-screen camera on a phone is not a modal dialog (focus, Escape);
- a long page title is cut on one or two lines at large zoom (WCAG 1.4.4);
- titles in another language carry no `lang` (WCAG 3.1.2).

Still to be checked by hand: a screen reader (NVDA with Firefox or Chrome, Orca on Linux) on the desk, a form with
errors, the grids, the dialogs and the notifications; zoom at 200 % and 400 % (320 CSS px); text spacing (WCAG
1.4.12); Windows contrast themes (`forced-colors`).

## For the school

The accessibility statement that AgID's guidelines ask of a school («dichiarazione di accessibilità», on AgID's
platform) concerns its websites and mobile apps. For an internal tool such as BiblioViva, this page is the self-
assessment the school can refer to; problems are reported as an issue on GitHub.
