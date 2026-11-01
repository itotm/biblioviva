# Problemi comuni

Questa pagina raccoglie i problemi più frequenti di BiblioViva, ciascuno con la causa e i passi per risolverlo. Serve a
chi usa il banco prestiti e a chi ha installato BiblioViva; i comandi vanno dati nel terminale del computer di
BiblioViva, aperto come descritto in [Collegarsi al computer](../setup/steps/terminal.md). Se il problema non è
qui, vedere [Chiedere aiuto](ask-for-help.md).

## Indirizzo che non si apre

Il browser non mostra la pagina **Accesso** di BiblioViva: scrive che il sito non è raggiungibile, che il nome non
esiste, oppure resta in attesa.

Causa: il computer di BiblioViva è spento o BiblioViva non è avviato; oppure il dispositivo non è nella stessa rete del
computer (con Tailscale, non ha Tailscale acceso e collegato all'account della scuola); oppure l'indirizzo è cambiato.

1. Controllare che il computer di BiblioViva sia acceso e collegato alla rete.
1. Dal terminale del computer di BiblioViva, controllare che i contenitori siano avviati.

   ```sh
   cd ~/biblioviva && docker compose ps
   ```

1. Se i contenitori non risultano avviati (stato `Up` o `running`), avviarli.

   ```sh
   cd ~/biblioviva && docker compose up -d
   ```

1. Attendere un paio di minuti e riprovare ad aprire l'indirizzo. Se il passo 2 risponde «permission denied», chiudere il
   terminale e collegarsi di nuovo, oppure anteporre `sudo` al comando.

Con Tailscale i passi seguenti riguardano il dispositivo da cui non si apre.

1. Aprire l'applicazione di Tailscale sul dispositivo e controllare che sia attiva e che l'accesso sia fatto con
   l'account della scuola, lo stesso del computer di BiblioViva.
1. Controllare che l'indirizzo sia quello giusto: `https://biblioviva.<tailnet>.ts.net`, con il nome della rete della
   scuola al posto di `<tailnet>` (vedere [Tailnet](glossary.md#tailnet)).
1. Se il browser non trova il nome, aprire la pagina «DNS» della
   [console di Tailscale](https://login.tailscale.com/admin/dns) e controllare che «MagicDNS» sia attivo (vedere
   [MagicDNS](glossary.md#magicdns)).
1. Se il problema resta, leggere il registro del collegamento di Tailscale sul computer di BiblioViva.

   ```sh
   cd ~/biblioviva && docker compose logs tailscale
   ```

Con la rete locale i passi seguenti riguardano l'indirizzo.

1. Provare l'indirizzo numerico al posto del nome: `http://<indirizzo>:8080`, per esempio `http://192.168.1.50:8080`.
   Se il nome `biblioviva.local` non si apre e quello numerico sì, il nome non è riconosciuto dal dispositivo (vedere
   [Nome .local](glossary.md#nome-local)).
1. Se l'indirizzo numerico non è più quello annotato, leggere gli indirizzi attuali sul computer di BiblioViva.

   ```sh
   hostname -I
   ```

1. Se l'indirizzo cambia a ogni riavvio, chiedere a chi gestisce la rete di riservarlo al computer (vedere
   [Prenotazione DHCP](glossary.md#prenotazione-dhcp)).
1. Se nemmeno l'indirizzo numerico si apre dagli altri computer, chiedere a chi gestisce la rete che la porta `8080`
   non sia bloccata tra i dispositivi.

Pagine che spiegano di più: [Collegare i dispositivi](../setup/steps/devices.md) e
[Preparare la rete](../setup/steps/network.md).

## Lucchetto che manca

Con Tailscale l'indirizzo si apre, ma il browser non mostra il lucchetto o segnala un certificato non valido.

Causa: i certificati HTTPS non sono attivi nella console di Tailscale (vedere [HTTPS](glossary.md#https)).

1. Aprire la pagina «DNS» della [console di Tailscale](https://login.tailscale.com/admin/dns).
1. Attivare «HTTPS Certificates», come descritto in [Preparare la rete](../setup/steps/network.md).
1. Riavviare Tailscale sul computer di BiblioViva.

   ```sh
   cd ~/biblioviva && docker compose restart tailscale
   ```

1. Attendere qualche secondo e riaprire l'indirizzo: la prima apertura dopo l'attivazione può richiedere più tempo.

## Fotocamera che non si avvia

Premendo il pulsante della fotocamera (lettura di un codice con il telefono, foto degli utenti, copertine) la pagina
scrive che la fotocamera funziona solo con una connessione sicura, oppure il browser non la attiva.

Causa: i browser permettono la fotocamera soltanto alle pagine sicure, quelle con il lucchetto (HTTPS). Con la rete
locale, e con un indirizzo numerico anche con Tailscale, la pagina non è sicura. La fotocamera è facoltativa: al banco
si lavora con il lettore di codici a barre USB.

1. Controllare l'indirizzo nella barra del browser: deve cominciare con `https://` e avere il lucchetto.
1. Con Tailscale, aprire l'indirizzo con il nome `https://biblioviva.<tailnet>.ts.net`, mai con un numero.
1. Con la rete locale la fotocamera non funziona: usare il lettore di codici a barre, oppure caricare un file al posto
   della foto. Per avere la fotocamera passare a Tailscale ([Passare dalla rete locale a
   Tailscale](../setup/lan-to-tailscale.md)).
1. Se l'indirizzo è giusto e la fotocamera non parte, controllare nel browser il permesso per questo sito (l'icona
   accanto all'indirizzo) e consentire l'uso della fotocamera.
1. Chiudere le altre applicazioni che usano la fotocamera e riprovare.

## Lettore che scrive caratteri strani

Leggendo un codice con il lettore di codici a barre compare un apostrofo `'` o un altro carattere al posto del trattino,
oppure i codici non vengono accettati.

Causa: il lettore e il computer usano due disposizioni diverse della tastiera, e il carattere trattino viene tradotto
male. BiblioViva accetta comunque i codici letti con le due disposizioni, ma conviene che siano uguali (vedere
[Lettore di codici a barre](glossary.md#lettore-di-codici-a-barre)).

1. Aprire **Amministrazione** → **Configurazione** → **Codici a barre**.
1. Scegliere in **Tastiera dei computer** la disposizione della tastiera del computer a cui è collegato il lettore. In
   Italia è «Italiana».
1. Premere **Salva**.
1. Leggere di nuovo un codice con il trattino e controllare che compaia uguale a quello stampato.
1. Se il carattere è ancora sbagliato, impostare il lettore sulla tastiera del computer con le istruzioni del suo
   manuale: di norma si leggono alcuni codici a barre di programmazione.

Se invece il lettore scrive il codice ma il banco non lo accetta, il lettore deve inviare il tasto Invio dopo ogni
codice: il manuale del lettore spiega come attivarlo. Pagina che spiega di più:
[Provare il lettore e la stampante](../setup/steps/scanner-printer.md).

## Stampa troppo piccola o sfalsata

Le tessere o le etichette escono più piccole del previsto, spostate rispetto ai bordi, tagliate, oppure con la data e
l'indirizzo della pagina in alto e in basso.

Causa: la finestra di stampa del browser ha ridotto o ingrandito la pagina, ha aggiunto i margini o le intestazioni, oppure
il foglio di etichette ha misure diverse da quelle impostate. Le misure di BiblioViva sono in millimetri e valgono solo
con la pagina al 100 %.

1. Aprire la stampa del browser con Ctrl+P.
1. Impostare la scala al 100 %. Il browser la chiama «Dimensioni effettive» o «100»; non scegliere «Adatta alla pagina»
   né «Adatta all'area di stampa».
1. Impostare i margini su «Nessuno».
1. Disattivare «Intestazioni e piè di pagina».
1. Scegliere il foglio A4 e stampare di nuovo.
1. Misurare con il righello il segno «Righello 10 cm» della pagina di prova: deve misurare 100 mm.
1. Se il righello è giusto ma le etichette non coincidono con il foglio, stampare la pagina di calibrazione e
   confrontarla con un foglio vero, come descritto in [Provare il lettore e la
   stampante](../setup/steps/scanner-printer.md#impostare-la-finestra-di-stampa).
1. Se le misure del foglio di etichette non sono quelle di BiblioViva, aggiungere il foglio come descritto in
   [Aggiungere un foglio di etichette](../admin/guides/add-a-label-stock.md).
1. Se le tessere stampate fronte e retro non combaciano, calibrare la stampa come descritto in
   [Calibrare la stampa fronte-retro](../admin/guides/calibrate-duplex.md).

## Password dell'amministratore dimenticata

Nessuno ricorda la password dell'account `admin`, l'unico che può cambiare le password degli altri account. Se un
altro account amministratore ricorda la sua, basta usarlo (**Amministrazione** → **Account del personale**, poi
**Nuova password** sulla riga dell'account).

Causa: le password non si possono leggere né recuperare, perché BiblioViva conserva solo la loro forma cifrata. Chi ha
accesso al terminale del computer di BiblioViva può però sostituirla nel file delle impostazioni con una password
provvisoria, da cambiare subito dopo.

1. Aprire il file delle impostazioni con l'editor del terminale.

   ```sh
   nano ~/biblioviva/config/config.json
   ```

1. Cercare la parte che comincia con `"username": "admin"`.
1. Nella riga `"passwordHash"` di quell'account, sostituire l'intera riga con una riga `"password"` seguita da una
   password provvisoria di almeno 8 caratteri, per esempio `"password": "<password provvisoria>",`, tenendo le virgolette
   e la virgola finale come nelle righe vicine.
1. Salvare con Ctrl+O e Invio, poi uscire con Ctrl+X.
1. Far rileggere le impostazioni a BiblioViva.

   ```sh
   cd ~/biblioviva && docker compose kill -s HUP app
   ```

1. Aprire BiblioViva nel browser ed entrare con il nome utente `admin` e la password provvisoria.
1. Aprire **Amministrazione** → **Account del personale**.
1. Premere **Nuova password** sulla riga di `admin` e scrivere la password definitiva.

> [!WARNING]
> Finché non si cambia la password provvisoria, il file delle impostazioni la contiene in chiaro. Cambiarla subito al
> passo 8, e non lasciare il file aperto a chi non deve vederla.

> [!NOTE]
> Se il comando del primo passo risponde «Permission denied», anteporre `sudo`. Se l'editor `nano` manca, installarlo con
> `sudo apt install -y nano`.

Pagina tecnica: [Deployment notes](../../deploy.md#installing-updating-logs-step-85) (in inglese).
[VERIFY: il modo di cambiare la password dell'amministratore senza modificare il file, se esiste]

## Collegamento SSH che non riesce

Dal proprio computer non ci si collega al PC o al Raspberry Pi di BiblioViva con il terminale (SSH, vedere
[Terminale](glossary.md#terminale)): compare un messaggio di errore.

Causa: dipende dal messaggio. I più comuni sono questi.

1. «Connection refused»: il computer non è ancora pronto, oppure SSH non è attivo. Attendere alcuni minuti e riprovare.
   Se il messaggio resta, per il PC installare il server SSH; per il Raspberry Pi scrivere di nuovo la scheda con
   SSH attivo.

   ```sh
   sudo apt install -y openssh-server
   ```

1. «Permission denied, please try again»: la password è sbagliata. Digitarla con attenzione alla disposizione della
   tastiera.
1. «Could not resolve hostname biblioviva.local»: il nome non è riconosciuto. Controllare che il computer sia acceso e
   sulla stessa rete, poi usare l'indirizzo che mostra il router.
1. «Connection timed out»: l'indirizzo non è quello del computer, oppure il computer non è raggiungibile. Controllare
   l'indirizzo nell'elenco del router.
1. «REMOTE HOST IDENTIFICATION HAS CHANGED»: la scheda del Raspberry Pi è stata riscritta e il nome è già noto con
   un'altra chiave. Eliminare la vecchia chiave e ripetere il collegamento.

   ```sh
   ssh-keygen -R biblioviva.local
   ```

Pagina che spiega di più: [Collegarsi al computer](../setup/steps/terminal.md#possibili-problemi).

## Installazione che si ferma

Il programma `setup.sh` scrive un messaggio di errore e si ferma prima di scrivere «BiblioViva è pronto.».

Causa: il messaggio la indica. Dopo averla rimossa, si ripete il comando dell'installazione, che riprende da dove era
arrivato e non fa danni.

```sh
curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang it
```

1. Leggere l'ultimo messaggio del programma e cercarlo qui sotto.
1. «Questo programma funziona solo su Linux»: il comando è stato incollato sul computer sbagliato. Incollarlo nel
   terminale del computer di BiblioViva.
1. «Il sistema è a 32 bit»: la scheda contiene un sistema a 32 bit. Scriverla di nuovo con Raspberry Pi OS Lite (64-bit).
1. «Il comando sudo non è disponibile»: installare `sudo` oppure collegarsi come amministratore.
1. «Docker non è stato installato»: è stato risposto `n` alla domanda, oppure l'installazione non è riuscita. Ripetere
   il comando e rispondere `S`; se l'errore resta, installare Docker con la
   [guida ufficiale](https://docs.docker.com/engine/install/) (vedere [Docker](glossary.md#docker)).
1. «Impossibile scaricare …»: il computer non ha internet. Controllare il cavo o il Wi-Fi e ripetere il comando.
1. «BiblioViva non risponde ancora»: su un computer lento l'avvio richiede più tempo. Attendere due minuti e ripetere il
   comando; se il messaggio resta, leggere il registro.

   ```sh
   cd ~/biblioviva && docker compose logs
   ```

1. Con Tailscale, «requested tags … are invalid or not permitted» nel registro: l'etichetta `tag:biblioviva` o la chiave
   non sono a posto. Ripetere le parti «Etichetta del computer» e «Chiave di accesso» di [Preparare la
   rete](../setup/steps/network.md).
1. Con Tailscale, «La chiave di Tailscale deve iniziare con tskey-» oppure i certificati HTTPS non attivi: incollare la
   chiave intera, o attivare «HTTPS Certificates» nella pagina «DNS» della console, poi ripetere il comando.
1. Con la rete locale, «port is already allocated»: un altro programma occupa la porta `8080`. Liberarla, oppure
   scrivere un altro numero dopo `LAN_PORT=` nel file `~/biblioviva/.env` e ripetere il comando.

Tutti i messaggi, con le cause, sono in [Installare BiblioViva](../setup/steps/install.md#possibili-problemi).

## Copia di sicurezza non fatta

Nella pagina **Backup** l'elenco non mostra copie recenti, oppure premendo **Esegui backup ora** compare un errore.

Causa: il computer era spento all'ora della copia (vedere [Computer rimasto spento](#computer-rimasto-spento)), oppure
BiblioViva non riesce a scrivere nella cartella delle copie, per esempio perché il disco esterno non è collegato o
non ha spazio.

1. Accedere come `admin` e aprire **Amministrazione** → **Backup**.
1. Premere **Esegui backup ora**. Attendere il messaggio «Backup creato».
1. Se compare un errore, controllare lo spazio libero sul disco del computer.

   ```sh
   df -h ~/biblioviva
   ```

1. Leggere nel registro le righe del backup.

   ```sh
   cd ~/biblioviva && docker compose logs app | grep backup
   ```

1. Se il registro dice che la cartella `/backups` non è scrivibile, ridare la cartella all'utente di BiblioViva.

   ```sh
   sudo chown -R 1000:1000 ~/biblioviva/backups
   ```

1. Se le copie vanno su un disco esterno, controllare che sia collegato.
1. Riavviare BiblioViva e premere di nuovo **Esegui backup ora**.

   ```sh
   cd ~/biblioviva && docker compose restart app
   ```

Pagina che spiega di più: [Copie di sicurezza](../setup/steps/backups.md); per le impostazioni dell'orario, la
guida [Fare e scaricare una copia di sicurezza](../admin/guides/make-a-backup.md).

## Computer rimasto spento

Il computer di BiblioViva è stato spento, o è mancata la corrente, e al mattino BiblioViva non si apre oppure manca la
copia della notte.

Causa: BiblioViva riparte da sola quando il computer si accende, ma ci vuole qualche minuto. La copia di sicurezza è
programmata di notte (di norma alle 3:00); se il computer è spento a quell'ora, BiblioViva la fa un minuto dopo
l'accensione successiva, una sola anche dopo più giorni di spegnimento.

1. Accendere il computer e attendere due o tre minuti.
1. Aprire l'indirizzo di BiblioViva nel browser. Se non si apre, seguire
   [Indirizzo che non si apre](#indirizzo-che-non-si-apre).
1. Dopo l'accesso come `admin`, aprire **Amministrazione** → **Backup** e controllare l'elenco: la copia fatta
   all'accensione porta la scritta **Recuperato all'avvio**.
1. Se la copia manca, premere **Esegui backup ora**.

Per spegnere il computer senza rischi, dare il comando seguente nel terminale, invece di togliere la corrente.

```sh
sudo shutdown -h now
```

Se il computer resta spesso spento di notte, si può spostare l'orario della copia dentro l'orario di apertura, da
**Amministrazione** → **Configurazione** → **Backup**, nel campo **Orario del backup**.

## Telefono che non installa l'applicazione

Sul telefono non compare il riquadro per aggiungere BiblioViva alla schermata Home, oppure l'installazione non riesce.

Causa: l'installazione come applicazione è facoltativa e possibile soltanto con Tailscale, cioè con l'indirizzo sicuro
(HTTPS). Il riquadro compare solo sul telefono, solo nella **Dashboard**, e solo quando il browser offre
l'installazione; dopo **Non ora** non compare più in quel browser.

1. Controllare che il telefono abbia Tailscale acceso e che apra l'indirizzo `https://biblioviva.<tailnet>.ts.net` con il
   lucchetto. Con la rete locale l'installazione non è possibile ([Scegliere la
   rete](../setup/choose-network.md)).
1. Aprire la **Dashboard** nel browser del telefono e cercare il riquadro **Aggiungi alla schermata Home**.
1. Premere **Installa** nel riquadro.
1. Se il riquadro non c'è, aprire il menu del browser e scegliere «Installa app» oppure «Aggiungi alla schermata
   Home». Con Firefox il menu è ⋮ e la voce è «Installa» o «Aggiungi alla schermata principale».
   [VERIFY: il nome della voce nel menu di Chrome per Android e di Safari per iPhone]
1. Se la voce non c'è nemmeno nel menu, aggiornare il browser e riaprire la pagina.

Al banco non serve: il lettore di codici a barre USB è lo strumento normale. Pagina che spiega di più: [Collegare i
dispositivi](../setup/steps/devices.md).

## BiblioViva che si riavvia di continuo

La pagina si apre per un attimo e poi non risponde, oppure `docker compose ps` mostra che il contenitore `app` si
riavvia.

Causa: BiblioViva non riesce a scrivere in una cartella dei dati, oppure il file delle impostazioni non è valido.
Il registro dice quale dei due e indica il comando che risolve.

1. Leggere le ultime righe del registro.

   ```sh
   cd ~/biblioviva && docker compose logs app
   ```

1. Se il registro parla di una cartella che non si può scrivere, dare il comando che il registro suggerisce.
1. Se il registro parla di un file delle impostazioni non valido, correggere la riga indicata (il file e la
   chiave sono nominati) oppure ripristinare una copia della configurazione (vedere [Ripartire da una copia di
   sicurezza](../setup/restore.md)).
1. Riavviare BiblioViva.

   ```sh
   cd ~/biblioviva && docker compose up -d
   ```

Pagina tecnica: [Deployment notes](../../deploy.md#permissions) (in inglese).

## Pagine correlate

- [Chiedere aiuto](ask-for-help.md)
- [Glossario](glossary.md)
- [Installazione](../setup/README.md)
