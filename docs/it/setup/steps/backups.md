# Copie di sicurezza

BiblioViva fa da sola una copia di sicurezza del database ogni notte. Questa pagina spiega che cosa viene salvato, dove
si trovano le copie, come farne una subito e come portarne una copia fuori dal computer di BiblioViva, su una chiavetta
USB o su un NAS. Serve a chi ha terminato il [primo avvio](first-run.md) e conserva i dati della biblioteca. Il passo
richiede circa 20 minuti.

## Occorrente

- L'accesso come `admin`, l'unico account che vede la pagina dei backup.
- Una chiavetta USB o un NAS (un disco di rete) su cui tenere una copia, con spazio sufficiente: la dimensione delle
  copie si legge nella pagina **Backup**. Le copertine pesano più del database.
- Per copiare l'intera cartella dei backup: lo stesso utente e lo stesso indirizzo del computer di BiblioViva usati nel
  passo [Collegarsi al computer](terminal.md).

## Che cosa salva BiblioViva

La copia notturna contiene il database completo (libri, copie, utenti, prestiti, registro delle operazioni) e una copia
delle foto e delle copertine.

- La copia viene fatta ogni notte alle 3:00 e si conserva per 30 giorni. Le copie più vecchie vengono cancellate, tranne
  la più recente. L'orario e i giorni di conservazione si cambiano da **Amministrazione** → **Configurazione** →
  **Backup**, nei campi **Orario del backup** e **Giorni di conservazione**.
- Le foto e le copertine sono copiate nella cartella `uploads` dei backup: vengono copiati solo i file nuovi o cambiati.
- Se il computer è spento alla sera, alle 3:00 non c'è nessuno a fare la copia. All'accensione successiva BiblioViva se
  ne accorge e la fa un minuto dopo l'avvio, una sola anche se il computer è rimasto spento più giorni. Nell'elenco
  quella copia porta la scritta **Recuperato all'avvio**. Il comportamento dipende dall'opzione **Backup all'avvio se
  saltato**, attiva di norma.
- La configurazione (le impostazioni, i template di tessere ed etichette con le loro immagini) non fa parte della copia
  notturna: sta nella cartella `config` e cambia di rado. Per averla al sicuro serve **Esporta tutto**, descritto più
  sotto.

Le copie si trovano nella cartella `~/biblioviva/backups` del computer di BiblioViva, accanto ai file `compose.yml` e
`.env`. È una cartella normale: contiene i file `biblioviva-AAAAMMGG-HHMM.db` (le copie del database), la cartella
`uploads` (le foto e le copertine) e gli archivi `.zip` fatti a mano.

## Procedura

### Controllare le copie

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Backup**.
1. Leggere l'elenco: ogni copia ha la data in **Creato** e la **Dimensione**.

Subito dopo l'installazione l'elenco può essere vuoto, con il messaggio «Nessun backup»: la prima copia nasce all'orario
pianificato oppure con il pulsante del punto seguente.

### Fare una copia subito

1. Premere **Esegui backup ora**.
1. Attendere il messaggio «Backup creato», con il nome del file. Il file compare in cima all'elenco.

Fare una copia a mano prima di ogni aggiornamento di BiblioViva e prima di importazioni o modifiche grandi.

### Salvare la configurazione con tutto il resto

1. Nella pagina **Backup** premere **Esporta tutto**.
1. Attendere che il browser scarichi il file `biblioviva-export-AAAAMMGG-HHMM.zip`. Il file contiene il database, le
   foto, le copertine e tutta la configurazione, e basta da solo per rimettere in piedi BiblioViva su un altro computer.
1. Ripetere l'operazione dopo ogni modifica importante delle impostazioni o dei template.

<!-- figure: admin/backups | La pagina Backup con l'elenco delle copie e i pulsanti Esegui backup ora e Esporta tutto -->

### Copiare una copia su una chiavetta USB

Questo è il modo più semplice: si scarica una copia con il browser e la si mette sulla chiavetta.

1. Collegare la chiavetta USB al computer del banco prestiti.
1. Nella pagina **Backup** premere **Scarica** accanto alla copia più recente. Per avere anche la configurazione e le
   foto, premere invece **Esporta tutto**.
1. Aprire la cartella in cui il browser ha salvato il file, di solito quella dei download.
1. Trascinare il file sulla chiavetta, nel gestore dei file del computer.
1. Espellere la chiavetta con il comando «Rimuovi in modo sicuro» del sistema, poi scollegarla.

### Copiare l'intera cartella dei backup

Il file scaricato contiene una sola copia. Per portare via l'intera cartella dei backup (tutte le copie, le foto e le
copertine) la si copia dal computer di BiblioViva a quello del banco prestiti.

1. Aprire il terminale sul computer del banco prestiti, come descritto nel passo [Collegarsi al computer](terminal.md).
1. Scrivere il comando seguente e premere Invio, sostituendo `<utente>` e `<indirizzo>` con l'utente e l'indirizzo usati
   per collegarsi al computer di BiblioViva.

   ```sh
   scp -r <utente>@<indirizzo>:biblioviva/backups .
   ```

1. Inserire la password dell'utente quando viene chiesta.
1. Attendere la fine della copia. Nella cartella corrente del terminale compare la cartella `backups`.
1. Copiare la cartella `backups` sulla chiavetta USB o, per un NAS, nella cartella condivisa del NAS, trascinandola nel
   gestore dei file del computer. Il NAS si apre con il gestore dei file secondo le istruzioni del suo produttore.

Il comando `scp` è incluso nei programmi che offrono `ssh` (Windows 10 e 11, macOS e Linux), descritti nel passo
[Collegarsi al computer](terminal.md).

> [!IMPORTANT]
> Le copie contengono i dati degli studenti. Tenere la chiavetta o il NAS in un luogo sicuro e cancellare le copie che
> non servono più.

### Copiare automaticamente su un secondo disco o fuori dalla scuola

Per copie che si fanno da sole, su un secondo disco sempre collegato, su un altro computer o su una cartella nel cloud,
serve un intervento tecnico sul computer di BiblioViva. Chi lo gestisce trova i passaggi nella pagina tecnica
[Deployment notes (technical)](../../../deploy.md) (in inglese): le sezioni
[Backups on a second disk or a USB drive](../../../deploy.md#backups-on-a-second-disk-or-a-usb-drive) e
[Off-site copies (optional, offsite compose
profile)](../../../deploy.md#off-site-copies-optional-offsite-compose-profile).

### Controllare ogni tanto

1. Una volta alla settimana, aprire **Amministrazione** → **Backup** e controllare che in **Creato** ci sia una copia
   degli ultimi giorni.
1. Una volta al mese, controllare che la chiavetta o il NAS contengano una copia recente e che il file si apra.
1. Prima di una lunga chiusura della scuola, fare una copia con **Esegui backup ora** e una con **Esporta tutto**.

## Verifica prima di proseguire

- Nella pagina **Backup** compare almeno una copia, fatta con **Esegui backup ora**.
- Il file scaricato con **Esporta tutto** è sulla chiavetta USB o sul NAS.
- Se non compare alcuna copia o la copia non è recente: controllare in **Amministrazione** → **Configurazione** →
  **Backup** l'orario e l'opzione **Backup all'avvio se saltato**, poi premere di nuovo **Esegui backup ora**.

## Possibili problemi

### L'elenco non mostra copie recenti

Il computer è rimasto spento a lungo oppure l'orario è stato cambiato. Premere **Esegui backup ora** e controllare le
impostazioni nella sezione **Backup** della configurazione.

### Il comando scp non trova la cartella

Controllare utente e indirizzo, e che la cartella `~/biblioviva/backups` esista sul computer di BiblioViva.

### Il file zip scaricato è molto grande

Le copertine pesano più del database. Usare una chiavetta con più spazio.

### Manca l'ultima copia esterna

La pagina **Backup** non indica una «Ultima copia esterna»: la copia esterna è opzionale e non è attiva, salvo averla
configurata come descritto nella pagina tecnica indicata sopra.

## Pagine correlate

- Passo precedente: [Provare il lettore e la stampante](scanner-printer.md)
- [Ripartire da una copia di sicurezza](../restore.md)
- [Aggiornare BiblioViva](../update.md)
- [Spostare BiblioViva su un altro computer](../move.md)
