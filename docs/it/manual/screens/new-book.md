# Nuovo libro

La pagina **Nuovo libro** serve a mettere in catalogo un libro nuovo, con le sue copie, partendo dal codice ISBN: il
lettore di codici a barre legge il codice, BiblioViva cerca i dati del libro online, l'operatore li controlla e salva la
scheda insieme alle copie. Se il libro è già in catalogo, la stessa pagina aggiunge copie alla scheda esistente. Le
procedure sono in [Catalogare un libro nuovo](../guides/catalog-a-new-book.md),
[Catalogare un libro senza ISBN](../guides/catalog-without-isbn.md) e
[Aggiungere una copia a un libro già in catalogo](../guides/add-a-copy.md).

La pagina si apre dal pulsante **Nuovo libro** del [Catalogo](catalog.md), dall'azione rapida **Nuovo libro** della
dashboard e dal pulsante **Cataloga** della [Lista desideri](wishlist.md). La usano gli account «Catalogazione» e
«Amministrazione». In alto un indicatore a quattro passi mostra a che punto si è: **Codice**, **Ricerca**, **Scheda e
copie**, **Completato**. Il pulsante di ritorno porta al catalogo.

<!-- figure: catalog/new-book-code | Il primo passo di Nuovo libro: il campo del codice e la scelta del materiale -->

Nella figura:

1. L'indicatore dei passi: [Passi della pagina](#passi-della-pagina).
1. Il campo **ISBN o EAN**, dove leggere il codice con il lettore: [Passo Codice](#passo-codice).
1. La scelta del **Materiale**: [Passo Codice](#passo-codice).
1. Il pulsante **Senza codice**: [Ricerca per titolo e autore](#ricerca-per-titolo-e-autore).
1. Il pulsante **Compila a mano**: [Scheda compilata a mano](#scheda-compilata-a-mano).

## Passi della pagina

Il percorso normale, con l'ISBN, è: leggere il codice, controllare la scheda proposta (che si apre da sola), salvare.
Per il libro già in catalogo il percorso si ferma al passo **Questo ISBN è già in catalogo** e aggiunge copie. Per il
libro senza codice si passa dalla ricerca per titolo e autore o dal modulo compilato a mano.

Il pulsante **Aggiungi un altro** della conferma riporta al primo passo per il libro seguente, senza lasciare la
pagina. Lo stesso fanno **Leggi un altro codice** (nei passi **Questo ISBN è già in catalogo** e **Scheda e copie**) e
**Nuovo codice** (nel passo **Ricerca**).

## Passo Codice

Il campo **ISBN o EAN** ha già il cursore. Si legge con il lettore di codici a barre il codice a barre stampato sul
retro del libro; il lettore invia il codice seguito da Invio e la ricerca parte da sola. In alternativa si può scrivere
il codice a mano e premere Invio.

Il pulsante della fotocamera accanto al campo è facoltativo: legge il codice dall'immagine e funziona solo con una
connessione sicura (https), cioè con Tailscale. Con il lettore non serve.

Sotto, la scelta **Materiale** indica che cosa si sta catalogando (libro, DVD…): il materiale è proposto alla scheda
e si può cambiare nel modulo. La scelta resta valida finché la pagina resta aperta, anche per i libri seguenti.

Sotto una linea di separazione stanno due vie per il libro senza ISBN, con la nota «Ricerca per titolo e autore, oppure
scheda compilata a mano»: **Senza codice** e **Compila a mano**.

## Messaggi del passo Codice

### Il codice letto non è un ISBN né un EAN

“Il codice letto non è un ISBN né un EAN: controllare le cifre o scegliere «Senza codice».” Il codice non ha la forma di
un ISBN o di un EAN. Si legge di nuovo il codice oppure si usa **Senza codice**.

### EAN letto, non ISBN

«EAN N letto: non è un ISBN, quindi la scheda va compilata a mano.» Capita con i DVD e gli altri materiali che non sono
libri: la pagina passa al modulo, con l'EAN già scritto, senza cercare online.

### Ricontrollare le cifre

Le segnalazioni «L'ISBN ha una cifra di controllo errata: controllare le cifre.» e «Codice non riconosciuto: verificare
che lo scanner legga Code 39 e Code 128.» compaiono sotto il campo quando la lettura è sbagliata. Si ripete la lettura.

### Non è un ISBN, con la fotocamera

«Non è un ISBN: inquadrare il codice del libro.» Con la fotocamera la pagina accetta soltanto gli ISBN.

## Libro già in catalogo

Se l'ISBN è già in catalogo, la pagina non crea una scheda doppia. Mostra il titolo, l'autore, l'editore, l'anno e
«N copie» sotto **Questo ISBN è già in catalogo**. Le scelte sono:

- **Aggiungi copia**: aggiunge al libro il **Numero di copie** scritto nel campo (almeno una), con la segnatura
  proposta; il materiale è quello della scheda. Si passa alla conferma [Scheda salvata](#scheda-salvata) (“N copie
  aggiunte a «titolo»”).
- **Apri la scheda**: apre la [Scheda del libro](book-record.md).
- **Leggi un altro codice**: torna al primo passo.

## Ricerca per titolo e autore

Il pulsante **Senza codice** apre una pagina intitolata **Cerca per titolo e autore** con i campi **Titolo** e
**Autore**. Premere **Cerca** avvia la ricerca online. **Compila a mano** apre il modulo vuoto e **Indietro** torna al
primo passo. Se i due campi sono vuoti, la pagina avvisa: «Scrivere almeno il titolo o l'autore.»

## Passo Ricerca

Dopo un codice ISBN o una ricerca per titolo, BiblioViva interroga i servizi bibliografici configurati dalla biblioteca
(di norma OPAC SBN). La pagina scrive «Ricerca in corso su …».

Una riga di contrassegni riferisce l'esito di ciascun servizio: «nome del servizio: N schede», con «dalla cache» se la
risposta era già stata scaricata, oppure «Errore» in rosso. Sotto, un riquadro rosso spiega ogni errore (il servizio
non risponde, non è raggiungibile, non è configurato…) e che i dati si possono scrivere a mano.

Con l'ISBN la scheda più completa si apre da sola nel passo seguente. Con la ricerca per titolo la pagina mostra
l'elenco **Schede trovate**, la più completa in testa con il segno **La più completa**. Ogni scheda riporta titolo,
autore, serie, luogo, editore, anno, descrizione fisica, ISBN e il servizio di provenienza. Il pulsante **Usa questa
scheda** sceglie quella scheda e apre il modulo.

Sotto l'elenco stanno i pulsanti:

- **Inserisci a mano**: apre il modulo vuoto;
- **Cerca per titolo**: ripete la ricerca per titolo e autore (compare dopo una ricerca per ISBN);
- **Riprova**: ripete la ricerca (compare se un servizio ha dato errore);
- **Nuovo codice**: torna al primo passo.

Se nessun servizio ha trovato nulla, la pagina scrive «Nessuna scheda trovata. La scheda si può compilare a mano.»

## Passo Scheda e copie

La pagina intitolata **Controllo della scheda e aggiunta delle copie** mostra il modulo del libro, già compilato con i
dati trovati, e le copie da creare. La scheda va sempre ricontrollata prima di salvare: sopra il modulo una nota dice
«Scheda da …: controllare i dati prima di salvare.» e, se il numero Dewey ha suggerito un argomento della saggistica,
«Argomento proposto dal numero Dewey N.»

In alto a destra il pulsante **Leggi un altro codice** abbandona la scheda e riparte da zero: serve quando il codice
letto era sbagliato.

### Scheda più completa

Se i servizi hanno trovato più schede, la pagina apre la più completa e lo dice: «La scheda più completa tra le N
trovate. Verificare anno e descrizione sulla copia.» Il pulsante «Altre schede (N)» torna all'elenco per sceglierne
un'altra.

### Copertina

Se le copertine sono attive, sopra il modulo il riquadro **Copertina** mostra l'immagine trovata online mentre la
scheda è aperta («Trovata su …: si salva con la scheda. Se è sbagliata, fotografare quella del libro.»). I pulsanti
sono **Fotografa la copertina** (o **Sostituisci con una foto**) e **Togli**. La copertina viene salvata insieme alla
scheda. L'amministratore può disattivare le copertine; in tal caso il riquadro non compare.

### Dati del libro

Il modulo ha le sezioni **Scheda**, **Pubblicazione**, **Classificazione** e **Altri dati**, con gli stessi campi e le
stesse regole del modulo [Modifica scheda](book-record.md#modifica-scheda). Il **Materiale** sta in **Pubblicazione**,
dopo la **Descrizione fisica**, già impostato dal primo passo. Autore ed editore sono obbligatori: se il
libro non li indica si usano i valori speciali dei pulsanti sotto il campo.

### Sezione Copie

La sezione **Copie** crea le copie del libro nello stesso salvataggio:

- **Numero di copie**: quante copie nuove, di norma 1;
- **Livello delle copie**, se la biblioteca registra il livello sulle copie;
- **Segnatura**: viene proposta dalla classificazione e si aggiorna finché non si scrive la propria;
- **Data di acquisizione**: di norma la data di oggi.

Il pulsante **Salva scheda e copie** salva. **Annulla** torna al catalogo. Se un campo non è valido, il messaggio
compare sotto il campo; i messaggi sono quelli descritti in [Messaggi del modulo](book-record.md#messaggi-del-modulo). Per
«Da 1 a 100 copie alla volta» il numero di copie va corretto.

### Dal desiderio

Se la pagina è stata aperta dal pulsante **Cataloga** della lista desideri, in alto un riquadro scrive «Dal desiderio:
…» e spiega «Leggere il codice del libro o cercarlo per titolo: il desiderio lascia la lista al salvataggio della
scheda.» Titolo e autore sono già scritti nella ricerca e nel modulo.

## Scheda salvata

Al termine compare la pagina **Scheda salvata**, con il riepilogo «titolo con N copie» (oppure «N copie aggiunte a
titolo»), la copertina e, sotto **Codici delle copie**, i codici a barre delle copie nuove. Le scelte sono:

- **Aggiungi un altro**: il pulsante principale, per il libro seguente;
- **Stampa etichette**: apre la finestra di [Stampa etichette](book-record.md#stampa-etichette) per le copie appena
  create;
- **Aggiungi alla lista etichette**: mette le copie in una lista di stampa, per stampare più tardi (vedere
  [Stampe](print-lists.md));
- **Apri la scheda**: apre la [Scheda del libro](book-record.md).

Se il libro era stato scelto per un desiderio, il desiderio esce dalla lista e un messaggio lo conferma («Desiderio
tolto dalla lista»). Se la copertina non ha potuto essere salvata, un avviso rosso lo dice («La copertina non è stata
salvata: si può aggiungere dalla scheda del libro.»).

## Scheda compilata a mano

Quando il libro non ha ISBN, o la ricerca online non trova nulla, il pulsante **Compila a mano** apre lo stesso modulo
del [Passo Scheda e copie](#passo-scheda-e-copie), vuoto, con la nota «Scheda compilata a mano.» L'ISBN o il titolo già
scritti restano nel modulo.

## Pagine correlate

- [Catalogo](catalog.md)
- [Scheda del libro](book-record.md)
- [Da classificare](to-classify.md)
- [Stampe](print-lists.md)
- [Lista desideri](wishlist.md)
- [Catalogare un libro nuovo](../guides/catalog-a-new-book.md)
- [Catalogare un libro senza ISBN](../guides/catalog-without-isbn.md)
