# Aggiungere una copia a un libro già in catalogo

Questa guida spiega come aggiungere una o più copie a un libro che ha già la scheda, per esempio quando la biblioteca
riceve un secondo esemplare o un dono dello stesso titolo. Serve a chi cataloga i libri.

- Tempo: circa 1 minuto.
- Account: Catalogazione (anche Amministrazione).
- Occorrente: il libro e, per il primo metodo, il lettore di codici a barre USB.

Ogni copia ha un proprio codice, generato da BiblioViva, e un'etichetta propria. La scheda del libro (titolo, autore,
classificazione) resta una sola e non si scrive di nuovo.

## Procedura

### Aggiungere la copia leggendo l'ISBN

1. Aprire **Catalogo** e premere **Nuovo libro**.
1. In **Materiale** scegliere il tipo delle copie, se non è quello già selezionato.
1. Leggere con il lettore il codice a barre dell'ISBN. BiblioViva trova la scheda già in catalogo e mostra «Questo ISBN
   è già in catalogo», con il titolo e il numero di copie che il libro ha già.

   <!-- figure: catalog/new-book-duplicate | La pagina Nuovo libro davanti a un ISBN già in catalogo -->

1. Scrivere nel campo **Numero di copie** quante copie si aggiungono.
1. Premere **Aggiungi copia**. Si apre la conferma, con il riepilogo «N copie aggiunte a …» e i **Codici delle copie**.
   La **Segnatura** delle nuove copie viene proposta dalla classificazione del libro.
1. Per proseguire premere **Aggiungi un altro** (il libro successivo), **Stampa etichette** oppure **Apri la scheda**.

### Aggiungere la copia dalla scheda del libro

Questo metodo serve per un libro senza ISBN o quando serve cambiare segnatura, livello o altri dati della copia.

1. Aprire **Catalogo** e cercare il libro, vedere [Cercare un libro](find-a-book.md). Aprire la sua scheda.
1. Premere **Aggiungi copie**. Se la finestra del browser è stretta il pulsante sta nel menu delle altre azioni
   in alto. Si apre la finestra «Aggiungi copie».

   <!-- figure: catalog/add-copies-dialog | La finestra Aggiungi copie sulla scheda di un libro -->

1. Scrivere il **Numero di copie** (da 1 a 100).
1. Scegliere il **Materiale** della copia.
1. Lasciare vuota la **Segnatura** per usare quella proposta dalla classificazione (la proposta si vede in grigio nel
   campo), oppure scriverne una diversa. La segnatura è la sigla che dice dove va il libro sullo scaffale, per esempio
   `B 4 DEL` o `590 ROS`.
1. Se la biblioteca assegna il livello di lettura a ogni copia, scegliere il **Livello della copia**.
1. Se il libro è in più volumi, scrivere il numero nel campo **Volume / numero**.
1. Controllare la **Data di acquisizione** e, se serve, scrivere una nota in **Note sulla copia**.
1. Se la copia non deve uscire dalla biblioteca, per esempio un volume da consultare in sede, spuntare **Solo
   consultazione (non si presta)**.
1. Premere **Aggiungi**. Un avviso conferma «N copie aggiunte» con i codici assegnati, e le copie compaiono nella scheda
   **Copie**.
1. Per stampare le etichette premere **Stampa etichette** in alto nella scheda, oppure l'icona della stampante sulla
   riga della copia, vedere [Stampare le etichette dei libri](print-book-labels.md).

## Risultato

La scheda del libro mostra le copie in più, ciascuna con il suo codice, la segnatura e lo stato **Disponibile**. Il
numero in alto, «N disponibili su M», comprende le nuove copie. La colonna **Etichette** dice **Etichette da stampare**
finché non si stampano le etichette.

## Possibili problemi

- Il libro ha già la scheda ma non si trova leggendo l'ISBN: la scheda è stata scritta senza ISBN, oppure con un ISBN
  diverso (un'altra edizione). Cercarla per titolo in **Catalogo** e usare il secondo metodo.
- Compare «Da 1 a 100 copie alla volta»: il numero di copie è fuori dai limiti. Aggiungere meno copie per volta.
- La scheda è marcata «Da classificare»: le copie si aggiungono lo stesso, ma non si prestano e non hanno una
  segnatura finché il libro non è classificato, vedere [Classificare i libri](classify-books.md).
- La copia aggiunta è di un libro in più volumi: aggiungere una copia per volta, scrivendo il numero in **Volume /
  numero**.
- Si è aggiunta una copia per sbaglio: una copia che non è mai stata prestata si elimina dalla sua riga con l'icona
  del cestino, che chiede conferma; una copia già prestata si toglie come in
  [Togliere una copia smarrita o rovinata](withdraw-a-copy.md).

## Pagine correlate

- [Catalogare un libro nuovo](catalog-a-new-book.md)
- [Cercare un libro](find-a-book.md)
- [Stampare le etichette dei libri](print-book-labels.md)
- [Togliere una copia smarrita o rovinata](withdraw-a-copy.md)
- [Scheda del libro](../screens/book-record.md)
