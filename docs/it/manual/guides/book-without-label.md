# Prestare o restituire una copia senza etichetta

Questa pagina spiega come registrare il prestito o la restituzione di un libro che non ha l'etichetta con il codice a
barre, o che ce l'ha ma il lettore non la legge. Ogni copia ha un codice anche quando l'etichetta manca: il codice
si trova nel programma e si scrive a mano. È per chi lavora al Banco prestiti con l'account Gestione prestiti.

- Tempo: da uno a due minuti.
- Account: Gestione prestiti (anche Amministrazione) per prestare e restituire; Catalogazione per stampare di nuovo
  l'etichetta.
- Occorrente: il titolo del libro; per una restituzione, anche il cognome di chi lo aveva.

## Procedura

### Prestare un libro senza etichetta

1. Aprire **Catalogo** dal menu laterale.
1. Scrivere il titolo nel campo **Cerca per titolo, autore o ISBN…** (almeno tre lettere). Compare l'elenco dei libri.
1. Fare clic sulla riga del libro. Si apre la **Scheda del libro**.
1. Aprire la scheda **Copie**. Per ogni copia la tabella mostra il **Codice** e lo **Stato**.

   <!-- figure: circulation/record-copies | La scheda Copie di un libro, con i codici delle copie -->

1. Se il libro ha una sola copia, annotare il suo codice. Se ne ha più d'una, vedere
   [Possibili problemi](#possibili-problemi).
1. Aprire **Prestiti** e leggere la tessera dell'utente.
1. Scrivere il codice della copia nel campo **Passa il libro** e premere Invio. Il prestito si registra come con il
   lettore.
1. Premere **Fine**.

### Restituire un libro senza etichetta

1. Aprire **Libri in prestito**.
1. Scrivere nel campo **Cerca per cognome o codice del libro** il cognome di chi aveva il libro. Compare l'elenco dei
   suoi prestiti.
1. Trovare il libro per titolo e leggere il suo codice nella colonna **Codice**.

   <!-- figure: circulation/loans-search-surname | I prestiti di un utente, con il codice di ogni copia -->

1. Aprire **Restituzioni**.
1. Scrivere il codice nel campo **Passa il codice del libro restituito** e premere Invio. La restituzione si
   registra come con il lettore.

## Risultato

Il prestito o la restituzione sono registrati sulla copia giusta. I codici sono scritti come nella tabella, con il
trattino (per esempio `2026-E0267`).

## Possibili problemi

### Il titolo ha più copie e non si sa quale è quella in mano

Non prestare una copia scelta a caso: il prestito finirebbe sulla copia sbagliata e l'inventario la troverebbe fuori
posto. Chiedere all'account Catalogazione di stampare di nuovo l'etichetta, come in
[Stampare le etichette dei libri](print-book-labels.md), poi prestare il libro con il lettore. L'account Catalogazione
vede i libri che aspettano l'etichetta nel riquadro **Libri senza etichette** della dashboard.

### Il codice scritto a mano non viene accettato

Il messaggio dice che il codice non è stato trovato o che il carattere di controllo non corrisponde: controllare le
lettere e le cifre e riscrivere il codice. Le forme dei codici della biblioteca sono scritte nel messaggio.

### Il libro non ha mai avuto un codice

Non è in catalogo: l'account Catalogazione deve schedarlo prima ([Catalogare un libro nuovo](catalog-a-new-book.md)).

### Il cognome non trova nulla in Libri in prestito

La pagina mostra i prestiti solo dopo tre lettere di ricerca o con un filtro. Scrivere più lettere, oppure togliere i
filtri con **Togli i filtri**. Se l'utente non ha prestiti, il libro non risulta in prestito: per sapere a chi, aprire
la **Scheda del libro** del Catalogo e leggere la colonna **In prestito a**.

## Pagine correlate

- [Prestare un libro](lend-a-book.md)
- [Restituire un libro](return-a-book.md)
- [Cercare un libro](find-a-book.md)
- [Stampare le etichette dei libri](print-book-labels.md)
