# Design system

Living reference for BiblioViva's look and feel (PLAN.md §3.18, step 0.9). The executable version is the style guide at
`/dev/ui` (development and test builds only).

## Theme

- Nine generated colour sets (`src/lib/themes/*.css`, ADR-010: `ocean`, `forest`, `grape`, `sunset`, `cherry`, `lagoon`, `silver`, `graphite`, `apricot`) sharing the shape and type tokens of `src/lib/theme.css`; `ocean` is the default (blue primary, orange secondary, teal tertiary). Formerly the Skeleton preset `cerberus`:
  violet secondary, pink tertiary, green success, amber warning, red error, neutral grey surfaces.
- **Every usable element gives feedback.** Buttons, links, selectable cards and swatches, menu items and navigation
  entries all have a visible hover state (darker or tinted background, border or shadow) and a pointer cursor; grey
  tonal buttons darken, coloured tonal buttons move to the 200 shade (`app.css`). Only the logo, a plain link home,
  is exempt by the owner's request.
- **Light only.** `color-scheme: light`; Tailwind's `dark` variant is bound to `[data-mode='dark']`, an attribute the
  app never sets, so no dark style can apply. `scripts/check-build.ts` fails the CI when the shipped CSS contains a
  `prefers-color-scheme: dark` query.
- Contrast: every filled `*-500` preset has its text colour overridden to white or `surface-950` so it reaches
  **4.5:1** (`src/lib/ui/theme-contrast.test.ts` checks the preset + overrides on every run).
- Fonts: **Inter** for text and **JetBrains Mono** for codes (`font-mono`), served by the app itself, so it works
  offline and looks the same on every device (ADR-044). SVAR grids use the same font.

### Tokens (from the theme, used through Skeleton utilities)

| Token | Use |
|---|---|
| `--color-primary-*` | main actions, links, selected state, active navigation |
| `--color-secondary-*` | secondary emphasis (rarely) |
| `--color-tertiary-*` | "reference / not for loan" status |
| `--color-success-*` | available, returned, printed, saved |
| `--color-warning-*` | due soon, damaged, in repair, pending print |
| `--color-error-*` | overdue, lost, destructive actions |
| `--color-surface-50…950` | page background (50), cards (100), borders (200/300), muted text (500), body text (950) |
| `--radius-base` 0.5rem, `--radius-container` 0.75rem | controls and cards |
| `--spacing` 0.25rem | 8-pt rhythm through Tailwind spacing |
| `--bv-area-<area>-tint\|strong\|nav\|deep\|text` | the colour of each area in the top bar and the menus (step 9.16) |

### Area colours

Every area of the navigation colours the top bar with a fixed hue, the same in every colour set, at the set's
intensity (`AREA_HUES` and `areaTone` in `src/lib/shared/theme-palette.ts`); `ui.areaStyle` chooses tinted, filled,
accents or no colour. The reference page [design/area-colors.html](design/area-colors.html) shows the bars, the menus
and the phone's bottom bar in all fifteen sets and four styles, with colour-blind and black-and-white views, the
distance and contrast checks, the hue table and the rules, in Italian and English; it opens from the file system and
is the source of the guides' screenshots of this feature. `bun run themes:generate` rewrites its data block together
with the theme files, and `scripts/area-colors-page.test.ts` fails when the committed page is out of date.

## Icons

Lucide through `@lucide/svelte`, imported per icon. **One icon per concept**, defined once in
`src/lib/ui/icons.ts` (`icons.patron`, `icons.loan`, `icons.overdue`, …). Sizes: 16 inline, 20 in buttons and
badges, 24 in headers and navigation (`ICON_SIZE`). Decorative icons carry `aria-hidden="true"`; icon-only buttons
carry an `aria-label`.

## Status = colour + icon + text

Never colour alone. `src/lib/ui/status.ts` defines the triples for item, loan, patron and print statuses;
`StatusBadge.svelte` renders them with the i18n label (`common.statuses.*`). Overdue is always red with the alarm
icon, due soon amber with the clock, available green with the check, reference blue with the book.

## Layout patterns (`src/lib/ui/`)

| Component | Job |
|---|---|
| `PageHeader` | title, subtitle, optional icon tile and back arrow, all in the top bar (one row of the same height on every page from tablets up, the title cut short with its tooltip); `views` and `actions` make the page's toolbar under the bar: a card with the switch between views and, on its right, the buttons (on a row of their own when they do not fit beside the views); it also writes the browser tab's title (`<title>` in the head, so the server's answer has it: "Prestiti · BiblioViva"), `docTitle` when the tab says something else; only pages without one (login, setup, the error page, the record pages of `DetailLayout`, a print list while it loads) write their own |
| `ListToolbar` | search box, filter chips or selection actions (when rows are selected), secondary actions such as "Esporta" |
| `FormLayout` + `FormSection` | sections of fields, collapsible advanced sections, sticky save bar on phones |
| `DetailLayout` | the kind of page in the top bar (`heading`: "Scheda del libro", the same for every record); a header card with photo/cover (beside the title from `lg`, above it on a tablet), the record's title (the page's `h1`), subtitle and key facts, the actions at its bottom right; then tabs |
| `EmptyState` | icon, message and the next action |
| `QueryState` | the states of a remote query, the same on every page: an error `Alert` with "Si è verificato un errore" (`errorText` for another text; `mode="notFound"` with `back` for a record page: an empty state with the way back), the wait (`Loading` in the `size` given, or a `loading` snippet of the page's own), the `empty` snippet when `isEmpty` says so, then the content with the loaded value; ready means the query's `ready`, an error comes before a value kept from before |
| `Loading` | the one wait of the app: the large turning icon with "Caricamento…", centred in the room the content will take (`WaitOverlay` shows it over the page's part of the window during a page change) |
| `DataGrid` (`src/lib/components/`) | the only data table, see ADR-004 |

Every screen is assembled from these patterns plus Skeleton components (Dialog, Toast, Combobox, Tabs, Pagination).

**Views and actions never look alike** (9.13, rounds 24–25): a switch between views (the pages of an area, `AreaTabs`; a filter; the tabs of a record, Skeleton `Tabs` styled in `app.css`) is `ChoiceButtons`, pills with the buttons' corners a little apart in one grey track, the current one tinted with a blue border (with a tick in `ChoiceButtons`); an action is a `Button`, the main one filled. On a phone the pills stay on one line that scrolls sideways.

## Building blocks (step 1.15)

Repeated Tailwind class sets are not allowed in pages and feature components: a set of **3+ classes used twice**
or **2 classes used four times** must become a component in `src/lib/ui/`. `bun run ui:audit` (part of `bun run ci`)
counts the static class sets of every `.svelte` file outside `src/routes/dev` and fails when a set crosses a threshold
(`--verbose` lists the files). The blocks, all with pass-through attributes (`data-testid`, `aria-*`, handlers):

| Component | Props | Job |
|---|---|---|
| `Button` | `variant` (`primary`, `tonal`, `outlined`, `error`, `error-outlined`, `error-tonal`, `success-tonal`, `primary-tonal`), `size` (`md`, `sm`), `icon`, `full`, `href`/`download`/`target`/`rel` | the button; renders an `<a>` when `href` is given, icon + label layout built in |
| `IconButton` | `icon`, `label` (aria), `variant` (`ghost`, `tonal`, `error`), `size` | icon-only action with an accessible name |
| `FileButton` | `accept`, `multiple`, `onchange`, children | file input styled as a tonal button |
| `Hint` | `tone` (`muted`, `faint`, `soft`, `error`, `error-soft`, `primary`), `as` (`p`, `span`), `mono` | small helper text under fields and grids |
| `Alert` | `tone` (`error`, `warning`, `info`, `success`), `padded`, `soft`, `mono`, `as`, `live` | inline message boxes; `role="alert"` by default for errors |
| `Page` | `width` (`md`, `lg`, `xl`, `2xl`), `gap` (`6`, `8`) | the page container; each width grows with large windows (from 1536 and 1800 px wide), unchanged up to the 1280 px reference: `md` forms, `lg` default, `xl` dashboards and editors, `2xl` grids |
| `Card` | `variant` (`plain`, `outlined`, `filled`), `padding` (`md`, `lg`, `none`), `gap`, `as` | soft card with the app's shadow and radius |
| `Badge` | `tone` | small pill for counts and secondary statuses (statuses themselves use `StatusBadge`) |
| `Row` | `wrap`, `align`, `justify`, `gap` (0–4), `column`, `as` | one flex row (or column) of controls |
| `Grid` | `cols` (`2`, `3`, `auto`), `from` (`sm`, `md`), `lg3`, `gap`, `span`, `as` | responsive grid of fields or cards |
| `Field` | `label`, `hint`, `errors`, `span` | label + control + hint + validation errors |
| `Input`, `Select`, `Checkbox` | `bind:value` / `bind:checked`, `mono`, `auto` | the form controls with the shared look |
| `Link` | `href` | inline link with the primary colour and underline on hover |
| `Table` | children | plain table for small read-only lists (data tables use `DataGrid`) |
| `MenuPanel` + `MenuItem` | `minWidth` (`44`, `48`, `56`); `value`, `href`, `download`, `icon`, `iconSize`, `strong`, `tone` (`error`), `disabled`, `onclick` | the parts of a Skeleton `Menu` (positioner, panel, highlighted entries; a destructive entry in red, an unusable one greyed) |
| `PageActions` | `actions` (`PageAction[]`: `key`, `label`, `icon`, `href`, `download`, `onclick`, `disabled`, `primary`, `danger`, `testid`), `keep` (2) | the actions of a page header: all buttons when they fit on the row with 48 px to spare, else the first ones (at most `keep`, as many as fit) beside `MoreMenu` with the rest; the main action first, a destructive one last |
| `MoreMenu` | `MenuItem` entries as children | the "Altre azioni" menu (a ⋮ button of the buttons' height), used by `PageActions` |
| `SegmentedGroup` | `fit` | pill selector for a small set of options (selected item is a filled pill, never an underline) |
| `Steps` | `steps`, `current` | segmented step bar of the wizards; non-current labels are visually hidden on phones |
| `OrderedList` | children | numbered instructions |
| `GridFooter` | children | the strip under a `DataGrid` (row count on the left, export menu on the right) |
| `TitleHint` | `title`, children (the muted line) | a bold line with a muted line under it: option labels, list entries, section links |
| `SelectCard` | `selected`, `label` | a full-width selectable card (template lists): filled and fully bordered when selected, hover feedback |
| `DialogFrame` | `width` (`md`, `lg`), `animated` | backdrop, positioner and card of a Skeleton `Dialog`; the caller renders header, body and footer |
| `DialogHeader` | `title`, `note` | the header of every dialog: title, a muted note after it, the close button |

Each block is shown in `/dev/ui`. When a new repeated pattern appears, add a prop to the closest block rather than a
new class set. TypeScript functions declare their return type (ESLint `explicit-function-return-type` and
`explicit-module-boundary-types`, expressions and typed callbacks excepted).

## Mobile

Designed for a 412 × 915 CSS px viewport (Q77): bottom navigation, 44 px touch targets, thumb-reachable primary
actions, full-screen camera flows, grids with horizontal scrolling.

## Notifications (toasts)

`toaster` (`#lib/ui/toaster.ts`) is the only way to show a toast: `toaster.success | info | warning | error({ title,
description })`. Placement follows the owner's decision of step 3.8b: **bottom right on desktop**, **top centre on
phones** (below the `md` breakpoint the bottom holds the navigation bar and the sticky save bars), chosen when the toast
is shown; two stores rendered by two `ToastStack` components in the root layout. Each toast is coloured by type with its
status icon and a thick accent on the leading edge (colour is never the only cue: icon and text carry the meaning), stays
6 s, errors stay until closed; at most three at a time on a phone. The motion is a short slide and fade, off under
`prefers-reduced-motion`.

## Motion and microcopy

150–200 ms transitions, disabled under `prefers-reduced-motion`. Italian first, operator vocabulary
("copia", "segnatura" — never "collocazione"), action verbs on buttons, messages that say what happened and what to do
(PLAN.md Appendix I for the circulation desk: each reason code's key, tone and fixed actions are built in
`#lib/components/circulation/desk-message.ts`, never written in a page).

## Dates and numbers

One language and one time zone per installation: components format with `useFormat()` (`#lib/ui/format.ts`, set by
the root layout from its data) — `day(isoDay, shape)` for calendar days (due dates, closures), `date(instant, shape)`
and `dateTime(instant)` for instants on the library's clock (`library.timezone`), `number(value, options)` — and never
take the locale or the time zone as props. The year of new codes comes from the layout data (`libraryYear`), never
from the browser's clock. Component tests mount with `formatContext()` (Italian, Europe/Rome) beside the i18n context.
