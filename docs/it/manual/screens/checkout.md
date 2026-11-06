# Prestiti

La pagina **Prestiti** è il banco dei prestiti: serve a registrare i libri che un utente porta via. Si lavora con il
lettore di codici a barre: prima si legge la tessera, poi i codici dei libri, uno dopo l'altro. La pagina la aprono gli
account che hanno il permesso dei prestiti («Gestione prestiti» e «Amministrazione»); per «Gestione prestiti» è la
pagina che si apre subito dopo l'accesso. Dagli altri account si raggiunge con **Prestiti** nel menu laterale (sul
telefono nella barra in basso) o con il pulsante **Prestiti** della [dashboard](dashboard.md).

La pagina fa parte del banco prestiti, che ha sei schede: **Prestiti**, **Restituzioni**, **Libri in prestito**,
**Solleciti**, **Lista desideri** e **Calendario**. Per la procedura passo per passo vedere
[Prestare un libro](../guides/lend-a-book.md).

<!-- figure: circulation/checkout-start | Prestiti prima di leggere la tessera: il campo dell'utente e i prestiti di oggi -->

1. [Schede del banco](#schede-del-banco).
1. [Segnalazioni in evidenza](#segnalazioni-in-evidenza).
1. [Campo dell'utente](#campo-dellutente).
1. [Prestiti di oggi](#prestiti-di-oggi).

<!-- figure: circulation/checkout-patron | Prestiti con un utente scelto: il campo dei libri, i libri prestati adesso e la scheda dell'utente -->

1. [Campo dei libri](#campo-dei-libri).
1. [Messaggi del banco](#messaggi-del-banco): l'esito dell'ultima lettura.
1. [Libri prestati adesso](#libri-prestati-adesso), con i pulsanti **Annulla ultimo**, **Stampa ricevuta** e **Fine**.
1. [Scheda dell'utente](#scheda-dellutente).

## Schede del banco

In alto sotto il titolo stanno le schede del banco prestiti. Premere di nuovo **Prestiti** mentre si è già in questa
pagina chiude l'operazione in corso e riporta al campo dell'utente.

## Segnalazioni in evidenza

Gli account che aprono direttamente il banco, come «Gestione prestiti», non vedono la dashboard: le segnalazioni che
l'amministratore ha messo in evidenza compaiono quindi qui, in una fascia sopra il campo. Il pulsante
**Apri le segnalazioni** porta a [Segnalazioni](notes.md). Senza segnalazioni in evidenza la fascia non compare.

## Campo dell'utente

Nella prima fase il campo si chiama **Tessera o nome dell'utente**. Ci sono tre modi per scegliere l'utente:

- leggere la tessera con il lettore di codici a barre: il lettore invia il codice e il tasto Invio, e l'utente è
  scelto;
- leggere il codice di un libro che è in prestito: il libro viene restituito e l'utente che lo aveva è scelto (vedere
  [Restituzione e prestito successivo](#restituzione-e-prestito-successivo));
- scrivere nel campo una parte del nome: dalla terza lettera si apre un elenco con gli utenti che corrispondono (anche
  per nomi simili), con la classe e, se le foto sono attive, la foto. Si sceglie con le frecce e Invio, oppure
  premendo sul nome; il tasto Esc svuota il campo.

Il pulsante **Fotocamera** accanto al campo legge il codice con la fotocamera del telefono. È facoltativo e funziona
solo se BiblioViva è aperto con una connessione sicura (https, cioè con Tailscale): il lettore di codici a barre resta
il modo normale.

Il campo può essere riempito anche aprendo la pagina da [Restituzioni](checkin.md) con il pulsante
**Vai a Prestiti con questo utente**: l'utente risulta già scelto.

## Prestiti di oggi

Finché nessun utente è scelto, sotto il campo compaiono due riquadri affiancati, **Prestati oggi** e
**Restituiti oggi**, con l'ora, il nome dell'utente e il titolo di ogni operazione della giornata. Se la giornata è
vuota: «Ancora niente oggi.» Se gli elementi sono più di sei: «e altri `<n>`».

## Campo dei libri

Dopo la scelta dell'utente il campo cambia nome in **Passa il libro**, con il suggerimento «Un libro dopo l'altro: il
codice del libro, letto con il lettore o scritto.» Ogni codice letto registra subito il prestito; il campo resta pronto
per il libro successivo. Non c'è la ricerca per titolo: i libri si leggono dal codice a barre della copia (sul dorso,
nell'etichetta) o si scrivono a mano.

Quando l'utente ha raggiunto il limite di prestiti, il campo lascia il posto a un avviso giallo: «`<nome>` ha raggiunto
il limite di prestiti (`<n>`): nessun nuovo prestito prima di una restituzione. Restano possibili i rinnovi dei prestiti
in corso.» Il pulsante **Fine** chiude l'operazione.

## Messaggi del banco

Sotto il campo compare l'esito di ogni lettura. Ogni messaggio dice che cosa è successo e che cosa fare, ha un colore,
un'icona e il testo (il colore non è mai l'unico segno) e, quando serve, uno o più pulsanti. Rosso: l'operazione non è
stata fatta; giallo: da controllare; azzurro: informazione; verde: operazione riuscita. Il banco non emette suoni di
avviso.

I messaggi sono descritti qui sotto, ciascuno con il testo esatto. Nei testi, `<titolo>`, `<nome>`, `<data>` e simili
stanno al posto dei dati veri; i titoli lunghi sono abbreviati a 40 caratteri.

## Conferme

### Prestito registrato

> Prestato: «`<titolo>`», scadenza `<data>`

Il libro è stato prestato e compare in **Libri prestati adesso**. La scadenza segue le regole di prestito della
biblioteca e il [calendario](calendar.md). Nessuna azione è richiesta: leggere il libro successivo, oppure premere
**Fine**. Se la scadenza è stata corretta, subito dopo compare uno degli avvisi descritti in
[Avvisi dopo un prestito](#avvisi-dopo-un-prestito).

### Restituzione e prestito successivo

> Restituito: «`<titolo>`». Ora i libri letti si prestano a `<nome>`.

Compare in verde quando nessun utente è scelto e si legge il codice di un libro che è in prestito: BiblioViva
registra subito la restituzione e sceglie l'utente che aveva il libro, come se ne avesse letto la tessera. Nella pagina
compare la scheda dell'utente e il campo diventa **Passa il libro**. Il libro successivo che si legge è prestato a
quell'utente. Se il libro era in ritardo compare anche «Restituito. «`<titolo>`» era in ritardo di `<n>` giorni
(scadenza `<data>`).»; se era segnato come smarrito compare anche il messaggio
[Libro smarrito ritrovato](checkin.md#libro-smarrito-ritrovato).

L'utente resta scelto finché si legge un'altra tessera, si preme **Fine** o la pagina si chiude da sola per inattività
(vedere [Sessione chiusa per inattività](#sessione-chiusa-per-inattività)). Se l'utente ha raggiunto il limite di
prestiti o non può prendere libri, il banco lo dice come dopo la lettura della tessera
(vedere [Limite di prestiti raggiunto](#limite-di-prestiti-raggiunto)). Per la procedura vedere
[Restituire un libro e prestarne subito un altro](../guides/return-and-lend.md).

### Prestito rinnovato

> Rinnovato: «`<titolo>`», nuova scadenza `<data>`

Il prestito è stato rinnovato con **Rinnova** (nella scheda dell'utente o nel messaggio
[Libro già in prestito allo stesso utente](#libro-già-in-prestito-allo-stesso-utente)). Nessuna azione è richiesta.

### Rinnovo di più prestiti

> Rinnovati `<n>` prestiti su `<totale>`.

Compare dopo **Rinnova tutti**. Se `<n>` è inferiore a `<totale>`, il messaggio è giallo e sotto di esso compare, per
ogni prestito non rinnovato, il motivo (vedere [Rinnovi rifiutati](#rinnovi-rifiutati)).

## Prestiti rifiutati

### Libro non in prestito letto senza tessera

> Il libro «`<titolo>`» non è in prestito: per prestarlo leggere prima la tessera dell'utente.

È stato letto il codice di una copia disponibile quando nessun utente era ancora scelto. Leggere la tessera
dell'utente e poi di nuovo il libro. Un libro che è in prestito, letto senza utente scelto, si restituisce da solo:
vedere [Restituzione e prestito successivo](#restituzione-e-prestito-successivo). Se il libro è già stato restituito
oggi, compare il messaggio [Libro già restituito oggi](checkin.md#libro-già-restituito-oggi).

### Codice non trovato

> Codice `<codice>` non trovato. Verificare la lettura dello scanner o digitare il codice: i codici dei libri hanno la
> forma `<esempio di copia>`, i numeri delle tessere `<esempio di tessera>`.

Il codice letto non corrisponde a nessuna tessera né a nessuna copia. Il messaggio mostra, come esempio, la forma dei
codici adottata dalla biblioteca. Che fare: premere **Riprova** e leggere di nuovo, oppure scrivere il codice a mano;
se il libro non ha il codice (etichetta persa), premere **Cerca per titolo**, che apre il [catalogo](catalog.md), e
vedere [Prestare o restituire una copia senza etichetta](../guides/book-without-label.md). La tessera di un utente
rimosso non è più riconosciuta e dà lo stesso messaggio.

Se il testo scritto non ha la forma di nessun codice, sotto il campo compare anche l'avviso «Codice non riconosciuto:
verificare che lo scanner legga Code 39 e Code 128.»

### Codice con carattere di controllo errato

> Il codice `<codice>` non è valido: il carattere di controllo non corrisponde. Rileggere il codice o digitarlo.

L'ultima lettera o cifra del codice serve a controllare che la lettura sia giusta, e qui non torna: di solito
l'etichetta è sporca o il lettore ha letto male. Premere **Riprova** e leggere di nuovo il codice. Sotto il campo
compare anche l'avviso «Il codice della copia ha un carattere di controllo errato: ripetere la lettura.» (o «Il numero
della tessera ha un carattere di controllo errato: ripetere la lettura.»).

### Codice di tessera e di copia insieme

Un vecchio numero può coincidere con quello di una tessera e con quello di una copia. Alla pagina Prestiti non compare
nessun messaggio: senza utente scelto il codice è trattato come tessera, con l'utente scelto come libro. Il messaggio
di scelta **Tessera** / **Libro** compare solo in
[Codice di tessera e di copia insieme](checkin.md#codice-di-tessera-e-di-copia-insieme).

### Tessera di un utente rimosso

> Questa tessera appartiene a un utente rimosso e non è più valida.

Compare nel raro caso in cui l'utente sia stato rimosso mentre la sua scheda era aperta al banco. Un utente rimosso non
può avere prestiti: premere **Fine** e scegliere un altro utente.

### Limite di prestiti raggiunto

> `<nome>` ha già `<n>` libro/libri in prestito (`<titoli>`); il limite è `<massimo>`. Per un nuovo prestito
> registrare prima una restituzione nella pagina Restituzioni.

Il messaggio compare al centro della pagina, in una finestra intitolata **Limite di prestiti raggiunto**, quando si
sceglie un utente che ha già il numero massimo di libri o quando si prova a prestarne uno in più. Il limite dipende dal
tipo di utente (alunno o docente) e, per alcuni tipi di materiale, dal materiale. Non si può forzare, nemmeno
dall'amministratore. Che fare: chiedere all'utente di riportare uno dei libri elencati; premere **Vai a Restituzioni** e
registrare la restituzione leggendo il codice di quel libro, poi tornare a **Prestiti**. Premere **Chiudi** per
chiudere la finestra senza fare altro; i rinnovi dei prestiti in corso restano possibili dalla scheda dell'utente.

### Libro già in prestito allo stesso utente

> «`<titolo>`» è già in prestito a `<nome>` dal `<data>`. Rinnovare il prestito?

L'utente ha già questa copia: probabilmente la porta per tenerla più a lungo. Premere **Rinnova** per rinnovare il
prestito (compare «Rinnovato: …») oppure **Annulla** per lasciare le cose come sono.

### Libro in prestito a un altro utente

> «`<titolo>`» risulta in prestito a `<altro utente>` dal `<data>`. Registrare prima la restituzione nella pagina
> Restituzioni, poi tornare a Prestiti.

La copia è registrata come prestata a un'altra persona: di solito è stata restituita senza leggere il codice. Premere
**Vai a Restituzioni**: la pagina si apre con il codice già nel campo, e la restituzione si conferma lì con Invio; la
pagina Prestiti non la registra da sola. Poi tornare a **Prestiti** e prestare il libro.

### Libro non ancora classificato

> «`<titolo>`» non è ancora classificato e non si presta. Va classificato prima: genere o classe.

Il libro è stato catalogato ma non ha ancora la classificazione: finché manca, non si presta. L'account con il permesso
del catalogo vede il pulsante **Classifica**, che apre la scheda del libro in [Da classificare](to-classify.md); gli
altri chiedono a chi cataloga. Non si può forzare.

### Copia solo da consultazione

> «`<titolo>`» è una copia da consultazione e non si presta.

La copia è segnata come esclusa dal prestito. Premere **Annulla** per chiudere il messaggio. Solo l'amministratore vede
anche **Forza (solo admin)**: si apre la finestra [Forzatura del prestito](#forzatura-del-prestito).

### Copia non prestabile

> «`<titolo>`» risulta `<stato>` e non può essere prestato. Se il libro è tornato disponibile, aggiornarne lo stato
> dalla scheda.

`<stato>` è uno tra «in riparazione», «smarrito» e «ritirato» (una copia danneggiata si presta ancora). Se il libro è davvero tornato in
biblioteca, premere **Apri scheda copia** e correggere lo stato nella scheda del libro (vedere
[Scheda del libro](book-record.md)). L'amministratore vede anche **Forza (solo admin)**, tranne che per le copie
ritirate, che non si prestano mai.

### Prestito rifiutato per libri in ritardo

> `<nome>` ha `<n>` libro/libri in ritardo: `<titoli>`.

Compare in rosso, senza pulsanti, solo se l'amministratore ha attivato l'impostazione
**Niente nuovi prestiti con libri in ritardo**: il prestito non viene registrato e l'utente deve prima restituire i
libri indicati (vedere [Restituzioni](checkin.md)). Senza questa impostazione lo stesso testo è un semplice avviso,
descritto in [Utente con libri in ritardo](#utente-con-libri-in-ritardo).

### Libro già nell'elenco

> «`<titolo>`» è già nell'elenco di questo prestito.

La stessa copia è stata letta due volte nella stessa operazione. Il prestito c'è già, una volta sola: leggere il libro
successivo.

## Avvisi dopo un prestito

Questi messaggi compaiono sotto la conferma «Prestato: …», perché il prestito è stato registrato ma con qualcosa da
sapere.

### Utente con libri in ritardo

> `<nome>` ha `<n>` libro/libri in ritardo: `<titoli>`.

Il messaggio è giallo e ha il pulsante **Stampa promemoria**, che apre in una nuova scheda il promemoria stampabile dei
libri in ritardo di quell'utente. Il prestito è già registrato; ricordare all'utente di riportare i libri indicati.

### Scadenza spostata per una chiusura

> La scadenza cade in un giorno di chiusura ed è stata spostata a `<data>`.

La data calcolata cadeva in un giorno in cui la biblioteca è chiusa, e BiblioViva l'ha portata al primo giorno utile.
Nessuna azione è richiesta; la data giusta è già nella conferma. I giorni di chiusura si vedono nel
[Calendario](calendar.md).

### Scadenza limitata alla fine dell'anno

> La scadenza è stata limitata al `<data>`, fine del prestito per quest'anno.

L'amministratore ha fissato una data oltre la quale nessun prestito può scadere. Nessuna azione è richiesta: ricordare
all'utente di restituire il libro entro quel giorno.

## Rinnovi rifiutati

Un rinnovo che le regole non consentono è spiegato da un messaggio rosso con il pulsante **Restituisci**, che apre
[Restituzioni](checkin.md) con il codice del libro nel campo. L'amministratore vede anche **Forza (solo admin)**,
tranne che per la scadenza massima: si apre la finestra [Forzatura del rinnovo](#forzatura-del-rinnovo).

### Limite di rinnovi raggiunto

> «`<titolo>`» è già stato rinnovato `<n>` volte, il massimo. Deve essere restituito.

Il libro è già stato rinnovato quante volte le regole consentono. Che fare: far restituire il libro (**Restituisci**).

### Rinnovo bloccato dal ritardo

> «`<titolo>`» è in ritardo di `<n>` giorni e le regole non consentono il rinnovo.

Le regole della biblioteca non permettono di rinnovare un libro già scaduto. Che fare: far restituire il libro
(**Restituisci**).

### Rinnovo oltre la scadenza massima

> «`<titolo>`» non si può rinnovare: la scadenza è già il `<data>`, l'ultimo giorno di prestito di quest'anno.

La data massima dei prestiti non lascia spazio a un rinnovo. Che fare: far restituire il libro (**Restituisci**). Questo
rifiuto non si può forzare.

## Altri messaggi

### Sessione chiusa per inattività

> Nessuna operazione da `<n>` minuti: il prestito di `<nome>` è stato chiuso. Per continuare, leggere di nuovo la
> tessera.

Dopo un certo tempo senza letture la pagina torna pronta per un nuovo utente, così che i libri del prossimo non vadano
per errore alla tessera precedente. I prestiti già registrati restano. Che fare: leggere di nuovo la tessera. Il tempo
è impostabile dall'amministratore (**Pausa della postazione prestiti (secondi)**, di norma 120 secondi).

### Prestito annullato

> Annullato: «`<titolo>`» non è più in prestito a `<nome>`.

Conferma il pulsante **Annulla ultimo**. Il libro è tornato disponibile e il prestito è cancellato (la cancellazione
resta nel registro delle operazioni). Nessuna azione è richiesta.

## Libri prestati adesso

La sezione **Libri prestati adesso** elenca i libri prestati nell'operazione in corso, l'ultimo in cima, ciascuno con la
scadenza («scade il `<data>`»). Mentre è vuota: «Leggere il codice dei libri da prestare.» Tre pulsanti:

- **Annulla ultimo**: annulla l'ultimo prestito della lista; premendolo di nuovo si annulla quello prima. Compare il
  messaggio [Prestito annullato](#prestito-annullato). Serve per un libro letto per errore.
- **Stampa ricevuta**: apre in una nuova scheda la ricevuta stampabile dei libri della lista. Compare solo se
  l'amministratore ha attivato l'impostazione **Ricevuta di prestito**.
- **Fine**: chiude l'operazione e riporta la pagina al campo dell'utente, pronta per il prossimo. Premerlo quando l'utente
  ha finito.

## Scheda dell'utente

A destra del campo, per tutta l'operazione, la scheda mostra l'utente scelto:

- la foto (se le foto sono attive), il nome, la classe oppure **Docente** per i docenti;
- il contatore dei prestiti, per esempio «2 di 3 prestiti»: diventa giallo quando il limite è raggiunto;
- l'avviso **Nota per il banco**, quando l'utente ha una nota di circolazione;
- l'elenco dei libri che ha già in prestito, ciascuno con il codice, il titolo (sul passaggio del mouse) e la scadenza;
  la scadenza è accompagnata dal segno «In corso» oppure, se è passata, da «In ritardo» in rosso con l'icona;
- accanto a ogni libro il pulsante **Rinnova**; quando i libri sono più di uno, sotto l'elenco anche **Rinnova tutti**.
  Se nessun libro è in prestito: «Nessun libro in prestito.»

Questi pulsanti permettono di rinnovare senza passare dalla pagina di restituzione. Gli esiti sono descritti in
[Conferme](#conferme) e [Rinnovi rifiutati](#rinnovi-rifiutati).

## Forzatura del prestito

La finestra **Forzare il prestito?** si apre solo per l'amministratore, dopo **Forza (solo admin)** in un messaggio che
lo consente. Chiede il **Motivo** («Resta nel registro del prestito.»), di almeno tre caratteri, e ha i pulsanti
**Presta comunque** e **Annulla**. Il limite di prestiti e il libro in prestito a un altro utente non si possono mai
forzare.

## Forzatura del rinnovo

La finestra **Forzare il rinnovo?** funziona allo stesso modo per un rinnovo rifiutato: **Motivo**, poi
**Rinnova comunque** o **Annulla**.

## Pagine correlate

- [Prestare un libro](../guides/lend-a-book.md)
- [Rinnovare un prestito](../guides/renew-a-loan.md)
- [Prestare a chi non ha la tessera con sé](../guides/lend-without-card.md)
- [Prestare o restituire una copia senza etichetta](../guides/book-without-label.md)
- [Restituire un libro e prestarne subito un altro](../guides/return-and-lend.md)
- [Restituzioni](checkin.md)
- [Libri in prestito](loans.md)
