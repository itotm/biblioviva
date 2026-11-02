# Catalogare un libro senza ISBN

Questa guida spiega come inserire in catalogo un libro che non ha il codice ISBN, per esempio un libro vecchio, un
fumetto, un libro fatto dalla scuola o un DVD: la scheda si cerca per titolo e autore oppure si scrive a mano. Serve a
chi cataloga i libri.

- Tempo: da 2 a 5 minuti per libro.
- Account: Catalogazione (anche Amministrazione).
- Occorrente: il libro, con il frontespizio davanti per copiare titolo, autore ed editore; la connessione a Internet del
  computer di BiblioViva per la ricerca per titolo; il lettore di codici a barre USB per un DVD che ha il codice EAN.

Il libro senza ISBN non ha un codice a barre proprio che BiblioViva possa leggere al banco. Ogni copia riceve da
BiblioViva un codice, che si stampa su un'etichetta da incollare sul libro: vedere
[Stampare le etichette dei libri](print-book-labels.md).

## Procedura

### Cercare la scheda per titolo e autore

1. Aprire **Catalogo** e premere **Nuovo libro**.
1. In **Materiale** scegliere il tipo di materiale, se non è quello già selezionato.
1. Premere **Senza codice**. Si apre la pagina «Cerca per titolo e autore».

   <!-- figure: catalog/new-book-search | La ricerca per titolo e autore della pagina Nuovo libro -->

1. Scrivere il **Titolo**, l'**Autore** o entrambi, poi premere **Cerca**. Basta uno dei due campi: se sono vuoti
   compare «Scrivere almeno il titolo o l'autore.».
1. Attendere l'elenco **Schede trovate**. Le schede sono in ordine di completezza: la prima porta l'etichetta **La più
   completa**. Ogni scheda mostra titolo, autore, editore, anno e descrizione.
1. Confrontare la scheda con il libro in mano (anno, editore, numero di pagine) e premere **Usa questa scheda** su
   quella giusta. Si apre il modulo **Scheda e copie** con i dati già scritti.
1. Proseguire dal controllo dei dati come in [Catalogare un libro nuovo](catalog-a-new-book.md): serie, classificazione,
   copie, **Salva scheda e copie**.

### Compilare la scheda a mano

Quando nessuna scheda corrisponde al libro, o l'elenco è vuoto, la scheda si scrive a mano.

1. Premere **Compila a mano** nella pagina «Cerca per titolo e autore». Dall'elenco delle schede trovate lo stesso
   pulsante si chiama **Inserisci a mano**. Si apre il modulo, con l'avviso «Scheda compilata a mano.».

   <!-- figure: catalog/new-book-manual | Il modulo della scheda compilata a mano -->

1. Scrivere il **Titolo**, come sul frontespizio. Il **Sottotitolo** si scrive solo se c'è.
1. Se il libro è una traduzione, scrivere in **Titolo originale** il titolo nella lingua originale.
1. Scrivere l'**Autore** come «Cognome, Nome». Senza autore personale premere «Anonimo» (autore sconosciuto) oppure
   «AA. VV.» (opera di più autori).
1. Scrivere l'**Editore**. Se non si conosce premere «s.n.» (senza nome). Il **Luogo** si scrive se si conosce,
   altrimenti si preme «s.l.» (senza luogo).
1. Scrivere l'**Anno** di pubblicazione con quattro cifre. Con un anno sconosciuto lasciare il campo vuoto.
1. Scrivere nella **Descrizione fisica** pagine, illustrazioni e formato, in un'unica riga (per esempio «120 p. : ill. ;
   24 cm»).
1. Se il libro fa parte di una serie, scrivere **Serie** e **Numero nella serie**.
1. Scegliere la classificazione e scrivere le copie come in [Catalogare un libro nuovo](catalog-a-new-book.md), poi
   premere **Salva scheda e copie**.

### DVD e altri materiali con il codice EAN

1. Aprire **Nuovo libro** e scegliere in **Materiale** il tipo giusto, per esempio DVD.
1. Leggere con il lettore il codice a barre della confezione. BiblioViva riconosce che è un EAN e non un ISBN: salta la
   ricerca, apre il modulo e scrive il codice nel campo **EAN (non ISBN)**, con l'avviso «EAN … letto: non è un ISBN,
   quindi la scheda va compilata a mano.».
1. Compilare la scheda come descritto sopra e premere **Salva scheda e copie**.

## Risultato

Il libro ha una scheda e una o più copie con il codice generato da BiblioViva. Il passo successivo è stampare le
etichette e incollarle: finché il libro non ha il codice sulla copertina, al banco prestiti non si può leggere.

## Possibili problemi

### La ricerca per titolo non trova niente

Compare «Nessuna scheda trovata. La scheda si può compilare a mano.». Provare con meno parole o con il solo cognome
dell'autore (premere **Nuovo codice** e ripetere **Senza codice**), oppure compilare la scheda a mano.

### Il servizio non è raggiungibile

Compare «Il servizio non è raggiungibile…»: il computer di BiblioViva non raggiunge OPAC SBN. Premere **Riprova** o
compilare la scheda a mano: i dati scritti a mano sono validi quanto quelli trovati.

### L'anno non è plausibile

Il salvataggio dice «Anno non plausibile»: l'anno non è un numero compreso tra 1450 e l'anno prossimo. Correggerlo o
lasciare il campo vuoto.

### L'ISBN non è valido

Il salvataggio dice «ISBN non valido (controllare le cifre)»: il libro ha un ISBN ma è stato scritto male. Leggerlo di
nuovo con il lettore o correggere le cifre nel campo **ISBN**.

### Autore ed editore mancano

Sono obbligatori. Usare «Anonimo», «AA. VV.», «s.n.» o «s.l.», che BiblioViva riconosce come valori ammessi.

## Pagine correlate

- [Catalogare un libro nuovo](catalog-a-new-book.md)
- [Aggiungere una copia a un libro già in catalogo](add-a-copy.md)
- [Classificare i libri](classify-books.md)
- [Stampare le etichette dei libri](print-book-labels.md)
- [Nuovo libro](../screens/new-book.md)
