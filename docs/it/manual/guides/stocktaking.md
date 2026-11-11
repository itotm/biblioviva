# Fare l'inventario

Questa guida spiega come controllare con il lettore tutti i libri sugli scaffali, in uno o più giorni, per scoprire
quali copie mancano o sono fuori posto. Serve a chi cataloga i libri e rivede la biblioteca.

- Tempo: da qualche ora a più giorni, secondo il numero di libri. Il lavoro si interrompe e si riprende quando si vuole.
- Account: Catalogazione (anche Amministrazione).
- Occorrente: il lettore di codici a barre USB collegato a un computer portatile che si possa portare lungo gli scaffali
  e che raggiunga BiblioViva con il browser, e tutti i libri con l'etichetta del codice a barre. I libri senza etichetta
  vanno prima etichettati, vedere [Stampare le etichette dei libri](print-book-labels.md).

Durante il lavoro nessuna copia viene segnata smarrita. Solo quando si chiude l'inventario le copie mai lette diventano
**Smarrito**. Le copie che ci si aspetta sullo scaffale sono quelle **Disponibile**, **Danneggiato** o **In
riparazione**: non contano tra le mancanti le copie in prestito, ritirate, già smarrite o riservate alla consultazione.

## Procedura

### Aprire l'inventario

1. Aprire **Catalogo** e poi la scheda **Inventario**. Oppure premere **Inventario** nelle azioni rapide della
   **Dashboard**.
1. Se non c'è un inventario in corso compare «Nessun inventario in corso». Scrivere il **Nome della campagna** (di norma
   quello proposto, con la data) e premere **Nuova campagna**.

   <!-- figure: catalog/inventory-empty | La pagina Inventario prima di iniziare la campagna -->

   Può essere aperto un solo inventario per volta.

### Leggere le copie

1. Nel riquadro «Leggi le copie» scrivere nel campo **Scaffale** la sigla dello scaffale che si sta controllando, per
   esempio `B`, `B 4` o `590` (la parte iniziale della segnatura). Le copie che hanno un'altra segnatura saranno segnalate come
   fuori posto. Il campo si può lasciare vuoto.
1. Leggere con il lettore il codice a barre di ogni copia, nell'ordine in cui stanno sullo scaffale. Il campo **Codice
   della copia** ha già il cursore e si svuota dopo ogni lettura.

   <!-- figure: catalog/inventory-scan | Il riquadro per leggere le copie, con gli ultimi esiti -->

1. Dopo ogni lettura guardare la riga dell'esito: sono le ultime cinque, ognuna con colore, icona e testo.
   - «… vista.»: la copia è al suo posto, non serve altro.
   - «… già letta …»: la copia era già stata letta.
   - «… fuori posto; ricollocarla secondo la segnatura.»: rimettere il libro nello scaffale giusto.
   - «… era smarrita ed è stata ritrovata; è di nuovo disponibile.»: la copia torna disponibile da sola.
   - «… risulta in prestito; registrare la restituzione al banco.»: il libro è sullo scaffale ma il prestito è ancora
     aperto.
   - «… copia ritirata, da togliere dallo scaffale.»: il libro non fa più parte della biblioteca.
   - «…: nessuna copia ha questo codice.»: codice letto non presente in catalogo.
1. Quando si cambia scaffale cambiare il valore del campo **Scaffale**.
1. Per interrompere il lavoro basta chiudere la pagina o spegnere il computer: gli esiti letti restano salvati. Per
   riprendere aprire di nuovo **Inventario**, oppure premere **Continua** nel riquadro «Inventario» della **Dashboard**,
   che mostra l'avanzamento. Gli esiti dei giorni precedenti contano ancora.

### Seguire l'avanzamento

1. In alto la barra **Tutta la biblioteca** dice «N su M (P%)», cioè quante copie attese sono state viste. Sotto sta il
   riepilogo «N copie lette · N fuori posto · N ritrovate».
1. Aprire **Avanzamento per scaffale** per una barra per ogni scaffale, con le copie senza segnatura sotto «Senza
   segnatura».
1. Nel riquadro **Ancora da trovare (N)** leggere le copie non ancora lette, ognuna con segnatura, titolo e codice.
   L'elenco si restringe con **Scaffale** (**Tutti gli scaffali**) e **Materiale** (**Tutti i materiali**).
1. Per avere l'elenco intero, anche quando è più lungo di quello mostrato («e altre N»), premere **Esporta** e scegliere **CSV (foglio di calcolo, testo)** oppure **ODS (LibreOffice)**. Con l'inventario della scuola attivo ogni copia dell'elenco porta «Inv.» e il numero
   d'inventario, e il file scaricato ha il **Numero d'inventario** come prima colonna: è l'elenco per la ricognizione
   dei beni, almeno quinquennale. Le scelte MARC e UNIMARC dello stesso menu scaricano i titoli con le sole copie mancanti
come record MARC, per un altro programma di biblioteca.

   <!-- figure: catalog/inventory-progress | L'avanzamento dell'inventario e l'elenco delle copie ancora da trovare -->

### Chiudere l'inventario

1. Quando tutti gli scaffali sono stati letti, cercare con calma le copie che risultano ancora da trovare nell'elenco
   **Ancora da trovare (N)**: ogni copia ritrovata e letta esce dall'elenco.
1. Premere **Chiudi inventario**. Si apre la finestra «Chiudere l'inventario?», che dice quante copie mai viste
   diventeranno smarrite: «Le N copie mai viste saranno segnate come smarrite.».
1. Premere **Chiudi inventario** nella finestra per confermare.
1. Leggere il riepilogo «Inventario chiuso»: «N copie viste su M, N segnate come smarrite, N ritrovate, N in prestito, N
   fuori posto.».

### Annullare la chiusura

Entro una settimana dalla chiusura l'inventario si può riaprire, per esempio se si è chiuso troppo presto.

1. Nel riquadro **Campagne precedenti** premere **Riapri** sulla riga dell'inventario chiuso. Il pulsante c'è solo entro
   una settimana dalla chiusura.
1. Le copie che la chiusura aveva segnato smarrite tornano allo stato di prima e l'inventario è di nuovo in corso.

## Risultato

L'inventario è chiuso. Le copie mai viste sono **Smarrito**, ognuna con il motivo «inventario» seguito dal nome della
campagna; le copie fuori posto sono state ricollocate; l'elenco delle copie mancanti è stato esportato, se serviva. Un
nuovo inventario si può aprire quando si vuole.

## Possibili problemi

### Il codice letto non corrisponde a nessuna copia

Il codice letto dice «nessuna copia ha questo codice»: il libro potrebbe avere un'etichetta di un altro sistema o essere
stato catalogato senza etichetta di BiblioViva. Catalogarlo o stampare la sua etichetta, vedere [Catalogare un libro
nuovo](catalog-a-new-book.md).

### C'è già un inventario in corso

Compare «C'è già un inventario in corso.»: si può aprire una sola campagna per volta. Continuare quella aperta o
chiuderla.

### L'inventario non si può riaprire

Compare «Si può riaprire solo entro una settimana dalla chiusura.»: il tempo è scaduto. Le copie smarrite si rimettono
**Disponibile** a mano, una per una o con una modifica di massa, vedere [Togliere una copia smarrita o
rovinata](withdraw-a-copy.md).

### Una copia sullo scaffale giusto risulta fuori posto

Una copia fuori posto dà «fuori posto» ma è sullo scaffale giusto: il campo **Scaffale** era rimasto sulla sigla dello
scaffale precedente: cambiarlo e rileggere la copia.

### Il computer si spegne a metà inventario

Nulla va perso, perché gli esiti letti sono salvati. Riaprire **Inventario**.

### La copia in prestito risulta mancante

Le copie in prestito non si contano tra le mancanti. Se il libro è sullo scaffale registrare la restituzione al banco,
vedere [Restituire un libro](return-a-book.md).

### Usare la fotocamera del telefono al posto del lettore

È un'alternativa facoltativa che richiede Tailscale (HTTPS), vedere [Scegliere la rete](../../setup/choose-network.md).
Nel riquadro «Leggi le copie» premere **Leggi con la fotocamera**, inquadrare i codici uno dopo l'altro e premere
**Fine** al termine.

## Pagine correlate

- [Togliere una copia smarrita o rovinata](withdraw-a-copy.md)
- [Stampare le etichette dei libri](print-book-labels.md)
- [Restituire un libro](return-a-book.md)
- [Inventario](../screens/inventory.md)
