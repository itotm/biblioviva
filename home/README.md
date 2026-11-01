# Home page of biblioviva.org

The presentation page of BiblioViva, in Italian (`/`) and English (`/en/`), not versioned. The documentation lives on
`docs.biblioviva.org` (`site/`) and the public demo on `demo.biblioviva.org`. See PLAN.md §3.23 and ADR-039.

| File | What it is |
|---|---|
| `it.html`, `en.html` | The page in each language: the same markup, only the words differ (a test checks it). The first line is the page's title and description as JSON. |
| `home.css`, `base.css` | The styles: scroll effects, sections, the screens (pictures and drawings) and the shared tokens. |
| `home.js` | The one script of the page: the language chosen with the switch, scroll progress, the steps of the desk, the pieces that rise into view. The page is complete without it. |
| `logo.webp` | The BiblioViva logo. |

Macros in the pages, expanded by `scripts/home-build.ts`: `[[icon:name]]` (a Lucide icon), `[[words:…]]` (the
sentence that lights up word by word), `[[shot:name|title|area|view]]` (a computer screen: the documentation's picture
`site/.shots/<lang>/<name>.webp` in the browser frame, `area` and `view` only for the drawing used when the picture is
missing), `[[wfd:area|view|title]]` and `[[wfp:…]]` (a drawn computer or phone screen; the phone one stays drawn),
`[[lang]]` (the language switch of the header: a globe, then IT and EN, as in the documentation), `[[shelfmini]]` (four spines with their bands), `[[site:docs]]…[[/site]]` and `[[site:repo]]…[[/site]]` (a piece kept
only while that site is online: `ONLINE` in the script, the documentation with 9.7, the repository once public with
9.36; `[[site:!docs]]…[[/site]]` is kept only while the site is not online, so the link to the installation guide
under the four steps falls back to the guide on GitHub while only the repository is online); `{{home}}`,
`{{other}}`, `{{docs}}`, `{{setup}}` (the installation guide in the repository), `{{demo}}`, `{{repo}}` are the
addresses of the sites.

**Language.** The Italian page (`/`) sends a visitor to `/en/` when the browser's first language between Italian and
English is English, or when it names neither; a click on the switch in the header (IT · EN) is kept in the cookie
`bv_lang`, which the documentation and the public demo share on `biblioviva.org` (ADR-047), and wins over the
browser's languages from then on, on all three sites. Crawlers stay on the page
they asked for (the two pages point to each other with `hreflang`); without the script the Italian page stays.

## Build

```sh
bun run home:build   # writes home/dist/ and home/biblioviva-home.zip (neither committed)
bun run home:serve   # serves home/dist/ on http://localhost:5176 to look at it before the upload
```

**Pictures.** The four computer screens of "In evidenza" are the pictures `bun run docs:shots` takes for the
documentation (lossless WebP, 1280 × 800, never committed): `catalog/new-book-form`, `census/start`,
`catalog/inventory-empty`, `reports/library`. The build copies the ones it uses into `home/dist/shots/<lang>/` (and the
zip); the English page uses the Italian picture until `site/.shots/en/` has its own. A missing picture is not an
error: the screen is drawn and the build prints a warning, so run `bun run docs:shots` before `home:build` for the
real ones. The steps of the desk (section "banco") and the phone screen stay drawn.

Open `home/dist/index.html` in a browser to check it. When a text changes, change it in both pages.

## Publication (Cloudflare Pages, by hand)

The pages are uploaded by hand, never built by Cloudflare: a Cloudflare Pages project made with **direct upload**
(Workers & Pages → Create → Pages → Upload assets), custom domain `biblioviva.org`. After every change:
`bun run home:build`, then in the project **Create new deployment** and upload `home/biblioviva-home.zip` (or drop
the folder `home/dist`). See `docs/deploy.md`.
