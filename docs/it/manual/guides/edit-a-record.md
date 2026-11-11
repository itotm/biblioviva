# Correggere la scheda di un libro

Questa guida spiega come correggere i dati di un libro già in catalogo (titolo, autore, serie, classificazione…), come
cambiare i dati di una singola copia e come eliminare una scheda inserita per errore. Serve a chi cataloga i libri.

- Tempo: circa 2 minuti.
- Account: Catalogazione (anche Amministrazione).
- Occorrente: il libro, per confrontare i dati con il frontespizio.

## Procedura

### Correggere i dati del libro

1. Aprire la scheda del libro da **Catalogo**, vedere [Cercare un libro](find-a-book.md).
1. Premere **Modifica**. Si apre **Modifica scheda**, con il titolo del libro sotto l'intestazione.

   <!-- figure: catalog/edit-record | La pagina Modifica scheda con i dati del libro -->

1. Correggere i campi. Nella sezione **Scheda**: **Titolo**, **Sottotitolo**, **Titolo originale**, **Autore**,
   **Responsabilità (come sul frontespizio)**, **Serie** e **Numero nella serie**. Nella sezione **Pubblicazione**:
   **Editore**, **Luogo**, **Anno**, **ISBN**, **EAN (non ISBN)**, **Descrizione fisica** e **Materiale**. Il materiale
   (libro, DVD, rivista…) è uno solo per il libro e vale per tutte le sue copie; se il materiale
   è escluso dal prestito, tutte le copie non si prestano. Una singola copia si tiene fuori dal prestito con **Solo
   consultazione (non si presta)**, nei dati della copia.
1. Per correggere soggetti, note o numero Dewey aprire la sezione **Altri dati**.
1. Per cambiare la classificazione correggerla nella sezione **Classificazione**. Sotto il selettore **Segnatura delle
   copie** mostra la nuova segnatura, calcolata da BiblioViva; vedere sotto per le segnature.
1. Se compare il campo **Testo della segnatura**, correggere le lettere della segnatura, oppure lasciarlo vuoto per le
   iniziali proposte dall'autore (in grigio).
1. Premere **Salva le modifiche**. Si torna alla scheda del libro, con i dati nuovi. **Annulla** lascia tutto com'era.

### Cambiare i dati di una copia

Una copia ha dati propri, distinti da quelli del libro: **Livello della copia**, **Volume / numero**,
**Data di acquisizione**, **Note sulla copia** e **Solo consultazione (non si presta)**; con l'inventario della scuola
attivo anche **Numero d'inventario**, **Provenienza** e **Valore (€)**. La **Segnatura** della copia si
vede ma non si scrive, perché la calcola BiblioViva; un campo da scrivere compare solo con lo schema libero
(**Segnatura**) o con uno schema che prevede una parte scritta per ogni copia (**Testo della segnatura**).

1. Se il libro ha una sola copia, la sezione «Copia …» sta in fondo alla pagina **Modifica scheda**: i suoi dati si
   modificano lì e si salvano insieme alla scheda.
1. Se il libro ha più copie, aprire la scheda del libro e premere l'icona della matita sulla riga della copia (il
   suggerimento dice «Modifica copia …»). Si apre una finestra con gli stessi campi.
1. Correggere i campi e premere **Salva**. Un avviso conferma «Copia aggiornata».

Per cambiare lo stesso dato su molte copie, per esempio la data di acquisizione, selezionare i libri in
**Catalogo** e premere **Modifica le copie dei selezionati**: vedere [Togliere una copia smarrita o
rovinata](withdraw-a-copy.md#cambiare-lo-stato-di-molte-copie-insieme), dove lo strumento è descritto. Lo stesso
pulsante cambia anche il materiale di molti libri insieme, scegliendo **Materiale** in **Cosa cambiare**: il materiale è del libro,
quindi cambia per tutte le sue copie.

### Dopo avere cambiato classificazione, autore o titolo

La segnatura delle copie segue i dati del libro: correggendo in **Modifica scheda** la classificazione, l'autore o il
titolo (il titolo conta per i libri di autore «Anonimo» o «AA. VV.»), oppure il livello di una copia, BiblioViva
ricalcola subito la segnatura delle copie. BiblioViva rimette da sola la fascetta e l'etichetta con il codice a barre
tra le etichette da stampare: la copia ricompare nel riquadro **Libri senza etichette** della Dashboard e si ristampano
come descrive [Stampare le etichette dei libri](print-book-labels.md). Un libro non ancora classificato non ha
segnatura: la riceve quando viene classificato, vedere [Classificare i libri](classify-books.md).

### Eliminare una scheda inserita per errore

1. Aprire la scheda del libro.
1. Se il libro ha copie, eliminare prima le copie inserite per errore con l'icona del cestino sulla loro riga. Una copia
   già prestata non si elimina: va ritirata, vedere [Togliere una copia smarrita o rovinata](withdraw-a-copy.md).
1. Premere **Elimina scheda** (nel menu delle altre azioni se la finestra è stretta).
1. Nella finestra «Eliminare la scheda …?» premere **Elimina scheda**. Un avviso conferma «Scheda eliminata».

## Risultato

La scheda del libro mostra i dati corretti, anche nelle pagine che la elencano. Il codice a barre delle copie e i
prestiti già registrati non cambiano.

## Possibili problemi

### L'ISBN è già usato da un'altra scheda

Il salvataggio dice «Esiste già una scheda con questo ISBN»: un'altra scheda ha quell'ISBN, ed è probabile che il
libro sia stato catalogato due volte. Aprire l'altra scheda, aggiungere lì le copie e togliere la scheda doppia.

### ISBN, ISSN o EAN non validi

Compare «ISBN non valido (controllare le cifre)», «ISSN non valido» o «EAN non valido»: le cifre non tornano.
Confrontarle con il libro e correggerle, oppure lasciare il campo vuoto.

### L'anno non è plausibile

Compare «Anno non plausibile»: scrivere un anno tra 1450 e l'anno prossimo, oppure lasciare il campo vuoto.

### Autore o editore sono vuoti

Non si possono lasciare vuoti: usare «Anonimo», «AA. VV.», «s.n.» o «s.l.» sotto i campi, vedere
[Catalogare un libro senza ISBN](catalog-without-isbn.md).

### La scheda ha ancora delle copie

Compare «La scheda ha ancora N copie: prima vanno ritirate o eliminate.»: la scheda non si elimina finché ha copie.
Seguire il secondo punto dell'ultima procedura.

### La copia ha prestiti registrati

Compare «La copia ha prestiti registrati: va ritirata, non eliminata.»: una copia già prestata resta nello storico dei
prestiti: cambiare lo stato in **Ritirato**.

## Pagine correlate

- [Cercare un libro](find-a-book.md)
- [Classificare i libri](classify-books.md)
- [Togliere una copia smarrita o rovinata](withdraw-a-copy.md)
- [Aggiungere la copertina](add-a-cover.md)
- [Scheda del libro](../screens/book-record.md)
