# Togliere una copia smarrita o rovinata

Questa guida spiega come segnare in BiblioViva che una copia è smarrita, rovinata, in riparazione o definitivamente
tolta dallo scaffale (ritirata), per una copia sola o per molte insieme. Serve a chi cataloga i libri.

- Tempo: circa 1 minuto per una copia.
- Account: Catalogazione (anche Amministrazione).
- Occorrente: il codice della copia, che sta sull'etichetta del libro (se il libro manca, la copia si trova dalla scheda
  del libro, vedere [Cercare un libro](find-a-book.md)).

La copia non si cancella: cambia stato e resta nell'archivio, con il motivo, per tutta la vita del catalogo. Gli stati
sono questi:

- **Disponibile**: la copia sta sullo scaffale e si presta.
- **Smarrito**: la copia non si trova. Non si presta.
- **Danneggiato**: la copia è rovinata ma si presta ancora; per fermarla scegliere **In riparazione**.
- **In riparazione**: la copia è fuori dallo scaffale per essere sistemata. Non si presta.
- **Ritirato**: la copia è stata tolta dalla biblioteca. Non si presta mai, nemmeno forzando il prestito. Quando tutte
  le copie di un libro sono ritirate, il libro sparisce dalle ricerche del catalogo.

## Procedura

### Cambiare lo stato di una copia

1. Aprire la scheda del libro da **Catalogo**, vedere [Cercare un libro](find-a-book.md).
1. Nella scheda **Copie** trovare la riga della copia dal **Codice**.
1. Premere l'icona della chiave inglese sulla riga della copia (il suggerimento dice «Stato della copia …»). Si apre la
   finestra con il codice della copia nel titolo.

   <!-- figure: catalog/item-status-dialog | La finestra per cambiare lo stato di una copia -->

1. In **Nuovo stato** scegliere **Smarrito**, **Danneggiato**, **In riparazione**, **Ritirato** oppure **Disponibile**.
1. In **Motivo (facoltativo, registrato)** scrivere perché, per esempio «perso da un alunno» o «pagine strappate». Il
   motivo resta nel registro delle operazioni di quella copia.
1. Premere **Cambia stato**. Un avviso conferma «Stato aggiornato» e la riga mostra lo stato nuovo.

Una copia in prestito si può segnare **Smarrito**: il prestito si chiude e la copia risulta smarrita, anche nella scheda
dell'utente. Una copia in prestito non si può ritirare: compare «La copia è in prestito: prima registra la
restituzione.». Registrare la restituzione al banco e poi ritirare la copia.

### Cambiare lo stato di molte copie insieme

Per togliere molte copie in una volta, per esempio dopo una revisione dello scaffale, si usa la selezione del catalogo.

1. Aprire **Catalogo** e cercare i libri interessati, vedere [Cercare un libro](find-a-book.md).
1. Selezionare i libri con Ctrl + clic (o Maiusc + clic per un gruppo) sulle righe.
1. Premere **Modifica le copie dei selezionati**. Si apre la finestra **Modifica le copie**, che dice su quante copie
   lavora.
1. In **Cosa cambiare** scegliere **Stato**.
1. In **Nuovo valore** scegliere lo stato, per esempio **Ritirato**.
1. Scrivere il **Motivo**: è obbligatorio per le copie perse e ritirate.
1. Premere **Controlla**. La finestra dice quante copie cambiano e quali restano come sono: le copie in prestito restano
   come sono finché non vengono restituite.
1. Premere **Applica a N copie**. Un avviso conferma «N copie modificate».

### Rimettere in servizio una copia

1. Aprire la scheda del libro e premere l'icona della chiave inglese sulla riga della copia.
1. In **Nuovo stato** scegliere **Disponibile** e premere **Cambia stato**.

Una copia smarrita che ricompare si può anche restituire al banco con **Restituzioni**: torna disponibile da sola.

### Eliminare una copia inserita per errore

L'eliminazione serve solo per gli errori di catalogazione e solo per una copia mai prestata.

1. Premere l'icona del cestino sulla riga della copia.
1. Nella finestra «Eliminare la copia …?» premere **Elimina copia**. Un avviso conferma «Copia eliminata».

## Risultato

La copia mostra il nuovo stato sulla scheda del libro e non si presta (tranne se **Disponibile** o **Danneggiato**).
Lo stato **Ritirato** toglie la copia anche dal conteggio «N disponibili su M» del libro. Il motivo e chi ha cambiato lo
stato restano nel registro.

## Possibili problemi

- Compare «La copia è in prestito: prima registra la restituzione.»: una copia in prestito non si ritira. Registrare
  la restituzione, vedere [Restituire un libro](return-a-book.md), poi cambiare lo stato.
- Compare «La copia ha prestiti registrati: va ritirata, non eliminata.»: una copia già prestata non si elimina, per
  non perdere lo storico. Scegliere **Ritirato**.
- Un libro ritirato non si trova più in catalogo: spuntare **Mostra anche i libri ritirati**, vedere
  [Cercare un libro](find-a-book.md).
- Al banco una copia si rifiuta con «risulta … e non può essere prestato»: la copia ha uno stato che non permette il
  prestito. Aprire la scheda del libro e controllare lo stato: se il libro è di nuovo sullo scaffale scegliere
  **Disponibile**.
- Molte copie risultano smarrite dopo l'inventario: le copie non lette alla chiusura dell'inventario sono segnate
  **Smarrito**; vedere [Fare l'inventario](stocktaking.md) per come annullare la chiusura entro una settimana.

## Pagine correlate

- [Fare l'inventario](stocktaking.md)
- [Restituire un libro](return-a-book.md)
- [Cercare un libro](find-a-book.md)
- [Scheda del libro](../screens/book-record.md)
