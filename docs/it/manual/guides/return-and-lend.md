# Restituire un libro e prestarne subito un altro

Questa pagina spiega come registrare la restituzione di un libro e il prestito del successivo quando l'utente li
porta insieme al banco. È per chi lavora al Banco prestiti con l'account Gestione prestiti.

- Tempo: meno di un minuto.
- Account: Gestione prestiti (anche Amministrazione).
- Occorrente: il libro restituito, il libro scelto dall'utente e il lettore di codici a barre collegato al computer. La
  tessera non serve: l'utente è quello che aveva il libro.

## Procedura

1. Aprire **Prestiti** dal menu laterale. Si apre la pagina **Prestiti**, con il campo **Tessera o nome dell'utente**
   già pronto a ricevere la lettura.
1. Leggere il codice a barre del libro restituito. Il libro viene restituito e compare il messaggio «Restituito:
   «`<titolo>`». Ora i libri letti si prestano a `<nome>`.» Il campo diventa **Passa il libro** e a destra compare la
   scheda dell'utente che aveva il libro.
1. Leggere il codice a barre del libro scelto dall'utente. Un messaggio conferma il prestito con la scadenza e il
   libro entra nell'elenco **Libri prestati adesso**.
1. Leggere gli altri libri, se ce ne sono, uno dopo l'altro.
1. Premere **Fine**. La pagina torna al campo **Tessera o nome dell'utente**, pronta per l'utente successivo.

In alternativa si parte da **Restituzioni**: dopo la restituzione di un libro, premere **Presta a `<nome>`** nel
messaggio. Si apre **Prestiti** con l'utente già scelto, pronto a ricevere il libro successivo.

> [!NOTE]
> L'utente resta scelto finché si legge un'altra tessera, si preme **Fine** o la pagina si chiude da sola dopo i
> minuti di inattività impostati dall'amministratore.

## Risultato

Il primo libro non risulta più in prestito e torna disponibile; il libro successivo risulta in prestito allo stesso
utente, con la scadenza calcolata dalle regole dei prestiti. La restituzione conta tra i **Restituiti oggi** della
dashboard, come ogni altra.

## Possibili problemi

### Il libro restituito era in ritardo

Oltre al messaggio verde compare «Restituito. «`<titolo>`» era in ritardo di `<n>` giorni (scadenza `<data>`).» Il
ritardo è solo un'informazione: la restituzione è registrata e il prestito del libro successivo prosegue.

### Il libro restituito era segnato come smarrito

Compare anche il messaggio [Libro smarrito ritrovato](../screens/checkin.md#libro-smarrito-ritrovato). La copia è di
nuovo disponibile e il prestito del libro successivo prosegue.

### L'utente ha raggiunto il limite di prestiti

Se dopo la restituzione l'utente ha ancora il numero massimo di libri, si apre la finestra **Limite di prestiti
raggiunto**, come dopo la lettura della tessera. Vedere [Prestare un libro](lend-a-book.md#possibili-problemi).

### Il libro letto non è in prestito

Un libro disponibile, letto senza utente scelto, non si restituisce: compare «Il libro «`<titolo>`» non è in prestito: per
prestarlo leggere prima la tessera dell'utente.» Leggere la tessera dell'utente e poi di nuovo il libro. Un libro
già restituito oggi mostra l'ora della restituzione e non cambia nulla.

### La sessione si chiude da sola

Dopo il tempo di inattività la pagina chiude l'operazione e lo dice. Leggere di nuovo la tessera dell'utente per
continuare.

## Pagine correlate

- [Prestare un libro](lend-a-book.md)
- [Restituire un libro](return-a-book.md)
- [Prestiti](../screens/checkout.md)
- [Restituzioni](../screens/checkin.md)
