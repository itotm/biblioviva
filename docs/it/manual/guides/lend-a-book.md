# Prestare un libro

Questa pagina spiega come registrare il prestito di uno o più libri a un utente che si presenta al banco con la
tessera. È per chi lavora al Banco prestiti con l'account Gestione prestiti.

- Tempo: meno di un minuto per ogni utente.
- Account: Gestione prestiti (anche Amministrazione).
- Occorrente: la tessera dell'utente, i libri da prestare e il lettore di codici a barre collegato al computer. Per
  chi ha dimenticato la tessera vale [Prestare a chi non ha la tessera con sé](lend-without-card.md); per un libro
  senza etichetta, [Prestare o restituire una copia senza etichetta](book-without-label.md).

## Procedura

1. Aprire **Prestiti** dal menu laterale. Si apre la pagina **Prestiti**, con il campo **Tessera o nome dell'utente**
   già pronto a ricevere la lettura.

   <!-- figure: circulation/checkout-start | La pagina Prestiti, pronta a leggere una tessera -->

1. Leggere la tessera dell'utente con il lettore. Il campo diventa **Passa il libro** e a destra compare la scheda
   dell'utente: nome, classe, quanti prestiti ha rispetto al limite (per esempio «1 di 1 prestiti») e i libri che
   ha già, ciascuno con la scadenza.

   <!-- figure: circulation/checkout-patron | La scheda dell'utente dopo la lettura della tessera -->

1. Se nella scheda compare la **Nota per il banco**, leggerla: è un avviso scritto per chi presta.
1. Leggere il codice a barre del primo libro. Un messaggio conferma il prestito con la scadenza e il libro entra
   nell'elenco **Libri prestati adesso**.
1. Leggere i libri successivi, uno dopo l'altro, senza toccare la tastiera. Ogni libro entra nell'elenco con la sua
   scadenza.

   <!-- figure: circulation/checkout-lent | Due libri prestati: l'elenco con le scadenze -->

1. Se l'ultimo libro letto non doveva essere prestato, premere **Annulla ultimo**. Il libro torna disponibile e il
   prestito viene cancellato.
1. Con le ricevute attivate, premere **Stampa ricevuta** per stampare il foglio dei libri appena prestati.
1. Premere **Fine**. La pagina torna al campo **Tessera o nome dell'utente**, pronta per l'utente successivo.

> [!NOTE]
> Con una fila di utenti, premere **Fine** a ogni persona e leggere subito la tessera successiva. Anche la lettura
> di un'altra tessera, senza premere **Fine**, passa al nuovo utente, ma l'elenco **Libri prestati adesso** del
> precedente scompare: stampare prima la ricevuta, se serve.

### Con il telefono (facoltativo)

Con l'indirizzo sicuro di Tailscale (HTTPS) il telefono può leggere le tessere e i libri con la fotocamera.

1. Premere il pulsante **Fotocamera** accanto al campo.
1. Inquadrare il codice a barre. La pagina continua come con il lettore.

## Risultato

Ogni libro letto risulta in prestito all'utente, con la scadenza calcolata dalle regole dei prestiti e dal calendario
della scuola. La scadenza compare nella scheda dell'utente, in **Libri in prestito** e nelle liste dell'account.
Se la scadenza cade in un giorno di chiusura, la pagina la sposta al primo giorno di apertura e lo dice in un
messaggio.

Le regole (giorni di prestito, numero massimo di libri, rinnovi) le imposta l'amministratore: vedere
[Impostare le regole dei prestiti](../../admin/guides/set-loan-rules.md).

## Possibili problemi

Ogni anomalia del banco compare in un messaggio che dice che cosa è successo e che cosa fare. I messaggi sono
elencati uno per uno nella pagina [Prestiti](../screens/checkout.md); qui i casi più frequenti.

### L'utente ha raggiunto il limite di prestiti

Si apre la finestra **Limite di prestiti raggiunto**, con i titoli ancora fuori, e il campo per i libri non compare.
Con le regole predefinite uno studente può avere un libro alla volta e un docente quattro.

1. Chiedere all'utente il libro che ha già.
1. Premere **Vai a Restituzioni** e registrare la restituzione leggendo il codice di quel libro, come in
   [Restituire un libro](return-a-book.md).
1. Tornare a **Prestiti** e leggere di nuovo la tessera.

Il limite non si può forzare, nemmeno con l'account Amministrazione: la restituzione si registra sempre leggendo il libro.
Restano possibili i rinnovi dei prestiti in corso ([Rinnovare un prestito](renew-a-loan.md)).

### Il libro risulta in prestito a un altro utente

Il libro è stato consegnato ma non restituito, o la restituzione non è stata registrata. Premere **Vai a Restituzioni**:
il codice letto passa alla pagina delle restituzioni, dove si conferma con Invio. Poi tornare a **Prestiti**.

### Il libro risulta già in prestito allo stesso utente

Il messaggio propone di rinnovare il prestito. Premere **Rinnova** per rinnovarlo, **Annulla** per lasciarlo com'è.

### Il libro è stato letto prima della tessera

Se il libro è disponibile, il messaggio «Il libro «`<titolo>`» non è in prestito: per prestarlo leggere prima la tessera
dell'utente.» chiede di leggere prima la tessera: leggere la tessera e poi di nuovo il libro. Se invece il libro è in
prestito, viene restituito subito e l'utente che lo aveva è scelto: vedere
[Restituire un libro e prestarne subito un altro](return-and-lend.md).

### Il codice non viene riconosciuto

Il messaggio mostra la forma dei codici di questa biblioteca. Rileggere il codice; se l'etichetta è rovinata, digitare
il codice nel campo e premere Invio. Per un libro senza etichetta o con l'etichetta illeggibile vedere
[Prestare o restituire una copia senza etichetta](book-without-label.md).

### Il libro non si può prestare

Una copia da consultazione, una copia smarrita o ritirata, un libro ancora da classificare non si prestano: il
messaggio dice quale caso è. Solo l'account Amministrazione ha il pulsante **Forza (solo admin)**, per le copie da
consultazione e per quelle in stato non disponibile (mai per una copia ritirata); la finestra chiede un motivo, che
resta nel registro del prestito. Per un libro da classificare, il pulsante **Classifica** è per l'account Catalogazione.

### L'utente ha libri in ritardo

Il messaggio elenca i libri in ritardo ma il prestito prosegue. Premere **Stampa promemoria** per stampare un foglio
per l'utente. Il prestito si blocca solo se l'amministratore ha attivato questa regola.

### La sessione si chiude da sola

Dopo due minuti senza operazioni (valore predefinito) la pagina chiude il prestito e lo dice. Leggere di nuovo la
tessera per continuare: i libri già letti sono già in prestito.

### La tessera appartiene a un utente rimosso

La tessera non è più valida. Non c'è altro da fare al banco: per una tessera nuova vedere
[Ristampare una tessera](replace-a-lost-card.md).

### Il lettore non scrive nel campo

Fare clic nel campo e leggere di nuovo. Se la lettura non produce nulla, digitare il codice a mano e premere Invio.

## Pagine correlate

- [Restituire un libro](return-a-book.md)
- [Restituire un libro e prestarne subito un altro](return-and-lend.md)
- [Rinnovare un prestito](renew-a-loan.md)
- [Prestare a chi non ha la tessera con sé](lend-without-card.md)
- [Prestiti](../screens/checkout.md)
