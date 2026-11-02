# Stampare le etichette dei libri

Questa guida spiega come stampare le etichette adesive da incollare sui libri: la fascetta per il dorso, con la
segnatura e il pittogramma, e l'etichetta con il codice a barre. Serve a chi cataloga i libri e li prepara per lo
scaffale.

- Tempo: circa 5 minuti per un foglio di libri.
- Account: Catalogazione (anche Amministrazione).
- Occorrente: i fogli di etichette adesive del formato scelto dalla biblioteca (di norma 70 × 48 mm, diciotto etichette
  per foglio A4), la stampante collegata al computer del banco prestiti e le copie già in catalogo, vedere
  [Catalogare un libro nuovo](catalog-a-new-book.md). La prima volta provare la stampa su carta comune, vedere
  [Provare il lettore e la stampante](../../setup/steps/scanner-printer.md).

Per ogni libro si stampa di norma una coppia di etichette, una sopra l'altra su due posti del foglio:

- la fascetta (sopra) è larga abbastanza da avvolgere il dorso: porta il titolo breve, il pittogramma del genere o
  dell'argomento e la segnatura in due righe grandi (per esempio `B 4` e `DEL`);
- l'etichetta con il codice a barre (sotto) porta la segnatura, il titolo breve, il codice a barre e il numero della
  copia. È l'etichetta che il lettore legge al banco prestiti.

Con il foglio da 70 × 48 mm una coppia occupa due etichette e un foglio ospita nove libri. La finestra di stampa calcola
da sola il numero di fogli.

> [!NOTE]
> La fascetta si stampa solo per i libri classificati. Per un libro ancora **Da classificare** si stampa solo l'etichetta
> con il codice a barre; la fascetta si stampa dopo la classificazione, vedere [Classificare i libri](classify-books.md).

## Procedura

### Stampare le etichette di un libro o di una copia

1. Aprire la scheda del libro da **Catalogo**. Subito dopo la catalogazione di un libro nuovo lo stesso pulsante
   **Stampa etichette** sta nella conferma «Scheda salvata».
1. Per tutte le copie del libro premere **Stampa etichette** in alto nella scheda (nel menu delle altre azioni se la
   finestra è stretta). Per una copia sola premere l'icona della stampante sulla riga della copia.
1. Nella finestra **Stampa etichette**, in **Tipo di etichetta**, lasciare **Coppia** (fascetta sopra e etichetta con il
   codice a barre sotto) oppure scegliere **Solo barcode** (per ristampare l'etichetta del codice) o **Solo fascetta**
   (per esempio dopo una riclassificazione). Sotto la scelta un testo spiega il tipo.

   <!-- figure: catalog/label-print-dialog | La finestra Stampa etichette, con il tipo, il foglio e la prima posizione
   libera -->

1. Controllare il **Foglio di etichette**. Il foglio proposto è quello configurato per il tipo scelto; se la biblioteca
   ha più prodotti di etichette si sceglie quello in uso.
1. Se il foglio è già stato usato in parte, scrivere in **Prima posizione libera** il numero della prima posizione
   ancora libera (da 1 al massimo indicato). Le posizioni si contano in coppie per il tipo **Coppia**.
1. Leggere la riga sotto i campi: dice quante copie e quanti fogli servono («N copie · N fogli (M per foglio)»).
1. Premere **Apri la stampa**. La pagina di stampa si apre in una nuova scheda del browser.
1. Nella finestra di stampa del browser impostare la scala al 100 % («Dimensioni effettive», mai «Adatta alla pagina») e
   i margini su nessuno. Inserire il foglio di etichette adesive nella stampante e stampare.
1. Tornare a BiblioViva. La finestra ricorda «La pagina di stampa è aperta in una nuova scheda. Dopo la stampa, segnare
   le etichette come stampate.». Premere **Segna come stampate**. Un avviso conferma «N copie segnate come stampate».
1. Incollare le etichette sui libri: la fascetta intorno al dorso, l'etichetta con il codice a barre sul libro.

### Stampare le etichette di molti libri

Per i libri catalogati in una giornata o per un gruppo di libri si usano le liste di stampa.

1. Aprire **Catalogo** e cercare i libri (anche per **Anno da**/**Anno a**, vedere [Cercare un libro](find-a-book.md)).
1. Selezionare i libri con Ctrl + clic (o Maiusc + clic per un gruppo).
1. Premere **Stampa etichette dei selezionati**. Si apre la stessa finestra **Stampa etichette**, che conta le copie di
   tutti i libri selezionati. Proseguire dalla scelta del tipo come nella procedura precedente.

Per scegliere i libri senza selezionarli uno a uno si costruisce una lista:

1. Aprire **Stampe** e premere **Nuova lista libri**.
1. Nella lista, sotto **Aggiungi con i filtri**, scegliere in **Etichette da stampare** il tipo di etichetta mancante
   (**Coppia**, **Solo barcode**, **Solo fascetta**) e premere **Aggiungi alla lista**. Entrano tutte le copie che hanno
   etichette ancora da stampare.
1. Premere **Stampa etichette** nella lista, poi procedere come sopra.
1. Dopo la stampa premere **Segna come stampate**: il tipo di etichetta da segnare si sceglie nel menu accanto al
   pulsante. Con **Svuota la lista dopo la stampa** spuntato la lista si svuota da sola.

Le liste sono spiegate in [Usare le liste di stampa](use-print-lists.md).

### Stampare le etichette che mancano

La **Dashboard** conta le copie senza etichette nel riquadro **Libri senza etichette**.

1. Aprire la **Dashboard** e premere il riquadro **Libri senza etichette**. Si apre la finestra **Stampa etichette**,
   con la riga «N copie con etichette da stampare».
1. Scegliere tipo, foglio e prima posizione libera e premere **Apri la stampa**.
1. Dopo la stampa tornare a BiblioViva e premere **Segna come stampate**: sono segnate esattamente le copie che la pagina
   di stampa ha elencato quando è stata aperta, e il riquadro **Libri senza etichette** scende. Una copia catalogata nel
   frattempo resta da stampare.

## Risultato

Le copie stampate mostrano nella colonna **Etichette** della scheda del libro **Etichette stampate**, e il riquadro
**Libri senza etichette** della **Dashboard** scende. I libri hanno la fascetta e l'etichetta con il codice a barre: al
banco prestiti il lettore legge il codice dell'etichetta e apre la copia.

## Possibili problemi

### Le etichette escono spostate rispetto al foglio

La stampa non è al 100 % oppure ha i margini del browser. Controllare la finestra di stampa del browser: scala 100 %,
margini nessuno. La pagina di calibrazione per il tipo di foglio la stampa l'amministratore, vedere [Aggiungere un foglio
di etichette](../../admin/guides/add-a-label-stock.md).

### Il foglio è stato usato in parte

La stampa sovrascrive le etichette già usate: scrivere in **Prima posizione libera** il numero della prima etichetta
ancora libera.

### Ci sono copie ancora da classificare

Compare «N copie di libri da classificare: si stampa solo l'etichetta col codice a barre, la fascetta del dorso dopo la
classificazione.»: il libro non è classificato. Classificarlo, poi ristampare la fascetta con **Solo fascetta**.

### Non si può aprire la stampa

Il pulsante **Apri la stampa** è grigio e non risponde: non ci sono copie da stampare, oppure manca il foglio di
etichette. Controllare la riga con il numero di copie e il campo **Foglio di etichette**.

### Il lettore non legge il codice a barre dell'etichetta

Controllare che il lettore legga Code 128 e Code 39, e che la stampa non sia ridotta o troppo chiara. Vedere [Provare il
lettore e la stampante](../../setup/steps/scanner-printer.md).

### La fascetta ha il testo troppo lungo o il pittogramma sbagliato

La fascetta segue la classificazione e la segnatura della copia: correggerle, vedere [Correggere la scheda di un
libro](edit-a-record.md), e ristampare con **Solo fascetta**. Il modello grafico delle etichette lo modifica
l'amministratore, vedere [Modificare le etichette e la fascetta del
dorso](../../admin/guides/edit-label-templates.md).

## Pagine correlate

- [Catalogare un libro nuovo](catalog-a-new-book.md)
- [Classificare i libri](classify-books.md)
- [Usare le liste di stampa](use-print-lists.md)
- [Provare il lettore e la stampante](../../setup/steps/scanner-printer.md)
- [Aggiungere un foglio di etichette](../../admin/guides/add-a-label-stock.md)
- [Modificare le etichette e la fascetta del dorso](../../admin/guides/edit-label-templates.md)
