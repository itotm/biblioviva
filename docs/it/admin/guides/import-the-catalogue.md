# Importare il catalogo

Questa guida spiega come caricare in BiblioViva i libri e le copie da un file, per esempio quando si abbandona un altro
programma. Serve a chi amministra BiblioViva; di solito si fa una volta, all'avvio.

- Tempo: da 30 minuti a due ore, secondo la dimensione del catalogo e la pulizia del file.
- Account: `admin`. Un altro account può importare il catalogo solo se la configurazione dei ruoli gli concede il
  permesso **Importa catalogo**.
- Occorrente: il catalogo in un foglio di calcolo, con una riga per ogni copia.

BiblioViva controlla tutto il file prima di scrivere qualcosa e importa soltanto se non ci sono errori: non esistono
importazioni a metà. Il file è un *CSV*, cioè un file di testo con una riga per copia e i dati separati da `;`, da `,`
o da tabulazione; ogni foglio di calcolo lo sa salvare. I dati del libro (titolo, autore, editore…) si ripetono sulle
righe delle sue copie.

## Procedura

### Preparare il file

1. Premere **Amministrazione**, poi **Importazioni**, poi **Catalogo**. Si apre la pagina **Importa il catalogo**.
1. Nel riquadro **Il modello del file** scegliere le colonne e premere **Scarica il modello**. Il file contiene
   soltanto la riga delle intestazioni.
1. Aprire il modello con un foglio di calcolo e scrivere una riga per ogni copia.
1. Salvare il foglio in formato CSV.

I nomi delle colonne sono in inglese e vanno lasciati come nel modello. Le principali:

| Colonna | Contenuto | Gruppo |
|---|---|---|
| `title`, `author`, `publisher` | titolo, autore (`Cognome, Nome`), editore | obbligatorie |
| `biblio_key` | il codice del libro nel vecchio programma: tiene insieme le copie dello stesso libro | chiave |
| `barcode` | il codice a barre già sulla copia | chiave |
| `classification` | il codice del genere (narrativa) o dell'argomento (saggistica) | facoltativa |
| `reading_level` | il livello di lettura (narrativa) | facoltativa |

Sono facoltative anche `isbn`, `subtitle`, `publication_place`, `publication_year`, `physical_description`, `series`,
`series_number`, `subjects`, `notes`, `call_number` (la segnatura), `item_type` (il materiale: libro, DVD…, uno per titolo), `status`,
`not_for_loan` (`sì` per le copie da consultazione), `acquisition_date` (`AAAA-MM-GG` o `GG/MM/AAAA`), `item_notes` e
altre ancora: l'elenco completo è nel riquadro **Il modello del file**. Lo stato si scrive `available`, `lost`, `damaged`,
`in_repair` o `withdrawn`; le parole italiane (disponibile, perso, danneggiato, in riparazione, ritirato) sono
accettate.

Le chiavi si possono lasciare fuori. Senza `biblio_key` le copie dello stesso libro si raggruppano per ISBN; senza
`barcode` BiblioViva genera il codice di ogni copia e alla fine si stampano le etichette. Un libro senza
`classification` viene importato lo stesso, ma finisce nell'elenco **Da classificare** e le sue copie non si prestano
finché qualcuno non lo classifica.

> [!NOTE]
> Il codice a barre di una copia non può avere la forma del numero di una tessera: le copie e le tessere non possono mai
> essere confuse (vedere [Scegliere i formati dei codici a barre](barcode-formats.md)).

### Caricare il file

1. Nel passo **File**, nel campo **File CSV**, scegliere il file e premere **Carica**.
1. Nel passo **Colonne** controllare che ogni colonna sia abbinata al campo giusto. Le colonne con i nomi del modello
   sono riconosciute da sole; per le altre scegliere il campo nel menu, oppure **— ignora —** per non usarle. La scelta
   viene ricordata per la prossima importazione.
1. Leggere gli avvisi sotto le colonne: se mancano le chiavi o la classificazione, la pagina dice che cosa succederà.
1. Se in alcune righe mancano l'autore o l'editore, spuntare la casella «Valori speciali quando mancano autore o
   editore»: nei campi vuoti BiblioViva scrive `Anonimo` e `s.n.`, come nella catalogazione. Senza la spunta quelle
   righe sono errori.
1. Premere **Verifica il file**.

### Controllare il file

1. Nel passo **Verifica** leggere la colonna **Esito** di ogni riga: **Nuovo**, **Aggiorna**, **Invariato** o **Errore**.
   La colonna **Dettagli** spiega gli errori. Per vedere solo le righe da correggere spuntare **Mostra solo gli errori**.
1. Sopra le righe la pagina riassume i titoli nuovi e quelli già in catalogo, le copie che riceveranno un codice nuovo e
   i titoli da classificare.
1. Se copie dello stesso libro hanno livelli di lettura diversi, la pagina chiede se attivare il livello per copia.
   Premere **Sì, livello per copia** per tenere il livello su ogni copia: la scelta vale per tutto il catalogo e sposta
   sulle copie il livello dei libri già presenti. Premere **No, sono errori da correggere** per correggere il file.
1. Se le copie di uno stesso titolo nuovo hanno materiali diversi, la pagina chiede **Copie dello stesso titolo con
   materiali diversi**, in un riquadro giallo. Premere **Sì, il materiale più frequente** perché ogni titolo prenda il
   materiale della maggior parte delle sue copie. Premere **No, sono errori da correggere** per correggere il file. Le
   copie aggiunte a un titolo già in catalogo tengono il materiale di quel titolo.
1. Se ci sono errori, correggere il file, premere **Torna alle colonne**, caricarlo di nuovo e verificare ancora. Con
   anche un solo errore **Importa** resta spento.

### Importare

1. Premere **Importa**. BiblioViva scrive tutto in una volta. Il passo **Completato** riassume i numeri: titoli nuovi,
   copie aggiunte, titoli già presenti, copie saltate.
1. Se alcune copie non avevano il codice a barre, premere **Stampa le etichette delle copie senza codice**: vedere
   [Stampare le etichette dei libri](../../manual/guides/print-book-labels.md).
1. Premere **Vai al catalogo** per controllare i libri.

## Risultato

I libri e le copie sono in catalogo. Le copie con un codice a barre già sulla copia tengono le etichette che hanno; le
altre hanno un codice nuovo, da stampare. I libri senza classificazione sono nell'elenco **Da classificare**: vedere
[Classificare i libri](../../manual/guides/classify-books.md). Il file originale resta conservato sul computer di
BiblioViva. Importare due volte lo stesso file non crea doppioni: le copie già presenti vengono saltate.

## Possibili problemi

### La classificazione non è nella configurazione

Compare «Classificazione non presente nella configurazione»: il codice scritto in `classification` non è né un genere
né un argomento. Correggere il file oppure aggiungere il codice: vedere
[Modificare la classificazione e i livelli di lettura](classification.md).

### Il codice è già di un'altra copia

Compare «Il codice … è già di un'altra copia in catalogo»: lo stesso codice a barre è su due libri diversi. Correggere
il codice nel file.

### Mancano l'autore o l'editore

Compare «Manca l'autore» o «Manca l'editore»: compilare la cella oppure spuntare i valori speciali.

### L'ISBN non è valido

Compare «ISBN non valido»: correggere l'ISBN o lasciare vuota la cella.

### Le copie di un titolo hanno materiali diversi

Compare «Copie con materiali diversi (…): rispondere alla domanda qui sotto», oppure, dopo **No, sono errori da
correggere**, «Copie con materiali diversi (…): il materiale è uno solo per titolo»: nel file le righe dello stesso
libro portano in `item_type` materiali diversi, ma il materiale è uno solo per titolo. Rispondere **Sì, il materiale più
frequente** oppure correggere `item_type` nel file, rendendolo uguale su tutte le righe del libro, e verificare di nuovo.

### Tutte le copie sono già in catalogo

Compare «Tutte le copie del file sono già in catalogo: non c'è niente da importare.»: il file è già stato importato.

### Il catalogo arriva da Koha

Il catalogo si estrae con una query già pronta; il file prodotto è separato da tabulazioni e va caricato com'è: vedere
[le istruzioni tecniche](../../../import/README.md). I nomi delle colonne di Koha cambiano da una versione all'altra:
chi esegue la query li controlla prima.

## Pagine correlate

- [Importare i prestiti in corso](import-loans.md)
- [Modificare la classificazione e i livelli di lettura](classification.md)
- [Scegliere i formati dei codici a barre](barcode-formats.md)
- [Catalogare un libro nuovo](../../manual/guides/catalog-a-new-book.md)
- [Importazioni](../screens/imports.md)
