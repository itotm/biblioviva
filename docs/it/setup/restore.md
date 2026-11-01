# Ripartire da una copia di sicurezza

Questa pagina spiega come rimettere in BiblioViva i dati di una copia di sicurezza: dopo il guasto della scheda o del
disco, su un altro computer, dopo un errore che ha cancellato dei dati. È per chi amministra BiblioViva.

- Tempo: da 20 a 40 minuti con un altro computer da preparare, circa 10 minuti se BiblioViva funziona già.
- Occorrente: un file di copia di sicurezza (vedere sotto quali) e l'account `admin`.
- Per ripristinare su un altro computer: i passi 1-4 dell'installazione, indicati più avanti.

## Quale file serve

BiblioViva produce tre tipi di file; ciascuno si può ripristinare.

| File | Dove si trova | Che cosa contiene |
|---|---|---|
| `biblioviva-AAAAMMGG-HHMM.db` | nella cartella `backups` del computer, uno per notte | i dati della biblioteca; le foto e le copertine sono nella cartella `backups/uploads` |
| `biblioviva-export-AAAAMMGG-HHMM.zip` | scaricato con **Esporta tutto** | dati, foto, copertine e tutta la configurazione |
| `biblioviva-AAAAMMGG-HHMM.zip` | nella cartella `backups`, dal pulsante **Crea backup** | le parti scelte al momento della copia |

La configurazione (impostazioni, account del personale, modelli di tessere ed etichette) fa parte soltanto dei file
`.zip`. Ripristinando una copia notturna `.db` la configurazione resta quella del primo avvio.

## Procedura

### Se BiblioViva funziona: ripristinare dal programma

1. Aprire BiblioViva con l'account `admin`, poi **Amministrazione**, poi **Backup**.
1. Per un file già nell'elenco, premere **Ripristina…** sulla sua riga.
1. Per un file portato da un altro computer, premere **Carica un archivio** e scegliere il file. Il browser accetta file
   fino a 30 MB; uno più grande si copia nella cartella `backups` del computer (sezione seguente) e poi si sceglie
   dall'elenco.
1. Leggere il controllo che BiblioViva mostra: le parti che il file contiene (con una casella ciascuna), quante righe
   ci sono ora e quante nel file. Togliere la spunta alle parti da non toccare: restano come sono.
1. Premere **Ripristina**. Alla domanda «Ripristinare le parti scelte?» confermare. I dati e la configurazione scelti
   sostituiscono quelli attuali.
1. Attendere il messaggio «Ripristino completato».

> [!WARNING]
> Il ripristino sostituisce i dati scelti con quelli del file. Se il computer ha dati recenti da non perdere, fare prima
> **Esegui backup ora**.

### Copiare un file grande sul computer

1. Dal computer in cui si trova il file, copiarlo nella cartella `backups` del computer di BiblioViva, sostituendo
   `<utente>` con il nome utente e `<file>` con il nome del file. Il comando funziona nel terminale di Windows, macOS
   e Linux; al posto di `biblioviva.local` si può usare l'indirizzo con cui ci si collega al computer.

   ```sh
   scp <file> <utente>@biblioviva.local:biblioviva/backups/
   ```

1. Aprire **Amministrazione**, poi **Backup**: il file compare nell'elenco, e si ripristina con **Ripristina…**.

### Se BiblioViva non si apre: ripristinare dal terminale

Sul computer di BiblioViva, con il terminale aperto come al passo [Collegarsi al computer](steps/terminal.md).

1. Copiare il file nella cartella `backups` (con `scp` come sopra, o da una chiavetta).
1. Fermare BiblioViva.

   ```sh
   cd ~/biblioviva && docker compose stop app
   ```

1. Far leggere il file al programma di ripristino, sostituendo `<file>` con il suo nome. Il programma controlla il
   file e scrive che cosa contiene, senza cambiare nulla.

   ```sh
   docker compose run --rm --entrypoint bun app cli/backup-restore.js /backups/<file>
   ```

1. Se il controllo non segnala errori, ripetere il comando con `--yes` in fondo: ripristina davvero.

   ```sh
   docker compose run --rm --entrypoint bun app cli/backup-restore.js /backups/<file> --yes
   ```

1. Riavviare BiblioViva.

   ```sh
   docker compose start app
   ```

### Dal primo avvio

Su un computer appena installato, o quando si ricomincia da capo, la configurazione guidata permette di ripristinare un
archivio **Esporta tutto** senza rispondere alle sue domande. La scelta compare soltanto finché la configurazione
guidata non è completata.

1. Aprire l'indirizzo di BiblioViva stampato da `setup.sh`: si apre la pagina **Prima configurazione**.
1. Nel primo passo, sotto la scelta della lingua, premere **Ripristina da un backup**.
1. Premere **Scegli l'archivio** e scegliere il file `biblioviva-export-AAAAMMGG-HHMM.zip`. Il browser accetta file
   fino a 30 MB.
1. Attendere il controllo. BiblioViva mostra la biblioteca che ha prodotto l'archivio, la data, la versione, quanti
   utenti, libri e prestiti contiene e gli account che potranno accedere.
1. Premere **Ripristina**. Impostazioni, dati e immagini tornano come erano nell'archivio, in una volta sola.
1. Attendere la schermata «Ripristino completato», che elenca gli account dell'archivio.
1. Premere **Vai all'accesso** e accedere con uno di quegli account, con la password che aveva nell'archivio.

Un archivio incompleto, di una versione più recente o che non è di BiblioViva viene rifiutato prima di cambiare
qualsiasi cosa, con un messaggio che spiega il motivo. Per un archivio più grande di 30 MB completare la
configurazione guidata e ripristinare dal terminale, come descritto sopra.

### Su un altro computer

1. Preparare il computer e installare BiblioViva con i passi 1-4 del percorso scelto (vedere
   [Installazione](README.md)), con lo stesso modo di collegamento di prima.
1. Al passo [Primo avvio](steps/first-run.md) ripristinare il file dalla prima schermata della configurazione
   guidata, come descritto nella sezione [Dal primo avvio](#dal-primo-avvio); il resto della configurazione guidata
   non serve.
1. Se la copia viene da un computer diverso, aprire **Amministrazione**, **Configurazione**, **Prestazioni** e
   controllare il campo **Computer**: la copia riporta quello del vecchio computer.

## Risultato

BiblioViva mostra di nuovo utenti, libri, prestiti e foto del file. Gli account del personale e le loro password
sono quelli della copia, se questa conteneva la configurazione; altrimenti sono quelli scelti al primo avvio.

## Possibili problemi

- «Il file non è un archivio di BiblioViva.»: il file scelto non è un file prodotto da BiblioViva. Scegliere un file
  `.db` o `.zip` della cartella `backups`, oppure scaricare di nuovo la copia.
- «Il backup è di una versione diversa di BiblioViva…»: il file è stato fatto da una versione che ha le tabelle
  diverse. Installare la stessa versione (vedere «Restare su una versione» in [Aggiornare BiblioViva](update.md)),
  ripristinare, poi aggiornare.
- Dal primo avvio: «L'archivio è incompleto: mancano …»: il file non contiene tutte le parti di una biblioteca
  (le impostazioni, gli account, gli utenti o il catalogo). Scegliere un archivio fatto con **Esporta tutto**.
- Dal primo avvio: «L'archivio è stato creato da una versione più recente di BiblioViva…»: installare prima quella
  versione, ripristinare, poi aggiornare.
- Il ripristino segnala righe che «si riferiscono a … che non ci sarebbero»: aggiungere alla scelta la parte che il
  messaggio nomina e ripetere.
- Da terminale: «permission denied» a proposito di Docker: vedere [Installare BiblioViva](steps/install.md).

## Pagine correlate

- [Copie di sicurezza](steps/backups.md)
- [Spostare BiblioViva su un altro computer](move.md)
- [Aggiornare BiblioViva](update.md)
- [Problemi comuni](../help/problems.md)
