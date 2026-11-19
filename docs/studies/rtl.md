# Study — right-to-left languages (Arabic, Hebrew, Persian, Urdu)

> **Status:** STUDY, open. Nothing here is decided; the steps of §15 are Phase 14 of PLAN.md and the questions of §16
> are its Q160–Q169, whose defaults apply until the owner answers.
> **Audience:** the owner (what a right-to-left interface costs and what it needs from them) and the agent that writes
> the steps of PLAN.md from it.
> **Context:** BiblioViva shows one language per installation (`ui.locale`, PLAN.md §3.16, Q52); the public demo
> follows its visitor (Q120, ADR-047). Language packs (step 9.39, Q136) publish 25 languages; **Arabic and Hebrew wait
> «until the interface can be laid out right to left»**. This study says what that means in the code.
> **Method:** read-only audit of `src/`, `scripts/`, `config/`, `docs/`, `home/`; the libraries read in
> `node_modules` at the versions pinned in `package.json`; small probes run for the doubtful points (the
> SVAR data grid in `dir="rtl"`, `Intl` in Bun, Node, Chromium and Firefox, SQLite FTS5 on Arabic and Hebrew text, the
> text normalisation of the search, Tailwind's logical utilities), their results quoted below. Counts come from a token scan of the
> class strings and style blocks of `src/` (tests excluded); `scripts/check-logical-css.ts` of step 14.1 would
> reproduce them. What could not be verified is marked `[VERIFY]`.
> Estimates are in agent-driven person-days (one day = one working session of the coding agent plus the owner's review),
> tests and docs included, as in the other studies.

## 1. Summary

| Area | Finding | Weight |
|---|---|---|
| Layout code | Only **61 physical-direction Tailwind tokens in 39 of 243 Svelte files**; about 50 convert mechanically, about 5 need judgement, 6 are symmetric (centring) and stay. The app already uses `flex`, `gap`, `justify-between`, and the flex alignments (`justify-start`, `items-end`…) that follow the direction. Plus 4 physical declarations in `app.css` and `Table.svelte` and one `scrollLeft` computation. | **small** (1½ days) |
| `<html>` | `lang` is written in one place (`hooks.server.ts` `transformPageChunk`, with the static default in `app.html`); `dir` goes beside it. Five more generators of HTML documents (print documents, refusal page, manifest, test report) carry `lang` too. `dir`, `<bdi>`, `unicode-bidi` appear **nowhere** in `src/`. | small |
| Direction of a locale | `sveltekit-i18n/utils` exports `textDirection(locale)` (verified: `ar`, `he`, `fa`, `ur`, `ps`, `sd`, `ckb` → `rtl`; `prs` (Dari) → `ltr`, wrong). No list of languages to keep; a pack may need an explicit `dir`. | small |
| Icons | All 97 icons come through `#lib/ui/icons.ts`; Lucide emits a `lucide-<name>` class on every icon. **Four icons carry direction** (`back`, `forward`, `undo`, `logout`) used in about 30 places; one CSS rule mirrors them in RTL. | small |
| Skeleton v5 / Zag | Every machine takes a `dir`; the Skeleton providers read it from a `LocaleProvider`, which the app **does not use**, so they run with `en-US` (LTR) defaults. One wrapper in the root layout fixes tabs, menus, toasts, dialogs. Floating UI resolves `start`/`end` placements by the element's computed direction (verified). | small |
| **SVAR DataGrid** | **No RTL support** (no `dir`, `rtl` or logical property anywhere in `@svar-ui/svelte-grid` 2.7.5). Probe: in `dir="rtl"` the columns lay out from the right, but **after any horizontal scroll the body renders blank** (virtual columns assume a non-negative `scrollLeft`). A grid kept in an LTR island with the columns reversed works. | **the one real blocker** (3 days, risk up to 6) |
| Chart.js 4.6.1 | Options `rtl` and `textDirection` exist on legend and tooltip; axes need `reverse` / `position`; canvas text needs the font loaded first. | small |
| Fonts | Inter and JetBrains Mono have no Arabic or Hebrew. The stack falls back to `system-ui`. Adding Noto Sans Arabic and Noto Sans Hebrew with `unicode-range` costs **no download on Latin pages**; ≈ 163 KB (Arabic) and ≈ 12 KB (Hebrew) when used. | small, an owner choice |
| Bidi | Arabic and Hebrew user data (titles, authors, patron names) already appear in Italian screens and print-outs; a Latin string in an RTL cell shows its final full stop on the wrong side (**probe**). `dir="auto"` / `unicode-bidi: plaintext` fixes the cells; placeholders in messages need isolates. | medium, **useful now** |
| Numbers and dates | `Intl` gives **different digits and calendars by locale code**: `ar` Latin digits, `ar-EG`/`ar-SA` Arabic-Indic, `fa` Persian digits **and the Solar Hijri calendar**, `he` and `ur` Latin. Identical in Bun, Node, Chromium and Firefox. The pack's code decides unless the formatters pin `nu` and `ca`. | medium, an owner choice |
| Scanners | `repairCandidates` repairs six Latin layouts. On an Arabic, Hebrew or Persian OS layout the **letters of the barcodes (`C` of `2026-C0042`, the check letter) come out as other scripts**; six tables are not the answer: capturing the physical key (`KeyboardEvent.code`) covers every layout. | medium |
| Search | `normalizeSearchText` replaces every combining mark and the decomposed hamza of أ إ آ ؤ ئ with a space, **splitting Arabic words** (`إبراهيم` → `ا براهيم`; `שָׁלוֹם` → `ש לו ם`). FTS5 `unicode61 remove_diacritics 2` does not fold Arabic marks or Hebrew niqqud either (`كِتَابُ` is indexed as `ك`, `ت`, `اب`). | medium, **useful now** |
| Segnatura | `author3` keeps `[A-Za-z]` only: **an Arabic, Hebrew, Cyrillic, Greek or Asian author gives an empty call number part.** Needs a Unicode-aware rule and the Arabic article. | medium, **useful now** |
| Print | Sheet geometry is physical and stays; the shipped faces are drawn in mm from the left corner and stay; text elements need `dir`. The designer canvas stays LTR. | medium |
| Packs tooling | `foreignScripts` has no entry for Arabic or Hebrew: **every Arabic message would be refused as `wrong_script`**. Plurals: the six CLDR forms of Arabic are handled by the parser (`zero`…`other`) and checked by `neededPluralCategories`. | small |
| Documentation | 126 pages per language, ≈ 125 000 words, only Italian and English; any other language reads English (`DOCS_LANGUAGES`). Translating it is out of proportion; RTL needs nothing there until it is. | none |
| Effort | **≈ 26 agent-days** for Arabic and Hebrew with their packs (§15), of which ≈ 7 days are useful before any RTL language ships. | — |

## 2. Premises

1. **One direction per installation.** `ui.locale` decides; the direction is derived from it, never stored by
   the owner. In the public demo it follows the visitor's language, and the page reloads (`LanguageSwitch` calls
   `location.reload()`), so a server-written `<html dir>` is enough there. The wizard is the exception: it switches
   language with `goto("setup?lang=…")` and no reload, so `lang` is already stale there; a root-layout effect must keep
   `lang` and `dir` of `<html>` in step with the data.
2. **Mirrored interface, LTR islands.** In RTL the whole interface mirrors (navigation, order of columns, side of
   icons, alignment). What is never mirrored: barcodes, codes (`font-mono`), the print-sheet geometry (millimetres from
   the paper's corner), the template designer's canvas, JSON and HTML editors, e-mail and URLs.
3. **Direction follows the content for user data.** The language of the interface says nothing about the language of a
   title, an author or a name: an Italian school has Arabic-named pupils, an Arabic school has Latin titles.
4. **A language pack is words only.** Direction, digits, fonts and scanner layouts live in the code and are keyed by the
   pack's language code (`pack.json` may add an optional `dir` for the codes the engine cannot resolve, such as `prs`).

## 3. Audit of the layout code

### 3.1 Physical Tailwind utilities (token scan of `*.svelte`, `*.ts`, `*.html` under `src/`, tests excluded)

| Utility | Count | Replacement | Kind |
|---|---:|---|---|
| `ml-*`, `mr-*` (`ml-auto` 11 of them) | 22 | `ms-*`, `me-*` | mechanical |
| `pl-*`, `pr-*` | 10 | `ps-*`, `pe-*` | mechanical (`PasswordInput` three together) |
| `text-left`, `text-right` | 10 | `text-start`, `text-end` | mechanical |
| `left-*`, `right-*` | 11 | `start-*`, `end-*` (or `inset-s-*`, `inset-e-*`, both exist in 4.3.3) | 9 mechanical; 2 `left-1/2` centring pairs stay |
| `border-r`, `last:border-r-0` | 3 | `border-e`, `last:border-e-0` | mechanical |
| `rounded-r-base` | 1 | `rounded-e-base` | mechanical (with `PasswordInput`) |
| `-translate-x-1/2` | 2 | stays (paired with `left-1/2`) | symmetric |
| `inset-x-0`, `inset-x-[10%]` | 2 | stays | symmetric |
| **Total** | **61** | | ≈ 50 mechanical, ≈ 5 judgement, 6 symmetric |

Direction-neutral already: `justify-start/end` (5), `items-start/end` (15), `self-start/end` (7) are `flex-start`/`flex-end`
(they follow the direction); `flex-row` 3; **zero** `space-x`, `divide-x`, `float-*`, `scale-x`, `origin-*`,
`translate-x` outside centring, gradients to the right; one logical utility in use. Tailwind 4.3.3 (verified by
compiling candidates against `node_modules/tailwindcss/dist/lib.mjs`) has `ms-/me-/ps-/pe-/start-/end-/inset-s-/inset-e-`,
`text-start/end`, `border-s/e`, `rounded-s/e/ss/se/es/ee`, `float-start`, `scroll-ms-`, and the `rtl:` / `ltr:` variants
(compiled to `:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)`).

**Top offenders (physical tokens per file):** `routes/(app)/+layout.svelte` 7 (sidebar `border-r`, skip link `focus:left-2`,
`ml-auto` of the trail, three `mr-*`, the bottom bar's `inset-x-0`), `CardTemplatesTab.svelte` 4, `PasswordInput.svelte` 3,
`ScannerOverlay.svelte` 3 (all symmetric), then 2 each in `Steps`, `Checkbox`, `PhotoCapture`, `ClassificationBadge`, `TaxonomyList`, `ReportEditor`,
`TemplateDesignerCanvas`, `dev/ui/+page`, `census/+page`, and 1 each in 26 more files.

**Judgement:**

1. `TemplateDesignerCanvas` (`left-0`, `-right-1.5` of the resize handle): the canvas is the paper, millimetres from the
   top-left corner (premise 2); stays physical, inside a `dir="ltr"` wrapper.
2. `PasswordInput`: field padding, toggle position and rounded corner change together; the field itself is LTR text
   (`dir="ltr"`), the toggle sits on the end side.
3. `PrintBasket` badge and `ToastStack` close button (`-right-1`, `-mr-1`): `-end-1`, `-me-1`, to check by eye.
4. `ColumnMapper` / `Steps` / `StatTile`: `text-left` and a separator `border-r` become `text-start` / `border-e`; check
   in the screenshots.

### 3.2 Physical CSS properties (`.css` and `<style>` blocks, inline styles, JavaScript)

| Where | What | Fix |
|---|---|---|
| `src/app.css:166` | `.select { background-position: right 0.75rem center }` (the chevron); the padding above it is already `padding-inline` | `[dir="rtl"] .select { background-position: left 0.75rem center }` |
| `src/app.css:556-560` | `.bv-note::before { right: 0; border-bottom-left-radius }` and the `225deg` gradients: the folded corner of a note | `inset-inline-end`, `border-end-start-radius`; the gradient angle mirrors with `rtl` |
| `src/app.css:405` | `translate: var(--x) var(--y)` of toasts | set by Zag from its `dir` prop (§5.1); nothing to change |
| `src/lib/ui/Table.svelte` `<style>` | `th { text-align: left }` | `text-align: start` |
| `src/lib/ui/ChoiceButtons.svelte:48` | `row.scrollLeft = pill.offsetLeft - …`: `scrollLeft` is negative in RTL | `pill.scrollIntoView({ inline: "center", block: "nearest" })` |
| Skeleton CSS (`@skeletonlabs/skeleton` 5.0.1) | about 15 physical declarations in 6 files (`.dialog { left: 50% }` with a centring translate, `.vr`, `.blockquote`, `.table th`, file-selector button `margin-right`, list `padding-left`); the app uses `.table` and `.dialog`-less modals | override `.table th` only (already done by `Table.svelte`); the others are unused or symmetric |
| `ArrowLeft` / `ArrowRight` handlers | 4 components (`CoverCapture`, `SheetPicture`, `PhotoCapture`, `TemplateDesignerCanvas`) move a point or a frame on a picture or a sheet | **stay physical** (the arrow moves what is drawn to the left) |
| `getBoundingClientRect().left`, `clientX` | about 7 files, pointer maths against a rectangle | physical on both sides; stay |
| Inline styles | `WaitOverlay` (`left` from a rectangle), `TemplateDesignerCanvas` (`left`/`top` in px), `labels.ts` / `card-sheets.ts` / `card-preview.ts` (millimetres of the sheet) | physical by design; stay |

### 3.3 Glyph arrows and direction words

- `DetailLayout.svelte:58` writes `← {backLabel}` in the markup: a character that must become the `back` icon (§4).
- 35 messages of each dictionary contain `→` as a path separator («Amministrazione → Backup») or as `{{from}} → {{to}}`
  (a class `3 B → 4 B`). In running RTL text a path reads right to left, so the arrow must point left; the pack
  glossary says so and the pack check flags a raw `→` in an RTL pack (§13). The Italian guillemets «…» (278 uses) are
  mirrored by the bidi algorithm itself (Bidi_Mirrored): nothing to do.
- The desk catalogue (PLAN.md Appendix I) has no left/right wording; `docs/` pages that say «a sinistra / a destra» are not
  translated into RTL languages (§12).

### 3.4 Where `lang` and `dir` are set, and where `dir` goes

| Place | Now | Add |
|---|---|---|
| `src/app.html:2` | `<html lang="it" data-theme="ocean">` (static default) | `dir="ltr"` |
| `src/hooks.server.ts:177-178` | `transformPageChunk` replaces that start tag with `lang="${event.locals.locale}"` | `dir="${directionOf(locale)}"`, from `textDirection()` or the pack's `dir` |
| `src/routes/+layout.svelte` | — | `$effect` that sets `document.documentElement.lang/dir` (the wizard's `goto` switch); wrap the tree in Skeleton's `<LocaleProvider locale={data.locale}>` |
| `src/lib/server/templates/document.ts:50` | `printDocument` and `previewDocument`: `<html lang="${doc.lang}">` (cards, labels, slips, reports, previews: about a dozen call sites pass `config.ui.locale` or `locale`) | `dir` from the same helper |
| `src/lib/server/demo/refusal.ts:34`, `src/hooks.server.ts:236` | the demo's refusal page | `dir` |
| `src/lib/server/services/web-manifest.ts:25` | `lang: config.ui.locale` | `dir` (a member of the Web App Manifest) |
| `LanguageSwitch.svelte` | `lang={code}` on each toggle | `dir={directionOf(code)}` on the toggle (its label is the language's own name) |
| `scripts/test-report.ts:243` | `<html lang="en">` | stays |

One helper `directionOf(locale)` (new, `#lib/shared/direction.ts`) wraps `textDirection` and the pack's `dir`, and is used by all of them.

## 4. Icons

All 97 icons are imported per icon in `#lib/ui/icons.ts`; nothing else imports `@lucide/svelte` (verified by grep).
Lucide 1.66.0 carries **no mirroring metadata**, but every icon renders `class="lucide lucide-<name> …"`
(`node_modules/@lucide/svelte/dist/utils/buildLucideIconNode.js`), so one global rule mirrors by name without touching
the call sites:

```css
:where([dir="rtl"]) :is(.lucide-arrow-left, .lucide-arrow-right, .lucide-undo-2, .lucide-log-out) {
	scale: -1 1;
}
```

| Key in `icons.ts` | Lucide icon | Uses | RTL | Reason |
|---|---|---:|---|---|
| `back` | `arrow-left` | 14 files (`BackButton`, import wizard, calendar, rollover, cataloging stages, the grid pager's previous) | **mirror** | points to the previous screen |
| `forward` | `arrow-right` | `GridPager` (next page), `dev/ui` | **mirror** | next page |
| `undo` | `undo-2` | 11 files (reset to default, restore, reopen) | **mirror** | a curved arrow back |
| `logout` | `log-out` | top bar | **mirror** | the door and the arrow leaving it |
| `lists` | `list-checks` | print lists | optional mirror | Wikimedia Codex mirrors list icons `[VERIFY]` |
| `loan` | `arrow-right-left` | 5 | no | symmetric |
| `return`, `renew`, `rotate` | `rotate-cw`, `refresh-cw`, `rotate-ccw` | 3 | **no** | a rotation keeps its sense (clockwise stays clockwise) |
| `confirm`, `available`, `lost` | `check`, `circle-check`, `circle-x` | many | no | checkmarks are universal |
| `dueSoon`, `overdue`, `pending` | `clock`, `alarm-clock`, `hourglass` | 3 | no | clocks and time |
| `moveUp`, `moveDown`, `more`, `download`, `upload` | vertical arrows and chevrons | — | no | vertical |
| `edit`, `search`, `help` | `pencil`, `search`, `circle-help` | — | no `[VERIFY]` | Codex lists «edit» among icons wrongly mirrored; the magnifier is mirrored by some systems (handle side), a taste decision; the question mark is Latin `?` (Arabic `؟`, Hebrew `?`) — acceptable |

Sources for the principle: Wikimedia Codex *Bidirectionality*
(https://doc.wikimedia.org/codex/main/style-guide/bidirectionality.html: mirror list icons; do not mirror clocks, play,
check marks), Material Design bidirectionality (back/forward mirrored, media players not; the page could not be read in
full `[VERIFY]` for undo, search). A Playwright check (§14) compares the computed `scale` of the four icons in `ltr`
and `rtl`.

## 5. Libraries

| Library (pinned) | RTL support | Verified from | Work |
|---|---|---|---|
| `@skeletonlabs/skeleton-svelte` 5.0.1 on Zag 1.43.0 | Every machine has a `dir` prop. Skeleton's `useDialog`, `useMenu`, `useTabs`, `useToast`… take it from `LocaleProviderRootContext`, whose **default is `en-US` → `ltr`**. `<LocaleProvider locale="ar">` sets `dir` from `isRTL(locale)` (`@zag-js/i18n-utils`). The app does not use it (no match in `src/`). | `node_modules/@skeletonlabs/skeleton-svelte/dist/components/locale-provider/{anatomy/root.svelte,modules/root-context.js}`; `…/dialog/modules/provider.svelte.js` (`dir: locale().dir`; the same line in all 27 providers; the toast root passes it in `anatomy/root.svelte:31`) | one wrapper in the root layout (14.2). Effects: tab arrows swap, submenus open to the left (`menu.machine.mjs:672`), toasts pick `-left`/`-right` for `bottom-end` (`toast.utils.mjs:20-21`) |
| `@floating-ui/dom` 1.8.0 (Zag's popper) | `start`/`end` placements resolved by `platform.isRTL(floating)`, i.e. the computed `direction` | `node_modules/@floating-ui/core/dist/floating-ui.core.mjs:139,351,443`; `dom/…dom.mjs:495` | none |
| Skeleton CSS 5.0.1 | mostly logical (`padding-inline`, `pe-*`); about 15 physical declarations in 6 files (§3.2) | `node_modules/@skeletonlabs/skeleton/src/utilities/*.css` | none beyond §3.2 |
| **`@svar-ui/svelte-grid` 2.7.5** | **none.** No `dir`, `rtl` or logical property in `src/` of the package; columns are positioned by pixel offsets (`column.left`, `padding-left:{deltaLeft}px`, `scrollLeft`), borders are `border-right`. No RTL in its documentation or readme (web search found none). | `node_modules/@svar-ui/svelte-grid/src/components/{Layout,HeaderFooter,HeaderCell,Cell}.svelte`; **probe** below | the grid decision (14.5) |
| `@svar-ui/core-locales`, `grid-locales` 2.7.5 | `en`, `cn` for the grid; core words in `cn de en es fr it ja pt ru`. No `ar`, `he`. The app's `gridWords()` knows `it` and `en` only, so **every pack shows English grid words** (not RTL-specific). | `node_modules/@svar-ui/{grid,core}-locales/locales`, `src/lib/components/data-grid-locale.ts` | words for the grid's few labels travel in the pack (14.11) |
| `chart.js` 4.6.1 | Legend and tooltip: `rtl: boolean`, `textDirection: string` (`node_modules/chart.js/dist/types/index.d.ts:2545-2550, 2961-2967`; used by `getRtlAdapter` in `dist/chart.js:8544…`). Axes: `x.reverse`, `y.position: "right"`. Canvas text uses the page `direction` and the font stack; **a subset of a `unicode-range` font is not fetched by canvas text**: call `document.fonts.load()` first. | `ReportChart.svelte:86-100` sets none of these | 14.8 |
| `date-fns` 4.4.0, `@date-fns/tz` 1.5.0 | Locales `ar`, `ar-DZ`, `ar-EG`, `he`, `fa-IR`, `ur` exist, but **the app imports none**: dates are formatted with `Intl` (`#lib/shared/dates.ts`, `#lib/ui/format.ts`). date-fns does arithmetic only (`startOfDay`, `endOfDay`). | `node_modules/date-fns/locale`; grep `date-fns/locale` in `src/`: no match | none |
| `Intl` | See §8: digits and calendar depend on the locale code. | probes | `formatLocale()` (14.6) |
| `sveltekit-i18n` 3.4.1 (`@sveltekit-i18n/base` 3.3.2, `@curly-message/parser` 3.1.2) | `textDirection(locale)` exported from `sveltekit-i18n/utils`. Plural selection by `Intl.PluralRules` with the six CLDR categories; a key can also be a number (`0:…`). A plain `{{count}}` prints the JS number (Latin digits); `{{count:number}}` uses `Intl.NumberFormat`. | `node_modules/sveltekit-i18n/README.md:352`, `@sveltekit-i18n/base/dist/utils.js:253-279`, `@curly-message/parser/README.md:254-300` | the dictionaries use `{{count}}`: Latin digits in messages whatever the pack |
| `valibot` 1.5.0 | Messages are English strings (the schema's or Valibot's). `@valibot/i18n` 1.3.0 has `ar` and `fa` but no `he`, `ur`, and is not a dependency (it would need an ADR). | tarball of `@valibot/i18n@1.3.0` | none now; English messages in an RTL page need the isolates of §7 |
| `barcode-detector` 3.2.3, `@bwip-js/generic` 4.11.4 | Barcodes are read and drawn left to right whatever the page. The text under a bar is `BARCODE_TEXT = /^[0-9A-Za-z\-. ]{1,40}$/` (ASCII). | `src/lib/server/barcodes/render.ts:19` | wrap in `dir="ltr"` (14.4, 14.8) |
| `papaparse` 5.7.0, `fflate` 0.8.3 | CSV carries Unicode and a BOM already (`CSV_BOM`); nothing direction-related. The ODS writer has no sheet direction. | `src/lib/server/imports/csv.ts:95`, `export/ods.ts` | 14.8 |
| `mustache` 4.2.0 | HTML-escaped values; direction is the template's business. | `src/lib/server/templates/engine.ts` | `dir` in the shipped faces (14.8) |

### 5.1 Probe: SVAR DataGrid in `dir="rtl"`

A standalone page (scratch directory, not in the repository) mounted `Grid` 2.7.5 under Willow with five columns of 250-300 px
(1350 px) in a 700 px box, 30 rows of Arabic and Latin text, run in Playwright's Chromium:

| Case | Result |
|---|---|
| `<html dir="ltr">`, wheel +500 px | the columns move left and render normally |
| `<html dir="rtl">`, no scroll | columns lay out from the right edge (first column at the right), header text right-aligned; **a Latin author renders `.Rowling, J. K`** (§7) |
| `<html dir="rtl">`, wheel −300 px (toward the later columns) | `scrollLeft = −300`; **header and body show nothing** (the cells exist, positioned outside the viewport: only the first column is drawn at x = 971 px) |
| grid wrapped in `dir="ltr"`, columns reversed, `scrollLeft` set to the end | first logical column at the right edge, scrolling and header in step |
| `unicode-bidi: plaintext; text-align: start` on `.wx-body .wx-cell` | `Rowling, J. K.` renders correctly in the RTL page; Arabic cells align to the right |

`[VERIFY]` Firefox and WebKit scroll in RTL with negative values too; the result is expected to be the same.

**The options** (14.5): (a) the wrapper keeps the grid in an LTR island, reverses the `columns` array when the page is RTL,
scrolls to the end after mount (the grid has a scroll-to action since 2.7.0), and gives cells `unicode-bidi: plaintext`; the
column that is first in reading order sits at the right edge; keyboard arrows move physically, which is what an RTL user
expects of a visual table. Cost ≈ 3 days, no new dependency, one place (`DataGrid.svelte`). (b) report the fault upstream and
wait: no date. (c) replace the grid: out of proportion. **Recommendation: (a), and a bug report to SVAR with the probe.**
The header's sort arrow, resize handle and the app's `GridPager` mirror by themselves in the island if their order is
reversed with the columns; to check by eye in the acceptance screenshots.

## 6. Fonts

**What the app does** (`src/app.css:29-30`, `src/lib/theme.css:10`, ADR-044): `--font-sans: "Inter Variable", system-ui,
sans-serif`, `--font-mono: "JetBrains Mono Variable", …`; both from `@fontsource-variable/*` 5.3.0 with `unicode-range`
subsets, so a page downloads only the subsets it uses (≈ 50 KB for Italian or English). Inter has no Arabic, Hebrew,
Persian or Urdu glyphs. An RTL page would fall back to `system-ui`: Segoe UI (Windows), San Francisco (Apple), Roboto/Noto
(Android, most Linux desktops); it works, but ADR-044's aim, one look on every device, is lost and Linux desktops without
Noto may show boxes `[VERIFY on the distributions of the schools]`.

**Candidates** (`@fontsource-variable/*` 5.3.0, OFL-1.1, all published in the npm registry; sizes of the woff2 `wght` files
of the package):

| Package | Scripts | Sizes of the subsets | Note |
|---|---|---|---|
| `noto-sans-arabic` | Arabic, Persian, Urdu letters (the Arabic block; `[VERIFY]` by a glyph test) | arabic **163 KB**, latin 31, latin-ext 17 (+ math 23, symbols 15) | widest coverage, neutral design near Inter |
| `vazirmatn` | Arabic, Persian | arabic **46 KB**, latin 34, latin-ext 22 | the common choice for Persian; much lighter; Urdu coverage `[VERIFY]` |
| `noto-sans-hebrew` | Hebrew | hebrew **12 KB**, latin 20, latin-ext 12 | |
| `heebo`, `rubik` | Hebrew (Rubik also Arabic, 32 KB, Cyrillic) | hebrew 12 / 9 KB | Rubik's rounded forms differ from Inter |
| `noto-nastaliq-urdu` | Urdu in Nastaliq | one file, 292 KB unpacked | Urdu readers prefer Nastaliq; Naskh (Noto Sans Arabic) is acceptable in interfaces `[VERIFY with an Urdu reader]` |

**How:** import only the Arabic and Hebrew subset files (a few `@font-face` rules with the package's `unicode-range`, as
`scripts/web-fonts.ts` does for the sites) and extend the stacks: `"Inter Variable", "Noto Sans Arabic Variable",
"Noto Sans Hebrew Variable", system-ui, sans-serif`. Because of `unicode-range`, **an Italian or English page downloads
nothing more**; the build output grows by ≈ 163 KB (Arabic) + ≈ 12 KB (Hebrew), the same for the container image and the
executables. Line boxes differ between Inter and the Arabic face (taller): set `line-height` with some air and check the
single-line controls (`--bv-control-height`); `size-adjust` on the fallback `@font-face` if needed. Monospace codes stay
JetBrains Mono (Latin, LTR). The home page and the documentation need none (§12).

**Print and canvas:** print templates name their own stacks (`FONTS.sans` = `Arial, Helvetica, 'Liberation Sans', 'DejaVu
Sans', …`) and print in the operator's browser, so they use the client's fonts: Arial (Windows) and DejaVu Sans have Arabic
and Hebrew; Georgia has not (the OS falls back). The e2e print baselines run with a fixed fontconfig
(`tests/fixtures/fontconfig`): it needs one font with Arabic and Hebrew glyphs for RTL snapshots `[VERIFY which are
installed]`. Chart.js canvas text: `Chart.defaults.font.family` set from the CSS variable, fonts awaited with
`document.fonts.load()` (§5).

## 7. Text content and bidirectional text

**What the Unicode bidi algorithm does wrong without help.** A stand-alone Latin string in an RTL paragraph puts its
trailing neutral on the wrong side (probe: `Rowling, J. K.` shown as `.Rowling, J. K`); a neutral between a Latin run and
Arabic text is attached to the Arabic side (`تم إرجاع Who am I? إلى المكتبة` shows `?` before the title); digits next to
Latin and Arabic runs reorder. The remedies are the HTML ones: `dir="auto"`, `<bdi>`, `unicode-bidi: isolate | plaintext`.
`src/` contains none of them (0 matches for `dir=`, `<bdi`, `unicode-bidi`), so they are added in a few shared places:

| Place | Fix |
|---|---|
| Text inputs and textareas (87 tags in 51 files, one wrapper `Input.svelte` with a `mono` prop) | `dir="auto"` on free-text fields (titles, names, notes); `dir="ltr"` for `mono`, e-mail, URL, number, date, password and barcode inputs; `text-align: start` |
| `font-mono` (37 files: codes, barcodes, card numbers, ISBN, JSON/HTML editors) | one rule: `.font-mono { direction: ltr; unicode-bidi: isolate; }` makes every code an LTR island, `3 B`, `B 4 DEL`, `2026-C0042` and ISBNs included |
| Grid cells and list rows of user data | the wrapper gives cells `unicode-bidi: plaintext` (§5.1); badges, chips, headings that show a title or a name use `<bdi>` |
| Messages with placeholders (desk messages with `{{title}}`, toasts, confirmations; 3 465 messages) | `t()` wraps **string** parameters in U+2068…U+2069 (FSI…PDI) **only when the locale is RTL**; numbers and codes are not wrapped (a code is already an island); a unit test per placeholder kind. Plain text contexts (`aria-label`, `title`, `<title>`) take the isolates too (invisible to screen readers `[VERIFY with NVDA]`) |
| Dates inside text | `Intl` output for `ar` contains U+200F marks (`19‏/11‏/2026`); keep them; do not strip |
| Class labels `3 B`, card class line, segnatura on a label | produced by `class-names.ts` / `school.ts` from the school preset; shown inside the same island rule |
| Toasts and form errors (`FormErrors.svelte` prints Valibot's English `issue.message`) | `<bdi>` around the message |
| `title`/`alt` attributes and file names in the browser | untouched |

**Useful before any RTL pack:** an Italian school with a pupil named «أحمد» or a book «كليلة ودمنة» already meets all of
the above in an LTR interface (the cell, the list, the card face).

## 8. Numbers, dates and calendars

`Intl` is used through two modules only: `#lib/ui/format.ts` (`Intl.NumberFormat`) and `#lib/shared/dates.ts`
(`Intl.DateTimeFormat`), plus `decorate.ts` for reports. The locale argument is the pack's code. Probe (Bun 1.4.4, Node 25 with ICU 78.2 and CLDR 48,
Chromium and Firefox of Playwright 1.64.1: **identical**):

| Locale | `1234.5` | Short date of 19 Nov 2026 | Calendar |
|---|---|---|---|
| `ar` | `1,234.5` (Latin) | `19‏/11‏/2026` | gregory |
| `ar-EG`, `ar-SA` | `١٬٢٣٤٫٥` (Arabic-Indic) | `١٩‏/١١‏/٢٠٢٦` | gregory |
| `ar-MA`, `ar-AE` | `1.234,5` / `1,234.5` (Latin) | `19‏/11‏/2026` | gregory |
| `he` | `1,234.5` | `19.11.2026` | gregory |
| `fa` | `۱٬۲۳۴٫۵` (Persian digits) | `۱۴۰۵/۸/۲۸` | **persian** (Solar Hijri) |
| `ur` | `1,234.5` | `19/11/26` | gregory |

**Consequences.** (1) A pack named `ar` gets Latin digits and `ar-EG` Arabic-Indic: the result depends on the code the
pack was published under, which is arbitrary. (2) `fa` formats **every date in the Solar Hijri calendar while the
database holds Gregorian ISO days**: a due date `2026-11-19` would show as `۱۴۰۵/۸/۲۸`; correct for an Iranian user, wrong if
the owner did not ask for it, and no input path (the school year `MM-DD`, closures, `weekStart`, the date fields `[VERIFY]`)
speaks Jalali. (3) The dictionaries write counts with plain `{{count}}`: Latin digits, so the same screen would mix Latin
digits in messages and Arabic-Indic digits in dates and grids. (4) Barcodes, card numbers, ISBN and class labels are Latin
everywhere. **Proposal:** `formatLocale(code)` appends `-u-nu-latn-ca-gregory` by default for every locale; a setting
`ui.digits` (`latin` default, `native`) lifts only the `nu` pin, applied to messages too (`{{count:number}}`); a Jalali
display is a later option, not a default (Q162). `weekStart` already offers `monday`, `sunday`, `saturday` (`WEEK_STARTS`),
which covers the Arab countries and Iran; the weekend closure is a calendar setting (`closedRanges`).

## 9. USB scanner input

`normalizeScan` (`#lib/shared/scan.ts`) repairs what a scanner types when the computer's layout is not US:
`LAYOUT_REPAIRS` (`#lib/shared/barcodes/layouts.ts`) knows `it`, `es`, `de`, `fr`, `uk`, `us` (the dash key, AZERTY
digits, swapped letters), with a `[VERIFY with a real scanner]` already on the tables. A HID scanner sends key
positions; the OS layout turns them into characters. On an **Arabic, Hebrew or Persian layout the letters become letters
of that script**: the new copy code `2026-C0042`, the card `CNNNNNN` and the **mod-23 check letter** (§3.7 of the plan) are
the letters of the keyboard's Latin keys, so they come out as `ؤ` (Arabic `C`), `ב` (Hebrew `C`), `ز` (Persian `C`); the
digit row may type Arabic-Indic or Persian digits `[VERIFY: Windows "Arabic (101)" and "Persian (Standard)" layouts]`;
upper case needs shifted tables.

**Option 1, tables** (`ar`, `he`, `fa`): US key → character, plain and shifted, plus the digit sets. Known layouts
`[VERIFY]` (Hebrew standard: `e→ק r→ר t→א y→ט u→ו i→ן o→ם p→פ a→ש s→ד d→ג f→כ g→ע h→י j→ח k→ל l→ך z→ז x→ס c→ב v→ה b→נ n→מ m→צ`;
Arabic 101: `q→ض w→ص e→ث r→ق t→ف y→غ u→ع i→ه o→خ p→ح a→ش s→س d→ي f→ب g→ل h→ا j→ت k→ن l→م z→ئ x→ء c→ؤ v→ر b→لا n→ى m→ة`); one
table per layout and variant (Arabic 101/102, AZERTY of the Maghreb, Persian, Urdu, Hebrew with or without niqqud), none
verifiable without the hardware. About 1½ days for three, endless for the rest.

**Option 2, the physical key** (**recommended**): the scan field already receives every key; record `event.code`
(`KeyC`, `Digit4`, `Minus`) with `shiftKey` and `getModifierState("CapsLock")`, and offer the string rebuilt from the
codes as one more **candidate** of `repairCandidates` (the function already tries a list and keeps the first one the code
table knows). Layout-independent: it also covers Czech, Slovak, Hungarian, Turkish and Cyrillic, the layouts 9.39 left out.
Limits: scanners that type through Alt-codes or an IME send no `code`; the phone keyboard sends none (the phone reads with
the camera). The wizard's «closest layout» proposal stays for the old path. ≈ 2½ days with a unit test on recorded event
sequences and an e2e on a simulated Arabic layout (Playwright can set `code` and a different `key`). `[VERIFY with a real
scanner on an Arabic and a Hebrew layout before a school of those countries relies on it]`.

## 10. Search, sorting and the segnatura

### 10.1 Search text of patrons and wishes

`normalizeSearchText` (`#lib/shared/text.ts`) is `foldForSearch` followed by the replacement of every `[^\p{L}\p{N}]` run
with a space. The fold is NFKD, every combining mark dropped (`\p{M}`: Latin accents, Greek tonos, Arabic hamza marks,
tashkeel and Hebrew points; only the voicing marks of kana are kept, so が stays distinct from か), the tatweel dropped, the
variants of one Arabic letter unified (`أإآٱ→ا`, `ى→ي`, `ی→ي`, `ک→ك`, `ة→ه`, `ۀ→ه`), the Greek final sigma written `σ`,
the Arabic-Indic and Persian digits made Latin, lower case, Hangul syllables put together again. Probe, before and after:

| Input | Before | Now |
|---|---|---|
| `كِتَابُ الأَطْفَالِ` | `ك ت اب الا ط ف ال` | `كتاب الاطفال` |
| `إبراهيم` | `ا براهيم` | `ابراهيم` |
| `שָׁלוֹם עֲלֵיכֶם` | `ש לו ם ע ל יכ ם` | `שלום עליכם` |
| `مدرسة` | `مدرسة` | `مدرسه` |
| `Mohamed Al-Ṣāliḥ` | `mohamed al salih` | `mohamed al salih` |
| `José Núñez` | `jose nunez` | `jose nunez` |

Every user of the fold gets the whole word: `patron.search_name`, the wishlist, the typo-tolerant `similarPatronIds` and the
catalogue's `searchWords`, the imports' header and value matching. Latin text gives the same result as before (tested
case by case; the compatibility forms of NFKD, such as `ª` or `ﬁ`, now fold to their letters). `patron.search_name` is a
derived column: at start-up `refreshPatronSearchNames` (`#lib/server/db/migrate.ts`) recomputes the rows written by another
fold. The folded forms of Arabic variants are a convention to confirm with a native librarian `[VERIFY]` (`ة`→`ه` is common
in Arabic search engines but loses a distinction).

### 10.2 Catalogue search (FTS5)

`biblio_fts` is `fts5(…, content='biblio', tokenize='unicode61 remove_diacritics 2')` (`src/lib/server/db/fts.ts`).
Alone, that tokenizer splits vocalised Arabic and does not match a plain word against its vocalised form (SQLite 3.53.4
probe): the vocabulary of `كِتَابُ الأَطْفَالِ` is `ك`, `ت`, `اب`, `ال`, `الأ`, `ط`, `ف` (`fts5vocab`), and `كتاب` does not
find it; with `categories 'L* N* Co Mn'` the words stay whole but still do not match the plain form.

**Fold on write and on query** (the study's option (a)). The triggers index `bv_fold(column)` instead of the column, where
`bv_fold` is `foldForSearch`, the very fold of the patrons' `search_name`, registered on the connection as an SQL function
(`bun:sqlite` has `Database.function`, `registerSearchFunctions`); `ftsMatch` folds the query with the same function.
`biblio` has no mirror column, so the Drizzle schema and the single migration are unchanged, and no service has to
remember to refill anything: every write to `biblio` goes through the triggers. Because FTS5's `'rebuild'` would read the
unfolded content table, `rebuildFts` empties the index (`'delete-all'`) and fills it from `biblio` with the fold. Searching
`احمد` finds `أحمد`, `كتاب` finds `كِتَابُ الأَطْفَالِ`, `שלום` finds `שָׁלוֹם`, `jose` finds `José`, and a prefix search still
works. The cost: a connection that writes to `biblio` without registering the function (the `sqlite3` shell) is refused with
`no such function: bv_fold`; `openDatabase` and the pruning of export copies register it. `applyFtsMigration` compares the
text SQLite keeps of the table and of the three triggers with the current statements and rebuilds the index when they differ
(columns, tokenizer or fold), so a database made before the fold is reindexed at its first start.

Left open: the attached article (`الكتاب` hides the word from a prefix search for `كتاب`); indexing the word without the
leading `ال` for words longer than four letters `[VERIFY with a native librarian]` would answer it. (b) a tokenizer option
alone does not solve the unvocalised/vocalised divide; (c) the `trigram` tokenizer (substring search in any script, a larger
index, no ranking by word) remains a possible later addition.

### 10.3 Sorting

`collatorFor(locale)` is `Intl.Collator(locale, { numeric: true, sensitivity: "base" })`; probe: `ar`, `he`, `fa`, `ur` sort
Arabic names in the alphabetical order (`أحمد ألف ب بشير علي`) and ignore tashkeel and niqqud at base sensitivity
(`كتاب` = `كِتاب`, `שלום` = `שָׁלוֹם`); the alef variants and ta marbuta depend on the locale (`ar`: `ا` = `أ`, `ة` ≠ `ه`;
`fa`: `ا` ≠ `أ`, `ة` = `ه`). Nothing to change; the pack's own code picks the collator. SQL `ORDER BY`
uses SQLite's binary order for columns without a collator: the grids that sort in SQL (the catalogue) would order Arabic by
code point, which is the alphabetical order of the basic letters but not of the variants `[VERIFY the sorts that run in SQL,
unchanged for the Latin scripts]`; those that sort in memory with `collatorFor` are right.

### 10.4 The author's initials for the call number (`{{author3}}`)

`author3` (`#lib/shared/classification.ts`) takes the first word of the author, split on whitespace and on the commas `,`
`،` (Arabic), `，` (full-width) and `、` (ideographic), and keeps its letters by script: **Latin** exactly as before (NFD,
accents dropped, `[A-Za-z]` only, three letters, upper case); **any other script** keeps its `\p{L}` letters after the marks
(tonos, tashkeel, niqqud) and the tatweel are dropped, the letters й, ё and ї of Cyrillic kept as letters of their own,
Cyrillic and Greek upper-cased. A leading Arabic article (`ال`, and `وال`, `بال`) is skipped when at least three
letters follow it (`المنفلوطي` → `منف`, `الله` stays `الل`); the Hebrew article `ה` only in a title, since a Hebrew surname
may begin with `ה` (`הרצל` → `הרצ`, `הנסיך הקטן` → `נסי`); the articles and the threshold are marked
`[VERIFY with a native librarian]` in the code. A
name in Chinese, Japanese or Korean script gives **two characters** (`村上春樹` → `村上`, `김영하` → `김영`): a surname is one or
two of them and three would cut a name in the middle. Examples: `Delitto, Anna` → `DEL`, `Достоевский` → `ДОС`,
`Καζαντζάκης` → `ΚΑΖ`, `محفوظ، نجيب` → `محف`, `المنفلوطي` → `منف`, `עוז, עמוס` → `עוז`, `村上春樹` → `村上`. A name written
given name first and without a comma (`نجيب محفوظ`) gives the first word, as `Marco Rossi` gives `MAR`: the surname goes first,
as everywhere in the catalogue. `title3` skips the Latin articles and then takes the same letters, skipping the Arabic
and Hebrew articles; `title1` takes the first whole character (not half of a surrogate pair). The segnatura is recomputed by the
same functions on the server (`call-numbers.ts`) and printed by the label templates as text: nothing after `author3` filters
to ASCII (the barcode fields are the ones that do, by design).

Still to do (14.9 and after): (3) the cutter on the label: the spine band prints it in two large lines (`B 4` / `DEL`): in
Arabic the line reads `ب 4` / `محف` in an RTL island; the shelf order of Arabic-script cutters follows the Arabic alphabet
while Latin ones sort after or before: a school that shelves both decides (Q164). (4) `ARTICLES` in `title3` per language of
the pack. (5) Special authors (`catalog.*`: `Anonimo`, `AA. VV.`) are configuration, in the school's language, nothing to do.
The codes (`CONFIG_CODE`, `LEVEL_CODE`, barcodes) are ASCII by design and stay so.

## 11. Print templates, labels, slips, designer, exports

**Geometry is physical.** Cards, labels and slips are placed in millimetres from the paper's corner
(`left`/`top` in the styles, `card-sheets.ts`, `labels.ts`, `card-preview.ts`); duplex mirroring (`cards.duplex.flip`) is
a property of the printer's paper path. None of it mirrors with the language (premise 2).

**Faces and templates.** The three shipped card templates (`default`, `fronte-retro`, `verticale`) and their variants without
photo are hand-placed artwork (`position:absolute; left:4mm; …`). They stay as they are; what changes inside a face:
- every text element that shows user data (`{{patron.first_name}}`, `{{patron.last_name}}`, `{{library.name}}`, the
  class line) gets `dir="auto"` and `text-align` that follows (the face's `style.css` can carry `[data-bv-text]`
  rules): an Arabic name on the left-aligned slot of the Italian layout reads correctly; whether to **mirror the whole
  face** for RTL schools (logo and photo on the other side) is a design choice, offered as an additional shipped
  template `…-rtl` rather than a code path (Q163). A school edits the file and the designer as before.
- the barcode `<div class="bv-barcode">` and the card number: `dir="ltr"`.
- the Mustache `{{words.teacher}}` etc. come from the print words of the pack (`print-words.ts`): translated with it.

**Documents.** `printDocument` / `previewDocument` get `dir` (§3.4); the overdue slip's table (columns «Nome», «Titolo»,
«Giorni ritardo») mirrors with `dir="rtl"` on the document: the first column at the right, as an Arabic reader expects; the
blocks per class (`3 B`) stay isolates. The pair label (spine band over barcode label) is geometry, not language: unchanged;
its text elements follow the face rules above; the barcode stays LTR.

**The designer** (steps 11.10, 11.16): the canvas is the paper (premise 2): `dir="ltr"` on `TemplateDesignerCanvas` and the
`left`/`top` it writes; the text style panel (`Align = "left" | "center" | "right"`, `template-style.ts`) stays physical
(a template author places by the paper) and gains a text direction (`direction: rtl | ltr | auto` in the element's own
`style`, read and written like the other declarations, `unicode-bidi: plaintext` for `auto`); an edit in one view still
shows in the other. The panel's own labels follow the app's direction.

**ODS and CSV.** `buildContentXml` writes no sheet properties: a Hebrew or Arabic sheet opens left-to-right in LibreOffice
and Excel's counterpart. ODF 1.3 has `style:table-properties style:writing-mode="rl-tb"` on a table style (and
`fo:text-align="start"`): the exporter emits it when the installation is RTL `[VERIFY by opening in LibreOffice]`; the
header names are the app's words (translated), the data are the library's. CSV: UTF-8 with a BOM, unchanged; column names for
imports are English only (`import-columns.ts`), so a spreadsheet in Arabic needs no column translation.

**Barcodes.** `dir="ltr"` on every container of `barcode_svg` and on the printed text under it (the `bv-barcode` div, labels,
cards, the scan overlay).

## 12. Documentation site, home page, PDFs, screenshots

- **Not translated, and nothing to do until it is.** `scripts/site-build.ts` is typed `Lang = "it" | "en"` (`LANGS`), the
  site has `docs/it` and `docs/en` (126 Markdown pages each, ≈ 125 000 words per language), the technical pages are English
  (`lang="en"`), and `DOCS_LANGUAGES = ["it", "en"]` in `help-links.ts`: **a pack's language opens the English
  documentation** with the help icon. Translating 126 pages into Arabic and Hebrew is a project of its own (≈ 125 000 words per
  language, plus the anchors of `help-links.ts`, a glossary and a native review): not proposed. The English documentation of an RTL installation is read in an LTR
  window, which is a normal situation for the people who use English software.
- **If it ever is:** `<html dir>` per page and the same logical-property pass on `site/assets/` CSS (the layout of the
  approved mock: sidebar, search, footers; `pagefind` indexes by language and its UI takes `dir`), a font for the script
  (`scripts/web-fonts.ts` copies Latin subsets only), the language switch of `biblioviva.org` (`IT · EN`, the cookie
  `bv_lang`) as a drop-down, the shot list's pictures per language (`docs:shots` takes Italian and English; pictures of an RTL
  app need the forced-direction mode of 14.2 plus the pack), and the PDF of «Normativa» (`docs:pdf`, Chromium prints RTL
  correctly; it needs the same fonts). About 15-20 days with review: a decision after the packs exist.
- **Home page** (`home/it.html`, `en.html`, built by `scripts/home-build.ts`): Italian and English only; nothing to do.
- **Screenshots of the documentation** show the Italian and English app; none in RTL are needed. A **gallery of RTL pictures
  for the owner's review** is a by-product of the tests of §14 (screenshots of the `desktop-rtl` project), not published.
- The app's about page, `docs/accessibility.md` and `docs/templates-authoring.md` gain a paragraph each (14.13).

## 13. Language packs and translation

- **Plurals.** ADR-051's implementation is generic: `neededPluralCategories(locale)` asks `Intl.PluralRules` for the
  categories of 0–1000. Probe (Chromium, Firefox, Bun, Node agree): `ar` → `zero one two few many other` (0 / 1 / 2 / 3-10 /
  11-99 / 100-102…); `he` → `one two other` (no `many` in this ICU: a pack must not write one, and the validator warns
  of an unused form); `fa` → `one other` (0 is `one`); `ur` → `one other`. `compareMessage` and `pluralProblems` need no
  change, but **the plural test that renders English and Italian for 0, 1, 2, 5, 21 needs 3, 11, 100, 102 for Arabic**.
  The Curly parser selects by category and by number key (`0:`), so «لا طلاب» for zero is either `zero:` or `0:`.
  166 messages of the dictionary count things.
- **The script check refuses Arabic and Hebrew.** `foreignScripts` (`#lib/server/i18n/pack-tools.ts:100-125`) lists
  `OWN_SCRIPTS` for `ru uk el zh ja ko` only; Arabic and Hebrew sit among the *foreign* scripts, so every Arabic message
  fails with `wrong_script`. Add `ar fa ur ps sd ckb → arabic`, `he yi → hebrew`; also warn when an Arabic pack contains
  Latin letters in a sentence outside placeholders and code names (a check, not an error).
- **New checks for RTL packs:** a raw `→` in a message (should be `←`, §3.3); stray bidi controls (U+202A–202E, U+2066–2069,
  U+200E/F) in the translation (the engine adds isolates itself); a placeholder adjacent to a Latin letter with no space.
- **`pack.json`:** optional `"dir": "rtl"` for codes the engine does not resolve (`prs`); `translation: "machine"` as for
  the others. `LOCALE_CODE = /^[a-z]{2,3}(-[A-Z]{2})?$/` accepts `ar`, `he`, `fa`, `ur`, `ar-EG`; no change.
- **Tools and glossaries.** `i18n:work split / merge`, `i18n:status`, `i18n:sync`, `i18n:release` are language-neutral
  (3 465 messages, 20 424 words, ≈ 18 chunks of 200 messages per language, translated by Haiku against a glossary the
  agent writes). Each RTL glossary adds `_register` (formal modern standard Arabic for software; Hebrew: neutral masculine
  imperatives vs infinitives; Persian and Urdu), `_arrow` (use `←`), `_numbers` (Latin digits in the text, `{{count}}`
  untouched), `_quotes` (Arabic and Hebrew guillemets or `"…"`), `_gender` (Arabic and Hebrew agree in gender: avoid
  sentences needing a placeholder's gender), and terms with the segnatura (Arabic «رقم الطلب» is the call number in
  libraries `[VERIFY with a native librarian]`; Hebrew «מספר מיון»). Machine translation of RTL languages is weaker for
  UI terms than for the Latin pilots: **native review is a requirement before publishing**, not a nicety (Q161).
- **Glossary of the grid and SVAR words** (§5): the five or six labels the DataGrid shows come from the pack.
- **Tested rendering of a pack:** a Playwright run per RTL pack (§14).

## 14. Testing

1. **A forced direction** (14.2): in development and in the e2e server, `?dir=rtl` and the environment `BV_FORCE_DIR=rtl`
   (the same gate as `?lang=`: `ALLOW_LANG_OVERRIDE`, already set in `playwright.config.ts`) give an Italian interface laid
   out right to left. All the existing specs use Italian texts and test ids, so **the whole suite can run mirrored before
   any translation exists**: a Playwright project `desktop-rtl` (and `mobile-rtl`) that sets the variable and runs the same
   specs (or a chosen list at first, then all): keyboard arrows in tabs and menus, the grid, dialogs, toasts, the desk. This is
   the single most valuable test of the study.
2. **Axe** (`tests/e2e/a11y.spec.ts`: 29 pages, two sizes, 11 reflow pages) in RTL: `expectAxeClean` over the same list,
   including a check that `<html lang>` and `dir` agree with the locale.
3. **Visual:** `toHaveScreenshot` of ten pages in RTL (desk, patron, catalogue, grid scrolled to the end, admin form, a
   dialog, a toast), the print faces and sheets with one name in Arabic and one in Latin; baselines in
   `tests/snapshots/desktop-rtl`; the print baselines need the font with Arabic glyphs (§6).
4. **Geometry assertions** that do not need baselines: the first grid column is at the right edge; the back icon's computed
   `scale` is `-1 1`; the toast appears at the left; a Latin cell reads `Rowling, J. K.`; the skip link appears at the end
   side; barcodes have `direction: ltr`.
5. **A lint guard** (14.1): `scripts/check-logical-css.ts`, added to `lint` and `lint:ci` beside `check-headers.ts` and
   `check-hardcoded-text.ts`, **fails** on physical utilities and declarations (`ml- mr- pl- pr- left- right- text-left
   text-right float-left/right rounded-l/r/tl/tr/bl/br border-l/r space-x- translate-x- (unpaired) origin-left/right
   scroll-ml/mr` and in `<style>` / `.css`: `margin-left`, `padding-right`, `left:`, `right:`, `text-align: left|right`,
   `border-left`, `float`, `translateX`), with an allow list per file and a reason (the designer canvas, centring pairs,
   print sheets). No new dependency: the token scan used for this study is 80 lines. ESLint has no maintained Tailwind 4
   rule `[VERIFY]` and Stylelint's `use-logical` would be a new dependency (ADR). `ui:audit` (the factoring rule) is a
   different check and stays.
6. **Unit tests:** `directionOf`, `foldForSearch` (Arabic, Hebrew, Latin unchanged), `author3` (Arabic with the article,
   Hebrew, Cyrillic, Latin), `formatLocale`, the isolates in `t()`, the scan from physical keys, the script check
   (`ar`, `he`), plurals of Arabic at 0, 1, 2, 3, 11, 100, 102.
7. **The hardcoded-text check** (`check-hardcoded-text.ts`, warnings only) is language-neutral; a pseudo-RTL check is not
   needed once §14.1 exists.
8. **Browsers:** `test:browsers` (Firefox, WebKit) must run the `desktop-rtl` project too before an RTL pack ships (negative
   `scrollLeft`, `:dir()`, font loading differ).

## 15. Effort, risks and proposed phases

### 15.1 Risks

1. **SVAR DataGrid** (the only blocker): option (a) is verified in a probe for scrolling; sorting, selection, resize,
   pinned columns (`fixed`), inline editors and the footer have not been tried; budget a second day of margin per
   surprise (3 to 6 days).
2. **Machine translation quality** for Arabic and Hebrew UI texts: native review needed; the owner may not have a reader
   among the school staff (Q161).
3. **Scanners on non-Latin layouts** cannot be verified without hardware; option 2 reduces the risk but a real device is the
   only proof.
4. **Hidden physical assumptions in tests:** specs that assert positions (`boundingBox().x`), the print snapshots, the
   dev style guide; the forced-direction project finds them, and fixing them is part of the steps.
5. **Segnatura conventions** in Arabic and Hebrew libraries differ from the Italian «tre lettere del cognome»: a
   decision, not a bug (Q164).
6. **Persian calendar** expectations of Iranian users (Q162): out of scope by default.
7. **Zag, Skeleton and SVAR updates:** SVAR may add RTL itself and change the grid's internals: the wrapper is the one place to adapt.

### 15.2 Proposed phase

**Phase 14 — Right-to-left languages** (the number is the next free one; optional for 0.9.0, a condition for publishing
the Arabic and Hebrew packs of Q136). Steps in order; 14.1, 14.2, 14.9, 14.10 and the data parts of 14.4 are
**useful before any RTL language ships** (≈ 7 days).

- [ ] **14.1 Logical layout everywhere and a lint guard** (useful now; ≈ 1½ days)
  - Context: 61 physical tokens in 39 files and 4 declarations (§3). Converting them changes nothing in LTR and removes
    the largest source of mirrored-layout bugs; the guard keeps it so.
  - Tasks: convert the ≈ 50 mechanical tokens and the `app.css` / `Table.svelte` declarations; decide the 5 judgement cases (§3.1);
    replace the `ChoiceButtons` `scrollLeft` maths; replace the `←` of `DetailLayout` by the `back` icon; write
    `scripts/check-logical-css.ts` with an allow list (the designer canvas, centring pairs, print sheet geometry, a
    comment per entry) and add it to `lint` and `lint:ci`; add the rule to CLAUDE.md (UX rules) and
    `docs/design-system.md`.
  - Acceptance: `bun run lint` fails on a sample `ml-2` and passes on the repository; the print baselines and all
    e2e specs are unchanged in Chromium (LTR); `bun run ci` green.
  - Depends on: —
- [ ] **14.2 Direction plumbing and the forced-direction test mode** (useful now; ≈ 2 days)
  - Context: §3.4, §14.1.
  - Tasks: `#lib/shared/direction.ts` (`directionOf(locale)` from `sveltekit-i18n/utils` + the pack's optional `dir`);
    `dir` in `app.html`, `transformPageChunk`, `printDocument` / `previewDocument` (about a dozen call sites), the refusal page, the
    web manifest, the language switch items; the root layout effect (`lang`, `dir`) and `<LocaleProvider>`; `?dir=rtl` and
    `BV_FORCE_DIR` (gated like `?lang=`, never in production); Playwright projects `desktop-rtl` / `mobile-rtl` running a first
    list of specs; the `.font-mono` island rule; the select chevron and note-corner rules.
  - Acceptance: an Italian page with `?dir=rtl` has `<html dir="rtl" lang="it">`; tabs answer to the arrow keys in the
    mirrored order; a menu's submenu opens to the left; a toast appears bottom-left; the forced mode is refused in production;
    unit tests of `directionOf` (ar, he, fa, ur, prs with `dir`, it, en); `bun run ci` green.
  - Depends on: 14.1
- [ ] **14.3 Mirrored icons and directional glyphs** (≈ 1 day)
  - Tasks: the CSS rule of §4 for `back`, `forward`, `undo`, `logout` (and `lists` if the owner wants it); the list kept
    in `icons.ts` as a documented set with a unit test that every listed class exists in Lucide; the rule of the
    `→` separators in messages (§3.3) in `docs/writing-guide.md`.
  - Acceptance: browser test: computed `scale` is `-1 1` in `dir="rtl"` and `1` in `ltr` for the four icons, `1` for
    the clock and the check; the grid pager's previous and next point the right way.
  - Depends on: 14.2
- [ ] **14.4 Bidirectional text: user data, placeholders, inputs, codes** (≈ 2½ days; the data parts are useful now)
  - Tasks: `Input` / `Textarea` / `Select` wrappers: `dir="auto"` by default, `dir="ltr"` for `mono`, e-mail, URL, number,
    date, password and the barcode fields; `<bdi>` in the shared list and detail components that show titles, authors and
    names (`DetailLayout`, `MediaCard`, `PatronStatusCell`, desk messages, badges, `NoteTile`); `t()` wraps string parameters
    in FSI…PDI when the locale is RTL; the barcode containers `dir="ltr"`; `FormErrors` with `<bdi>`.
  - Acceptance: component tests: an Arabic title in an Italian screen and a Latin title in an RTL screen both show
    their punctuation right; the desk message of a loan with `«{{title}}»` for «Who am I?» and «كليلة ودمنة» in both
    directions; unit tests of the wrapper (strings wrapped, numbers and codes not, none in LTR); axe clean.
  - Depends on: 14.2
- [ ] **14.5 The data grid in right-to-left** (≈ 3 days, risk up to 6)
  - Context: §5.1.
  - Tasks: `DataGrid.svelte` keeps the grid in an LTR island when the page is RTL, reverses the columns, scrolls to the end
    after mount and on data replacement, gives cells `unicode-bidi: plaintext; text-align: start`, mirrors the pinned
    (`fixed`) columns and the footer; `GridPager` and `GridFooter` follow the page's direction; report the fault to SVAR with
    the probe.
  - Acceptance: Playwright in `desktop-rtl` on the catalogue, patrons and loans grids: the first column of the reading order
    is at the right edge, horizontal scrolling reaches every column, header and body stay in step, sorting by a header,
    selecting by arrows and clicking a row opens it, resize works; a Latin author reads `Rowling, J. K.`; an LTR page is
    byte-identical in behaviour (the existing grid specs).
  - Depends on: 14.2, 14.4
- [ ] **14.6 Numbers, dates and calendars for any pack** (≈ 1½ days; useful for the `fa` and `ar-*` packs only)
  - Tasks: `formatLocale(code)` (`-u-nu-latn-ca-gregory` by default; `ui.digits: "native"` lifts the digits pin, Q162)
    used by `#lib/ui/format.ts`, `#lib/shared/dates.ts`, `decorate.ts` and `{{count:number}}` in messages; the `ui.digits`
    setting in Amministrazione → Aspetto e lingua and the configuration archive (Phase 11 completeness rule); weekdays,
    `weekStart` presets for the countries of 14.13.
  - Acceptance: unit tests for `ar`, `ar-EG`, `fa`, `he`, `ur` with both settings (Latin digits and Gregorian by default
    in all of them; `native` gives Arabic-Indic or Persian digits and never changes a barcode or a card number); the
    ISO day shown for `fa` equals the stored day.
  - Depends on: —
- [ ] **14.7 Fonts for Arabic, Hebrew, Persian and Urdu** (≈ 1 day)
  - Tasks: the chosen families (Q165) as `@fontsource-variable/*` 5.3.0 exact versions, only the Arabic and Hebrew subset
    files imported with their `unicode-range`; the stacks of `--font-sans` and the Skeleton typography variable extended;
    `Chart.defaults.font.family`; ADR in `docs/DECISIONS.md` (supersedes nothing: it extends ADR-044) and the size added to
    `docs/performance.md`; the fontconfig of the e2e baselines gains an Arabic and Hebrew face; `deps:generate`.
  - Acceptance: a Latin page requests no new font file (network assertion); an Arabic and a Hebrew page request exactly the
    subset files they use; a browser test that every letter of the Arabic, Persian and Urdu alphabets and of the Hebrew
    alphabet has a glyph in the chosen faces; build output grows by less than 200 KB.
  - Depends on: 14.2
- [ ] **14.8 Charts, print templates, slips, designer and exports** (≈ 3 days)
  - Tasks: `ReportChart` (`rtl`, `textDirection`, `x.reverse`, `y.position`, fonts awaited); `dir` and `dir="auto"` in the
    shipped faces and their variants without photo, the slips and the labels (`barcode` containers `dir="ltr"`), an
    optional `…-rtl` card template if the owner wants it (Q163); the designer's canvas LTR island, the text-direction field of
    the text style panel (`direction`, `unicode-bidi` in the element's `style`, round trip kept); ODS `writing-mode`;
    `docs/templates-authoring.md`.
  - Acceptance: visual baselines of a card, a label pair and the overdue slip with an Arabic and a Latin name in
    `desktop-rtl`; the designer saves and reloads an element with `direction: rtl` and changes no other byte; ODS opens
    right-to-left in LibreOffice `[VERIFY]`; chart legend and tooltip align with the page.
  - Depends on: 14.2, 14.4, 14.7
- [ ] **14.9 Searching and filing non-Latin names and titles** (useful now; ≈ 3 days)
  - Context: §10.
  - Tasks: `foldForSearch` and its use in `patron.search_name`, the wishlist and the typo-tolerant search (words, not
    fragments); mirror columns for the catalogue's FTS (fold on write in the services, same fold on query, a stamp of the
    tokenizer in `applyFtsMigration`, `rebuildFts` after the schema's regeneration), the Latin results unchanged; `author3`
    and `title3` Unicode-aware with the Arabic and Hebrew articles and `،`; configurable articles per pack language if the
    owner wants (Q164); the single migration regenerated (Q82), `docs/database.md`, `docs/navigation.md` untouched.
  - Acceptance: unit tests (§14.6); searching `احمد` finds `أحمد` and `كِتَابُ` finds `كتاب` in patrons and in the
    catalogue; `jose` still finds `José`; the call number of a record by `نجيب محفوظ` is `… محف` (or the chosen rule), of
    `Достоевский` is `… ДОС`; e2e: add, search and print a label for an Arabic-named author in the Italian interface.
  - Depends on: —
- [ ] **14.10 USB scanners on Arabic, Hebrew and Persian keyboards** (useful for the Cyrillic and Greek layouts too; ≈ 2½ days)
  - Context: §9.
  - Tasks: record `event.code` + modifiers in the scan field (`BarcodeInput`, the desk field) and give `repairCandidates` the
    string rebuilt from the physical keys as one more candidate; Arabic-Indic and Persian digits mapped to Latin in
    `normalizeScan`; the setup wizard's layout hint for RTL languages; `docs` (setup guide: «set the scanner to US keyboard
    mode, or leave it, both work»).
  - Acceptance: unit tests on recorded sequences of `2026-C0042` on simulated Arabic, Hebrew, Persian, Russian layouts
    (`code` set, `key` the local letter); an e2e that types such a sequence into the desk field and checks out the copy; the six
    existing layouts' tests unchanged.
  - Depends on: —
- [ ] **14.11 Language-pack tooling for right-to-left** (≈ 1½ days)
  - Tasks: `OWN_SCRIPTS` for `ar fa ur ps sd ckb he yi`; the checks of §13 (`→`, bidi controls, placeholders next to Latin
    letters); `pack.json` optional `dir`; the plural tests for Arabic and Hebrew; the glossary template with the keys of
    §13; the grid words travel in the pack (`gridWords()` reads a pack's `grid` block); `docs/writing-guide.md` and
    `i18n-packs/README.md`.
  - Acceptance: `bun run i18n:check` accepts a sample `ar` pack and refuses one with `→`; a pack with `zero one two few many other`
    renders 0, 1, 2, 3, 11, 100 correctly; one with a missing `few` is refused.
  - Depends on: 14.6 (for the digits policy)
- [ ] **14.12 The Arabic and Hebrew packs, then Persian and Urdu** (≈ 3 days of agent work + the owner's reviewers' time)
  - Tasks: glossaries (Sonnet) and the machine translation of `ar` and `he` (Haiku, chunks of 200, ADR-051's pipeline),
    `translation: "machine"` until a native speaker has read them; the release workflow lists them; Q136 and step 9.39 text
    updated; the RTL project runs with `?lang=ar` and `?lang=he` on the main pages (axe + screenshots for the owner's
    review); `fa` and `ur` follow when a reviewer exists.
  - Acceptance: `bun run i18n:status` green for `ar` and `he`; the e2e RTL run, axe and the visual baselines green; the
    reviewers' remarks recorded; the packs appear in Aspetto e lingua and switch the direction, the font and the digits.
  - Depends on: 14.1 – 14.11, 9.39
- [ ] **14.13 Presets, documentation notes and the About page** (≈ 1 day)
  - Tasks: school presets for the RTL countries (§15.3: Israel, Saudi Arabia, Egypt, UAE, Morocco, Iran, Jordan) with
    their weeks (`weekStart`), `[VERIFY]` marks and the labels in their script; a line in `docs/accessibility.md`, the
    manual page of languages, `docs/templates-authoring.md` and the README of the packs; PLAN.md §3.16 and the CLAUDE.md
    rules updated (the direction rule, the logical-properties rule).
  - Acceptance: presets validate (`presets.test.ts`); the docs pages build; the documentation site is published again (the
    owner's step, ADR-050).
  - Depends on: 14.12

**Total ≈ 26 agent-days** (14.1 1½, 14.2 2, 14.3 1, 14.4 2½, 14.5 3, 14.6 1½, 14.7 1, 14.8 3, 14.9 3, 14.10 2½, 14.11 1½, 14.12 3,
14.13 1), more with the grid's risk and the reviewers' round trips.

### 15.3 School presets for RTL countries (note only)

`config/school-presets/` has 60 presets and none for an RTL country (`generic.json` only). Hebrew: Israel (primary grades
א׳–ו׳, lower secondary ז׳–ט׳, upper secondary י׳–י״ב; classes written `ג׳ 1`: a letter-numbered grade and a number, so
`class-names.ts` ranges `A-Z` need a script-aware alphabet for the groups), school year from 1 September, the week
Sunday to Friday. Arabic: Saudi Arabia (primary 1-6, intermediate 1-3, secondary 1-3; week Sunday-Thursday; Hijri
calendar in official use), Egypt (primary 1-6, preparatory 1-3, secondary 1-3), UAE (grades 1-12 in four cycles), Morocco
(primaire 1-6, collège 1-3, lycée; Arabic and French), Jordan, Tunisia. Persian: Iran (دبستان 1-6, متوسطه اول 7-9,
متوسطه دوم 10-12; school year starts 1 Mehr; Saturday-Wednesday week; Solar Hijri). Every preset carries a `[VERIFY]` with a
teacher of the country, as 9.41's do; weekends and calendars interact with `closedRanges` and `weekStart`.

## 16. Questions for the owner

The same questions, with the same numbers, are in PLAN.md §11.

- **Q160** — Which languages first? a) Arabic and Hebrew (the two Q136 waited for), b) Arabic only, c) Arabic, Hebrew, then Persian
  and Urdu when a reviewer exists, d) none for now: only the first useful steps (14.1, 14.2, 14.9, 14.10).
- **Q161** — Native review: who reads the Arabic and Hebrew translations? a) a named reader, the packs ship as `reviewed`;
  b) nobody: the packs ship `machine` with a visible warning in Aspetto e lingua and are not advertised; c) not published.
- **Q162** — Digits and calendars for Arabic, Persian and Urdu? a) **Latin digits and the Gregorian calendar everywhere,
  with a setting `ui.digits` for native digits** (proposed); b) the language's own digits by default (`ar-EG`, `fa` style);
  c) a Solar Hijri display for `fa` as a later step.
- **Q163** — Print templates in an RTL school: a) the shipped faces stay as drawn, text elements follow the text direction
  (proposed); b) additionally an `…-rtl` card template with logo and photo mirrored; c) mirror every shipped template with
  a switch in the template settings.
- **Q164** — The segnatura for Arabic and Hebrew authors: a) the first three letters of the surname in the author's script,
  with the article skipped (proposed); b) a Latin transliteration typed by hand in the copy's `{{copytext}}`; c) the title's
  initial.
- **Q165** — Fonts: a) Noto Sans Arabic (broadest, +163 KB when used) and Noto Sans Hebrew (+12 KB); b) Vazirmatn (+46 KB; Arabic
  and Persian) and Noto Sans Hebrew; c) the system's fonts only (no download, a different look per device).
- **Q166** — The documentation stays Italian and English, with the English pages for every other language (proposed), or a
  translation of the manual alone into Arabic once the packs exist (≈ 5 days with review)?
- **Q167** — The data grid: a) the LTR island with reversed columns (proposed, 3 days); b) wait for an upstream fix and keep the
  RTL packs back until then; c) another grid.
- **Q168** — Scanners: a) the physical-key capture of 14.10 for every layout (proposed); b) tables for Arabic and Hebrew
  only; c) leave as is (the school sets the scanner's layout).
- **Q169** — Order: the steps useful before any RTL language (14.1, 14.2, 14.9, 14.10 and the data parts of 14.4, ≈ 7 days)
  before 0.9.0, the rest after (a) or all before 0.9.0 (b)?

## Sources

- Tailwind CSS 4.3.3 utilities and the `rtl:` variant — compiled against `node_modules/tailwindcss/dist/lib.mjs`.
- Lucide for Svelte 1.66.0 — `node_modules/@lucide/svelte/dist/utils/buildLucideIconNode.js`.
- Skeleton 5.0.1 and Zag 1.43.0 — `node_modules/@skeletonlabs/skeleton-svelte/dist/components/locale-provider/`,
  `…/dialog/modules/provider.svelte.js`, `node_modules/@zag-js/{menu,toast,i18n-utils,popper}/dist/`.
- Floating UI 1.8.0 — `node_modules/@floating-ui/core/dist/floating-ui.core.mjs`.
- SVAR DataGrid 2.7.5 — `node_modules/@svar-ui/svelte-grid/src/components/`; readme and whatsnew without RTL.
- Chart.js 4.6.1 — `node_modules/chart.js/dist/types/index.d.ts`, `dist/chart.js`.
- sveltekit-i18n 3.4.1 — `node_modules/sveltekit-i18n/README.md`, `node_modules/@sveltekit-i18n/base/dist/utils.js`;
  `@curly-message/parser` 3.1.2 `README.md`.
- `@valibot/i18n` 1.3.0 — npm tarball (languages `ar`, `fa`; not `he`, `ur`).
- `@fontsource-variable/{noto-sans-arabic,noto-sans-hebrew,vazirmatn,rubik,heebo,noto-nastaliq-urdu}` 5.3.0 — npm registry
  (OFL-1.1), woff2 sizes read from the tarballs.
- Wikimedia Codex, *Bidirectionality* — https://doc.wikimedia.org/codex/main/style-guide/bidirectionality.html
- Material Design, *Bidirectionality* — https://m2.material.io/design/usability/bidirectionality.html (not readable in full; `[VERIFY]`).
- Unicode Standard Annex #9, *Unicode Bidirectional Algorithm* — https://www.unicode.org/reports/tr9/
- ODF 1.3, `style:writing-mode` — https://docs.oasis-open.org/office/OpenDocument/v1.3/ `[VERIFY: the attribute's section]`.
- SQLite FTS5, the `unicode61` tokenizer — https://www.sqlite.org/fts5.html#unicode61_tokenizer (behaviour checked on 3.53.4).
- Probes (not committed): SVAR grid under `dir="rtl"` in Playwright's Chromium; `Intl` in Bun 1.4.4, Node 25, Chromium and
  Firefox of Playwright 1.64.1; `normalizeSearchText` and SQLite FTS5 vocabularies in Bun 1.4.4. WebKit could not be launched
  on this host (missing system libraries): `[VERIFY]` in WebKit through Playwright's container (`test:browsers`).
