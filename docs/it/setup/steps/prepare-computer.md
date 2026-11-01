# Preparare il computer

Questo passo prepara il computer su cui funzionerà BiblioViva: un PC con Linux, oppure un
Raspberry Pi con la sua scheda microSD. Richiede circa 20 minuti per un PC che ha già Debian o Ubuntu (se il sistema
va installato, il tempo dipende dal PC) e circa 30 minuti con il Raspberry Pi. È il primo dei passi di ogni percorso
di installazione.

## Occorrente

<!-- variant: linux -->
**Con un PC Linux**

- Un PC a 64 bit, acceso e collegato al router della scuola con un cavo di rete.
- Se il PC non ha Linux: una chiavetta USB per l'installazione, preparata secondo la guida ufficiale della
  distribuzione, e un altro computer per prepararla.
- Una tastiera e uno schermo per il PC, almeno durante l'installazione.
- Un foglio e una penna: il nome utente e la password scelti in questo passo servono nei passi successivi.
<!-- /variant -->
<!-- variant: raspberry -->
**Con il Raspberry Pi**

- Un Raspberry Pi 4 o 5 con almeno 2 GB di memoria, con il suo alimentatore.
- Una scheda microSD da 32 GB.
- Un altro computer (Windows, macOS o Linux) con un lettore di schede microSD, collegato a internet.
- Un cavo di rete tra il Raspberry Pi e il router della scuola. Il collegamento Wi-Fi è possibile, ma il cavo è
  più affidabile.
- Un foglio e una penna: il nome utente e la password scelti in questo passo servono nei passi successivi.
<!-- /variant -->

## Procedura

<!-- variant: linux -->
**Con un PC Linux**

Va bene Debian oppure Ubuntu a 64 bit; l'edizione "server" o minimale è sufficiente, perché BiblioViva non usa
l'ambiente grafico. Per Fedora e per le altre distribuzioni si veda la pagina tecnica
[Deployment notes (technical)](../../../deploy.md) (in inglese).

> [!NOTE]
> Con la rete locale, il programma di installazione del passo [Installare BiblioViva](install.md) aggiunge da solo il
> servizio che rende raggiungibile il computer con il nome `biblioviva.local`. Fino ad allora il nome `biblioviva.local`
> può non funzionare da un altro computer: il passo [Collegarsi al computer](terminal.md) indica che cosa fare.

### PC con Debian o Ubuntu già installato

1. Aprire il terminale del PC e controllare che il sistema sia a 64 bit.

   ```sh
   uname -m
   ```

   Il risultato deve essere `x86_64` o `aarch64`.

   ```
   x86_64
   ```

1. Aggiornare il sistema.

   ```sh
   sudo apt update && sudo apt full-upgrade -y
   ```

1. Dare al computer il nome `biblioviva`.

   ```sh
   sudo hostnamectl set-hostname biblioviva
   ```

1. Se il PC sarà usato da un altro computer, installare il server SSH.

   ```sh
   sudo apt install -y openssh-server
   ```

### PC senza Linux

1. Seguire la guida ufficiale all'installazione: [Debian](https://www.debian.org/releases/stable/installmanual) oppure
   [Ubuntu Server](https://ubuntu.com/tutorials/install-ubuntu-server).
1. Quando il programma di installazione chiede il nome del computer, scrivere `biblioviva`.
1. Creare un utente e una password. Annotare entrambi su un foglio.

   > [!IMPORTANT]
   > Il nome utente e la password servono a ogni passo successivo. Conservare il foglio in un luogo sicuro.

1. Quando il programma propone di installare il server SSH (in Ubuntu "OpenSSH server", in Debian "SSH server"),
   accettare se il PC sarà usato da un altro computer.
1. Terminata l'installazione, riavviare il PC.
1. Lasciare il PC collegato alla rete con il cavo.
<!-- /variant -->
<!-- variant: raspberry -->
**Con il Raspberry Pi**

La scheda microSD viene scritta con Raspberry Pi Imager, il programma ufficiale di Raspberry Pi, su un altro computer.
Le impostazioni personali (nome del computer, utente, rete, accesso da un altro computer) si danno al programma
prima della scrittura: la scheda parte già configurata. Il programma cambia di aspetto da una versione all'altra; la
[guida ufficiale](https://www.raspberrypi.com/documentation/computers/getting-started.html) descrive le sue schermate.

1. Sull'altro computer, scaricare e installare Raspberry Pi Imager dalla
   [pagina di download ufficiale](https://www.raspberrypi.com/software/).
1. Inserire la scheda microSD nel lettore dell'altro computer.

   > [!WARNING]
   > La scrittura cancella tutto il contenuto della scheda.

1. Avviare Raspberry Pi Imager.
1. Nella schermata del dispositivo, scegliere il modello del proprio Raspberry Pi (4 o 5) e proseguire con "Next".
1. Nella schermata del sistema operativo, aprire la voce "Raspberry Pi OS (other)" e scegliere "Raspberry Pi OS Lite
   (64-bit)". Il sistema Lite non ha un ambiente grafico: BiblioViva non ne ha bisogno. [VERIFY: nomi delle voci
   dell'elenco dei sistemi di Imager nella versione corrente]
1. Nella schermata della memoria, scegliere la scheda microSD. Controllare che la capacità indicata sia quella della
   scheda e che non sia scelto il disco del computer.
1. Nella schermata delle personalizzazioni, aprire la scheda "Hostname" e impostare il nome del computer:
   `biblioviva`.
1. Nella scheda "Localisation" scegliere la città (per l'Italia, Roma): Imager ne ricava il fuso orario e la
   disposizione della tastiera.
1. Nella scheda "User" impostare un nome utente (per esempio `biblioviva`; lettere minuscole, cifre, trattini) e una
   password. Annotare entrambi su un foglio.

   > [!IMPORTANT]
   > Il nome utente e la password servono a ogni passo successivo e non si recuperano da BiblioViva. Conservare il
   > foglio in un luogo sicuro.

1. Nella scheda "Wi-Fi", se il Raspberry Pi è collegato con il cavo di rete, lasciare vuote le impostazioni. Se invece
   usa il Wi-Fi, inserire il nome della rete e la sua password.
1. Nella scheda "Remote Access" attivare "Enable SSH" e scegliere l'autenticazione con password.

   <!-- screenshot: imager/customisation | Le schede di personalizzazione di Raspberry Pi Imager compilate -->

1. Confermare e avviare la scrittura. Attendere la fine della scrittura e della verifica; il programma avvisa quando
   la scheda può essere tolta.
1. Togliere la scheda dall'altro computer e inserirla nel Raspberry Pi.
1. Collegare il cavo di rete al Raspberry Pi e al router.
1. Collegare l'alimentatore. Il Raspberry Pi si avvia da solo: al primo avvio servono alcuni minuti, perché il sistema
   si prepara. Attendere almeno cinque minuti prima di proseguire.
<!-- /variant -->

## Verifica prima di proseguire

<!-- variant: linux -->
**Con un PC Linux**

- Il PC è acceso, collegato con il cavo di rete e mostra la richiesta di accesso con il proprio nome:

  ```
  biblioviva login:
  ```

- Il PC compare nell'elenco dei dispositivi del router con il nome `biblioviva`; il nome della pagina del router
  dipende dal modello.
<!-- /variant -->
<!-- variant: raspberry -->
**Con il Raspberry Pi**

- Il Raspberry Pi è acceso e la sua spia verde lampeggia o si accende a intermittenza (è normale).
- Il Raspberry Pi compare nell'elenco dei dispositivi del router con il nome `biblioviva`. La pagina del router si
  apre di solito all'indirizzo indicato sull'etichetta del router; l'elenco si chiama in generale "dispositivi
  connessi" o "client", ma il nome dipende dal router.

Quando il nome non compare, il passo successivo, [Collegarsi al computer](terminal.md), serve anche da prova: se la
connessione riesce, il Raspberry Pi è in rete.
<!-- /variant -->

## Possibili problemi

<!-- variant: linux -->
**Con un PC Linux**

- Il PC non compare nell'elenco del router: controllare il cavo di rete e che il sistema sia avviato fino alla
  richiesta di accesso.
- Dimenticato il nome utente o la password: ripetere l'installazione del sistema.
<!-- /variant -->
<!-- variant: raspberry -->
**Con il Raspberry Pi**

- Il Raspberry Pi non si accende (nessuna spia): controllare l'alimentatore. Un caricabatterie per telefono spesso
  non basta: usare un alimentatore adatto al modello.
- Dopo dieci minuti il Raspberry Pi non compare nell'elenco del router: controllare il cavo di rete (le spie della
  presa si accendono), poi ripetere la scrittura della scheda controllando le impostazioni.
- Dimenticato il nome utente o la password: ripetere la scrittura della scheda con Raspberry Pi Imager.
<!-- /variant -->

## Pagine correlate

- [Scegliere il computer](../choose-computer.md)
- [Occorrente](../material.md)
- Passo successivo: [Collegarsi al computer](terminal.md)
- [Glossario](../../help/glossary.md#nome-del-computer)
