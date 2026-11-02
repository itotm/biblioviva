# Importare gli alunni

Questa guida spiega come caricare in BiblioViva l'elenco degli alunni da un file, all'inizio dell'anno scolastico o
quando si abbandona un altro programma. Serve a chi amministra BiblioViva.

- Tempo: da 15 a 30 minuti, secondo la correzione del file.
- Account: `admin`. Un altro account può importare gli alunni solo se la configurazione dei ruoli gli concede il
  permesso **Importa utenti**; per rimuovere gli alunni che mancano dal file serve anche il permesso **Anonimizza**, che
  ha l'account `admin`.
- Occorrente: l'elenco degli alunni in un foglio di calcolo (nome, cognome, classe) e le classi già create: vedere
  [Impostare le classi](set-up-classes.md).

BiblioViva controlla tutto il file prima di scrivere qualcosa e importa soltanto se non ci sono errori: non esistono
importazioni a metà. Il file è un *CSV*, cioè un file di testo con una riga per alunno e i dati separati da `;` o da
`,`; ogni foglio di calcolo lo sa salvare.

## Procedura

### Preparare il file

1. Premere **Amministrazione**, poi **Importazioni**, poi **Studenti**. Si apre la pagina **Importa studenti**.
1. Nel riquadro **Il modello del file** scegliere le colonne. Quelle sotto **Obbligatorie** sono sempre nel modello;
   quelle sotto **Chiavi** e **Facoltative** si scelgono con le caselle.
1. Per la classe scegliere una delle due forme, sotto **La classe**: **In una colonna (class: 3A)** oppure **In due
   colonne (level: 3, section: A)**.
1. Premere **Scarica il modello**. Il file contiene soltanto la riga delle intestazioni.
1. Aprire il modello con un foglio di calcolo e scrivere una riga per alunno.
1. Salvare il foglio in formato CSV.

I nomi delle colonne sono in inglese e vanno lasciati come nel modello:

| Colonna | Contenuto | Gruppo |
|---|---|---|
| `first_name`, `last_name` | nome e cognome | obbligatorie |
| `class` | la classe in una colonna: `3A`, `3 A`, `3ª A` | obbligatoria, in alternativa a `level` e `section` |
| `level`, `section` | l'anno (`3`) e la sezione (`A`) in due colonne | obbligatorie, in alternativa a `class` |
| `card_number` | il numero della tessera che l'alunno ha già | chiave |
| `external_id` | la matricola del registro elettronico | chiave |
| `email` | l'indirizzo email | facoltativa |

Le chiavi servono a riconoscere chi è già in archivio e si possono lasciare fuori. Senza `card_number` BiblioViva genera
una tessera nuova per ogni alunno; senza `external_id` chi è già in archivio si riconosce dal nome e dalla classe.

> [!NOTE]
> L'importazione non crea classi: ogni classe nominata nel file deve esistere in **Classi**. Sono accettati i file in
> UTF-8 e in Windows-1252, con separatore `;`, `,`, tabulazione o `|`. Le righe vuote vengono ignorate.

### Caricare il file

1. Nel passo **File**, nel campo **File CSV**, scegliere il file.
1. Premere **Carica**. Si apre il passo **Colonne**.
1. Controllare che ogni colonna del file sia abbinata al campo giusto. Le colonne con i nomi del modello sono
   riconosciute da sole; per le altre scegliere il campo nel menu, oppure **— ignora —** per non usarle. Se il file ha
   la riga delle intestazioni, la casella **La prima riga è un'intestazione** è spuntata.
1. Se manca una colonna obbligatoria, la pagina scrive quali: «Mancano le colonne obbligatorie: …». Il pulsante
   **Verifica il file** resta spento finché non sono tutte abbinate.

### Scegliere che cosa fare

1. Nel campo **Modalità** scegliere **Aggiungi e aggiorna** per un file con alunni nuovi o con le classi aggiornate: chi
   è già in archivio viene aggiornato, gli altri vengono creati.
1. Scegliere **Sincronizza studenti** soltanto se il file è l'elenco completo degli alunni della scuola: chi manca dal
   file viene elencato e, con una conferma, rimosso. I docenti non vengono mai toccati.
1. Nel campo **Utenti già presenti** scegliere che cosa fare di una riga che corrisponde a un alunno già in archivio:
   **Aggiorna** (il normale), **Salta** oppure **Crea comunque**.

### Controllare il file

1. Premere **Verifica il file**. Si apre il passo **Verifica**, con una riga per ogni alunno.
1. Leggere la colonna **Esito**: ogni riga è **Nuovo**, **Aggiorna**, **Invariato** o **Errore**. La colonna **Dettagli**
   spiega gli errori. Per vedere solo le righe da correggere spuntare **Mostra solo gli errori**.
1. Se nel file non ci sono numeri di tessera, la pagina dice quante tessere nuove verranno generate.
1. Se due alunni in archivio hanno lo stesso nome e cognome, la pagina chiede di scegliere quale aggiornare, con
   **Scegli l'utente**, oppure **Crea un nuovo utente**. Poi verificare di nuovo.
1. Con la sincronizzazione compare l'elenco degli alunni presenti in archivio ma assenti dal file. Per toglierli
   spuntare **Rimuovi questi studenti dall'archivio (anonimizzazione immediata)**.
1. Se ci sono errori, correggere il file con il foglio di calcolo, premere **Torna alle colonne**, caricare di nuovo il
   file e rifare la verifica. Con anche un solo errore **Importa** resta spento.

> [!WARNING]
> La rimozione cancella subito e per sempre nome, cognome, contatti, matricola, numero di tessera e foto; restano la
> classe e le statistiche. Non si può annullare. Chi ha prestiti in corso non viene rimosso: prima i libri vanno
> restituiti.

### Importare

1. Premere **Importa**. BiblioViva scrive tutto in una volta. Il passo **Completato** riassume i numeri: «… nuovi, …
   aggiornati, … invariati, … rimossi».
1. Per le tessere dei nuovi alunni premere **Stampa le tessere dei nuovi**: vedere
   [Stampare le tessere di una classe](../../manual/guides/print-class-cards.md).
1. Per le foto premere **Censimento foto**.

## Risultato

Gli alunni sono in archivio, ciascuno nella sua classe e con la sua tessera. Il file originale resta conservato sul
computer di BiblioViva e l'importazione compare nel **Registro operazioni**. Caricare di nuovo lo stesso file non crea
doppioni: tutte le righe risultano **Invariato**.

## Possibili problemi

### Una classe non viene riconosciuta

La riga segnala che la classe non è stata trovata ed elenca le classi valide. Creare la classe in **Classi** oppure
correggere il nome nel file, poi verificare di nuovo.

### Il numero di tessera è già assegnato

Compare «Numero tessera già assegnato a un altro utente»: due persone hanno lo stesso numero di tessera, nel file o in
archivio. Correggere il numero nel file.

### Il numero di tessera sembra un codice di libro

Compare «Numero tessera uguale o simile al codice di una copia»: il numero ha la forma del codice di un libro: le
tessere e le copie non possono mai essere confuse. Lasciare vuota la cella: BiblioViva genera il numero.

### Una cella vuota non cancella niente

Una tessera vuota nel file lascia all'alunno la tessera che ha già.

### Il pulsante Importa non si attiva

Ci sono ancora righe con **Errore**: leggere la colonna **Dettagli**.

### Gli studenti arrivano da Koha

Gli studenti si estraggono con una query già pronta, che produce un file con i nomi delle colonne giusti e i numeri di
tessera già in uso: vedere [le istruzioni tecniche](../../../import/README.md). I nomi delle colonne di Koha cambiano da
una versione all'altra: chi esegue la query li controlla prima.

## Pagine correlate

- [Impostare le classi](set-up-classes.md)
- [Importare i docenti](import-teachers.md)
- [Avanzare di classe](class-upgrade.md)
- [Importare le foto degli utenti](import-photos.md)
- [Iscrivere un alunno](../../manual/guides/enrol-a-student.md)
- [Importazioni](../screens/imports.md)
