# Spostare BiblioViva su un altro computer

Questa pagina spiega come portare BiblioViva, con tutti i suoi dati, da un computer a un altro: per sostituire un
computer vecchio con un PC più nuovo o con un Raspberry Pi, per esempio. È per chi amministra BiblioViva.

- Tempo: circa 1 ora e mezza, quasi quanto un'installazione completa.
- Occorrente: l'account `admin`, un altro supporto (chiavetta USB o un secondo computer) dove tenere il file della
  copia, e il materiale per preparare l'altro computer.
- Il vecchio computer serve fino alla copia; poi resta fermo e non si usa più per il lavoro al banco.

## Procedura

### Fare la copia completa

1. Salvare l'archivio con **Esporta tutto**, come descritto nella sezione
   [Salvare la configurazione con tutto il resto](steps/backups.md#salvare-la-configurazione-con-tutto-il-resto) del
   passo [Copie di sicurezza](steps/backups.md). Il file contiene il database, le foto, le copertine e tutta la
   configurazione, compresi i modelli di tessere ed etichette.
1. Copiare il file su una chiavetta o su un altro computer, e controllare che la copia si apra. Il file può pesare
   alcune centinaia di megabyte.

> [!IMPORTANT]
> La copia notturna della cartella `backups` non contiene la configurazione (account del personale, impostazioni,
> modelli): per spostare BiblioViva serve **Esporta tutto**.

### Fermare il vecchio computer

Da questo momento il lavoro al banco non deve continuare sul vecchio computer: i prestiti registrati dopo la copia non
passerebbero all'altro computer.

1. Sul vecchio computer, aprire il terminale come al passo [Collegarsi al computer](steps/terminal.md).
1. Fermare BiblioViva (i dati restano sul disco).

   ```sh
   cd ~/biblioviva && docker compose down
   ```

### Con Tailscale: liberare il nome

BiblioViva con Tailscale prende il nome `biblioviva` nella rete della scuola. Se il vecchio computer è ancora iscritto,
l'altro ottiene un nome con un numero (`biblioviva-1`) e l'indirizzo cambia. Tailscale descrive la regola nella
pagina [Machine names](https://tailscale.com/kb/1098/machine-names).

1. Aprire la pagina «Machines» della [console di amministrazione](https://login.tailscale.com/admin/machines) di
   Tailscale.
1. Cercare la riga `biblioviva`, aprire il menu della riga e scegliere di eliminare la macchina (voce «Delete»)
   [VERIFY: nome del menu e della voce nella console, visibili solo con l'accesso].

Con la rete locale non c'è altro da liberare: ricordare solo che l'altro computer avrà un altro indirizzo, a meno che
chi gestisce la rete non gli riservi l'indirizzo del vecchio.

### Preparare l'altro computer

1. Eseguire i passi 1-4 del percorso scelto, nello stesso ordine, con lo stesso modo di collegamento
   (Tailscale o rete locale) del vecchio computer. I percorsi sono nella pagina [Installazione](README.md).
1. Al passo [Primo avvio](steps/first-run.md) aprire la configurazione guidata e fermarsi alla prima schermata, senza
   rispondere alle domande: il ripristino della sezione seguente sostituisce le sue scelte.

Con Tailscale la chiave del passo [Preparare la rete](steps/network.md) si può riusare se è ancora valida, perché è
stata generata come riutilizzabile; altrimenti se ne genera una nuova.

### Dal primo avvio

1. Nella prima schermata della configurazione guidata, sotto la scelta della lingua, premere
   **Ripristina da un backup**.
1. Premere **Scegli l'archivio** e scegliere il file `biblioviva-export-AAAAMMGG-HHMM.zip`. BiblioViva lo controlla e
   mostra che cosa contiene.
1. Premere **Ripristina**, attendere «Ripristino completato» e premere **Vai all'accesso**. Il dettaglio è nella
   sezione [Dal primo avvio](restore.md#dal-primo-avvio) di [Ripartire da una copia di sicurezza](restore.md).
1. Accedere con l'account `admin` del vecchio computer.
1. Aprire **Amministrazione**, **Configurazione**, **Prestazioni** e controllare il campo **Computer**: la copia riporta
   quello del vecchio computer; sceglierne uno adatto all'altro computer.

Da questo momento gli account del personale e le loro password sono quelli del vecchio computer.

### Controllare e spegnere il vecchio computer

1. Sull'altro computer, controllare un utente, un libro e un prestito noti, e leggere una tessera con il lettore.
1. Controllare i dispositivi del banco: con Tailscale l'indirizzo è lo stesso di prima (`https://biblioviva.<tailnet>.ts.net`);
   con la rete locale, comunicare l'indirizzo se è cambiato (vedere [Collegare i dispositivi](steps/devices.md)).
1. Tenere il vecchio computer spento ma intatto per alcune settimane, poi cancellarlo come in
   [Disinstallare BiblioViva](uninstall.md): contiene i dati degli utenti.

## Risultato

L'altro computer serve BiblioViva allo stesso indirizzo (con Tailscale) o a un indirizzo comunicato ai dispositivi
(con la rete locale), con gli stessi dati, le stesse foto e le stesse impostazioni del vecchio.

## Possibili problemi

### Con Tailscale il nome e l'indirizzo sono diversi

Con Tailscale il computer si chiama `biblioviva-1` e l'indirizzo è diverso: il vecchio nodo non è stato eliminato.
Eliminarlo dalla console; il nome dell'altro computer si può correggere dalla stessa pagina «Machines»
[VERIFY: se il nome si può correggere dalla console].

### Il backup è di una versione diversa

Compare il messaggio «Il backup è di una versione diversa di BiblioViva…»: i due computer hanno versioni diverse.
Vedere [Ripartire da una copia di sicurezza](restore.md).

### La procedura guidata non si completa o BiblioViva non si apre

Vedere [Installare BiblioViva](steps/install.md).

## Pagine correlate

- [Copie di sicurezza](steps/backups.md)
- [Ripartire da una copia di sicurezza](restore.md)
- [Disinstallare BiblioViva](uninstall.md)
- [Installazione](README.md)
