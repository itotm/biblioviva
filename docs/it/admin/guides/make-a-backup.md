# Fare e scaricare una copia di sicurezza

Questa guida spiega come fare una copia di sicurezza subito, senza aspettare quella della notte, e come scaricarla sul
computer. Serve a chi amministra BiblioViva, prima di un aggiornamento, di un'importazione grande o di un passaggio di
classe, e a ogni modifica importante.

BiblioViva fa da sola una copia del database ogni notte. Che cosa contiene la copia notturna, dove si trova e come si
tiene una copia fuori dal computer di BiblioViva è spiegato nel passo [Copie di
sicurezza](../../setup/steps/backups.md) dell'installazione.

- Tempo: da 2 a 5 minuti, secondo la dimensione dei dati.
- Account: `admin`, l'unico che vede la pagina **Backup**.
- Occorrente: spazio sul computer per il file scaricato. Le copertine pesano più del database.

## Procedura

### Fare una copia subito

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Backup**.
1. Premere **Esegui backup ora**.
1. Attendere il messaggio «Backup creato:» seguito dal nome del file. Il file compare in cima all'elenco, con la data in
   **Creato** e la **Dimensione**.

<!-- figure: admin/backups | La pagina Backup con l'elenco delle copie e i pulsanti Esegui backup ora e Esporta tutto -->

### Scaricare una copia

1. Nell'elenco premere **Scarica** accanto alla copia da portare via. Il browser salva un file
   `biblioviva-AAAAMMGG-HHMM.db` nella cartella dei download.

Il file contiene soltanto il database. Le foto e le copertine sono copiate nella cartella `uploads` dei backup e la
configurazione non fa parte della copia notturna.

### Scaricare tutto in un solo file

1. Premere **Esporta tutto**.
1. Attendere che il browser salvi il file `biblioviva-export-AAAAMMGG-HHMM.zip`. Contiene il database, le foto, le
   copertine e tutta la configurazione, e basta da solo per rimettere in piedi BiblioViva su un altro computer.

### Copiare soltanto alcune parti

Il riquadro **Backup o esportazione di alcune parti** permette di salvare solo ciò che serve.

1. Spuntare le parti nei gruppi **Dati della biblioteca**, **Impostazioni** e **Classificazione, modelli e altro**. I
   pulsanti **Tutti** e **Nessuno** spuntano o tolgono tutto. Alcune parti ne richiedono altre: la pagina lo segnala.
1. Premere **Crea backup** per salvare l'archivio nell'elenco, oppure **Scarica** per salvarlo sul computer.

### Conservare il file

1. Copiare il file scaricato su una chiavetta USB o su un altro supporto che non stia nel computer di BiblioViva. I
   passaggi sono nel passo [Copie di sicurezza](../../setup/steps/backups.md).
1. Cancellare le copie che non servono più.

> [!IMPORTANT]
> Le copie contengono i dati degli studenti. Tenerle in un posto sicuro.

## Risultato

- Nell'elenco della pagina **Backup** compare una copia recente.
- Il file scaricato è sul computer, e poi su una chiavetta o su un altro supporto.

## Possibili problemi

### L'elenco dei backup è vuoto

L'elenco mostra «Nessun backup»: la prima copia nasce all'orario pianificato oppure con **Esegui backup ora**.

### Una copia risulta recuperata all'avvio

La copia era in programma di notte, il computer era spento e BiblioViva l'ha fatta all'accensione successiva.

### Il file zip è molto grande

Il file `.zip` è molto grande: le copertine pesano più del database. Usare un supporto con più spazio.

### Si vuole cambiare l'orario o la durata delle copie

L'orario e la durata delle copie si cambiano in **Amministrazione**, **Configurazione**, **Backup**, nei campi
**Orario del backup** e **Giorni di conservazione**.

### Si vogliono rimettere i dati di una copia

Per rimettere i dati di una copia in BiblioViva vedere [Ripartire da una copia di
sicurezza](../../setup/restore.md).

## Pagine correlate

- [Copie di sicurezza](../../setup/steps/backups.md)
- [Ripartire da una copia di sicurezza](../../setup/restore.md)
- [Esportare e importare la configurazione](export-the-configuration.md)
- [Backup](../screens/backups.md)
