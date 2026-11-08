# Writing the documentation

The rules every writer of BiblioViva's documentation follows, human or coding agent. The documentation site
(`docs.biblioviva.org`, PLAN.md §3.23) is built from these Markdown files; the files must also read well on GitHub.
PLAN.md §3.23 is the source of these rules; this guide is the working version for whoever writes a page.

## Sections and folders

| Section (site) | Folder | Readers | Languages |
|---|---|---|---|
| **Installazione** | `docs/it/setup/`, `docs/en/setup/` | whoever installs BiblioViva, often a teacher or a school secretary (write every step out; never say so in the text) | Italian, English mirror |
| **Manuale** | `docs/it/manual/`, `docs/en/manual/` | whoever works at the desk, catalogues or makes the cards | Italian, English mirror |
| **Amministrazione** | `docs/it/admin/`, `docs/en/admin/` | the administrator's account: first steps, the work during the year and at its end | Italian, English mirror |
| **Aiuto** | `docs/it/help/`, `docs/en/help/` | everyone: common problems, the glossary, how to ask for help | Italian, English mirror |
| **Norme** | `docs/it/compliance/`, `docs/en/compliance/` | the head teacher, the DSGA, the DPO and the Responsabile per la transizione digitale: what the rules ask of a school that adopts BiblioViva, what BiblioViva does about it and what is left to the school | Italian, English mirror |
| **Tecnica** | `docs/*.md` | whoever knows Docker, Linux and JSON | English only |
| Overview (no section) | `docs/it/features.md`, `docs/en/features.md` | everyone who meets BiblioViva, the school deciding to adopt it too: what it does, area by area | Italian, English mirror |

The page of a folder that opens it is its `README.md` (GitHub shows it). File names are English, lower case, words
joined by `-` (`choose-network.md`); they become the paths of the site (`/0.9.0/it/install/choose-network/`), the
same in every language.

## Italian first, English as a mirror

1. A page is written in Italian first. The English page has the **same file name**, the **same headings in the same
   order**, the **same numbered steps**, the same figure markers and the same variant blocks. Only the language
   changes: nothing is added, dropped or reordered.
2. The anchors of a page come from the English headings (the site gives the Italian heading at the same place the
   same anchor), so a help link opens the same section in both languages. Never write anchor ids by hand. A link
   with an anchor uses the anchor GitHub makes from the target heading in the page's own language
   (`steps/install.md#possibili-problemi` in Italian, `#possible-problems` in English): it works on GitHub, and the
   site turns it into the shared anchor of that heading.

## Tone

- Serious and plain, neither chatty nor telegraphic. No jokes, no exclamation marks, no "facile", "semplicissimo",
  "basta un clic".
- **Not promotional** (owner rule): say what the program does, never how good, flexible or fitting it is ("si adatta
  alla biblioteca, e non il contrario", "nessuna biblioteca è costretta", "senza l'aiuto di un tecnico"). BiblioViva
  is «un software» for a school library, never «il programma» of the school library, as if it were the only one.
  Presenting BiblioViva is the home page's job.
- **No proprietary programs named** (owner rule): name the format or the free program, never a proprietary one that
  the reader might use («ODS (LibreOffice)», «un foglio di calcolo», never «Excel» or «Word»). Proprietary software
  is named only where the reader must use it to follow the page (Windows, the browser, the Tailscale console).
- **Never stress what the reader does not know** (owner rule): no "anche senza esperienza", "per chi non ha
  competenze informatiche", "anche senza aver mai usato un terminale", "non-technical", "even without experience".
  It reads as if the reader were taken for a fool. Where it must be said at all, say once that the guides are meant
  to be simple, also for people who seldom use a computer; otherwise just write the page simply.
- **Italian instructions in the infinitive**, as Italian manuals write them: "Premere **Salva**", "Leggere la tessera
  con il lettore", "Aprire il terminale". Never the second person ("premi", "puoi", "hai") nor the first ("cerco").
  States are described impersonally ("La copia risulta in prestito").
- **English** mirrors with the imperative ("Press **Save**", "Read the card with the scanner"), without chatter.
- **Headings are nouns**: "Procedura", "Occorrente", "Risultato", "Possibili problemi", "Verifica prima di
  proseguire", "Pagine correlate" (English: "Procedure", "Requirements", "Result", "Possible problems", "Check
  before going on", "Related pages").
- Every page **opens with one or two complete sentences** saying what it is for and for whom, before any list.
- **One action per step.** A step that needs two actions becomes two steps. The result of a step, when the reader
  needs to see it, follows the action in the same item ("Premere **Avanti**. Si apre la pagina **Scuola**.").
- Plain words; a technical word is explained the first time it appears on a page, or linked to the glossary
  (`docs/<lang>/help/glossary.md`).

## Vocabulary

- The words of the interface, exactly as the interface writes them: the Italian and English dictionaries are
  `src/lib/i18n/it/*.json` and `src/lib/i18n/en/*.json`. Find the label with a search there before naming a button,
  a tab, a page or a field.
- Operator words: **copia** (not "esemplare"), **segnatura** for the call number (never "collocazione"),
  **tessera**, **utente** for a patron, **Banco prestiti** for the desk area, **Gestione prestiti** for the shared
  loans account.
- **The USB barcode scanner is the normal reader** of cards, books and ISBNs: "il lettore di codici a barre", "the
  barcode scanner". The phone is an optional extra: when a page mentions it, it says so ("facoltativo", "optional")
  and comes after the scanner. Never suggest that a phone is needed.
- **Tailscale is never required.** The installation offers two ways side by side: Tailscale (the full way: HTTPS,
  camera, phones, use from outside the school; a free account) and the local network (the basic way: no account,
  no camera, only inside the school). The reader chooses; neither is presented as the wrong one.

## Kinds of page

Four kinds, never mixed on one page (Diátaxis). Each uses these headings, in this order, leaving out the ones that
do not apply.

**Guide** — one task from start to end ("Catalogare un libro nuovo").
`# <task in the infinitive>`, the opening sentences, then: a short list with the time it takes, the permission
needed and what is needed; `## Procedura` (numbered steps with figures); `## Risultato`; `## Possibili problemi`;
`## Pagine correlate`.

**Reference page** — one screen ("Banco prestiti").
`# <name of the screen>`, the opening sentences (what it is for, the permission, where it opens from), the figure
with numbered callouts and their legend, then one `##` per part of the screen and per message, so each has an
anchor.

**Installation step** — one step of an installation path ("Preparare il computer").
`# <step in the infinitive>`, the opening sentences (what the step achieves, how long it takes), `## Occorrente`,
`## Procedura`, `## Verifica prima di proseguire` (what the reader must see before the next step, and what to do when
it is not so), `## Possibili problemi` when there are any.

**Possibili problemi** — on every kind of page, one `###` per problem, never a bulleted list: the heading is the
symptom in a few words, as the reader recognises it (a short sentence or a noun phrase: «Il libro è già in
catalogo», «L'ISBN ha una cifra di controllo errata»; no colon, no bold, no link, no full stop); the body quotes the
message of the app in full, then the cause and the remedy. The site shows each problem as a box that opens with a
click, with one icon on the section's heading only; `site:build` warns about a section still written as a list. The
page Aiuto → Problemi comuni is made of problems only: each `##` is a box.

**Overview** — the features page only: the settings first, then a short paragraph per area saying what can be done
there; no steps, no figures and no lists of links (the site's header and side menu list the pages), a link only
where the navigation would not lead the reader. When a feature is added, its area's paragraph names it.

**Norme page** — one area of rules ("Protezione dei dati personali"), for the school's offices.
`# <area as a noun>`, the opening sentences (which rules, for whom), then: `## Che cosa chiede la norma` (the rule
in plain words, with its article), `## Che cosa fa BiblioViva` (facts only, each checked in the code),
`## Che cosa fa la scuola` (what stays to the school: a choice, a document, a check), the ready texts when the page
has them (`## Testo per …`, a quotation the school copies and completes; the parts to fill in are in square brackets, `[nome]`, since angle
brackets outside code would be read as HTML),
`## Riferimenti` (links to the official texts: Normattiva, EUR-Lex, AgID, the Garante, ACN). The section's first page
says once that the pages give facts for the school's evaluations and that the decisions are the school's and its
DPO's; no other page repeats it. A fact the law leaves open is written as such ("la norma non lo prevede
espressamente"), never stretched to an answer.

**Technical page** — the English documents of `docs/` (deployment, configuration reference, templates, reports),
written for technical readers as they are.

## Markdown

- One `#` heading per page, then `##` and `###`; no deeper levels.
- Lines wrapped at about 120 columns, as in the other files of `docs/`.
- **Steps** are a numbered list (`1.` for every item; Markdown numbers them). A command to copy goes in a code block
  of its own, with the language `sh`, one command per block, nothing in it that the reader must not type (no `$`
  prompt, no output). The output, when the reader must check it, goes in a separate block without a language.
- **Labels of the interface in bold**, exactly as in the dictionaries: "Premere **Salva**". Bold is for labels only;
  emphasis is rare and in italics. The site check fails when a bold text is not a label of that language. The
  labels of other programs (Raspberry Pi Imager, the Tailscale console, the router) go in quotation marks:
  "Choose OS", «Genera chiave».
- **Notes and warnings** are GitHub alerts, and only these three:

  ```markdown
  > [!NOTE]
  > Il numero di copie non cambia.

  > [!IMPORTANT]
  > Annotare la password: serve al primo accesso.

  > [!WARNING]
  > Il comando cancella tutti i dati.
  ```

- **Figures of BiblioViva's screens** are never pictures in the repository: a marker line names the picture of the
  shot list (`docs/shots.ts`) and gives the caption in the page's language, which is also the text alternative:

  ```markdown
  <!-- figure: circulation/desk-ok | Il banco prestiti dopo un prestito riuscito -->
  ```

  The name is `<area>/<what it shows>`, English, lower case. A writer who needs a picture that the shot list does not
  have yet proposes it (see "Hand-over").
- **Pictures of other programs** (the Tailscale admin console, Raspberry Pi Imager) only when the official page,
  linked, does not explain the step well enough. They are never screenshots taken by hand: each is a **mock**, an HTML
  page in `docs/mocks/<area>/<name>.html` that draws the parts the step names (labels as on the official page, no
  logos), taken by `docs:shots` like the app's screens (ADR-046): the page links `docs/mocks/mock.css` (the type and
  the plain parts, switches, fields, buttons), draws inside one `.mock` box, which is the picture, writes a text that
  depends on the reader's language twice (`.l-it`, `.l-en`), and gets a `mock("<area>/<name>")` line in the shot
  list. It is placed with a marker of the same shape:

  ```markdown
  <!-- screenshot: tailscale/dns | La pagina DNS della console di Tailscale -->
  ```

- **Variant blocks** (installation steps only): where a step differs between the paths that share it, each variant
  sits between two markers and opens with a visible label, so that a reader on GitHub sees both and knows which one
  is theirs; the site keeps only the block of the path. Variants: `raspberry`, `linux`, `windows`, `tailscale`, `lan`.

  ```markdown
  <!-- variant: tailscale -->
  **Con Tailscale**

  1. Aprire l'indirizzo `https://biblioviva.<tailnet>.ts.net`.
  <!-- /variant -->
  <!-- variant: lan -->
  **Con la rete locale**

  1. Aprire l'indirizzo `http://biblioviva.local:8080`.
  <!-- /variant -->
  ```

- **Links** between pages are relative links to the `.md` file (`[Scegliere la rete](choose-network.md)`, with
  `#anchor` when needed); they work on GitHub and become site paths. Links to other sites are full `https://`
  addresses of the official page (Raspberry Pi, Docker, Tailscale, the browser's maker), written as a link with a
  telling text, never a bare address.
- Tables only for comparisons and short reference lists, at most four columns (the manual is also printed). No
  footnotes, no raw HTML apart from the markers above, no emoji.
- Placeholders that the reader replaces are written in angle brackets inside code: `<tailnet>`, `<indirizzo>`.

## Facts

- Every command, path, port, file name, default value, label and message is **checked in the repository** before it
  is written: the compose files and `.env.example` in `docker/`, `setup.sh`, the routes in `src/routes/`, the
  dictionaries, `config/config.example.json`, and the technical pages `docs/deploy.md`, `docs/config-reference.md`,
  `docs/security.md`, `docs/navigation.md` (the pages, their paths and permissions).
- Other programs (Tailscale, Docker, Raspberry Pi Imager, router pages) change their screens: describe them in as few
  words as possible, link the official page that explains them, and check menu names on that page.
- What cannot be checked is written anyway, marked inline with `[VERIFY: what to check]`, and listed in the hand-over.
  Never invent a label, a menu, a message or a behaviour.
- No dates, no history ("from version…", "now", "new"), no names of real people or schools, no real addresses; the
  examples use the demo data and placeholder addresses (`biblioviva.<tailnet>.ts.net`, `192.168.1.50`).

## Hand-over (coding agents)

A writer works on the pages it was given, in the Italian folder only unless it was asked for the English mirror, and
does not touch other files. Its final message lists:

1. the files written;
2. the figures it placed that the shot list does not have yet: name, caption, the page of the app and the state it
   must be in (which account, which steps: a scan, a dialog opened), the windows (computer, tablet, phone) and the
   element to crop to, if any;
3. the screenshots of other programs it placed, with what each must show;
4. every `[VERIFY]` it left, with where it looked;
5. the glossary terms it used that the glossary should explain;
6. questions for the owner, if any.
