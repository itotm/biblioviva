# Installare BiblioViva

Questo passo installa BiblioViva sul computer preparato ai passi precedenti, con un solo comando da copiare nel
terminale. Il programma `setup.sh` controlla il computer, installa Docker se manca, pone alcune domande, avvia
BiblioViva e scrive l'indirizzo da aprire nel browser. Richiede da 5 a 15 minuti, in gran parte attesa per lo
scaricamento di BiblioViva [VERIFY: tempi da misurare su un Raspberry Pi 4 con scheda SD].

Docker è il programma che fa girare BiblioViva in un contenitore chiuso, separato dal resto del computer (vedere il
[glossario](../../help/glossary.md#docker)).

## Occorrente

- Il terminale del computer di BiblioViva, aperto al passo [Collegarsi al computer](terminal.md).
- Il computer collegato a internet.
- La password dell'utente del computer, annotata al passo [Preparare il computer](prepare-computer.md): serve a
  `sudo`, il comando che dà al programma i diritti di amministratore.

<!-- variant: tailscale -->
**Con Tailscale**

- La chiave di accesso generata al passo [Preparare la rete](network.md), che inizia con `tskey-auth-`, a portata di
  mano per essere incollata.
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

- Nessun altro dato: la rete locale non richiede né account né chiave.
<!-- /variant -->

## Procedura

### Avviare il programma

1. Copiare il comando seguente.

   ```sh
   curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang it
   ```

1. Incollarlo nel terminale e premere Invio (come si incolla un comando è spiegato in
   [Collegarsi al computer](terminal.md)). Il terminale scrive il titolo
   «Installazione di BiblioViva» e il programma comincia a controllare il computer.

> [!NOTE]
> L'opzione `--lang it` fa scrivere al programma in italiano; senza di essa il programma usa la lingua del computer,
> spesso l'inglese.

Il programma scarica i file di configurazione di BiblioViva dal suo archivio pubblico e le immagini dei programmi, e
scrive tutto nella cartella `biblioviva` dell'utente. Il testo del programma si può leggere prima di eseguirlo:
[setup.sh](https://github.com/itotm/biblioviva/blob/main/setup.sh).

### Installare Docker, quando manca

Su un computer appena preparato Docker non c'è. In quel caso il programma lo dice e fa una domanda.

```
Docker non è installato. Il programma lo installa con lo script ufficiale di Docker (https://get.docker.com): servono alcuni minuti e la password dell'utente.
Installare Docker adesso? [S/n]
```

1. Premere Invio (oppure `S`) per installare Docker. Rispondere `n` ferma il programma.
1. Quando `sudo` chiede la password, digitare la password dell'utente e premere Invio. Mentre la si digita non
   compare nulla, nemmeno asterischi: è normale.
1. Attendere. L'installazione di Docker scrive molte righe e dura alcuni minuti. Al termine il programma scrive:
   «Docker è installato. Per usare il comando docker senza sudo, chiudere il terminale e collegarsi di nuovo al
   termine.» L'installazione di BiblioViva prosegue senza interruzioni.

> [!NOTE]
> La frase sul terminale da chiudere riguarda il momento in cui l'installazione sarà finita: allora chiudere il
> terminale e collegarsi di nuovo come al passo [Collegarsi al computer](terminal.md). Fino ad allora non occorre
> fare nulla. Se Docker era già installato, la frase non compare.

### Rispondere alle domande

Le domande compaiono nell'ordine seguente. Il programma ripete la domanda quando la risposta non è valida
(«Risposta non valida.»).

### Come raggiungere BiblioViva

```
Come raggiungono BiblioViva i computer e i telefoni della biblioteca?
  1) Con Tailscale: indirizzo sicuro (HTTPS), fotocamera, telefoni, anche fuori dalla scuola. Serve un account Tailscale gratuito.
  2) Solo dalla rete locale della scuola: nessun account, ma senza fotocamera e solo dentro la scuola.
Scelta [1/2]:
```

<!-- variant: tailscale -->
**Con Tailscale**

1. Digitare `1` e premere Invio.
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

1. Digitare `2` e premere Invio.
<!-- /variant -->

La risposta deve essere quella scelta al passo [Preparare la rete](network.md). Cambiare idea più avanti è possibile,
senza perdere i dati: vedere [Passare dalla rete locale a Tailscale](../lan-to-tailscale.md).

### Che computer è

```
Che computer è questo?
  1) micro: un computer molto piccolo, con 512 MB di memoria
  2) small: un Raspberry Pi 4 con 2 GB e scheda SD
  3) medium: un PC non recente con disco rigido
  4) large: un PC con disco SSD
Scelta [small, proposta per questo computer]:
```

Il profilo regola quanta memoria e quanto lavoro BiblioViva chiede al computer: uno troppo alto per un computer
piccolo lo rende lento (vedere il [glossario](../../help/glossary.md#profilo-di-prestazioni)). Il programma
guarda la memoria e il tipo di disco e propone il profilo adatto, scritto tra le parentesi quadre.

1. Premere Invio per accettare la proposta. Il profilo si può cambiare più avanti da BiblioViva.

<!-- variant: tailscale -->
**Con Tailscale**

### La chiave di Tailscale

```
Incollare la chiave di autenticazione di Tailscale (inizia con tskey-auth-):
```

1. Incollare la chiave annotata al passo [Preparare la rete](network.md) (come per i comandi: Ctrl+Shift+V nel
   terminale di Linux, tasto destro o Ctrl+Shift+V in quello di Windows, Cmd+V in macOS) e premere Invio. La chiave
   resta visibile sullo schermo mentre la si incolla.
1. Se il programma risponde «La chiave di Tailscale deve iniziare con tskey-.», la chiave è incompleta o è un'altra:
   incollarla di nuovo, per intero, quando il programma la richiede.

> [!IMPORTANT]
> Il programma scrive la chiave nel file `.env` della cartella `biblioviva`, leggibile solo dall'utente del computer.
> Non copiare né spedire quel file: contiene un segreto.
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

Con la rete locale non c'è altra domanda: il programma passa subito all'installazione. Se il computer non ha il
servizio che gli dà il nome `biblioviva.local` (`avahi-daemon`), il programma lo installa da solo.
<!-- /variant -->

### Attendere l'installazione

Il programma scrive poi le fasi del lavoro, ciascuna preceduta da `==`, e tra l'una e l'altra le righe dei programmi
che chiama.

<!-- variant: tailscale -->
**Con Tailscale**

```
== Preparazione della cartella /home/<utente>/biblioviva

== Scaricamento di BiblioViva (la prima volta può richiedere alcuni minuti)

== Avvio di BiblioViva

== Attesa che BiblioViva risponda (fino a 180 secondi)
```
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

```
== Preparazione della cartella /home/<utente>/biblioviva

== Installazione di avahi-daemon, che rende raggiungibile il computer con il nome biblioviva.local

== Scaricamento di BiblioViva (la prima volta può richiedere alcuni minuti)

== Avvio di BiblioViva

== Attesa che BiblioViva risponda (fino a 180 secondi)
```

La riga su avahi-daemon compare solo se il servizio manca.
<!-- /variant -->

1. Attendere. Lo scaricamento è la fase più lunga, soprattutto su un Raspberry Pi con scheda SD. Il terminale scrive
   righe con percentuali e sigle ("Pulling", "Download complete"): sono normali.
1. Non chiudere il terminale e non spegnere il computer finché il programma non ha scritto l'indirizzo.

### Annotare l'indirizzo

Al termine il programma scrive che BiblioViva è pronto e l'indirizzo da aprire.

<!-- variant: tailscale -->
**Con Tailscale**

```
BiblioViva è pronto. Aprire nel browser:

    https://biblioviva.<tailnet>.ts.net

(da un dispositivo con Tailscale collegato all'account della scuola; la prima apertura può richiedere qualche secondo)
```

1. Annotare l'indirizzo che il programma scrive: al posto di `<tailnet>` ha il nome della rete della scuola, che
   finisce con `.ts.net`. Serve al passo [Primo avvio](first-run.md).
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

```
BiblioViva è pronto. Aprire nel browser:

    http://biblioviva.local:8080
    http://192.168.1.50:8080

(da un computer della rete della scuola; se il nome non funziona, usare l'indirizzo numerico)
```

1. Annotare i due indirizzi che il programma scrive: quello con il nome e quello numerico (il secondo è assente se il
   programma non riesce a leggere l'indirizzo del computer). L'indirizzo numerico cambia da scuola a scuola: è quello
   che il router ha riservato al passo [Preparare la rete](network.md). Servono al passo [Primo avvio](first-run.md).
<!-- /variant -->

1. Se Docker è stato installato durante questa esecuzione, chiudere il terminale e collegarsi di nuovo come al passo
   [Collegarsi al computer](terminal.md).

## Verifica prima di proseguire

- Il programma si è concluso senza messaggi di errore e l'ultima parte che ha scritto comincia con «BiblioViva è
  pronto.».
- Sotto quella frase compare un indirizzo, ed è annotato.
- Il comando seguente, dato nel terminale, elenca i contenitori di BiblioViva con lo stato `Up` (o `running`):

  ```sh
  cd ~/biblioviva && docker compose ps
  ```

  Se il comando risponde «permission denied» a proposito di Docker, il terminale non è stato ancora riaperto dopo
  l'installazione di Docker: chiuderlo e collegarsi di nuovo, oppure ripetere il comando con `sudo` davanti.

Quando uno dei punti manca, si veda «Possibili problemi». Eseguire di nuovo il comando del primo punto della
procedura non fa danni: il programma riconosce l'installazione già fatta e la aggiorna senza fare domande (vedere
[Aggiornare BiblioViva](../update.md)).

## Possibili problemi

Il programma scrive il messaggio di errore e si ferma. Dopo aver rimosso la causa, ripetere il comando del primo
passo della procedura.

- «Questo programma funziona solo su Linux (Raspberry Pi OS, Debian o Ubuntu).»: il comando è stato incollato sul
  computer sbagliato, per esempio il proprio computer di lavoro. Incollarlo nel terminale di BiblioViva, aperto al
  passo [Collegarsi al computer](terminal.md).
- «Il sistema è a 32 bit (…): BiblioViva richiede un sistema a 64 bit. Su un Raspberry Pi, installare Raspberry Pi OS
  (64-bit).»: la scheda microSD contiene un sistema a 32 bit. Scriverla di nuovo con Raspberry Pi OS Lite (64-bit)
  come al passo [Preparare il computer](prepare-computer.md); il comando non può funzionare su un sistema a 32 bit.
- «Sistema …: questo programma è provato su Raspberry Pi OS, Debian e Ubuntu. Si prosegue…»: avviso, non errore. Il
  computer ha un'altra distribuzione di Linux (per esempio Fedora) e il programma prosegue; se l'installazione si
  ferma, vedere la pagina tecnica [Deployment notes (technical)](../../../deploy.md).
- «Il comando sudo non è disponibile: eseguire il programma come amministratore oppure installare sudo.»: il
  computer non ha `sudo`. Installarlo con le istruzioni della distribuzione, oppure collegarsi come utente `root` e
  ripetere il comando.
- «Docker non è stato installato: il programma si ferma. Installarlo e rieseguire il programma.»: è stato risposto `n`
  alla domanda, oppure l'installazione di Docker non è riuscita (per esempio per mancanza di internet). Ripetere il
  comando e rispondere `S`; se l'errore resta, installare Docker con la
  [guida ufficiale](https://docs.docker.com/engine/install/) e ripetere il comando.
- «Manca la risposta a una domanda e non c'è un terminale da cui leggerla: indicare …»: il programma non è in
  una finestra dove si può scrivere (per esempio il comando è stato lanciato da un altro programma). Aprire il
  terminale come al passo [Collegarsi al computer](terminal.md) e ripetere il comando. In alternativa si danno le
  risposte con le opzioni `--network tailscale` o `--network lan`, `--profile micro`, `--profile small`,
  `--profile medium` o `--profile large`, `--key <chiave>` per la chiave di Tailscale e `--yes` per installare
  Docker senza domande, per esempio:

  ```sh
  curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang it --network lan --profile small
  ```

- «Risposta non valida.»: la risposta non è tra quelle ammesse. Digitare una delle cifre elencate.
- «Impossibile scaricare …: controllare la connessione a internet.»: il computer non riesce a scaricare un file di
  BiblioViva. Controllare che il cavo o il Wi-Fi funzionino (per esempio con `ping -c 3 raspberrypi.com`), poi
  ripetere il comando.
- «BiblioViva non risponde ancora. Vedere il registro con: cd … && docker compose logs»: BiblioViva è stato avviato
  ma non risponde dopo 180 secondi. Su un computer lento l'avvio può richiedere più tempo: attendere due minuti e
  ripetere il comando, che riprende da dove era arrivato. Se il messaggio si ripete, dare il comando che il
  programma suggerisce e leggere le ultime righe; se Docker è stato appena installato e il comando risponde «permission
  denied», anteporre `sudo`.

  ```sh
  cd ~/biblioviva && docker compose logs
  ```

<!-- variant: tailscale -->
**Con Tailscale**

- Nel registro di «BiblioViva non risponde ancora», le parole «requested tags … are invalid or not permitted»
  indicano che la voce `tagOwners` o la chiave di Tailscale non sono a posto: ripetere le parti «Etichetta del
  computer» e «Chiave di accesso» del passo [Preparare la rete](network.md), poi ripetere il comando.
- «La chiave di Tailscale deve iniziare con tskey-.»: la chiave incollata non è valida. Incollare la chiave intera, che
  inizia con `tskey-auth-` (vedere [Preparare la rete](network.md)).
- «Il nodo è nella tailnet, ma i certificati HTTPS non sono attivi: attivarli nella pagina DNS della console di
  Tailscale, poi rieseguire il programma.»: il computer è entrato nella rete, ma manca il lucchetto. Nella pagina
  «DNS» della [console di amministrazione](https://login.tailscale.com/admin/dns) attivare «HTTPS Certificates»,
  come descritto nel passo [Preparare la rete](network.md), poi ripetere il comando.
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

- Docker scrive «port is already allocated» (porta già in uso) e il programma si ferma: un altro programma occupa la
  porta `8080`. Chiedere a chi gestisce il computer di liberarla, oppure scrivere un altro numero dopo `LAN_PORT=`
  nel file `~/biblioviva/.env` e ripetere il comando: gli indirizzi cambiano di conseguenza.
- L'indirizzo con il nome (`biblioviva.local`) non si apre dagli altri computer: usare l'indirizzo numerico che il
  programma ha scritto. La verifica dal computer del banco è al passo [Collegare i dispositivi](devices.md).
<!-- /variant -->

Altri problemi: [Problemi comuni](../../help/problems.md#installazione-che-si-ferma).

## Pagine correlate

- Passo precedente: [Preparare la rete](network.md)
- Passo successivo: [Primo avvio](first-run.md)
- [Aggiornare BiblioViva](../update.md)
- [Glossario](../../help/glossary.md)
