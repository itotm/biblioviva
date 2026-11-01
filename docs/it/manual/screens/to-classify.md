# Da classificare

La pagina **Da classificare** elenca i libri messi in catalogo senza genere né argomento, dal più vecchio. Serve per
classificarli uno dopo l'altro: finché un libro non è classificato le sue copie non si prestano e la fascetta del dorso
non si stampa.

La pagina si apre dalla scheda **Da classificare** del [Catalogo](catalog.md) e dal riquadro della dashboard che conta
i libri da classificare (compare solo se ce ne sono). La usano gli account «Catalogazione» e «Amministrazione». La
procedura è in [Classificare i libri](../guides/classify-books.md).

<!-- figure: catalog/to-classify-list | L'elenco dei libri da classificare -->

Nella figura:

1. Le schede dell'area catalogo: [Elenco](#elenco).
1. Il pulsante **Inizia a classificare**: [Elenco](#elenco).
1. Il conteggio e la spiegazione: [Elenco](#elenco).
1. La tabella dei libri: [Elenco](#elenco).

## Elenco

In alto, accanto alle schede dell'area (**Catalogo**, **Inventario**, **Da classificare**), il pulsante **Inizia a
classificare** apre il primo libro dell'elenco, cioè il più vecchio. Sotto, una riga dice «N libri da classificare» e
ricorda: «I libri inseriti senza classificazione, dal più vecchio. Le loro copie non si prestano finché non sono
classificate.»

Le colonne della tabella sono **Titolo**, **Autore**, **Editore**, **Anno**, **ISBN**, **Copie** e **Inserito il**. Un
clic su una riga apre la pagina [Classifica il libro](#classifica-il-libro) di quel libro.

Quando non c'è più nulla da classificare, la pagina scrive **Nessun libro da classificare** e «Tutti i libri del
catalogo hanno un genere o un argomento.»

Un libro entra in questo elenco quando viene salvato con **Classifica dopo** (nel modulo del libro, in Nuovo libro o
nell'importazione del catalogo) oppure quando l'importazione non porta la classificazione.

## Classifica il libro

La pagina **Classifica il libro** propone un libro alla volta. Si apre da **Inizia a classificare**, da una riga
dell'elenco, dal pulsante **Classifica** della [Scheda del libro](book-record.md) e dal banco
prestiti, quando una copia è stata rifiutata perché il libro non è classificato. In alto il pulsante di ritorno porta
all'elenco **Da classificare**.

<!-- figure: catalog/classify-flow | La pagina Classifica il libro con la scelta del genere e la segnatura proposta -->

Nella figura:

1. I dati che aiutano a classificare: [Dati del libro](#dati-del-libro).
1. La proposta del numero Dewey: [Proposta dal numero Dewey](#proposta-dal-numero-dewey).
1. La scelta del tipo e del genere o dell'argomento: [Scelta della classificazione](#scelta-della-classificazione).
1. La segnatura delle copie: [Segnatura delle copie](#segnatura-delle-copie).
1. I pulsanti **Salva e avanti**, **Salta** e **Torna all'elenco**: [Pulsanti](#pulsanti).

### Dati del libro

Il riquadro in alto mostra quanto serve per decidere: la copertina (se le copertine sono attive), il titolo (un
collegamento alla scheda), il sottotitolo, l'autore, l'editore, l'anno, la serie, l'ISBN, il numero delle copie e, se
presenti, i **Soggetti** e le **Note**.

### Proposta dal numero Dewey

Se il libro ha un numero Dewey, la pagina dice «Il numero Dewey N corrisponde all'argomento X» e sceglie da sola
Saggistica e quell'argomento. La scelta si può cambiare.

### Scelta della classificazione

La scelta è la stessa del modulo del libro (vedere [Sezione Classificazione](book-record.md#sezione-classificazione)),
senza **Classifica dopo**: **Narrativa** con il genere (e il livello di lettura, se previsto), oppure **Saggistica** con
l'argomento. **Salva e avanti** resta spento finché non è stato scelto un genere o un argomento.

### Segnatura delle copie

Appena scelta la classificazione, la pagina scrive **Segnatura delle copie** con la segnatura che le copie riceveranno.
La nota spiega: «Le copie senza segnatura prendono questa; poi la fascetta si può stampare.»

### Pulsanti

- **Salva e avanti** salva la classificazione e apre il libro seguente da classificare. Un messaggio conferma «titolo»
  classificato.
- **Salta** lascia il libro com'è e passa al seguente.
- **Torna all'elenco** riporta all'elenco **Da classificare**.

Quando non restano altri libri la pagina scrive «Non ci sono altri libri da classificare in questo giro.» con il
pulsante **Torna all'elenco**.

### Libro già classificato

Se si apre la pagina di un libro che nel frattempo è stato classificato, la pagina scrive «Questo libro è già
classificato.» e lascia solo **Salta** e **Torna all'elenco**.

Dopo la classificazione le copie si possono prestare e la fascetta del dorso compare tra le etichette da stampare.

## Pagine correlate

- [Scheda del libro](book-record.md)
- [Catalogo](catalog.md)
- [Nuovo libro](new-book.md)
- [Classificare i libri](../guides/classify-books.md)
