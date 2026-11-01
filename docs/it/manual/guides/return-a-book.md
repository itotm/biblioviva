# Restituire un libro

Questa pagina spiega come registrare la restituzione di uno o più libri, anche di una pila intera. È per chi lavora al
Banco prestiti con l'account Gestione prestiti.

- Tempo: pochi secondi per libro.
- Account: Gestione prestiti (anche Amministrazione).
- Occorrente: i libri restituiti e il lettore di codici a barre collegato al computer. La tessera dell'utente non
  serve: la restituzione si registra leggendo solo il libro.

## Procedura

1. Aprire **Restituzioni** dal menu laterale o dalle schede in alto. Si apre la pagina **Restituzioni**, con il campo
   **Passa il codice del libro restituito**.

   <!-- figure: circulation/checkin-start | La pagina Restituzioni, pronta a leggere un libro -->

1. Leggere il codice a barre del primo libro con il lettore. Un messaggio conferma la restituzione con il titolo e il
   nome dell'utente, e il libro entra nell'elenco **Libri restituiti adesso**.
1. Controllare nella riga del libro la data del prestito, la scadenza e il segnalino: «in tempo» oppure i giorni di
   ritardo.

   <!-- figure: circulation/checkin-returned | Un libro restituito in tempo e uno in ritardo -->

1. Leggere i libri successivi, uno dopo l'altro. Il campo resta pronto: ogni lettura registra subito la restituzione.
1. Se un libro è rovinato, premere **Segna danneggiato** nella sua riga. La copia risulta danneggiata ma si può ancora
   prestare.
1. Se l'utente vuole tenere il libro, premere **Rinnova invece** nella riga del libro: il prestito viene rinnovato
   al posto della restituzione ([Rinnovare un prestito](renew-a-loan.md)).
1. Rimettere i libri sugli scaffali secondo la segnatura scritta sull'etichetta.

> [!NOTE]
> I giorni di ritardo sono solo un'informazione: la restituzione si registra comunque, in tempo o in ritardo.

## Risultato

Ogni libro letto non risulta più in prestito e torna disponibile. L'utente non ha più quel libro nella sua scheda in
**Prestiti**, e la restituzione conta tra i **Restituiti oggi** della dashboard.

## Possibili problemi

I messaggi sono elencati uno per uno nella pagina [Restituzioni](../screens/checkin.md); qui i casi più frequenti.

### Il libro è restituito in ritardo

Il messaggio dice di quanti giorni e quale era la scadenza, e offre **Segna danneggiato**. Se l'utente ha altri libri
in ritardo, la riga ha anche **Stampa promemoria**, che apre un foglio con i suoi libri da restituire. Per i solleciti
di tutte le classi vedere [Stampare i solleciti](overdue-reminders.md).

### È stata letta una tessera invece di un libro

Il messaggio dice che quella è una tessera e che qui si registrano solo le restituzioni. Se l'utente vuole prendere un
libro, premere **Vai a Prestiti con questo utente**: la pagina **Prestiti** si apre già con l'utente scelto.

### Il libro non risulta in prestito

Nessuna restituzione da registrare: il libro è comunque disponibile. Capita quando un libro è stato prestato senza
registrazione, o quando la restituzione è già stata registrata. Un libro già restituito oggi mostra l'ora della
restituzione e non cambia nulla.

### Il libro era segnato come smarrito

Il messaggio dice che la copia torna disponibile. Premere **Conferma** per chiudere il messaggio.

### Il codice non viene riconosciuto

Rileggere il codice; se l'etichetta è rovinata o manca, vedere
[Prestare o restituire una copia senza etichetta](book-without-label.md). Se la lettura dà un codice che corrisponde
sia a una tessera sia a un libro (succede con i numeri del vecchio sistema), scegliere **Tessera** o **Libro**.

### Il codice arriva dalla pagina dei prestiti

Chi ha premuto **Vai a Restituzioni** da **Prestiti** trova il codice già scritto nel campo, con l'invito a premere
Invio. La restituzione si registra solo con Invio.

## Pagine correlate

- [Prestare un libro](lend-a-book.md)
- [Rinnovare un prestito](renew-a-loan.md)
- [Prestare o restituire una copia senza etichetta](book-without-label.md)
- [Stampare i solleciti](overdue-reminders.md)
- [Restituzioni](../screens/checkin.md)
