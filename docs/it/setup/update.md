# Aggiornare BiblioViva

Questa pagina spiega come portare BiblioViva all'ultima versione, per chi gestisce il computer su cui gira. I dati
della biblioteca (utenti, libri, prestiti, foto, impostazioni) restano dove sono.

- Tempo: circa 10 minuti, in gran parte attesa per lo scaricamento.
- Occorrente: il terminale del computer di BiblioViva (vedere [Collegarsi al computer](steps/terminal.md)) e una copia
  di sicurezza recente.
- Per la copia di sicurezza: l'account `admin` di BiblioViva.

## Procedura

### Fare una copia di sicurezza

1. Fare una copia di sicurezza con **Esegui backup ora**, come descritto nella sezione
   [Fare una copia subito](steps/backups.md#fare-una-copia-subito) del passo [Copie di sicurezza](steps/backups.md).

La copia notturna e quella da conservare fuori dal computer sono spiegate nello stesso passo.

### Aggiornare

1. Aprire il terminale del computer di BiblioViva, come al passo [Collegarsi al computer](steps/terminal.md).
1. Copiare il comando seguente, incollarlo e premere Invio. È lo stesso comando dell'installazione.

   ```sh
   curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang it
   ```

1. Attendere. Il programma riconosce l'installazione già fatta, non pone alcuna domanda e scrive una riga come la
   seguente, con la cartella e il modo di collegamento (`tailscale` o `lan`) che BiblioViva ha già.

   ```
   BiblioViva è già installato in /home/<utente>/biblioviva (tailscale): aggiornamento.
   ```

1. Attendere la fine. Il programma scarica la versione più recente, riavvia BiblioViva e scrive «BiblioViva è
   pronto.» con l'indirizzo di sempre. Il riavvio interrompe BiblioViva per alcuni istanti: farlo quando nessuno lavora al banco.

> [!NOTE]
> Il programma riscrive il file `compose.yml` della cartella `biblioviva` (e, con Tailscale, `tailscale/serve.json`)
> con quelli del modo di collegamento in uso. Il file `.env`, con la chiave di Tailscale e la versione scelta, e le
> cartelle `config` e `backups` non si toccano. Chi ha modificato `compose.yml` a mano deve rifare la modifica.

### Aggiornare con i comandi di Docker (alternativa)

Per chi preferisce non riscaricare il programma di installazione, due comandi bastano.

1. Entrare nella cartella di BiblioViva.

   ```sh
   cd ~/biblioviva
   ```

1. Scaricare la versione più recente.

   ```sh
   docker compose pull
   ```

1. Riavviare BiblioViva con la versione scaricata.

   ```sh
   docker compose up -d
   ```

### Restare su una versione

Per impostazione predefinita BiblioViva segue l'ultima versione pubblicata. Per fermarlo a una versione precisa, per
esempio per non cambiare versione durante l'anno scolastico:

1. Aprire il file `.env` con l'editor del terminale.

   ```sh
   nano ~/biblioviva/.env
   ```

1. Trovare la riga che comincia con `BIBLIOVIVA_IMAGE=` e sostituire la parte dopo il segno `=` con la versione
   voluta, per esempio:

   ```
   BIBLIOVIVA_IMAGE=ghcr.io/itotm/biblioviva:1.0.0
   ```

1. Salvare con Ctrl+O e Invio, uscire con Ctrl+X, poi eseguire i comandi della sezione precedente
   (`docker compose pull`, poi `docker compose up -d`).

Per tornare all'ultima versione, scrivere di nuovo `ghcr.io/itotm/biblioviva:latest`. Il comando di installazione
rieseguito non cambia questa riga.

## Risultato

BiblioViva risponde allo stesso indirizzo di prima, la pagina di accesso si apre e i libri, gli utenti e i prestiti
sono quelli di prima.

## Possibili problemi

### Il comando risponde permission denied per Docker

Il comando risponde «permission denied» a proposito di Docker: il terminale va chiuso e riaperto dopo l'installazione
di Docker (vedere [Installare BiblioViva](steps/install.md)), oppure si antepone `sudo` ai comandi `docker`.

### BiblioViva non risponde ancora

Compare il messaggio «BiblioViva non risponde ancora»: attendere due minuti e rieseguire il comando; se il messaggio
resta, la lettura del registro è descritta in [Installare BiblioViva](steps/install.md#possibili-problemi).

### Dopo l'aggiornamento qualcosa non va

Ripristinare la copia fatta all'inizio, come in [Ripartire da una copia di sicurezza](restore.md), e rimandare
l'aggiornamento restando sulla versione di prima come descritto sopra.

## Pagine correlate

- [Copie di sicurezza](steps/backups.md)
- [Ripartire da una copia di sicurezza](restore.md)
- [Installare BiblioViva](steps/install.md)
