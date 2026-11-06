# Primi passi dell'amministratore

Questa pagina indica l'ordine in cui conviene impostare BiblioViva dopo l'[installazione](../setup/README.md) e il
[primo avvio](../setup/steps/first-run.md). Serve a chi amministra BiblioViva con l'account `admin`. Ogni voce
rimanda alla guida che spiega il lavoro; le voci facoltative sono segnate come tali, e quelle che non servono alla
propria scuola si saltano.

- Tempo: da mezza giornata a una giornata, divisa in più momenti.
- Account: `admin`, l'unico che vede **Amministrazione**.
- Occorrente: BiblioViva installato e il primo avvio completato; le password degli account annotate; i file di studenti,
  docenti e catalogo, se si importano dati da un altro programma.

## Procedura

### I dati dimostrativi e le password

1. [Togliere i dati dimostrativi](guides/remove-demo-data.md), se il primo avvio li ha caricati. Va fatto per primo,
   prima di inserire dati veri.
1. [Cambiare una password](guides/change-a-password.md) e, se serve, [gestire gli account del
   personale](guides/manage-accounts.md): dopo i dati dimostrativi le password semplici vanno sostituite.

### La biblioteca

1. [Impostare la biblioteca](guides/set-up-the-library.md): il nome, il logo, i colori e la lingua.
1. [Disattivare le foto o le copertine](guides/switch-off-photos-or-covers.md), se la scuola preferisce non conservarle.
   Facoltativo.
1. [Aggiungere una lingua](guides/add-a-language.md), se serve una lingua diversa dall'italiano e dall'inglese.
   Facoltativo.

### La scuola e le regole

1. [Impostare le classi](guides/set-up-classes.md): le classi create al primo avvio si controllano e si completano.
1. [Impostare le regole dei prestiti](guides/set-loan-rules.md): durata, numero di libri e rinnovi, solleciti.
1. [Impostare il calendario della scuola](guides/set-the-calendar.md): chiusure settimanali, festività e vacanze.

### I codici e il catalogo

1. [Scegliere i formati dei codici a barre](guides/barcode-formats.md): da fare prima di stampare etichette e tessere, e
   in particolare se la biblioteca ha già codici stampati da un altro sistema.
1. [Modificare la classificazione e i livelli di lettura](guides/classification.md): i generi, gli argomenti e lo schema
   delle segnature.

### Le stampe

1. [Modificare il modello delle tessere](guides/edit-the-card-template.md).
1. [Modificare le etichette e la fascetta del dorso](guides/edit-label-templates.md).
1. [Aggiungere un foglio di etichette](guides/add-a-label-stock.md), se il foglio adesivo della scuola non è tra quelli
   proposti.
1. [Calibrare la stampa fronte-retro](guides/calibrate-duplex.md), se le tessere si stampano sui due lati del foglio.

### I dati veri

1. [Importare gli alunni](guides/import-students.md).
1. [Importare i docenti](guides/import-teachers.md).
1. [Importare il catalogo](guides/import-the-catalogue.md).
1. [Importare i prestiti in corso](guides/import-loans.md), una volta sola, il giorno del passaggio da un altro
   programma.
1. [Importare le foto degli utenti](guides/import-photos.md), se le foto sono già disponibili.

### Le copie di sicurezza

1. [Fare e scaricare una copia di sicurezza](guides/make-a-backup.md), e metterla in un posto che non sia il computer di
   BiblioViva. La copia notturna è già attiva: vedere il passo
   [Copie di sicurezza](../setup/steps/backups.md) dell'installazione.
1. [Esportare e importare la configurazione](guides/export-the-configuration.md): un archivio delle impostazioni da
   tenere al sicuro.

### Dopo le impostazioni

1. [Creare un report](guides/create-a-report.md), se servono statistiche diverse da quelle fornite. Facoltativo.
1. Consegnare a ogni collega la password del suo account e passare al [Manuale](../manual/README.md).

## Risultato

- BiblioViva ha il nome, i colori, le classi, le regole e il calendario della scuola.
- I dati dimostrativi sono stati tolti e i dati veri sono dentro.
- Le password sono cambiate e consegnate a chi le usa.
- Esiste almeno una copia di sicurezza, fuori dal computer di BiblioViva.

## Possibili problemi

### Non si sa se una voce serve

Saltarla. Le impostazioni proposte da BiblioViva sono adatte alla maggior parte delle scuole e ogni modifica si può
annullare dalla [cronologia della configurazione](guides/undo-a-configuration-change.md).

### Un'impostazione non si trova

La pagina [Configurazione](screens/configuration.md) elenca le sezioni, e [Amministrazione](screens/admin.md) elenca le
pagine dell'amministratore.

### La password è persa o BiblioViva non si apre

Vedere [Problemi comuni](../help/problems.md).

## Pagine correlate

- [Amministrazione](README.md)
- [Gestire gli account del personale](guides/manage-accounts.md)
- [Ripartire da una copia di sicurezza](../setup/restore.md)
- [Problemi comuni](../help/problems.md)
