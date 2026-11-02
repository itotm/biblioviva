# Ristampare una tessera

Questa pagina spiega che cosa fare quando un utente ha perso la tessera o l'ha rovinata. Se la tessera è solo rovinata
si stampa di nuovo la stessa; se è smarrita si assegna un numero nuovo e si stampa la tessera con quel numero. Serve a
chi gestisce le tessere.

- Tempo: circa 5 minuti.
- Account: Tessere e foto (anche Amministrazione).
- Occorrente: il nome dell'utente, una stampante e un foglio A4.

> [!IMPORTANT]
> Con **Riassegna tessera** il numero attuale viene ritirato per sempre e non torna più a nessuno. Se l'utente ritrova
> la vecchia tessera, quella non serve più. Usare questo comando solo quando la tessera è davvero persa.

## Procedura

### Trovare l'utente

1. Accedere a BiblioViva con l'account Tessere e foto.
1. Aprire **Utenti**.
1. Scrivere almeno tre lettere del cognome nel campo **Cerca per cognome…**.
1. Premere la riga dell'utente. Si apre la **Scheda dell'utente**.
1. Aprire la scheda **Tessera**. Mostra il numero e il codice a barre della tessera attuale e dice se è già stata
   stampata.

   <!-- figure: patrons/card-tab | La scheda Tessera della scheda dell'utente con i pulsanti di stampa e Riassegna
   tessera -->

### Ristampare la stessa tessera (tessera rovinata)

La tessera conserva il suo numero: i prestiti e la scheda restano come sono.

1. Premere **Stampa tessera**. Si apre la finestra **Stampa tessere**.
1. Scegliere **Come stampare** e premere **Stampa**. La scelta, la stampa e il taglio sono spiegati in [Stampare le
   tessere di una classe](print-class-cards.md#scegliere-come-stampare).
1. Dopo la stampa premere **Segna come stampata**.

### Assegnare una tessera nuova (tessera smarrita)

1. Premere **Riassegna tessera**. Si apre la finestra «Assegnare una nuova tessera?», che avverte: «Il numero attuale
   viene ritirato per sempre e la nuova tessera andrà stampata.».
1. Premere **Riassegna tessera** nella finestra. Compare l'avviso «Nuova tessera:» seguito dal numero nuovo. La scheda
   **Tessera** mostra il numero nuovo e la scritta «Tessera non ancora stampata.».
1. Premere **Stampa tessera** e seguire la finestra, come nella parte precedente.
1. Dopo la stampa premere **Segna come stampata**.
1. Consegnare la tessera nuova all'utente e togliere dalla circolazione la vecchia, se si ritrova.

I prestiti in corso restano all'utente: appartengono a lui e non alla tessera. Al banco prestiti la tessera nuova va
letta con il lettore di codici a barre come la vecchia. Il numero della vecchia tessera non appartiene più a nessuno:
se viene letto, il banco risponde che il codice non è stato trovato.

## Risultato

L'utente ha una tessera che funziona. Con una tessera nuova, la **Scheda dell'utente** mostra il numero nuovo e la
vecchia tessera non identifica più nessuno.

## Possibili problemi

### Non si può stampare la tessera

Il pulsante **Stampa tessera** non c'è: l'utente non ha un numero di tessera, oppure è stato rimosso. Una persona
rimossa non ha più tessera; per un utente senza numero premere **Riassegna tessera**.

### Il foglio esce senza la foto

L'utente non ha la foto, oppure l'amministratore ha disattivato le foto. Vedere [Fare le foto degli
utenti](take-patron-photos.md).

### I retri non cadono dietro i fronti

I retri non cadono dietro i fronti, o le misure non tornano: vedere i possibili problemi di [Stampare le tessere di una
classe](print-class-cards.md#possibili-problemi).

### La tessera è stata riassegnata per sbaglio

Si è premuto **Riassegna tessera** per sbaglio: il numero precedente non si recupera. La tessera nuova va comunque
stampata e consegnata.

## Pagine correlate

- [Stampare le tessere di una classe](print-class-cards.md)
- [Correggere i dati di un utente](edit-a-patron.md)
- [Scheda dell'utente](../screens/patron-record.md)
