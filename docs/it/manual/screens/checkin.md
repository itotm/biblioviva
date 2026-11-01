# Restituzioni

La pagina **Restituzioni** serve a registrare i libri che tornano in biblioteca. Si legge il codice a barre di ogni
libro con il lettore: la restituzione è registrata subito, senza leggere la tessera dell'utente. La pagina la
aprono gli account che hanno il permesso dei prestiti («Gestione prestiti» e «Amministrazione»), con la scheda
**Restituzioni** del banco prestiti, con il pulsante **Restituzioni** della [dashboard](dashboard.md) o dai messaggi di
[Prestiti](checkout.md) che propongono **Vai a Restituzioni**. Per la procedura passo per passo vedere
[Restituire un libro](../guides/return-a-book.md).

<!-- figure: circulation/checkin-done | Restituzioni dopo due libri riportati, uno dei quali in ritardo -->

1. [Campo del codice](#campo-del-codice).
1. [Messaggi del banco](#messaggi-del-banco): l'esito dell'ultima lettura.
1. [Libri restituiti adesso](#libri-restituiti-adesso).
1. [Pulsanti di ogni riga](#pulsanti-di-ogni-riga).

## Campo del codice

Il campo si chiama **Passa il codice del libro restituito**, con il suggerimento «Un libro dopo l'altro: ogni codice
registra subito la restituzione.» Resta pronto dopo ogni lettura: una pila di libri si registra leggendo un codice dopo
l'altro, senza toccare la tastiera o il mouse. Il codice si legge con il lettore di codici a barre, che invia anche il
tasto Invio, oppure si scrive a mano e si preme Invio.

Il pulsante **Fotocamera** accanto al campo legge il codice con la fotocamera del telefono. È facoltativo e funziona
solo se BiblioViva è aperto con una connessione sicura (https, cioè con Tailscale).

Aprendo la pagina da un messaggio di [Prestiti](checkout.md) con il pulsante **Vai a Restituzioni**, il campo contiene
già il codice del libro: la restituzione si registra solo premendo Invio, mai da sola (vedere
[Codice in attesa](#codice-in-attesa)).

## Messaggi del banco

Sotto il campo compare l'esito di ogni lettura. Ogni messaggio dice che cosa è successo e che cosa fare, ha un colore,
un'icona e il testo (il colore non è mai l'unico segno) e, quando serve, uno o più pulsanti. Rosso: l'operazione non è
stata fatta; giallo: da controllare; azzurro: informazione; verde: operazione riuscita. Il banco non emette suoni di
avviso.

I messaggi sono descritti qui sotto, ciascuno con il testo esatto. Nei testi, `<titolo>`, `<nome>`, `<data>` e simili
stanno al posto dei dati veri; i titoli lunghi sono abbreviati a 40 caratteri. Il ritardo è solo un'informazione: non
cambia nulla per l'utente.

## Conferme

### Restituzione registrata

> Restituito: «`<titolo>`» (`<nome>`).

Il libro era in prestito ed era in tempo: ora è disponibile e compare in **Libri restituiti adesso**. Nessuna azione è
richiesta: leggere il libro successivo.

### Restituzione in ritardo

> Restituito. «`<titolo>`» era in ritardo di `<n>` giorni (scadenza `<data>`).

Il libro è stato registrato come restituito, ma la scadenza era passata. Il messaggio è giallo, con il pulsante
**Segna danneggiato** (vedere [Copia segnata come danneggiata](#copia-segnata-come-danneggiata)) da usare se il libro
tornato è rovinato. Se l'utente ha altri libri in ritardo, nella riga compare **Stampa promemoria**.

### Libro smarrito ritrovato

> «`<titolo>`» era segnato come smarrito: ora torna disponibile.

Il libro era stato segnato come smarrito e ora è tornato. Compare insieme a «Restituito…» se il libro era anche in
prestito, da solo se non lo era. BiblioViva lo ha già rimesso tra i disponibili. Premere **Conferma** per chiudere il
messaggio.

### Copia segnata come danneggiata

> «`<titolo>`» è segnato come danneggiato: si può ancora prestare.

Conferma **Segna danneggiato**: la copia ha ora lo stato «danneggiato», visibile nella scheda del libro, ma si presta
ancora. Per toglierla dal prestito vedere [Togliere una copia smarrita o rovinata](../guides/withdraw-a-copy.md).

### Rinnovo al posto della restituzione

> Rinnovato invece di restituito: «`<titolo>`», nuova scadenza `<data>`.

Conferma **Rinnova invece**: l'utente voleva tenere il libro. La riga mostra «rinnovato fino al `<data>`» e i suoi
pulsanti scompaiono. Il libro non risulta restituito.

### Codice in attesa

> Premere Invio per registrare la restituzione del libro `<codice>`.

Compare quando la pagina è stata aperta da [Prestiti](checkout.md) con il codice già nel campo. La restituzione non è
ancora registrata: premere Invio per confermarla.

## Letture da spiegare

### Libro non in prestito

> «`<titolo>`» non risulta in prestito: nessuna restituzione da registrare. Se era prestato senza registrazione, il libro
> è comunque disponibile.

Il codice è di una copia che non ha prestiti aperti: per esempio era stata prestata senza leggere la tessera, o è
tornata più volte. Il messaggio è informativo. Nessuna azione è richiesta: il libro risulta disponibile e può tornare
sullo scaffale.

### Libro già restituito oggi

> «`<titolo>`» è già stato restituito oggi alle `<ora>`.

La stessa copia è stata letta una seconda volta nella giornata, di solito per distrazione. Non è stato registrato nulla
di nuovo. Nessuna azione è richiesta.

### Tessera letta al posto di un libro

> Questa è una tessera (`<nome>`), non un libro. Qui si registrano solo le restituzioni: per un prestito aprire
> Prestiti.

È stato letto il codice di una tessera. Se l'utente vuole prendere un libro, premere
**Vai a Prestiti con questo utente**: [Prestiti](checkout.md) si apre con l'utente già scelto. Se si stavano
restituendo libri, leggere il codice del libro.

### Codice di tessera e di copia insieme

> Il codice `<codice>` corrisponde sia a una tessera (`<nome>`) sia a un libro (`<titolo>`). Scegliere quale dei due.

Alcuni vecchi numeri, precedenti all'attuale formato dei codici, sono uguali per una tessera e per una copia. Premere
**Libro** per registrare la restituzione della copia, oppure **Tessera** per trattare il codice come una tessera: compare
il messaggio di [Tessera letta al posto di un libro](#tessera-letta-al-posto-di-un-libro).

### Codice non trovato

> Codice `<codice>` non trovato. Verificare la lettura dello scanner o digitare il codice: i codici dei libri hanno la
> forma `<esempio di copia>`, i numeri delle tessere `<esempio di tessera>`.

Il codice non corrisponde a nessuna tessera né a nessuna copia; il messaggio mostra la forma dei codici della
biblioteca. Premere **Riprova** per leggere di nuovo, oppure scrivere il codice; per cercare il libro dal titolo
premere **Cerca per titolo**, che apre il [catalogo](catalog.md). Se il libro non ha un'etichetta leggibile vedere
[Prestare o restituire una copia senza etichetta](../guides/book-without-label.md).

### Codice con carattere di controllo errato

> Il codice `<codice>` non è valido: il carattere di controllo non corrisponde. Rileggere il codice o digitarlo.

L'ultimo carattere del codice non torna: di solito l'etichetta è sporca o il lettore ha letto male. Premere **Riprova**
e leggere di nuovo. Sotto il campo compare anche l'avviso «Il codice della copia ha un carattere di controllo errato:
ripetere la lettura.»

## Rinnovo rifiutato

Se **Rinnova invece** non è consentito, al posto della conferma compare uno dei tre messaggi seguenti, senza pulsanti:
il libro resta restituito e la riga non cambia.

### Limite di rinnovi raggiunto

> «`<titolo>`» è già stato rinnovato `<n>` volte, il massimo. Deve essere restituito.

Il libro è già stato rinnovato quante volte le regole consentono. Nessuna azione è richiesta: la restituzione è già
registrata.

### Rinnovo bloccato dal ritardo

> «`<titolo>`» è in ritardo di `<n>` giorni e le regole non consentono il rinnovo.

Le regole non permettono di rinnovare un libro già scaduto. La restituzione resta registrata.

### Rinnovo oltre la scadenza massima

> «`<titolo>`» non si può rinnovare: la scadenza è già il `<data>`, l'ultimo giorno di prestito di quest'anno.

Un rinnovo supererebbe la data massima dei prestiti. La restituzione resta registrata.

## Libri restituiti adesso

La sezione **Libri restituiti adesso** elenca i libri registrati da quando la pagina è stata aperta, l'ultimo in cima.
Finché è vuota: «Leggere il codice dei libri restituiti.» Ogni riga mostra:

- il codice della copia e il titolo;
- il nome dell'utente che aveva il libro, la classe (**Docente** per i docenti) e le date, «prestato il `<data>`» e
  «scadenza `<data>`»;
- un segno colorato con il testo: «in tempo» (verde), «`<n>` giorni di ritardo» (rosso) oppure «rinnovato fino al
  `<data>`»; con il segno «Danneggiato» se la copia è stata segnata come tale.

L'elenco non è salvato: ricaricando la pagina si svuota. I prestiti restituiti restano però nello storico dell'utente e
del libro.

## Pulsanti di ogni riga

- **Stampa promemoria**: compare se l'utente ha ancora altri libri in ritardo; apre in una nuova scheda il promemoria
  stampabile. Vedere anche [Stampare i solleciti](../guides/overdue-reminders.md).
- **Rinnova invece**: per il caso dell'utente che voleva tenere il libro. Rinnova il prestito appena chiuso; esiti in
  [Rinnovo al posto della restituzione](#rinnovo-al-posto-della-restituzione) e [Rinnovo rifiutato](#rinnovo-rifiutato).
- **Segna danneggiato**: segna la copia come danneggiata; esito in
  [Copia segnata come danneggiata](#copia-segnata-come-danneggiata). Dopo averlo usato il pulsante scompare.

## Pagine correlate

- [Restituire un libro](../guides/return-a-book.md)
- [Rinnovare un prestito](../guides/renew-a-loan.md)
- [Prestiti](checkout.md)
- [Libri in prestito](loans.md)
