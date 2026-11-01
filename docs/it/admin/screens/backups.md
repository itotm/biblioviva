# Backup

La pagina **Backup** mostra le copie di sicurezza del database, permette di farne una subito, di scaricarla e di
ripristinare i dati o la configurazione. È riservata all'account `admin` e si apre dalla scheda **Backup** di
[Amministrazione](admin.md). Il programma fa da solo una copia del database ogni notte; l'orario e la conservazione si
scelgono nella sezione Backup della [Configurazione](configuration.md#backup). Le procedure sono nella guida
[Fare e scaricare una copia di sicurezza](../guides/make-a-backup.md); per il ripristino da terminale e per la copia fuori
dal computer vedere [Ripartire da una copia di sicurezza](../../setup/restore.md) e
[Copie di sicurezza](../../setup/steps/backups.md).

<!-- figure: admin/backups | La pagina Backup con l'elenco delle copie e il pannello di ripristino -->

1. I pulsanti **Esporta tutto** ed **Esegui backup ora**.
2. Il riquadro «Cosa contiene il backup».
3. Il riquadro «Backup o esportazione di alcune parti».
4. Lo stato della copia esterna.
5. L'elenco delle copie, con **Scarica** e **Ripristina…** su ogni riga.
6. Il pannello «Ripristino».

## Esegui backup ora

Il pulsante **Esegui backup ora** crea subito una copia completa del database. Al termine compare il messaggio «Backup
creato» con il nome del file; se la conservazione ha eliminato copie vecchie, il messaggio dice quante.

## Esporta tutto

Il pulsante **Esporta tutto** scarica un unico file ZIP con database, foto, copertine e tutta la configurazione,
template e immagini compresi, pronto per il ripristino con `bun run backup:restore`. Nella demo pubblica il download è
disattivato.

## Cosa contiene il backup

Il riquadro riassume il contenuto della copia notturna.

- Il database: una copia completa a ogni esecuzione.
- Le foto e le copertine: copiate ogni notte nella cartella `uploads` del backup, con il loro numero. Prima della prima
  copia il riquadro dice quante sono da copiare.
- La configurazione (template, immagini, impostazioni) non è nel backup notturno: per averla si usa **Esporta tutto** o
  l'archivio della [Configurazione](configuration.md#archivio-della-configurazione).

## Backup o esportazione di alcune parti

Il riquadro permette di includere solo alcune parti. Le parti sono in tre gruppi:

- «Dati della biblioteca»: Utenti, Catalogo e copie, Prestiti e storico, Liste di stampa, Foto degli utenti, Copertine,
  Segnalazioni, Date del calendario, Registro delle attività;
- «Impostazioni»: una voce per ogni sezione della configurazione;
- «Classificazione, modelli e altro»: Classificazione e pittogrammi, Fogli di etichette, Calendario, Report, i template
  di tessere, di etichette, di fascette, di ricevute e solleciti, Pacchetti di lingua e Logo della biblioteca.

I comandi **Tutti** e **Nessuno** di ogni gruppo scelgono o svuotano le voci. Alcune parti hanno bisogno di altre per
essere ripristinate: la pagina lo segnala. **Crea backup** salva la scelta nell'elenco; **Scarica** la scarica sul
computer.

## Copia esterna

Il riquadro «Ultima copia esterna» dice se la copia fuori dal computer (con rclone) è attiva e come è andata:

- «Copia esterna non configurata», quando il servizio non è attivo;
- «Il servizio è abilitato ma non ha ancora scritto alcun esito»;
- «Ultima copia riuscita» oppure «Ultima copia fallita», con data e ora;
- «La copia esterna è più vecchia di due giorni: controllare il servizio offsite»;
- la «Destinazione» della copia.

## L'elenco delle copie

Ogni riga mostra il nome del file, la data di creazione e la dimensione. Una copia fatta all'avvio perché quella
programmata era saltata (computer spento) porta l'etichetta **Recuperato all'avvio**. Senza copie compare «Nessun backup.
Il primo verrà creato all'orario pianificato oppure con «Esegui backup ora».»

- **Scarica** scarica il file della copia.
- **Ripristina…** prepara il ripristino da quella copia e porta al pannello «Ripristino».

## Ripristino

Il pannello «Ripristino» riporta indietro solo le parti scelte; le altre restano come sono. Si parte da una copia
dell'elenco con **Ripristina…**, oppure si carica un archivio di BiblioViva con **Carica un archivio** (un backup,
**Esporta tutto** o l'archivio della configurazione; la dimensione massima è scritta nella pagina, uno più grande si
copia nella cartella dei backup del server). Prima di ripristinare, la pagina controlla tutto e mostra:

- da quale archivio e di quale data si ripristina;
- per ogni parte, quanti elementi ci sono ora e quanti nel backup;
- le immagini che verranno ripristinate (foto e copertine);
- l'avviso «Così alcuni dati resterebbero senza ciò a cui si riferiscono», con l'indicazione di quale parte aggiungere
  alla scelta;
- il blocco «Il backup è di una versione diversa di BiblioViva», che non si può ripristinare;
- il messaggio «Il file non è un archivio di BiblioViva», se il file è sbagliato.

Il pulsante **Ripristina** chiede conferma («Ripristinare le parti scelte?»): i dati e la configurazione scelti vengono
sostituiti da quelli del backup. La configurazione si può riportare indietro dalla [Cronologia](config-history.md); per i
dati conviene fare prima un backup, se non ce n'è uno recente. A fine operazione compare «Ripristino completato».
