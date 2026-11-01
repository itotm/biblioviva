# BiblioViva — Guida per chi amministra la biblioteca

Questa guida spiega le operazioni che si fanno poche volte l'anno: importare gli studenti, gestire
le tessere, i backup. È pensata per chi non ha competenze tecniche. La versione inglese è in
[admin-guide.en.md](admin-guide.en.md). Le sezioni crescono insieme all'applicazione.

## 1. Importare studenti e docenti da un file

Serve il permesso *Importazione utenti* (di norma l'account **Amministrazione** o **Tessere**). Le
importazioni sono in **Amministrazione → Importazioni**: **Studenti** e **Docenti** sono due pagine
separate.

### 1.1 Preparare il file

1. In fondo alla pagina c'è il riquadro **Il modello del file**: scegli le colonne che ti servono e
   premi **Scarica il modello**. Il modello contiene solo la riga di intestazione, da riempire con
   una riga per persona (anche con un foglio di calcolo, salvando in formato CSV).
2. Le colonne **obbligatorie** sono sempre nel modello:
   - per gli **studenti** `first_name` (nome), `last_name` (cognome) e la classe, in una colonna
     `class` (per esempio `3A` o `3 A`) oppure in due colonne `level` (l'anno, `3`) e `section`
     (la sezione, `A`): scegli tu quale forma usare;
   - per i **docenti** solo `first_name` e `last_name`.
3. Le **chiavi** servono a riconoscere chi è già in archivio e si possono lasciare fuori:
   `card_number` (il numero di tessera già in uso: se manca, la tessera viene generata) e
   `external_id` (la matricola del registro: se manca, chi è già in archivio si riconosce per nome
   e classe).
4. Colonne facoltative: `email`; per i docenti `group` (il gruppo docenti; se manca, quello
   predefinito).
5. I nomi delle colonne vanno scritti come nel modello, in inglese: le colonne con altri nomi
   vengono ignorate (si possono abbinare a mano nel passo **Colonne**). Un file senza intestazione
   va bene se le colonne sono nell'ordine `first_name;last_name;level;section` o
   `first_name;last_name;class` (docenti: `first_name;last_name`).
6. La classe deve esistere già in **Amministrazione → Configurazione → Classi**: l'importazione non crea classi.
7. Non serve preoccuparsi di codifica o separatore: sono accettati UTF-8 e Windows-1252, `;` e `,`.
   Le righe vuote vengono ignorate.

### 1.2 Caricare e controllare

1. Apri **Amministrazione → Importazioni → Studenti** (o **Docenti**).
2. Scegli il file e premi **Carica**.
3. Nel passo **Colonne** controlla che ogni colonna del file sia abbinata al campo giusto; accanto
   ai campi obbligatori e alle chiavi c'è scritto *obbligatoria* o *chiave*. Se manca una colonna
   obbligatoria la pagina dice quale. La scelta viene ricordata per la prossima volta.
4. Scegli la **modalità**:
   - **Aggiungi e aggiorna** (normale): chi è già in archivio viene aggiornato (per esempio con la
     nuova classe), gli altri vengono creati.
   - **Sincronizza studenti** (o **Sincronizza docenti**): da usare con l'elenco completo. Chi non è
     più nel file viene elencato; se hai il permesso e lo confermi, viene **rimosso** (i dati
     personali sono cancellati subito e per sempre, restano solo classe e statistiche). La
     sincronizzazione degli studenti non tocca mai i docenti, e viceversa.
5. Premi **Verifica il file**.

### 1.3 Leggere l'esito

- Ogni riga ha un esito: **Nuovo**, **Aggiorna**, **Invariato** o **Errore** con la spiegazione.
  Una classe che non esiste è un errore che elenca le classi valide.
- Con anche un solo errore il bottone **Importa** resta spento: correggi il file (o l'utente in
  archivio) e verifica di nuovo. Non esiste "salta gli errori": così l'archivio resta pulito.
- Se nel file non ci sono numeri di tessera, la pagina dice quante tessere nuove verranno generate.
- Una cella vuota non cancella niente: per esempio una tessera vuota nel file lascia la tessera
  che l'utente ha già.
- Se in archivio ci sono due persone con lo stesso nome e cognome, la riga chiede di scegliere
  quale aggiornare (o di crearne una nuova); poi verifica di nuovo.
- Nella sincronizzazione, chi manca e ha prestiti aperti non viene rimosso: prima i libri vanno
  restituiti o segnati smarriti.

### 1.4 Importare

1. Premi **Importa**: tutto viene scritto in un colpo solo. Ai nuovi utenti senza numero viene
   assegnato automaticamente il numero di tessera.
2. La pagina finale riassume i numeri e offre **Stampa le tessere dei nuovi** e **Censimento
   foto**. Il file originale resta conservato sul server (Amministrazione → Registro operazioni
   riporta l'importazione).

Ricaricare lo stesso file non fa danni: tutte le righe risultano *Invariato*.

### 1.5 Passare da Koha

Chi arriva da Koha può estrarre gli studenti con la query `docs/import/koha-students.sql` e i
docenti con `docs/import/koha-teachers.sql` (vedi `docs/import/README.md`): i file che producono
hanno già i nomi delle colonne giusti e contengono i numeri di tessera, così le tessere già stampate
continuano a funzionare. I nomi delle colonne di Koha possono cambiare da una versione all'altra:
chi esegue la query deve controllarli prima.

## 1b. Importare il catalogo e passare da Koha

### 1b.1 Il file del catalogo

**Amministrazione → Importazioni → Catalogo** accetta un file con **una riga per ogni copia**: i
dati del titolo (titolo, autore, editore, anno, ISBN, classificazione…) si ripetono sulle righe
delle sue copie (codice a barre, segnatura, materiale, data di acquisizione…). Anche qui il modello
si genera dalla pagina con le colonne che servono; esempi in `docs/import/`.

- **Obbligatorie**: `title`, `author`, `publisher`.
- **Chiavi**: `biblio_key` (il codice del titolo nel vecchio programma, in Koha il
  `biblionumber`: tiene insieme le copie; se manca, le copie si raggruppano per ISBN) e `barcode`
  (il codice a barre già sulla copia; se manca, il codice viene generato e le etichette vanno
  stampate).
- **Facoltative**: tutte le altre, tra cui `classification` (il codice del genere o
  dell'argomento). Un libro senza classificazione viene importato lo stesso e finisce in
  **Catalogo → Da classificare**: le sue copie non si prestano finché qualcuno non lo classifica.

1. Carica il file. Le colonne con i nomi del modello sono riconosciute da sole; le altre si
   scelgono a mano (la scelta viene ricordata). Se mancano chiavi o classificazione, la pagina dice
   cosa succederà.
2. Se in alcune righe mancano autore o editore, spunta **«usa i valori speciali»**: verranno
   messi «Anonimo» e «s.n.», come in catalogazione.
3. **Verifica il file**: ogni riga mostra il suo esito, e la pagina conta le copie che riceveranno
   un codice nuovo e i titoli da classificare. Con anche un solo errore «Importa» resta spento:
   correggi il file e verifica di nuovo.
4. Se copie dello stesso titolo hanno **livelli di lettura diversi**, BiblioViva chiede se attivare
   il **livello per copia** (il livello di lettura sta su ogni copia invece che sul titolo).
   Rispondendo sì, l'impostazione vale per tutto il catalogo e il livello dei titoli già presenti
   passa alle loro copie; rispondendo no, quelle righe restano errori.
5. **Importa**: tutto in un'unica operazione. Le copie senza codice a barre ricevono un codice
   nuovo e alla fine puoi stamparne le etichette; quelle con il codice di Koha tengono le etichette
   che hanno già. Importare due volte lo stesso file non crea doppioni.

### 1b.2 Passare da Koha: l'ordine

La scuola usa **due versioni di Koha**: prima di lanciare le estrazioni bisogna sapere da quale
versione si parte, perché i nomi delle colonne cambiano. Le query in `docs/import/` sono scritte
per la versione attuale di Koha; chi le esegue deve controllarle sulla propria.

1. **Studenti**: `koha-students.sql` → **Importazioni → Studenti** (le tessere restano valide).
2. **Docenti**: `koha-teachers.sql` → **Importazioni → Docenti**.
3. **Catalogo**: `koha-biblio-items.sql` → **Importazioni → Catalogo**. L'estrazione produce un
   file separato da tabulazioni: va caricato così com'è (le descrizioni fisiche contengono «;»).
4. **Prestiti in corso**: `koha-issues.sql` → **Importazioni → Prestiti in corso**. Si usa una
   volta sola, il giorno del passaggio: ogni prestito mantiene la data e la scadenza originali,
   quelli già scaduti compaiono subito tra i ritardi. Se il file non ha le date, il prestito
   risulta fatto oggi e la scadenza si calcola con le regole di prestito.
5. **Foto degli utenti**: `koha-patron-images.sql` e il ciclo descritto in testa al file scrivono un
   file per utente, chiamato con il numero di tessera. Poi **Importazioni → Foto degli utenti**:
   carica le foto in un archivio ZIP oppure copiale nella cartella `imports/photos` dei dati e
   premi «Importa dalla cartella». Le foto già presenti restano, a meno di spuntare «Sostituisci»;
   i file senza utente si scaricano in un elenco.

Dopo ogni passo controlla i numeri: quanti utenti, titoli, copie e prestiti c'erano in Koha e
quanti ne mostra BiblioViva; prova a leggere con lo scanner qualche etichetta e qualche tessera.

## 2. Note, storico e rimozione di un utente

Nella scheda di ogni studente o docente (**Utenti** → clic sul nome):

- **Note**: *Modifica note* permette di scrivere la *nota per il banco prestiti* (compare in
  evidenza quando quella persona prende un libro) e le note interne.
- **Storico**: tutti i prestiti, anche quelli restituiti, con l'esito (in corso, in ritardo,
  restituito, restituito in ritardo) ed **Esporta** in CSV o ODS.
- **Rimuovi studente / Rimuovi docente** (serve il permesso *Anonimizzazione*, di norma solo
  l'account Amministrazione): cancella subito e per sempre nome, cognome, contatti, matricola,
  note, numero di tessera e foto. Restano tipo, classe, sezione e lo storico dei prestiti, che
  servono alle statistiche. Non si può annullare e non è possibile con prestiti in corso: prima
  vanno restituiti o segnati smarriti. È la stessa operazione che la sincronizzazione degli
  studenti (§1.2) propone per chi non è più nel file.

## 3. Liste di stampa

Una **lista di stampa** è un elenco ordinato di utenti o di copie da stampare in un colpo solo,
per esempio le tessere di una classe o le etichette dei libri appena arrivati. Si trova in **Stampe** e nel cestino in alto
a destra: il numero sul cestino conta le liste **da stampare** (con almeno una voce e mai segnate come
stampate) e il suo menu le elenca con il numero di voci; tutte le altre sono in *Stampe*.

1. **Nuova lista utenti** in *Stampe*, con un nome parlante (per esempio «Tessere 1A»).
2. Aggiungi le persone: con i **filtri rapidi** (classe e sezione, tipo, solo chi non ha ancora la
   tessera stampata o la foto, un'importazione, creati da una data), con lo **scanner** (passa le
   tessere una dopo l'altra: chi è già in lista viene ignorato con un avviso, senza suoni), oppure
   dalla pagina **Utenti** con *Aggiungi alla lista* (anche sui selezionati con Ctrl-clic).
3. Riordina trascinando le voci o con le frecce; togli chi non serve con la ×.
4. **Stampa tessere** apre il foglio pronto per la stampante nell'ordine della lista.
5. **Segna come stampate** registra la data sulla lista e su ogni tessera; spunta *Svuota la lista
   dopo la stampa* se non ti serve più.

Le liste si possono rinominare ed eliminare: eliminare una lista non tocca gli utenti.

Per le tessere di tutta una classe non serve una lista: sotto le liste, *Stampe* mostra le
**classi**, ciascuna con **Stampa tessere**.

### 3.1 Etichette dei libri

Le **liste di libri** (**Nuova lista libri** in *Stampe*) funzionano allo stesso modo e servono a stampare le etichette: la **coppia**
(fascetta per il dorso sopra, etichetta con il codice a barre sotto, una per libro sul foglio
adesivo da 70 × 48 mm: nove libri per foglio, come la stampa attuale), oppure solo l'etichetta con
il codice a barre o solo la fascetta.

1. Aggiungi le copie: dal **Catalogo** (seleziona i titoli con Ctrl-clic e usa *Aggiungi selezionati
   alla lista*: entrano tutte le copie di quei titoli), dalla **scheda di un libro** (*Aggiungi alla
   lista* mette tutte le copie), con lo **scanner** camminando lungo lo scaffale, o con i **filtri
   rapidi** (etichette ancora da stampare, data di acquisizione, genere o classe di saggistica, tipo
   di copia, importazione).
2. **Stampa etichette** apre una finestra dove scegli il tipo (coppia, solo barcode, solo fascetta),
   il **foglio di etichette** e la **prima posizione libera**, per usare un foglio già iniziato: le
   posizioni si contano in unità (in coppie per la coppia). La finestra dice quante copie e quanti
   fogli servono e apre la stampa in una nuova scheda.
3. Stampa con **scala 100 %**, mai «adatta alla pagina». La prima volta stampa la **pagina di
   calibrazione** su carta comune (*Amministrazione → Configurazione → Template di stampa → Etichette*) e
   sovrapponila a un foglio di etichette per controllare i margini.
4. **Segna come stampate** (scegli il tipo accanto al pulsante) registra la data su ogni copia: la
   coppia segna entrambe le etichette. Le copie ancora senza etichette compaiono nella **Dashboard**,
   da cui si stampano in un colpo solo.

Le stesse azioni sono sulla scheda del libro (tutte le copie, o una sola con l'icona della stampante
sulla riga della copia) e al termine dell'inserimento di un nuovo libro.

### 3.2 Modificare molte copie insieme (per esempio dismettere dei libri)

Le copie si cambiano in un colpo solo dal **Catalogo**: seleziona i titoli con Ctrl-clic e usa
**Modifica le copie dei selezionati** (le liste di *Stampe* servono solo a stampare).

1. Scegli *Stato → Ritirato* e scrivi il **motivo** (obbligatorio per ritirate e perse).
2. **Controlla** mostra quante copie cambiano e quali restano come sono: quelle **in prestito** non
   vengono ritirate finché non sono restituite.
3. **Applica**: tutte le copie cambiano insieme e ciascuna conserva nel registro il motivo.

Lo stesso strumento cambia il materiale, l'esclusione dal prestito, la data di acquisizione o la
classe della copia, e **Riclassifica** assegna ai titoli selezionati un nuovo genere o argomento,
riscrivendo se vuoi le segnature: le fascette (e le etichette, se cambia la segnatura) tornano tra
quelle da stampare.

## 4. Backup e copia completa

BiblioViva fa da sola una copia di sicurezza ogni notte (all'ora impostata in `backup.cron`, di
norma le 3:00) e la trovi in **Amministrazione → Backup**.

**Computer spento di notte.** Se BiblioViva gira su un computer che la sera si spegne, all'ora del
backup non c'è nessuno a farlo. Allora, all'accensione successiva, BiblioViva si accorge che il
backup programmato è saltato e ne fa uno un minuto dopo l'avvio (uno solo, anche se il computer è
rimasto spento più giorni). Nell'elenco della pagina Backup quella copia porta la scritta
**Recuperato all'avvio**. L'opzione si chiama «Backup all'avvio se saltato», in **Amministrazione →
Configurazione → Backup**, ed è attiva di norma. Nella stessa pagina puoi anche spostare l'orario
del backup dentro l'orario di apertura (per esempio `0 13 * * 1-5`, alle 13 dal lunedì al venerdì),
quando il computer è sicuramente acceso.

### 4.1 Cosa contiene il backup notturno

- **Il database**: una copia completa a ogni esecuzione, conservata per il numero di giorni impostato
  (30 di norma). Le copie sono i file `biblioviva-AAAAMMGG-HHMM.db` elencati nella pagina.
- **Le foto e le copertine**: vengono copiate nella cartella `backups/uploads` (solo i file nuovi o
  cambiati, così l'operazione è veloce anche su un Raspberry Pi). La pagina indica quante foto e
  copertine sono già al sicuro.
- Se hai attivato la copia esterna (servizio *offsite*, vedi `docs/deploy.md`), la cartella dei backup viene
  copiata ogni ora nella sua destinazione, immagini comprese.

La **configurazione** (impostazioni, template delle tessere e delle etichette con le loro immagini)
non fa parte del backup notturno: sta nella cartella `/config` e cambia raramente. Per averla in un
unico file usa l'esportazione completa (§4.2) o **Esporta configurazione** (§14).

Tutti i file ZIP che BiblioViva crea — **Esporta tutto**, **Esporta configurazione**, i backup delle
parti scelte — sono fatti allo stesso modo: ognuno contiene solo le parti che hai chiesto. Per questo
ognuno si può dare sia a **Ripristina** sia a **Importa configurazione**.

### 4.2 Esporta tutto

1. Apri **Amministrazione → Backup** e premi **Esporta tutto**.
2. Il browser scarica un file `biblioviva-export-AAAAMMGG-HHMM.zip` con dentro il database, tutte le
   foto e le copertine e l'intera configurazione (template e immagini compresi), più un file
   `manifest.json` che riassume il contenuto.
3. Conserva il file in un posto sicuro (una chiavetta, il cloud della scuola): è tutto ciò che serve
   per rimettere in piedi BiblioViva su un altro computer.

Il file può essere grande (le copertine pesano più del database): con qualche migliaio di libri conta
alcune centinaia di megabyte.

### 4.3 Ripristinare

- **Da una copia notturna**: ferma l'app, sostituisci `/data/db/biblioviva.db` con il file scelto,
  cancella `biblioviva.db-wal` e `biblioviva.db-shm` se ci sono, rimetti le immagini da
  `/backups/uploads` in `/data/uploads` se mancano e riavvia.
- **Da un backup o da un file di BiblioViva** («Esporta tutto», «Esporta configurazione»): in
  **Amministrazione → Backup** premi **Ripristina…** sul backup dell'elenco, oppure **Carica un
  archivio** per un file portato da un altro computer. La pagina mostra le parti che il file contiene
  (un file della sola configurazione offre solo le parti della configurazione): scegli quali
  riprendere e premi **Ripristina**. Le parti che non scegli restano come sono.
- **Dal terminale**: ferma l'app e, sul computer che la ospita, esegui
  `bun run backup:restore <file.zip>`: senza altre opzioni ti mostra cosa contiene l'archivio; con
  `--yes` lo rimette al posto dei dati e della configurazione attuali. Poi riavvia l'app.

Prima di scompattare qualsiasi cosa l'archivio viene controllato: se non è un file di BiblioViva, se
contiene percorsi che escono dalle sue cartelle, collegamenti, file che non gli appartengono, più di
200 000 file o contenuti molto più grandi del file stesso (oltre venti volte la sua dimensione, al
massimo 8 GB) viene rifiutato e non si scrive nulla. Ripristinando gli
utenti tornano anche le loro classi.

I passaggi esatti per il contenitore sono nella guida di installazione (`docs/deploy.md`).

### 4.4 Dove sono i backup e come tenerne una copia altrove

I backup — le copie notturne, i backup delle parti scelte e la copia delle foto e delle copertine —
stanno nella cartella **`backups`**, accanto ai file di BiblioViva sul computer che la ospita (la
stessa cartella che contiene `compose.yml` e la cartella `config`). È una cartella normale: puoi
aprirla, guardarne i file e copiarla. Il database invece sta in un posto suo, dentro Docker: se
quello si guasta o viene cancellato, i backup restano.

Per avere una copia anche altrove:

1. **Su una chiavetta o un disco esterno, ogni tanto**: copia la cartella `backups` (o solo i file
   più recenti). In alternativa scarica un backup da **Amministrazione → Backup** (il pulsante
   **Scarica** accanto a ogni backup) oppure premi **Esporta tutto**.
2. **Su un secondo disco, sempre**: chi gestisce il computer può far stare la cartella `backups` su
   un secondo disco o su un disco USB sempre collegato (i passaggi sono nella guida tecnica,
   `docs/deploy.md`, «Backups on a second disk or a USB drive»). Così un guasto del disco principale
   non si porta via anche i backup.
3. **Una seconda copia, ogni ora**: la copia esterna (servizio *offsite*, rclone, vedi `docs/deploy.md`) copia la
   cartella `backups` in una cartella di un altro disco o del server della scuola, oppure su un servizio che la
   scuola usa già, con un account che possiede.

I backup contengono i dati degli studenti: tienili in un posto sicuro e cancella le copie che non
servono più.

## 5. Aggiungere una lingua

BiblioViva parla inglese e italiano. Se ti serve un'altra lingua, puoi aggiungerla senza toccare il
programma: basta una cartella con le traduzioni nella cartella di configurazione.

1. Apri la cartella di configurazione (`/config`, vedi la guida di installazione): dentro trovi
   `i18n/en/` e `i18n/it/`, le traduzioni ufficiali scritte lì come esempio al primo avvio.
2. Copia la cartella `i18n/it/` (o `en/`) e rinomina la copia con il codice della nuova lingua, per
   esempio `i18n/de/` per il tedesco o `i18n/fr/` per il francese (due lettere minuscole,
   eventualmente seguite dal paese: `pt-BR`).
3. Nel file `pack.json` della copia scrivi il nome della lingua in inglese (`"name"`) e nella lingua
   stessa (`"nativeName"`, è quello che si vede nei menu).
4. Traduci i testi nei file `.json`: cambia solo ciò che sta a destra dei due punti, mai le chiavi a
   sinistra, e lascia intatte le parti fra doppie graffe come `{{name}}` (vengono sostituite dal
   programma). Puoi tradurre poco alla volta: quello che manca resta in inglese.
5. Riavvia BiblioViva (o ricarica la configurazione). La nuova lingua compare nel wizard iniziale e in
   **Amministrazione → Configurazione → Aspetto e lingua**.

Prima di caricarla, BiblioViva controlla la cartella: se manca un file, se un file non è un JSON
valido o se una traduzione ha perso una parte fra graffe, la lingua **non viene proposta** e nel
registro del server compare un avviso che dice esattamente quale file e quale chiave sistemare. Chi
sa usare il terminale può fare lo stesso controllo prima di riavviare con
`bun run i18n:check /config/i18n/de`.

Le traduzioni ufficiali restano dentro al programma: le cartelle `en/` e `it/` in `/config/i18n/`
sono solo copie da cui partire, e modificarle non cambia l'inglese e l'italiano dell'app.

## 6. Calendario e scadenze

Le scadenze dei prestiti tengono conto dei giorni in cui la biblioteca è chiusa. In
**Prestiti → Calendario** vedi i mesi dell'anno scolastico con i giorni di chiusura e il
motivo di ciascuno (chiusura settimanale, festività nazionali — Pasqua compresa, calcolata da sola —,
festività della scuola, periodi di chiusura come le vacanze di Natale o l'estate). La pagina serve a
controllare: le chiusure si cambiano in **Amministrazione → Configurazione → Calendario** (salvate
nella sezione `calendar` di `config.json` oppure in un file per anno `calendar.2026.json` nella
cartella `/config`).

Con l'impostazione normale una scadenza che cade in un giorno di chiusura passa al primo giorno di
apertura successivo; `circulation.hardDueDate` fissa un ultimo giorno oltre il quale nessun prestito
può scadere (per esempio la fine delle lezioni).

## 7. Foto e copertine: formato e dimensioni

Le foto degli utenti e le copertine vengono salvate nel formato scelto in configurazione:
`photos.format` e `covers.format` (`jpeg`, quello normale, oppure `webp`, un po' più leggero) con la
qualità `quality` da 1 a 100 (80 è un buon compromesso).

- **Foto**: sempre esattamente `photos.width × photos.height` pixel (480 × 640, proporzione 3:4 come
  una fototessera). Quando scatti o carichi una foto dal browser scegli tu l'inquadratura nella
  cornice; le foto che arrivano senza inquadratura (importazione da Koha, file che il browser non sa
  aprire) vengono ritagliate al centro.
- **Copertine**: larghe `covers.width` pixel (600) con le proporzioni del libro, mai ritagliate;
  `covers.maxHeight` limita l'altezza delle immagini molto lunghe.

Cambiare formato vale per le foto e le copertine salvate da quel momento: quelle già presenti restano
come sono e continuano a funzionare.

## 8. Solleciti, promemoria e ricevute

In **Prestiti → Solleciti** trovi i prestiti in ritardo divisi per classe e sezione (i docenti in
fondo, sotto "Docente"), con il numero di libri in ritardo di ogni gruppo.

1. Controlla **Giorni minimi di ritardo**: un prestito compare solo dopo questi giorni (5 di
   solito, perché non tutti possono passare in biblioteca ogni giorno; 0 = subito). Il valore di
   partenza è `circulation.overdueNotice.minDays`.
2. Togli la spunta ai gruppi che non vuoi stampare; scegli **Una pagina per ogni classe** se vuoi
   consegnare un foglio a ogni insegnante.
3. Premi **Stampa solleciti**: si apre una nuova scheda con i solleciti come quelli di oggi
   (intestazione "1 D - Solleciti biblioteca del …", tabella Nome, Titolo, Giorni ritardo). Stampa
   con la scala al 100 %.
4. Dopo aver stampato premi **Segna solleciti stampati**: la data compare come "Ultimo sollecito"
   nell'elenco **In prestito**.

**Stampa promemoria** stampa i libri in ritardo di un solo utente: lo trovi nella scheda
dell'utente, nelle restituzioni (quando restano altri libri in ritardo) e nel messaggio del banco
prestiti che segnala i ritardi. La **ricevuta del prestito** ("Stampa ricevuta" al banco) si attiva
con `"receipts": true` nella sezione `circulation` della configurazione. I tre modelli sono nella
cartella `/config/slips/templates/` e si modificano come quelli delle tessere
(`docs/templates-authoring.md`).

### 8.1 Libri smarriti, danneggiati e ritirati

- **Smarrito**: nella scheda dell'utente, accanto al prestito, il pulsante con la croce rossa
  ("Segna smarrito") chiude il prestito e segna la copia come smarrita; il libro resta elencato
  sotto **Libri smarriti** nella scheda dell'utente. Se ricompare basta passarlo nelle
  **Restituzioni**: torna disponibile da solo. Si può segnare smarrita una copia anche dalla scheda
  del libro (cambio di stato): se era in prestito, il prestito si chiude allo stesso modo.
- **Danneggiato**: dopo una restituzione, "Segna danneggiato". Una copia danneggiata si presta
  ancora; per fermarla scegli "In riparazione" nella scheda del libro.
- **Ritirato**: una copia ritirata non si presta mai, nemmeno forzando; quando tutte le copie di un
  libro sono ritirate il libro sparisce dalle ricerche del catalogo (spunta **Mostra anche i libri
  ritirati** per ritrovarlo). Una copia in prestito non si può ritirare.

## 9. Logo della biblioteca

In **Amministrazione → Configurazione → Aspetto e lingua**, riquadro **Logo della biblioteca**:

1. Premi **Carica il logo** e scegli l'immagine (PNG, JPEG o WebP; meglio un PNG con lo sfondo
   trasparente). Il logo compare subito in alto a sinistra in ogni pagina, accanto al nome della
   biblioteca.
2. Per cambiarlo premi **Cambia il logo**; per toglierlo **Rimuovi il logo** (torna un'icona
   generica).

Il logo viene salvato nella cartella della configurazione (`/config/branding/logo.png`), quindi fa
parte dei backup e dell'esportazione della configurazione. Il logo e il nome di BiblioViva restano
solo nella dashboard.

## 10. Avanza di classe (fine anno)

Si fa una volta l'anno, quando lo decide l'amministratore (di solito a giugno o prima dell'inizio
delle lezioni): **Amministrazione → Avanza di classe**.

1. **Backup**: premi **Crea il backup**. Senza backup non si va avanti; se qualcosa va storto si
   ripristina da **Amministrazione → Backup**.
2. **Classi**: ogni studente passa alla classe successiva (la 3 A diventa 4 A). Apri una classe per
   segnare chi **ripete** l'anno o chi cambia **sezione**.
3. **Uscite**: gli studenti dell'ultima classe lasciano la scuola e i loro dati vengono **cancellati
   subito e per sempre** (restano solo i numeri delle statistiche). Togli la spunta a chi resta. Chi ha
   ancora libri in prestito blocca l'avanzamento: registra la restituzione (o segna il libro
   smarrito), oppure togli la spunta.
4. **Conferma**: controlla il riepilogo e premi **Avanza di classe**. Se l'ultimo avanzamento è di
   meno di sei mesi fa, serve una conferma in più.
5. Alla fine importa i nuovi studenti delle prime classi con **Amministrazione → Importazioni →
   Studenti** (sincronizzazione, §1).

I docenti non cambiano. I prestiti già fatti tengono la classe del giorno del prestito, quindi le
statistiche degli anni passati restano giuste.

## 11. Esportazioni

**Amministrazione → Esportazioni** scarica i dati della biblioteca:

- **Studenti**, **Docenti**, **Catalogo** e **Prestiti in corso** in CSV, nello stesso formato
  delle importazioni: si possono correggere con un foglio di calcolo e reimportare, o portare in una
  nuova installazione (prima studenti e docenti, poi il catalogo, infine i prestiti in corso).
- **Storico dei prestiti** in CSV, con la classe e la sezione di ogni utente al momento del prestito.
- **Tutti i dati** in un unico file JSON, per passare a un'altra installazione o a un altro
  programma.

I dati di una singola persona (per esempio quando un genitore chiede quali dati conserviamo) si
scaricano dalla scheda dell'utente con **Esporta i dati della persona**. Questi file contengono dati
personali di minori: conservali con cura e cancellali quando non servono più.

## 12. Classificazione: generi, argomenti e pittogrammi

**Amministrazione → Configurazione → Classificazione** raccoglie i generi della narrativa, gli
argomenti della saggistica con i loro sottoargomenti, la tabella Dewey e le opzioni della segnatura.
Le modifiche restano in bozza finché non premi **Salva**; se esci prima, la pagina chiede conferma.

1. Scegli la scheda (**Narrativa**, **Saggistica**, **Dewey**, **Opzioni**) e premi una riga per
   modificarla nel riquadro a destra (sul telefono si apre una finestra). Accanto a ogni riga vedi
   quanti libri la usano.
2. Nel riquadro cambi **codice**, **nome**, **colore** e **pittogramma**: carica un'immagine (PNG,
   JPEG o WebP, viene salvata come PNG) oppure scegline una già presente. Un sottoargomento senza
   colore o senza immagine usa quelli del suo argomento. L'**anteprima** mostra la fascetta come
   verrebbe stampata.
3. Per cambiare l'ordine trascina le righe o usa le frecce. Un sottoargomento passa sotto un altro
   argomento con **Posizione**.
4. In **Dewey** ogni riga associa un prefisso Dewey a un argomento: quando un libro arriva con il
   suo numero Dewey (per esempio da SBN) viene proposto l'argomento del prefisso più lungo. Il campo
   **Prova un numero Dewey** mostra subito cosa verrebbe proposto.
5. In **Opzioni** scegli se la narrativa è divisa per classe, se la classe sta su ogni copia (serve
   quando copie dello stesso libro stanno negli scaffali di classi diverse) e gli schemi della
   segnatura delle nuove copie (per esempio `A 4 DEL`).
6. Premi **Salva**: prima vedi cosa cambia nel catalogo. Se hai eliminato o rinominato un codice
   usato da qualche libro, scegli dove spostare quei libri: il nuovo codice va sui libri e all'inizio
   delle loro segnature, e le fascette tornano tra le etichette da stampare (**Stampe**, §3.1). Se
   cambi nome, colore o pittogramma di un codice usato, puoi rimettere tra le etichette da stampare
   anche quelle fascette.

Ogni salvataggio scrive il file `classification.json` della cartella di configurazione e conserva la
versione precedente (con le immagini tolte) nella cronologia della configurazione (§13). Un codice non può
essere usato sia da un genere sia da un argomento.

## 13. Configurazione: impostazioni, cronologia e ripristino

**Amministrazione → Configurazione** mostra se la configurazione è valida e una scheda per ogni
sezione (Biblioteca e scuola, Prestiti, Etichette, Backup…), con il nome del file in cui è salvata.

1. Apri una sezione: la scheda **Impostazioni** elenca i valori con una breve spiegazione. Cambia
   quello che serve e premi **Salva**: i valori sbagliati sono segnati in rosso e il salvataggio
   aspetta finché non sono corretti. Sotto ogni campo c'è il nome della chiave nel file.
2. **Torna al predefinito** compare quando un valore è diverso da quello predefinito: al
   salvataggio la chiave viene tolta dal file e vale di nuovo il predefinito.
3. In fondo, **Altre impostazioni di questa sezione** elenca quello che si modifica altrove (per
   esempio la classificazione o la lingua) con il collegamento alla pagina giusta. Quello che non ha
   ancora una pagina dedicata si modifica nella scheda **JSON**, che mostra la sezione come è scritta
   nel file e la controlla mentre scrivi.
4. Un salvataggio che toglierebbe qualcosa ancora in uso viene rifiutato con la spiegazione: per
   esempio un tipo di copia usato da delle copie, una sezione con degli studenti, un genere con dei
   libri.
5. **Cronologia** elenca le modifiche fatte da qui (le ultime 50). **Ripristina** rimette com'erano
   solo i valori cambiati da quella modifica: le modifiche fatte dopo ad altri valori restano. Se nel
   frattempo gli stessi valori sono stati cambiati di nuovo, il ripristino viene rifiutato. Anche il
   ripristino finisce nella cronologia e si può annullare.
6. Se qualcuno ha modificato i file a mano, la pagina lo segnala: premi **Ricarica** per usare le
   modifiche. Se i file hanno errori, la biblioteca continua con la versione precedente e la pagina
   elenca cosa correggere.
7. Nella sezione **Biblioteca e scuola** ci sono anche i **tipi di copia** e le **sezioni** delle
   classi, con quante copie o quanti studenti usano ciascuno. Cambiare un codice sposta le sue copie
   o i suoi studenti sul nuovo codice; se togli un codice ancora usato, al salvataggio scegli dove
   spostarli.
8. Nella sezione **Codici a barre** scegli il tipo di codice (Code 128 per le stampe nuove, Code 39
   solo se i lettori della biblioteca non leggono il 128) e da che numero partono le nuove tessere;
   l'anteprima mostra la prossima tessera e la prossima copia senza consumarle.

## 14. Archivio della configurazione

In **Amministrazione → Configurazione**, riquadro **Archivio della configurazione**:

1. **Esporta configurazione** scarica un solo file ZIP con tutta la configurazione: impostazioni,
   modelli di stampa con le loro immagini, fogli adesivi, pittogrammi, logo, report e lingue. Non
   contiene i dati della biblioteca (libri, utenti, prestiti: per quelli c'è il backup, §4) né la
   cronologia delle modifiche. Contiene però gli account del personale con le password in forma
   protetta (non leggibile): conservalo con cura. Con **Scegli cosa esportare** puoi prenderne solo
   alcune parti.
2. **Importa configurazione** prende un file di BiblioViva (da questa o da un'altra installazione):
   un file di **Esporta configurazione**, ma anche un backup o un file **Esporta tutto**, da cui
   prende solo la configurazione (i dati della biblioteca restano come sono). Un file che contiene
   solo dati viene rifiutato con un messaggio. Prima lo controlla, senza cambiare niente: quanti file
   sono nuovi, modificati o tolti, quali sezioni cambiano, eventuali problemi (un valore non valido,
   un modello rotto, un codice usato da dei libri che sparirebbe…). Puoi scegliere quali parti della
   configurazione prendere: le altre restano come sono.
3. **Importa** si può premere solo se non ci sono errori. La configurazione di prima resta nella
   cronologia (§13): **Ripristina** la riporta indietro.

Chi lavora sul server può fare lo stesso con `bun run config:export` e `bun run config:import`
(guida tecnica, `deploy.md`).

## 15. Report: modificarli e crearne di nuovi

**Amministrazione → Configurazione → Libreria dei report** elenca tutti i report: quelli forniti con
BiblioViva, quelli personalizzati dalla scuola e quelli aggiunti.

1. **Modifica** apre l'editor. Per un report fornito con BiblioViva, salvando crei la copia della
   scuola con lo stesso nome; **Torna all'originale** la toglie.
2. **Duplica** apre l'editor su una copia, con un codice nuovo da scrivere; **Nuovo report** parte da
   zero.
3. Nella scheda **Guidata** scegli i dati (prestiti, copie o utenti), che cosa mettere nelle **righe**
   (per esempio l'anno di classe) e, se vuoi una tabella a doppia entrata, nelle **colonne** (per
   esempio la sezione): in quel caso compaiono la colonna e la riga dei **totali**. Poi i **valori**
   (prestiti, lettori…), i **filtri** — nessuno, chiesto quando si apre il report (per esempio il
   periodo) o fisso — e il grafico. I docenti sono una riga «Docenti», i libri non ancora classificati
   una riga «Da classificare».
4. **Anteprima** mostra il risultato con i valori predefiniti; **Salva** controlla il report, lo
   prova e lo mette nella libreria. Se la query va in errore, il messaggio dice perché e il report non
   viene salvato.
5. La scheda **SQL** è per chi conosce l'SQL: per un report guidato mostra l'SQL che ne risulta, e
   **Modifica come SQL** lo trasforma in un report da scrivere a mano (dopo non si torna indietro).
   Il formato completo è in `docs/reports-authoring.md`.

Ogni salvataggio entra nella cronologia della configurazione (§13) e nell'archivio (§14).
