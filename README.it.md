# BiblioViva

<p align="center"><img src="docs/reference/branding/biblioviva-logo.png" alt="BiblioViva" width="360"></p>

> Gestione snella e self-hosted della biblioteca scolastica.
> English: [README.md](README.md)

**Stato: public beta.** Le funzioni sono stabili, ma fino alla versione 1.0 non è garantito che un aggiornamento
resti compatibile con i dati e le impostazioni della versione precedente. La specifica completa è in
[PLAN.md](PLAN.md) (in inglese).

- Sito: [biblioviva.org](https://biblioviva.org)
- Demo con dati di esempio, ripristinata ogni notte: [demo.biblioviva.org](https://demo.biblioviva.org)
- Documentazione: [docs.biblioviva.org](https://docs.biblioviva.org/it/) (manuale, amministrazione, installazione, aiuto,
  tecnica)

BiblioViva è un'applicazione web per il personale di una biblioteca scolastica (fino a circa 10 000 libri e 1 000
utenti). Prende le idee buone di [Koha](https://koha-community.org/), come la separazione tra record bibliografico e
copie fisiche, le regole di prestito e il calendario delle chiusure, e lascia fuori tutto ciò che a una scuola non serve.
Gira in un unico contenitore su un computer della scuola, tiene i dati in un solo file SQLite e si usa dal browser di
qualunque computer, tablet o telefono della rete della scuola.

## Cosa fa

- **Catalogazione in pochi secondi**: si legge l'ISBN con il lettore di codici a barre USB, si recupera la scheda
  dall'OPAC SBN (Z39.50, UNIMARC), la copertina arriva da sola (o si fotografa, raddrizzata automaticamente), si
  stampano le etichette con il codice a barre e le fascette per il dorso.
- **Classificazione da biblioteca scolastica**: narrativa per genere (favole, gialli, avventura…) con, per le scuole
  primarie, la classe consigliata; saggistica con una tassonomia molto semplice, a uno o due livelli. Ogni genere e ogni
  classe ha il suo pittogramma.
- **Utenti**: studenti e docenti, organizzati per classi (anche pluriclassi). Tessere con codice a barre, fototessere
  scattate nella pagina di censimento o ritagliate dalla foto di classe, stampa delle tessere da template HTML (fronte
  e retro affiancati, da piegare), import dal registro elettronico in CSV con sincronizzazione di inizio anno,
  passaggio di classe con un clic, anonimizzazione immediata degli studenti che escono.
- **Banco prestiti**: si passa la tessera (o si cerca per cognome), si passano i libri, fatto. Rinnovi, durate
  configurabili, weekend e festività, elenchi dei ritardi per classe e solleciti da stampare.
- **Liste di stampa**: si compongono liste di utenti o di libri da qualunque punto dell'interfaccia (ricerca, classe,
  selezione, lettura dei codici) e da lì si stampano tessere o etichette.
- **Inventario**: si passano i libri sullo scaffale e BiblioViva indica quelli mancanti.
- **Report e statistiche**: interrogazioni predefinite in file JSON (estendibili), grafici, export CSV e ODS di ogni
  tabella.
- **Backup e ripristino**: copia quotidiana di database, foto e copertine in una cartella che può stare su
  un secondo disco o una chiavetta USB, e una seconda copia facoltativa con rclone (per esempio sul server della
  scuola); un archivio con tutto da scaricare; ripristino anche dalla procedura del primo avvio.
- **Tutto si imposta dall'amministrazione**: regole di prestito, calendario, classi, formati dei codici, template
  di tessere ed etichette (con un editor grafico), account e permessi; la configurazione si esporta e si importa in un
  solo archivio.
- Interfaccia **multilingue** (con italiano e inglese già incluse, altre lingue con un pacchetto di traduzione), scelta
  una volta per tutta l'installazione.

## Cosa non fa

- **Nessun catalogo pubblico (OPAC)** e nessun accesso per studenti o famiglie: BiblioViva è solo per il personale
  della biblioteca. Non ci sono account personali degli utenti, prenotazioni o richieste online.
- **Nessun cloud per i dati di studenti e docenti**: restano sul computer della scuola, insieme ai backup. Nessun
  account presso il progetto, nessun abbonamento, nessuna statistica d'uso inviata. Verso l'esterno escono solo i
  dati dei libri: l'ISBN (o titolo e autore) cercato, verso l'OPAC SBN per compilare la scheda e verso Amazon e Open
  Library per la copertina (ogni fonte si può disattivare).
- **Nessuna multa e nessuna prenotazione**, per scelta: a scuola non servono.
- **Nessuna email o SMS**: i solleciti si stampano e si consegnano in classe.
- **Nessun collegamento diretto al registro elettronico**: studenti e docenti si importano da un file CSV esportato
  dal registro.
- **Non è un sistema per biblioteche grandi o per la catalogazione professionale**: una sola biblioteca per
  installazione, una scheda con pochi campi essenziali (niente MARC completo), niente acquisti, periodici o
  prestito interbibliotecario. Si importano cataloghi in CSV (anche da Koha), non file UNIMARC.

## Cosa serve

- **Un computer che resti acceso** durante l'apertura della biblioteca: un vecchio PC con Linux va benissimo (il
  percorso con Windows e Docker Desktop è in preparazione); in alternativa un Raspberry Pi 4 o 5 con almeno 2 GB.
- **Un lettore di codici a barre USB**: è il lettore normale per tessere, libri e ISBN; scrive come una tastiera.
- **Una stampante** per etichette, tessere e solleciti.

Facoltativi:

- **Tailscale** (account gratuito): dà a BiblioViva un indirizzo HTTPS, l'uso dal telefono con la fotocamera e
  l'accesso da fuori scuola. Senza Tailscale BiblioViva si usa dalla rete della scuola
  (`http://biblioviva.local:8080`) con tutte le funzioni tranne la fotocamera e l'accesso da fuori; si può passare a
  Tailscale in seguito, senza perdere i dati.
- **Un telefono o un tablet**: legge i codici e scatta foto e copertine con la fotocamera (serve Tailscale, perché il
  browser concede la fotocamera solo alle pagine HTTPS). Tutto si può fare anche senza: con il lettore USB o con foto
  caricate da file.

## Installazione

La guida passo per passo è la sezione Installazione della documentazione,
[docs.biblioviva.org/it/install](https://docs.biblioviva.org/it/install/) (inglese:
[docs.biblioviva.org/en/install](https://docs.biblioviva.org/en/install/)). Su un computer con
Linux un solo comando installa Docker se manca, fa poche domande (Tailscale o rete locale, potenza del computer) e
avvia tutto:

```bash
curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang it
```

Lo stesso comando, rilanciato, aggiorna BiblioViva. Le note tecniche (volumi, compose, Podman, backup esterni) sono nella sezione
[Tecnica](https://docs.biblioviva.org/it/tech/): [deploy](https://docs.biblioviva.org/it/tech/deploy/) e
[impostazioni](https://docs.biblioviva.org/it/tech/config-reference/).

```yaml
# docker/compose.yml (estratto, via Tailscale): funziona con docker compose e podman compose
services:
  tailscale:
    image: docker.io/tailscale/tailscale
    hostname: biblioviva          # → https://biblioviva.<tailnet>.ts.net
    environment:
      - TS_AUTHKEY=${TS_AUTHKEY}
      - TS_SERVE_CONFIG=/config/serve.json
    volumes: [ts-state:/var/lib/tailscale, ./tailscale:/config:ro]
  app:
    image: ghcr.io/itotm/biblioviva:latest
    network_mode: service:tailscale
    volumes:
      - ./config:/config          # configurazione, definizioni dei report, template di stampa, pittogrammi
      - app-data:/data            # database SQLite, foto e copertine, file importati
      - ./backups:/backups        # backup giornalieri e la copia di foto e copertine
```

- La variante senza Tailscale è `docker/compose.lan.yml`: solo l'applicazione, sulla porta 8080 della rete della
  scuola.
- Il database viene salvato automaticamente ogni giorno in `./backups`, una normale cartella accanto al file compose:
  è quella che va copiata altrove (o tenuta su un secondo disco).
- Con Tailscale servono MagicDNS e i certificati HTTPS abilitati sulla tailnet. In nessuno dei due casi una porta è
  esposta su Internet.

## Tecnologia

Bun · TypeScript · SvelteKit 3 (remote functions) · Svelte 5 (rune) · Tailwind CSS 4 · Skeleton · SVAR DataGrid ·
icone Lucide · Drizzle ORM su `bun:sqlite` · sveltekit-i18n · Playwright e Vitest. Un'unica immagine OCI per
`linux/amd64` e `linux/arm64`. Dettagli e versioni bloccate in [PLAN.md §2](PLAN.md#2-technology-stack).

## Sviluppo

```bash
bun install                 # Bun ≥ 1.4.4; versioni esatte bloccate in package.json
bun run dev                 # http://localhost:5173, raggiungibile anche dalla rete locale: http://<ip-del-pc>:5173
bun run ci                  # lint, controllo tipi, test unitari, di componente ed end-to-end (Chromium)
bunx playwright install firefox webkit   # una volta: Firefox e WebKit per le verifiche manuali e test:browsers
bun run build && bun run start
```

Da un telefono sulla stessa rete la fotocamera richiede HTTPS (i browser rifiutano `getUserMedia` su un'origine
`http://<ip>`): provarla tramite Tailscale `serve` o il contenitore installato; tutto il resto funziona in HTTP
semplice.

Al primo avvio si apre la procedura guidata (lingua, colori, nome della biblioteca, scuola e classi, password del
personale, dati dimostrativi facoltativi). I dati locali stanno in `./local/` (ignorata da git).

### Comandi

| Comando | A cosa serve |
|---|---|
| **Applicazione** | |
| `bun run dev` | Server di sviluppo su http://localhost:5173 (anche dalla rete locale) |
| `bun run demo` | La demo pubblica in locale (`local/demo/`, porta 5174): dati di esempio, selettore della lingua |
| `bun run build` / `bun run start` | Compila l'applicazione e avvia il server compilato (`bun --smol` se il profilo lo chiede) |
| `bun run dev:reset --yes` | Riparte da zero come al primo avvio: cancella database, backup, configurazione, logo e storico |
| `bun run db:seed` | Tiene la configurazione e riempie un database vuoto con dati sintetici |
| **Controlli e test** | |
| `bun run ci` | Tutto quello che controlla la CI: lint, tipi, test unitari e di componente, end-to-end |
| `bun run check` / `bun run lint` / `bun run format` | Controllo dei tipi, stile e lint, formattazione automatica |
| `bun run test` / `bun run test:watch` | Test unitari e di componente (Vitest) con la copertura / in modalità watch |
| `bun run test:e2e` | Test end-to-end (Playwright, Chromium, computer e telefono) |
| `bun run test:browsers` | Componenti ed end-to-end su Chromium, Firefox e WebKit (a richiesta, obbligatorio prima della 1.0) |
| `bun run test:report` | Riscrive `test-reports/index.html`: riepilogo e link ai report HTML |
| `bun run ui:audit` | Trova gruppi di classi Tailwind ripetuti che vanno raccolti in un componente |
| **Configurazione e dati** | |
| `bun run config:check [config.json] [--explain chiave]` | Verifica la cartella della configurazione senza avviare il server; `--explain` dice quale file definisce una chiave |
| `bun run config:export [file] [--only\|--except parti]` | Esporta la configurazione in un archivio |
| `bun run config:import <zip> [--only\|--except parti] [--yes]` | Importa una configurazione esportata |
| `bun run backup:restore <zip\|db> [--only\|--except parti] [--yes]` | Ripristina un backup o un archivio completo |
| `bun run auth:hash-password` | Calcola l'hash di una password per `security.users` |
| `bun run patrons:import-photos <cartella\|zip> [--replace]` | Importa le foto degli utenti esportate da Koha (un file per numero di tessera) |
| `bun run classification:import-images <cartella>` | Importa i pittogrammi esistenti della biblioteca, uno per codice di classificazione |
| `bun run i18n:check <cartella>` | Verifica un pacchetto di traduzione rispetto all'inglese |
| **Ricerca dei libri** | |
| `bun run yaz:image` | Costruisce una volta l'immagine `biblioviva-yaz` con `yaz-client`, se non è installato |
| `bun run z3950:test <isbn>` | Prova la ricerca Z39.50 su OPAC SBN dal terminale |
| `bun run metadata:test <isbn\|"titolo"> [fonti]` | Una ricerca attraverso tutte le fonti attive, con l'esito di ciascuna |
| **Sito e documentazione** | |
| `bun run home:build` / `bun run home:serve` | La home page di biblioviva.org in `home/dist/` e in uno zip / servita su http://localhost:5176 |
| `bun run docs:shots` | Gli screenshot della documentazione presi dall'app (in `site/.shots/`) |
| `bun run site:build` / `bun run site:serve` | Il sito della documentazione in `site/dist/` / servito su http://localhost:5175 |
| **Contenitore** | |
| `bun run docker:build` / `bun run docker:build:multi` | Immagine locale (Podman) / immagine multi-architettura |
| `bun run deploy:check <indirizzo>` | Controlla un'installazione dalla rete: salute, HTTPS e certificato, intestazioni, pagina di accesso |
| **Generatori** (dopo una modifica alla loro sorgente) | |
| `bun run db:generate` / `bun run db:migrate` | Rigenera l'unica migrazione dallo schema / la applica |
| `bun run themes:generate` | I set di colori in `src/lib/themes/` |
| `bun run pictograms:generate` | I pittogrammi delle fascette forniti con l'app |
| `bun run templates:shipped` | L'elenco delle versioni dei template di stampa forniti |
| `bun run i18n:locales` | L'elenco delle lingue dalle cartelle dei dizionari |
| `bun run deps:generate` | L'elenco delle librerie della pagina Informazioni |

**Provare la ricerca per ISBN.** La ricerca usa `yaz-client` (Z39.50). Se non è installato sul computer
(`dnf install yaz`, `apt install yaz`), lo si usa dal piccolo contenitore di `bun run yaz:image`:

```bash
YAZ_CLIENT=$PWD/scripts/yaz-client.sh bun run dev   # l'app chiama yaz-client attraverso il contenitore
```

Senza rete, `METADATA_PROVIDER=mock bun run dev` risponde con sei schede di prova invece di OPAC SBN. Codici da
scansionare durante le prove: tessere ed etichette stampate dall'app (Stampe, oppure le pagine di utenti e libri), i
fogli di esempio di Amministrazione → Template di stampa e i codici in `tests/fixtures/barcodes/`; un lettore USB
funziona come una tastiera (impostarlo sul layout italiano o lasciare che l'app corregga `'` in `-`).

Le regole per chi contribuisce, persone o agenti di programmazione, sono in [CLAUDE.md](CLAUDE.md) (in inglese).
Problemi e proposte: [issue su GitHub](https://github.com/itotm/biblioviva/issues).

## Come viene sviluppato

BiblioViva è progettato e sviluppato con l'aiuto di [Claude](https://claude.com) (Anthropic) come agente di
programmazione, a partire dalla specifica in [PLAN.md](PLAN.md) e secondo le regole di [CLAUDE.md](CLAUDE.md).
Le decisioni di progetto, le revisioni e ogni commit sono del manutentore.

## Licenza

GPL-3.0-or-later — vedi [LICENSE](LICENSE).
