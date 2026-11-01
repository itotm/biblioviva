# Inventario

L'inventario serve a controllare che le copie del catalogo siano davvero sugli scaffali. Si apre una campagna, si
leggono le copie scaffale per scaffale con il lettore di codici a barre, e alla chiusura le copie mai lette risultano
smarrite.

La pagina si apre dalla scheda **Inventario** del [Catalogo](catalog.md) e dall'azione **Inventario** della dashboard
(**Continua**, mentre una campagna è in corso). La usano gli account «Catalogazione» e «Amministrazione». La procedura
è in [Fare l'inventario](../guides/stocktaking.md).

<!-- figure: catalog/inventory-scan | Una campagna di inventario in corso: avanzamento, lettura delle copie e copie ancora da trovare -->

Nella figura:

1. Il nome della campagna e il pulsante **Chiudi inventario**: [Campagna in corso](#campagna-in-corso).
1. L'avanzamento: [Avanzamento](#avanzamento).
1. Il campo **Scaffale**: [Lettura delle copie](#lettura-delle-copie).
1. Il campo **Codice della copia**: [Lettura delle copie](#lettura-delle-copie).
1. Gli ultimi esiti: [Esiti della lettura](#esiti-della-lettura).
1. L'elenco «Ancora da trovare (N)»: [Copie ancora da trovare](#copie-ancora-da-trovare).

## Nuova campagna

Quando non c'è un inventario in corso la pagina scrive **Nessun inventario in corso** e ricorda: «Avviare una campagna e
leggere le copie scaffale per scaffale: alla chiusura le copie non lette vengono segnate come smarrite.»

1. Nel campo **Nome della campagna** scrivere un nome, oppure lasciare quello proposto (**Inventario** seguito dalla
   data di oggi).
1. Premere **Nuova campagna**.

Può esserci una sola campagna alla volta: se una è già aperta, la pagina risponde «C'è già un inventario in corso.»

## Campagna in corso

Il riquadro in alto riporta il nome della campagna, «Iniziato» con la data e l'ora, e il pulsante **Chiudi inventario**.
La campagna dura quanto serve: si può interrompere la lettura e riprenderla nei giorni seguenti; la dashboard offre il
pulsante **Continua**.

### Avanzamento

Una barra mostra le copie viste su quelle attese per tutta la biblioteca («N su M», con la percentuale) e una riga
riassume: «N copie lette · N fuori posto · N ritrovate». Aprendo **Avanzamento per scaffale** si vede la stessa barra
per ogni scaffale, cioè per ogni gruppo di segnature uguali; le copie senza segnatura stanno sotto **Senza segnatura**.

## Lettura delle copie

Il riquadro **Leggi le copie** è la parte che si usa durante il lavoro.

1. Nel campo **Scaffale** scrivere la sigla dello scaffale in lavorazione, per esempio `B` o `590`. Il campo suggerisce
   le sigle già note. Le copie lette la cui segnatura non corrisponde allo scaffale sono segnalate come fuori posto. Il
   campo può restare vuoto.
1. Leggere con il lettore di codici a barre il codice della copia (l'etichetta sul libro). Il campo **Codice della
   copia** ha già il cursore e si svuota dopo ogni lettura.
1. Leggere il codice della copia seguente. L'esito compare subito sotto (vedere [Esiti della
   lettura](#esiti-della-lettura)).
1. Passando a un altro scaffale, cambiare il contenuto di **Scaffale** e proseguire.

Il pulsante **Leggi con la fotocamera** è facoltativo: sostituisce il lettore con la fotocamera del dispositivo, che
resta accesa lettura dopo lettura; funziona solo con una connessione sicura (https), cioè con Tailscale. Durante la
lettura il titolo mostra «Scaffale» e la sigla; **Fine** chiude la fotocamera. La fotocamera conta soltanto i codici
che possono essere di una copia.

## Esiti della lettura

Gli ultimi cinque esiti restano visibili, ciascuno con un colore, un'icona e il testo.

### Vista

Verde: «titolo (codice): vista.» La copia è al suo posto ed è stata contata.

### Già letta

Grigio: «titolo (codice): già letta» seguito dalla data della prima lettura. Una seconda lettura non cambia nulla.

### Fuori posto

Arancione: «titolo (codice): fuori posto; ricollocarla secondo la segnatura.» La copia è sullo scaffale sbagliato; va
rimessa dove dice la segnatura.

### Ritrovata

Verde: «titolo (codice): era smarrita ed è stata ritrovata; è di nuovo disponibile.» La copia segnata come smarrita è
tornata e riprende a circolare.

### In prestito

Nel colore principale del tema: «titolo (codice): risulta in prestito; registrare la restituzione al banco.» Una copia
in prestito che si trova in biblioteca è un prestito da registrare come restituito alla pagina
[Restituzioni](checkin.md).

### Ritirata

Grigio: «titolo (codice): copia ritirata, da togliere dallo scaffale.»

### Codice sconosciuto

Rosso: «codice: nessuna copia ha questo codice.» Il codice non è di nessuna copia del catalogo; occorre controllare
l'etichetta.

## Copie ancora da trovare

Il riquadro «Ancora da trovare (N)» elenca le copie attese e non ancora lette, con la segnatura, il titolo (un
collegamento alla [Scheda del libro](book-record.md)) e il codice. L'elenco si restringe con **Scaffale** (**Tutti gli
scaffali** oppure uno scaffale) e **Materiale** (**Tutti i materiali** oppure un tipo). Quando tutto è stato letto, la
pagina scrive «Tutte le copie attese sono state viste.»

L'elenco mostra le prime copie; se sono di più, una riga dice «e altre N: per vederle tutte, esportare l'elenco». I
pulsanti CSV e ODS scaricano l'elenco completo con i filtri scelti: è l'elenco da portare sugli scaffali per la
ricerca finale.

## Chiusura dell'inventario

Quando la lettura è finita, **Chiudi inventario** chiede conferma («Chiudere l'inventario?») e avvisa quante copie
verranno segnate come smarrite: «Le N copie mai viste saranno segnate come smarrite. La campagna si può riaprire entro
una settimana per annullare.» Il pulsante **Chiudi inventario** della finestra conferma; **Annulla** lascia la campagna
com'è.

Dopo la chiusura la pagina mostra **Inventario chiuso** e il riepilogo: «N copie viste su M, N segnate come smarrite, N
ritrovate, N in prestito, N fuori posto.»

## Campagne precedenti

In fondo, sotto **Campagne precedenti**, sono elencate le campagne chiuse, ciascuna con il suo riepilogo. Per le
campagne chiuse da meno di una settimana compare il pulsante **Riapri**, che annulla la chiusura: le copie che la
chiusura aveva segnato come smarrite tornano com'erano e la campagna riprende. Si può riaprire una campagna soltanto se
non ce n'è già un'altra in corso; dopo una settimana la pagina risponde «Si può riaprire solo entro una settimana dalla
chiusura.»

## Altri messaggi

«Questo inventario è chiuso.», «Inventario non trovato.» e «Il nome della campagna è obbligatorio.» compaiono quando
si agisce su una campagna già chiusa, scomparsa, o si prova ad avviarne una senza nome.

## Pagine correlate

- [Catalogo](catalog.md)
- [Scheda del libro](book-record.md)
- [Restituzioni](checkin.md)
- [Fare l'inventario](../guides/stocktaking.md)
