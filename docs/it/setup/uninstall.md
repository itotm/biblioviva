# Disinstallare BiblioViva

Questa pagina spiega come fermare BiblioViva su un computer e, se serve, cancellarne tutti i dati. È per chi
amministra BiblioViva e deve dismettere il computer o rinunciare all'installazione.

- Tempo: circa 10 minuti.
- Occorrente: il terminale del computer di BiblioViva (vedere [Collegarsi al computer](steps/terminal.md)) e, per la
  copia, l'account `admin`.
- Con Tailscale: l'accesso alla console di amministrazione di Tailscale.

## Procedura

### Conservare una copia

Prima di cancellare qualunque cosa, tenere una copia dei dati, anche se non si pensa di servirsene.

1. Salvare l'archivio con **Esporta tutto**, come descritto nella sezione
   [Salvare la configurazione con tutto il resto](steps/backups.md#salvare-la-configurazione-con-tutto-il-resto) del
   passo [Copie di sicurezza](steps/backups.md).
1. Copiare il file `biblioviva-export-AAAAMMGG-HHMM.zip` scaricato in un posto sicuro, fuori dal computer. Contiene
   dati personali di minori: conservarlo con cura e cancellarlo quando non serve più.
1. Copiare anche la cartella `backups` del computer: contiene le copie notturne e la copia delle foto e delle
   copertine.

### Fermare BiblioViva, senza cancellare i dati

1. Aprire il terminale del computer di BiblioViva.
1. Entrare nella cartella di BiblioViva.

   ```sh
   cd ~/biblioviva
   ```

1. Fermare BiblioViva e rimuoverne i contenitori. I dati restano su disco.

   ```sh
   docker compose down
   ```

Per riavviarlo, dalla stessa cartella: `docker compose up -d`.

### Cancellare tutti i dati

> [!WARNING]
> Il comando seguente cancella per sempre il database, le foto e le copertine. Senza una copia i dati degli utenti, dei
> libri e dei prestiti non si possono più recuperare. Eseguirlo soltanto con la copia già conservata.

1. Dalla cartella `~/biblioviva`, cancellare i dati di Docker (il database, le foto, le copertine e l'identità del
   computer in Tailscale).

   ```sh
   docker compose down -v
   ```

1. Uscire dalla cartella.

   ```sh
   cd ~
   ```

1. Cancellare la cartella di BiblioViva, con le impostazioni e le copie di sicurezza che contiene.

   ```sh
   rm -r ~/biblioviva
   ```

### Con Tailscale: togliere il computer dalla rete

1. Eliminare dalla console di Tailscale la macchina `biblioviva`, come descritto nella sezione
   [Con Tailscale: liberare il nome](move.md#con-tailscale-liberare-il-nome) di
   [Spostare BiblioViva su un altro computer](move.md).
1. Aprire la pagina «Keys» della [console di amministrazione](https://login.tailscale.com/admin/settings/keys) e
   revocare la chiave di accesso generata per BiblioViva.

I telefoni e i computer che hanno l'applicazione di Tailscale la tengono: si disinstalla dal dispositivo, se non serve
più.

## Risultato

Il comando seguente non mostra più contenitori di BiblioViva e la cartella `~/biblioviva` non esiste (se è stata
cancellata).

```sh
docker ps
```

Docker resta installato sul computer: non occorre rimuoverlo.

## Possibili problemi

### Permission denied durante la cancellazione della cartella

Compare «Permission denied» durante la cancellazione della cartella: alcuni file appartengono a un altro utente del
computer. Ripetere il comando con `sudo` davanti, controllando con cura il percorso prima di premere Invio.

```sh
sudo rm -r ~/biblioviva
```

### Docker risponde permission denied

Il messaggio «permission denied» a proposito di Docker si risolve chiudendo il terminale e collegandosi di nuovo,
oppure anteponendo `sudo` ai comandi `docker`.

## Pagine correlate

- [Copie di sicurezza](steps/backups.md)
- [Spostare BiblioViva su un altro computer](move.md)
- [Ripartire da una copia di sicurezza](restore.md)
