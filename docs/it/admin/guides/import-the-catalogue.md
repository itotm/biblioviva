# Importare il catalogo

Questa guida spiega come caricare in BiblioViva i libri e le copie da un file, per esempio quando si abbandona un altro
programma. Serve a chi amministra BiblioViva; di solito si fa una volta, all'avvio.

- Tempo: da 30 minuti a due ore, secondo la dimensione del catalogo e la pulizia del file.
- Account: `admin`. Un altro account può importare il catalogo solo se la configurazione dei ruoli gli concede il
  permesso **Importa catalogo**.
- Occorrente: il catalogo in un foglio di calcolo, con una riga per ogni copia, oppure un file MARC esportato da un altro
  programma di biblioteca.

BiblioViva controlla tutto il file prima di scrivere qualcosa e importa soltanto se non ci sono errori: non esistono
importazioni a metà. Il file è un *CSV*, cioè un file di testo con una riga per copia e i dati separati da `;`, da `,`
o da tabulazione; ogni foglio di calcolo lo sa salvare. I dati del libro (titolo, autore, editore…) si ripetono sulle
righe delle sue copie. Un file MARC si carica allo stesso modo: vedere [Caricare un file MARC](#caricare-un-file-marc).

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
`series_number`, `subjects`, `notes`, `call_number` (la segnatura, che BiblioViva calcola: vedere sotto), `item_type` (il materiale: libro, DVD…, uno per titolo), `status`,
`not_for_loan` (`sì` per le copie da consultazione; anche `consultazione` in `item_type` rende la copia da consultazione, senza essere il materiale del titolo), `acquisition_date` (`AAAA-MM-GG` o `GG/MM/AAAA`), `item_notes`, `inventory_number` (il numero d'inventario),
`origin` (la provenienza), `value` (il valore in euro, `12.50` o `12,50`) e `accessible_formats` (i formati accessibili del titolo) e altre ancora: l'elenco completo è nel riquadro **Il modello del file**. Lo stato si scrive `available`, `lost`, `damaged`,
`in_repair` o `withdrawn`; le parole italiane (disponibile, perso, danneggiato, in riparazione, ritirato) sono
accettate.

Le colonne `inventory_number`, `origin` e `value` riguardano l'inventario della scuola e vengono importate anche quando
l'inventario è spento: nulla del file si perde, e i valori compaiono quando lo si accende. Un numero d'inventario è di una
sola copia: la verifica rifiuta un numero scritto due volte nel file e un numero già dato a una copia del catalogo.

La colonna `accessible_formats` contiene i formati accessibili del titolo, separati da punto e virgola (per esempio
`Audiolibro; Caratteri grandi`), come nell'elenco **Formati accessibili** della Configurazione. I nomi si confrontano
con l'elenco senza badare a maiuscole e accenti. Un formato che non è nell'elenco è un errore della riga: l'importazione
resta bloccata finché non si correggono il file o l'elenco.

Le chiavi si possono lasciare fuori. Senza `biblio_key` le copie dello stesso libro si raggruppano per ISBN; senza
`barcode` BiblioViva genera il codice di ogni copia e alla fine si stampano le etichette. Un libro senza
`classification` viene importato lo stesso, ma finisce nell'elenco **Da classificare** e le sue copie non si prestano
finché qualcuno non lo classifica.

La colonna `call_number` non viene copiata così com'è: BiblioViva calcola la segnatura di ogni copia dallo schema
scelto in **Amministrazione** → **Configurazione** → **Classificazione** (vedere [Modificare la classificazione e i
livelli di lettura](classification.md#scegliere-come-si-compone-la-segnatura)). Con la parte finale «Iniziali
dell'autore, modificabili per titolo» il titolo prende dal file la parte dopo la classificazione, quella più frequente
tra le sue copie. Con l'ordine «Libera: scritta a mano su ogni copia» ogni copia tiene la segnatura del file.

> [!NOTE]
> Il codice a barre di una copia non può avere la forma del numero di una tessera: le copie e le tessere non possono mai
> essere confuse (vedere [Scegliere i formati dei codici a barre](barcode-formats.md)).

### Caricare il file

1. Nel passo **File**, nel campo **File CSV o MARC**, scegliere il file e premere **Carica**.
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
1. Se alcune copie hanno nel file una segnatura diversa da quella calcolata, la pagina chiede **Copie con una segnatura
   diversa da quella calcolata**. Premere **Sì, la segnatura calcolata** perché quelle copie prendano la segnatura
   calcolata: le loro etichette tornano tra quelle da stampare. Premere **No, sono errori da correggere** per correggere
   il file.
1. Se ci sono errori, correggere il file, premere **Torna alle colonne**, caricarlo di nuovo e verificare ancora. Con
   anche un solo errore **Importa** resta spento.

### Importare

1. Premere **Importa**. BiblioViva scrive tutto in una volta. Il passo **Completato** riassume i numeri: titoli nuovi,
   copie aggiunte, titoli già presenti, copie saltate.
1. Se alcune copie non avevano il codice a barre, premere **Stampa le etichette delle copie senza codice**: vedere
   [Stampare le etichette dei libri](../../manual/guides/print-book-labels.md).
1. Premere **Vai al catalogo** per controllare i libri.

### Caricare un file MARC

Il catalogo si importa anche da un file MARC, il formato in cui i programmi di biblioteca (Koha, SebinaNEXT, Clavis, il
catalogo SBN) si scambiano i record, e in cui BiblioViva stessa esporta il catalogo. Sono accettati i file ISO 2709
(`.mrc`, `.marc`, `.iso`) e MARCXML (`.xml`), in UNIMARC o in MARC 21. Nulla va scelto: BiblioViva riconosce il tipo dal
file. I file devono essere in UTF-8, come li scrivono Koha e SBN; un vecchio file in MARC-8 non è accettato.

1. Nel passo **File**, nel campo **File CSV o MARC**, scegliere il file MARC e premere **Carica**.
1. Nel passo **Colonne** leggere, accanto al nome del file, la riga che riassume il contenuto, per esempio «120 righe
   (una per copia) · file MARC 21 · MARCXML».
1. Controllare le colonne, già abbinate perché BiblioViva trasforma il file nelle stesse righe di un CSV, con
   l'intestazione dei nomi inglesi, e proseguire come per un CSV: la verifica e **Importa** non cambiano.

Valgono tutte le regole dell'importazione da CSV: BiblioViva controlla l'intero file, fa le stesse domande (copie dello
stesso titolo con livelli di lettura o materiali diversi, segnature diverse da quelle calcolate), offre i valori speciali
per l'autore o l'editore mancante, abilita **Importa** solo senza errori, scrive tutto in una volta e conserva il file
originale.

I numeri di riga della verifica sono quelli dell'elenco «una per copia», non righe del file: la riga 1 è la prima copia
del primo record.

Che cosa si legge da un file di un altro programma:

- del titolo: titolo, sottotitolo, responsabilità, autore, editore, luogo e anno di pubblicazione, ISBN, ISSN, EAN,
  descrizione fisica, collana e numero, classe Dewey, soggetti, note e titolo originale di una traduzione. Con tre o più
  autori personali l'autore è «AA. VV.»; senza autori è «Anonimo». Della collana si legge quella del libro, non quella
  dell'editore;
- delle copie, dal campo 952 (MARC 21) o 995 (UNIMARC): codice a barre, segnatura, materiale e il codice della
  collezione, che BiblioViva legge come classificazione (il codice di un genere o di un argomento, come nella colonna
  `classification` del CSV). Dal campo 952 si leggono anche la data di acquisizione, il volume, le note, l'esclusione dal
  prestito, lo stato (smarrita, danneggiata, ritirata), il numero d'inventario, la provenienza e il valore.

I codici a barre sono riconosciuti secondo i formati della biblioteca, quindi anche i codici dei vecchi sistemi restano
validi.

Un record senza copie dà una riga senza codice a barre: l'importazione crea una copia con un codice generato, come per una
riga di CSV senza `barcode`. Un record del catalogo SBN non ha né copie né classificazione: i suoi titoli vanno
nell'elenco **Da classificare**.

Un file esportato da BiblioViva stessa (menu **Esporta** del [Catalogo](../../manual/screens/catalog.md#esportazione))
si rilegge con tutti i dati, perché porta due campi locali, che gli altri programmi ignorano.

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

### Il numero d'inventario è già usato

Compare «Numero d'inventario già usato alla riga N» (il numero è scritto due volte nel file) oppure «Il numero d'inventario …
è già di un'altra copia in catalogo». Correggere il numero nel file.

### Il formato accessibile non è nell'elenco

Compare «Formato accessibile non previsto dalla configurazione: «Braille»» (il nome è quello scritto nel file): un nome
di `accessible_formats` non è tra i formati dell'elenco **Formati accessibili**. Correggere il nome nel file oppure
aggiungerlo all'elenco, in **Amministrazione** → **Configurazione** → **Catalogo**, e verificare di nuovo.

### Mancano l'autore o l'editore

Compare «Manca l'autore» o «Manca l'editore»: compilare la cella oppure spuntare i valori speciali.

### L'ISBN non è valido

Compare «ISBN non valido»: correggere l'ISBN o lasciare vuota la cella.

### Le copie di un titolo hanno materiali diversi

Compare «Copie con materiali diversi (…): rispondere alla domanda qui sotto», oppure, dopo **No, sono errori da
correggere**, «Copie con materiali diversi (…): il materiale è uno solo per titolo»: nel file le righe dello stesso
libro portano in `item_type` materiali diversi, ma il materiale è uno solo per titolo. Rispondere **Sì, il materiale più
frequente** oppure correggere `item_type` nel file, rendendolo uguale su tutte le righe del libro, e verificare di nuovo.

### Le copie hanno una segnatura diversa da quella calcolata

Compare «Segnatura nel file …, calcolata …: rispondere alla domanda qui sotto» oppure, dopo **No, sono errori da
correggere**, «Segnatura nel file … diversa da quella calcolata …»: la segnatura scritta in `call_number` non coincide
con quella che BiblioViva calcola dallo schema. Rispondere **Sì, la segnatura calcolata**, oppure correggere
`call_number` nel file, oppure cambiare lo schema nella classificazione (con l'ordine «Libera: scritta a mano su ogni
copia» il file viene tenuto com'è), e verificare di nuovo.

### Tutte le copie sono già in catalogo

Compare «Tutte le copie del file sono già in catalogo: non c'è niente da importare.»: il file è già stato importato.

### Il catalogo arriva da Koha

Il catalogo si estrae con una query già pronta; il file prodotto è separato da tabulazioni e va caricato com'è: vedere
[le istruzioni tecniche](../../../import/README.md). I nomi delle colonne di Koha cambiano da una versione all'altra:
chi esegue la query li controlla prima. In alternativa Koha esporta i record in MARC 21 e il file si carica come
descritto in [Caricare un file MARC](#caricare-un-file-marc).

## Pagine correlate

- [Importare i prestiti in corso](import-loans.md)
- [Modificare la classificazione e i livelli di lettura](classification.md)
- [Scegliere i formati dei codici a barre](barcode-formats.md)
- [Catalogare un libro nuovo](../../manual/guides/catalog-a-new-book.md)
- [Importazioni](../screens/imports.md)
