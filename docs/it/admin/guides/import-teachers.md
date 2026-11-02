# Importare i docenti

Questa guida spiega come caricare in BiblioViva l'elenco dei docenti da un file. Serve a chi amministra BiblioViva; di
solito si fa una volta, all'avvio, e poi quando cambia il corpo docente.

- Tempo: circa 10 minuti.
- Account: `admin`. Un altro account può importare i docenti solo se la configurazione dei ruoli gli concede il
  permesso **Importa utenti**. Per rimuovere i docenti che mancano dal file serve anche il permesso **Anonimizza**.
- Occorrente: l'elenco dei docenti in un foglio di calcolo (nome e cognome) e, se la scuola ha più gruppi di docenti, i
  gruppi già creati: vedere [Impostare le classi](set-up-classes.md).

La procedura è la stessa degli alunni, spiegata passo per passo in [Importare gli alunni](import-students.md): questa
pagina ne riporta solo le differenze. BiblioViva controlla tutto il file prima di scrivere qualcosa e importa soltanto
se non ci sono errori.

## Procedura

### Preparare il file

1. Premere **Amministrazione**, poi **Importazioni**, poi **Docenti**. Si apre la pagina **Importa docenti**.
1. Nel riquadro **Il modello del file** scegliere le colonne e premere **Scarica il modello**.
1. Aprire il modello con un foglio di calcolo e scrivere una riga per docente.
1. Salvare il foglio in formato CSV.

Le colonne, con i nomi in inglese come nel modello:

| Colonna | Contenuto | Gruppo |
|---|---|---|
| `first_name`, `last_name` | nome e cognome | obbligatorie |
| `card_number` | il numero della tessera che il docente ha già | chiave |
| `external_id` | il codice del docente nel registro | chiave |
| `email` | l'indirizzo email | facoltativa |
| `group` | il nome del gruppo docenti, per esempio `Docenti` | facoltativa |

Senza `card_number` BiblioViva genera una tessera per ogni docente; senza `external_id` chi è già in archivio si
riconosce dal nome. Senza la colonna `group` ogni docente entra nel gruppo docenti predefinito.

### Caricare e controllare

1. Nel passo **File**, nel campo **File CSV**, scegliere il file e premere **Carica**.
1. Nel passo **Colonne** controllare l'abbinamento delle colonne, come per gli alunni.
1. Nel campo **Modalità** scegliere **Aggiungi e aggiorna**. Scegliere **Sincronizza docenti** soltanto se il file è
   l'elenco completo dei docenti: chi manca dal file viene elencato e, con una conferma, rimosso. Gli alunni non vengono
   mai toccati.
1. Premere **Verifica il file** e leggere la colonna **Esito** di ogni riga: **Nuovo**, **Aggiorna**, **Invariato** o
   **Errore**.
1. Con la sincronizzazione, per togliere i docenti assenti dal file spuntare **Rimuovi questi docenti dall'archivio
   (anonimizzazione immediata)**.
1. Se ci sono errori, correggere il file, premere **Torna alle colonne**, caricarlo di nuovo e verificare ancora.

> [!WARNING]
> La rimozione cancella subito e per sempre nome, cognome, contatti, codice nel registro, numero di tessera e foto del docente. Non si può annullare. Chi ha
> prestiti in corso non viene rimosso.

### Importare

1. Premere **Importa**. Il passo **Completato** riassume i numeri: «… nuovi, … aggiornati, … invariati, … rimossi».
1. Per le tessere dei nuovi docenti premere **Stampa le tessere dei nuovi**.

## Risultato

I docenti sono in archivio, ciascuno nel suo gruppo e con la sua tessera. Il file originale resta conservato sul
computer di BiblioViva e l'importazione compare nel **Registro operazioni**. Caricare di nuovo lo stesso file non crea
doppioni.

## Possibili problemi

### Il gruppo non viene riconosciuto

La riga segnala che il gruppo docenti non è stato trovato ed elenca i gruppi validi. Creare il gruppo con **Nuovo
gruppo docenti** nella pagina **Classi**, oppure correggere il nome nel file.

### Un docente compare due volte

La riga segnala che la stessa persona è già alla riga indicata: togliere il doppione dal file.

### Due docenti hanno lo stesso nome e cognome

La pagina chiede di scegliere quale aggiornare, con **Scegli l'utente**, oppure **Crea un nuovo utente**.

### I docenti arrivano da Koha

I docenti si estraggono con una query già pronta: vedere [le istruzioni tecniche](../../../import/README.md).

## Pagine correlate

- [Importare gli alunni](import-students.md)
- [Impostare le classi](set-up-classes.md)
- [Iscrivere un docente](../../manual/guides/enrol-a-teacher.md)
- [Importazioni](../screens/imports.md)
