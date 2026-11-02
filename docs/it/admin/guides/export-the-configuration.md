# Esportare e importare la configurazione

Questa guida spiega come salvare in un solo file tutta la configurazione di BiblioViva (impostazioni, modelli di stampa,
fogli di etichette, logo, report, lingue) e come rimetterla in BiblioViva, anche su un'altra installazione. Serve a chi
amministra BiblioViva, per tenere una copia delle impostazioni o per ripetere le stesse impostazioni in un'altra scuola.

L'archivio della configurazione non contiene i dati della biblioteca (libri, utenti, prestiti: per quelli c'è la [copia
di sicurezza](make-a-backup.md)) né la cronologia delle modifiche.

- Tempo: circa 5 minuti.
- Account: `admin`.
- Occorrente: per l'importazione, un archivio ZIP di BiblioViva.

> [!IMPORTANT]
> L'archivio contiene anche gli account del personale con le password in forma protetta, non leggibile. Conservarlo
> con cura e non spedirlo a chi non deve entrare in BiblioViva.

## Procedura

### Esportare

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Configurazione**.
1. Scorrere fino al riquadro **Archivio della configurazione**.
1. Premere **Esporta configurazione**. Il browser salva il file `biblioviva-configurazione-AAAAMMGG-HHMM.zip`.

<!-- figure: admin/config-archive | Il riquadro Archivio della configurazione con i pulsanti Esporta configurazione e Importa configurazione -->

Per esportare soltanto alcune parti:

1. Aprire **Scegli cosa esportare** e spuntare le parti da prendere.
1. Premere **Esporta le parti scelte**.

### Importare

1. Nel riquadro **Archivio della configurazione** premere **Importa configurazione**.
1. Scegliere il file ZIP. BiblioViva lo controlla senza cambiare nulla e mostra il risultato sotto i pulsanti: di quale
   archivio si tratta, quanti file sono nuovi, modificati, tolti e uguali, e quali sezioni cambiano.
1. Aprire **Elenco dei file** per vedere un file alla volta.
1. Spuntare le parti da prendere. Le altre restano come sono.
1. Leggere gli eventuali problemi. Con anche un solo errore il pulsante **Importa** resta spento.
1. Premere **Importa**.
1. Alla domanda «Sostituire la configurazione con quella dell'archivio?» premere **Importa**. Compare il messaggio
   «Configurazione importata».

L'archivio può essere un file di **Esporta configurazione**, ma anche un backup o un file di **Esporta tutto**: ne viene
presa soltanto la configurazione, i dati della biblioteca restano come sono. Un file che contiene soltanto dati viene
rifiutato.

> [!WARNING]
> Se l'archivio viene da un'altra installazione e si prende anche la parte **Sicurezza e accessi**, gli account del
> personale e le loro password diventano quelli dell'archivio. Togliere la spunta a quella parte per tenere gli
> account di adesso.

## Risultato

- Il file `.zip` della configurazione è sul computer.
- Dopo un'importazione la configurazione è quella dell'archivio. I file di prima restano nella cronologia: per tornare
  indietro vedere [Annullare una modifica della configurazione](undo-a-configuration-change.md).

## Possibili problemi

### Il file non è un archivio di BiblioViva

Compare «Il file non è un archivio ZIP valido.» o «Il file non è un archivio di BiblioViva.»: scegliere un file
prodotto da BiblioViva.

### L'archivio non contiene la configurazione

Compare «L'archivio non contiene la configurazione (solo dati della biblioteca): si ripristina da Amministrazione →
Backup.»: il file è una copia dei dati, non della configurazione; vedere
[Ripartire da una copia di sicurezza](../../setup/restore.md).

### L'archivio ha dei problemi da correggere

Compare «L'archivio ha dei problemi: vanno corretti prima di importarlo.» con un elenco: ogni riga indica il file e la
chiave da correggere, per esempio un valore non valido o un codice usato da alcuni libri che sparirebbe. Correggere
l'archivio, oppure togliere la spunta alle parti che hanno il problema.

### L'archivio è troppo grande

Compare «L'archivio è troppo grande»: il limite è indicato nel messaggio.

### Si vuole fare lo stesso dal terminale

Chi lavora sul computer di BiblioViva può fare lo stesso dal terminale: i comandi sono nella pagina tecnica
[Deployment notes](../../../deploy.md).

## Pagine correlate

- [Annullare una modifica della configurazione](undo-a-configuration-change.md)
- [Fare e scaricare una copia di sicurezza](make-a-backup.md)
- [Configurazione](../screens/configuration.md)
- [Primi passi dell'amministratore](../first-steps.md)
