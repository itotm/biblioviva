# Scheda del libro

La scheda del libro raccoglie tutto ciò che la biblioteca sa di un titolo: i dati bibliografici, la classificazione e,
soprattutto, le sue copie con lo stato di ciascuna. Serve per sapere dove si trova una copia e a chi è prestata, e, con
il permesso del catalogo, per correggere i dati, aggiungere copie, cambiarne lo stato e stampare le etichette.

La scheda si apre da un libro del [Catalogo](catalog.md), dal salvataggio di un [Nuovo libro](new-book.md), dalle liste
di stampa, dall'[Inventario](inventory.md) e dal banco prestiti (pulsante **Apri scheda copia**). La leggono gli account
«Gestione prestiti», «Catalogazione», «Report» e «Amministrazione». Modificarla, aggiungere copie e
stampare le etichette spetta a «Catalogazione» e «Amministrazione»; la scheda degli altri account non ha pulsanti di
modifica.

<!-- figure: catalog/record-copies | La scheda di un libro con le sue copie, vista dall'account Catalogazione -->

Nella figura:

1. L'intestazione con titolo, autore e copertina: [Intestazione della scheda](#intestazione-della-scheda).
1. I contrassegni (tipo, classificazione, serie, ISBN, copie): [Intestazione della scheda](#intestazione-della-scheda).
1. I pulsanti di azione: [Azioni della scheda](#azioni-della-scheda).
1. Le schede **Copie**, **Dettagli** e **Storico prestiti**: [Copie](#copie), [Dettagli](#dettagli),
   [Storico prestiti](#storico-prestiti).
1. L'elenco delle copie con stato ed etichette: [Copie](#copie).
1. Le icone di azione di ogni copia: [Azioni su una copia](#azioni-su-una-copia).

## Intestazione della scheda

In alto compaiono il titolo e, sotto, autore, editore e anno separati da un puntino. A sinistra sta la copertina, se la
biblioteca le usa; l'amministratore può disattivare le copertine e, in tal caso, la copertina non compare e non si cerca
nulla.

Sotto il titolo si leggono i contrassegni:

- il tipo, **Narrativa** o **Saggistica**, e la classificazione con il suo nome (con il livello di lettura, se c'è);
- se il libro non ha ancora una classificazione, il contrassegno **Da classificare** (con la spiegazione «Le copie non
  si prestano finché il libro non è classificato.») e, con il permesso del catalogo, il pulsante **Classifica**, che
  apre la pagina [Classifica il libro](to-classify.md#classifica-il-libro);
- la serie, con il numero, come pulsante: apre il [Catalogo](catalog.md) con tutti i libri della serie, in ordine;
- il materiale (libro, DVD…), lo stesso per tutte le copie;
- l'**ISBN**;
- le copie, nella forma «N disponibili su M». Le copie ritirate non si contano nel totale.

### Copertina

Con il permesso del catalogo, sotto la copertina stanno i pulsanti per cambiarla (la procedura è in
[Aggiungere la copertina](../guides/add-a-cover.md)):

- **Fotografa la copertina** (**Cambia copertina** se la copertina c'è già) apre il pannello per scattare la foto con
  la fotocamera o per **Carica un file**. Dopo lo scatto la copertina viene raddrizzata: si trascinano i quattro
  angoli sui bordi (in alternativa si tocca l'immagine per portarvi l'angolo più vicino oppure, con la tastiera, Tab
  sceglie un angolo e le frecce lo spostano), si preme **Raddrizza** e si conferma con **Usa questa copertina**;
  **Rifai** ripete lo scatto e **Annulla** esce. La fotocamera è facoltativa e funziona solo con una connessione
  sicura (https), cioè con Tailscale; caricare un file va bene ovunque.
- **Scarica copertina** cerca la copertina online dall'ISBN. Il pulsante compare solo se il libro ha un ISBN. Se non la
  trova, la pagina avvisa («Nessuna copertina trovata online per questo ISBN: è possibile fotografarla.»).
- **Rimuovi copertina** chiede conferma («Rimuovere la copertina?») e cancella l'immagine dal server.

## Azioni della scheda

I pulsanti in alto a destra sono visibili solo con il permesso del catalogo. L'azione principale è **Modifica**;
quando la riga è troppo stretta, le altre azioni passano nel menu **Altre azioni**.

- **Modifica** apre il modulo [Modifica scheda](#modifica-scheda).
- **Aggiungi alla lista** mette tutte le copie del libro in una lista di stampa (vedere [Stampe](print-lists.md)). È
  spento se il libro non ha copie.
- **Aggiungi copie** apre la finestra [Aggiunta di copie](#aggiunta-di-copie).
- **Stampa etichette** apre la finestra [Stampa etichette](#stampa-etichette) per tutte le copie. È spento se il libro
  non ha copie.
- **Elimina scheda**, in rosso, cancella la scheda: vedere [Eliminazione della scheda](#eliminazione-della-scheda).

## Copie

La scheda **Copie**, con il numero delle copie tra parentesi, elenca le copie fisiche del libro, una riga per copia. Se
il libro non ha copie, la pagina scrive «Nessuna copia: per il prestito occorre aggiungerne una.»

Le colonne sono:

- **Codice**: il codice a barre della copia, stampato sull'etichetta interna;
- **Segnatura**: vedere [Segnatura](#segnatura);
- **Livello**: il livello di lettura della copia; compare solo se la biblioteca lo registra sulle copie e non sul
  titolo;
- **Stato**: vedere [Stati della copia](#stati-della-copia);
- **In prestito a**: vedere [Chi ha la copia](#chi-ha-la-copia);
- **Etichette**: vedere [Stato delle etichette](#stato-delle-etichette);
- le icone di azione, con il permesso del catalogo: vedere [Azioni su una copia](#azioni-su-una-copia).

### Segnatura

La segnatura è la sigla scritta sul dorso, che dice dove va riposta la copia: per la narrativa il genere seguito dalle
prime lettere dell'autore (per esempio `B DEL`, o `B 4 DEL` con il livello di lettura), per la saggistica il numero
dell'argomento seguito dalle lettere dell'autore (per esempio `590 ROS`). Per un libro di autore «Anonimo» o «AA. VV.»
le lettere sono le prime tre del titolo, saltando l'articolo iniziale. La forma esatta dipende dallo schema scelto dalla
biblioteca, vedere [Modificare la classificazione e i livelli di lettura](../../admin/guides/classification.md).

La segnatura la calcola BiblioViva e non si scrive per intero. Tutte le copie di un libro hanno la stessa segnatura; fa
eccezione il livello di lettura quando la biblioteca lo assegna a ogni copia: allora ogni copia porta il suo. La
segnatura segue i dati: correggendo la classificazione, l'autore o il titolo nel modulo [Modifica
scheda](#modifica-scheda), o il livello di una copia, la segnatura delle copie cambia subito e la loro fascetta e la
loro etichetta con il codice a barre tornano tra le etichette da stampare. Un libro non ancora classificato non ha
segnatura.

### Stati della copia

Ogni copia ha uno stato, mostrato con un colore, un'icona e il testo. Gli stati sono i seguenti.

- **Disponibile**: la copia è sullo scaffale e si può prestare.
- **In prestito**: la copia è fuori, prestata a un utente. La colonna **In prestito a** mostra a chi e la scadenza.
- **Consultazione**: la copia è disponibile ma segnata «Solo consultazione (non si presta)»: sta in biblioteca e non
  va a casa. Il banco prestiti la rifiuta.
- **Smarrito**: la copia non si trova. Non si può prestare né stampare. Se la copia ricompare e viene restituita, torna
  disponibile.
- **Danneggiato**: la copia è rovinata ma si presta ancora.
- **In riparazione**: la copia è fuori scaffale per essere riparata e non si presta.
- **Ritirato**: la copia è stata tolta dalla collezione. Non si presta e non entra nelle liste né nelle etichette.

### Chi ha la copia

Per una copia in prestito la colonna **In prestito a** mostra il nome dell'utente e «scade il» seguito dalla data. Il
nome si vede solo con gli account «Gestione prestiti» e «Amministrazione»; gli altri account leggono **In prestito** e
la scadenza. Il nome è un collegamento alla [Scheda dell'utente](patron-record.md) solo per gli account che possono
aprire le schede degli utenti (di norma «Amministrazione»).

### Stato delle etichette

L'ultima colonna dice a che punto è la stampa delle due etichette della copia (la fascetta del dorso e l'etichetta con
il codice a barre):

- **Etichette stampate**: entrambe sono state stampate;
- **Manca una etichetta**: ne è stata stampata una sola;
- **Etichette da stampare**: nessuna è stata stampata.

### Azioni su una copia

A destra di ogni riga, solo con il permesso del catalogo, stanno quattro icone; il nome compare al passaggio del mouse
e contiene il codice della copia:

- «Etichette della copia»: stampa le etichette di quella sola copia ([Stampa etichette](#stampa-etichette));
- «Modifica copia»: [Modifica di una copia](#modifica-di-una-copia);
- «Stato della copia»: [Cambio di stato di una copia](#cambio-di-stato-di-una-copia);
- «Elimina copia», in rosso: [Eliminazione di una copia](#eliminazione-di-una-copia).

## Aggiunta di copie

La finestra **Aggiungi copie** crea una o più copie nuove del libro. Si apre da **Aggiungi copie** nelle azioni della
scheda. La procedura è in [Aggiungere una copia a un libro già in catalogo](../guides/add-a-copy.md). I campi sono:

- **Numero di copie**, da 1 a 100;
- **Segnatura**, mostrata ma non modificabile, con la nota «Calcolata da classificazione, livello e autore.»; solo con
  lo schema libero della biblioteca è un campo da scrivere;
- **Testo della segnatura**, solo con uno schema che prevede una parte scritta per ogni copia («La parte della segnatura
  scritta per questa copia.»);
- **Livello della copia**, se la biblioteca lo registra sulle copie;
- **Volume / numero**, **Data di acquisizione** e **Note sulla copia**;
- **Solo consultazione (non si presta)**, per le copie che non devono uscire.

Il pulsante **Aggiungi** crea le copie e un messaggio conferma «N copie aggiunte» con i nuovi codici. I codici a barre
delle copie sono assegnati da BiblioViva. Dopo l'aggiunta le etichette risultano **Etichette da stampare**.

## Modifica di una copia

La finestra «Modifica copia», intitolata con il codice della copia, cambia **Livello della copia**,
**Volume / numero**, **Data di acquisizione**, **Note sulla copia** e **Solo consultazione (non si presta)**. La
**Segnatura** vi compare senza poterla scrivere, con la nota «Calcolata da classificazione, livello e autore.»; i campi
**Segnatura** (schema libero) e **Testo della segnatura** (parte scritta per ogni copia) ci sono solo con gli schemi che
li prevedono, come in [Aggiunta di copie](#aggiunta-di-copie). Il pulsante **Salva** conferma («Copia aggiornata»);
**Annulla** esce.

## Cambio di stato di una copia

La finestra «Stato della copia», con il codice della copia nel titolo, serve per segnare una copia smarrita,
danneggiata, in riparazione o ritirata, o per rimetterla disponibile. La procedura è in
[Togliere una copia smarrita o rovinata](../guides/withdraw-a-copy.md).

1. In **Nuovo stato** scegliere **Disponibile**, **Smarrito**, **Danneggiato**, **In riparazione** o **Ritirato**.
1. In **Motivo (facoltativo, registrato)** scrivere perché, in poche parole. Il motivo resta nel registro della copia.
1. Premere **Cambia stato**. Un messaggio conferma «Stato aggiornato».

Se la copia è in prestito, il passaggio a **Ritirato** è rifiutato con il messaggio «La copia è in prestito: prima
registra la restituzione.» Occorre prima restituirla nella pagina [Restituzioni](checkin.md). Il passaggio a
**Smarrito**, invece, è accettato e chiude il prestito.

## Eliminazione di una copia

Il cestino chiede conferma con «Eliminare la copia N?» e la nota: «Solo per errori di catalogazione: una copia che è
stata prestata non si può eliminare, va ritirata.» Il pulsante **Elimina copia** cancella la copia. Se la copia ha
prestiti registrati, la pagina risponde «La copia ha prestiti registrati: va ritirata, non eliminata.» e la copia resta:
va ritirata dalla finestra descritta in [Cambio di stato di una copia](#cambio-di-stato-di-una-copia).

## Dettagli

La scheda **Dettagli** mostra i dati che non stanno nell'intestazione, solo quelli presenti: **Sottotitolo**,
**Titolo originale**, **Responsabilità (come sul frontespizio)**, **Luogo**, **Descrizione fisica**, **ISSN**,
**EAN (non ISBN)**, **Dewey (da SBN)**, **Note** e **Soggetti**. In fondo una riga indica l'origine della scheda
(«Origine: …», per esempio il servizio da cui è stata scaricata o «manual»), la data di creazione e quella dell'ultima
modifica.

## Storico prestiti

La scheda **Storico prestiti** compare per gli account che hanno il banco prestiti («Gestione prestiti» e
«Amministrazione»). Elenca tutti i prestiti delle copie del libro, dal più recente. Le colonne sono **Prestato il**,
**Utente**, **Classe**, **Copia**, **Scadenza**, **Restituito il**, **Esito** e **Rinnovi**. Sopra l'elenco una riga
dice «N prestiti». Se nessuna copia è mai stata prestata, la pagina scrive «Nessuna copia di questo libro è mai stata
prestata.»

L'esito è **In corso**, **In ritardo**, **Restituito**, **Restituito in ritardo** o **Smarrito**. Un utente rimosso
compare con il nome reso anonimo. Un clic sulla riga apre la scheda dell'utente, ma solo per gli account che possono
aprire le schede degli utenti.

## Stampa etichette

La finestra **Stampa etichette** si apre dal pulsante **Stampa etichette** della scheda, dall'icona della stampante di
una copia e dal catalogo, per i libri selezionati. Prepara la pagina di stampa delle etichette adesive e, dopo la
stampa, registra quali copie sono state stampate. La procedura è in
[Stampare le etichette dei libri](../guides/print-book-labels.md). Le parti della finestra sono:

- **Tipo di etichetta**: **Coppia** (la fascetta per il dorso sopra e l'etichetta con il codice a barre sotto, una
  coppia per libro: è la scelta normale), **Solo barcode** (per le ristampe) oppure **Solo fascetta** (per esempio dopo
  una riclassificazione);
- **Foglio di etichette**: il foglio adesivo caricato in stampante;
- **Prima posizione libera**: l'etichetta del foglio da cui iniziare, da 1 al numero massimo del foglio, per saltare
  quelle già usate;
- la riga di riepilogo: «N copie», con i fogli necessari e le etichette per foglio;
- **Apri la stampa**: apre la pagina di stampa in una nuova scheda del browser; la finestra ricorda «Dopo la stampa,
  segnare le etichette come stampate.»;
- **Segna come stampate**: compare dopo l'apertura della stampa; un messaggio conferma «N copie segnate come stampate» e
  le etichette passano allo stato **Etichette stampate**.

Per i libri non ancora classificati la finestra avvisa che si stampa solo l'etichetta con il codice a barre e che la
fascetta del dorso verrà dopo la classificazione. **Chiudi** esce senza segnare nulla.

## Eliminazione della scheda

**Elimina scheda** apre la conferma “Eliminare la scheda «titolo»?” con la nota «La scheda scompare dal catalogo.
Possibile solo senza copie.» Se il libro ha ancora copie, la pagina risponde «La scheda ha ancora N copie: prima vanno
ritirate o eliminate.» e non cancella nulla. Alla conferma si torna al [Catalogo](catalog.md) con il messaggio
«Scheda eliminata».

## Modifica scheda

La pagina **Modifica scheda** corregge i dati del libro; la procedura è in
[Correggere la scheda di un libro](../guides/edit-a-record.md). Si apre dal pulsante **Modifica** della scheda e mostra,
sotto il titolo, il titolo del libro. In fondo stanno **Annulla**, che torna alla scheda senza cambiare nulla, e
**Salva le modifiche**. Un campo non valido è segnalato sotto il campo, con un testo rosso; i campi di cui il modulo si
lamenta sono elencati in alto sotto «Controllare i campi segnalati».

### Sezione Scheda

I campi della sezione **Scheda**:

- **Titolo** (obbligatorio);
- **Sottotitolo**;
- **Titolo originale**, da compilare solo se il libro è una traduzione: il titolo dell'opera nella lingua originale;
- **Autore** (obbligatorio), nella forma Cognome, Nome. Sotto il campo i pulsanti dei valori speciali mettono l'autore
  quando non c'è un autore personale (per esempio Anonimo o AA. VV.);
- **Responsabilità (come sul frontespizio)**, per illustratori, traduttori e simili;
- **Serie** e **Numero nella serie**: la serie si scrive a mano, con il suggerimento delle serie già presenti nel
  catalogo; il numero è il numero del volume (per esempio Harry Potter e 3).

### Sezione Pubblicazione

I campi della sezione **Pubblicazione**:

- **Editore** (obbligatorio), con il pulsante del valore «editore sconosciuto» (di norma `s.n.`);
- **Luogo**, con il pulsante del valore «luogo sconosciuto» (di norma `s.l.`);
- **Anno**, a quattro cifre;
- **ISBN**;
- **EAN (non ISBN)**, per i materiali che hanno un EAN senza essere libri (un DVD);
- **Descrizione fisica**, in una riga sola (pagine, illustrazioni, formato);
- **Materiale**, il tipo di materiale (libro, DVD, rivista…): è uno solo per il libro e vale per tutte le sue
  copie. Un materiale escluso dal prestito esclude dal prestito tutte le copie; una singola copia si tiene fuori dal
  prestito con **Solo consultazione (non si presta)**.

### Sezione Classificazione

La sezione **Classificazione** sceglie il tipo e l'argomento del libro.

1. Alla domanda **Che tipo di libro è?** scegliere **Narrativa**, **Saggistica** oppure **Classifica dopo**. Con
   **Classifica dopo** il libro va nell'elenco [Da classificare](to-classify.md): le sue copie non si prestano e la
   fascetta del dorso non si stampa finché non viene classificato.
1. Per la narrativa, scegliere il genere tra le figure di **Scegli il genere** e, se la biblioteca lo usa, il **Livello
   di lettura**.
1. Per la saggistica, scegliere l'argomento tra le figure di **Scegli l'argomento**. Un argomento principale ha dei
   sottoargomenti: aprendolo si leggono gli «Argomenti di …» e si sceglie quello giusto, oppure il pulsante «Usa … in
   generale»; **Torna agli argomenti principali** riporta all'elenco.
1. Sotto il selettore **Segnatura delle copie** mostra la segnatura calcolata, oppure «Dopo la classificazione» quando è
   scelto **Classifica dopo**. La nota dice «Calcolata da classificazione, livello e autore; le copie la prendono al
   salvataggio.»
1. Solo se lo schema della biblioteca prevede iniziali modificabili compare il campo **Testo della segnatura**: vuoto,
   usa le iniziali proposte dall'autore, mostrate in grigio («Vuoto: DEL, proposto dall'autore.»); scrivere altre lettere
   per cambiarle.

### Sezione Altri dati

La sezione **Altri dati** è chiusa all'apertura, a meno che non contenga già dei dati. Contiene **Dewey (da SBN)**,
**ISSN**, **Soggetti** (uno per riga, oppure separati da virgola) e **Note**.

### Sezione della copia singola

Se il libro ha una sola copia, in fondo al modulo compare la sezione intitolata con il codice della copia («Copia N»):
«La scheda ha una sola copia: i suoi dati si modificano qui e si salvano insieme alla scheda.» I campi sono quelli di
[Modifica di una copia](#modifica-di-una-copia); il materiale non c'è, perché si cambia nella sezione
**Pubblicazione**. La segnatura è un campo solo con gli schemi descritti in [Aggiunta di copie](#aggiunta-di-copie). Con due o più copie la sezione non compare.

## Messaggi del modulo

Il modulo rifiuta i dati non validi con uno dei messaggi seguenti.

### ISBN non valido

«ISBN non valido (controllare le cifre)»: l'ISBN ha una cifra di controllo errata. Occorre ricontrollare le cifre sul
retro del libro.

### Esiste già una scheda con questo ISBN

«Esiste già una scheda con questo ISBN»: il libro è già in catalogo. Per avere un'altra copia si usa **Aggiungi copie**
sulla scheda esistente.

### Il genere o l'argomento è obbligatorio

«Il genere è obbligatorio» per la narrativa, «L'argomento è obbligatorio» per la saggistica. Se il libro non è ancora
classificabile, scegliere **Classifica dopo**. Gli altri messaggi della classificazione («La saggistica non ha un
genere», «La narrativa non ha un argomento», «Livello di lettura non previsto dalla configurazione») dicono che la
scelta non è coerente con il tipo.

### Anno non plausibile

«Anno non plausibile»: l'anno scritto è fuori dall'intervallo accettato. Si scrive l'anno a quattro cifre.

### ISSN o EAN non valido

«ISSN non valido» e «EAN non valido»: le cifre non superano il controllo.

### Data non valida

«Data non valida (AAAA-MM-GG)»: la data di acquisizione si scrive nella forma anno-mese-giorno, oppure si sceglie dal
calendario.

### Materiale non previsto dalla configurazione

«Materiale non previsto dalla configurazione»: il materiale scelto non è tra quelli attivi in biblioteca. Per
aggiungerne uno occorre l'amministratore.

## Pagine correlate

- [Catalogo](catalog.md)
- [Nuovo libro](new-book.md)
- [Da classificare](to-classify.md)
- [Stampe](print-lists.md)
- [Correggere la scheda di un libro](../guides/edit-a-record.md)
- [Aggiungere una copia a un libro già in catalogo](../guides/add-a-copy.md)
- [Stampare le etichette dei libri](../guides/print-book-labels.md)
