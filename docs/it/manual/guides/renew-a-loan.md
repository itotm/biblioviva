# Rinnovare un prestito

Questa pagina spiega come prolungare la scadenza di un libro che l'utente vuole tenere più a lungo. È per chi lavora al
Banco prestiti con l'account Gestione prestiti. Il rinnovo si può fare in tre modi, a seconda di dove si parte.

- Tempo: meno di un minuto.
- Account: Gestione prestiti (anche Amministrazione).
- Occorrente: la tessera dell'utente, oppure il libro, oppure il nome dell'utente.

## Procedura

### Dal Banco prestiti, con la tessera

1. Aprire **Prestiti** e leggere la tessera dell'utente. Nella sua scheda compaiono i libri che ha, ciascuno con la
   scadenza.
1. Premere **Rinnova** nella riga del libro da rinnovare. Un messaggio conferma il rinnovo con la nuova scadenza.
1. Per rinnovare tutti i libri dell'utente in una volta, premere **Rinnova tutti** (compare quando i libri sono più di
   uno). Il messaggio dice quanti prestiti su quanti sono stati rinnovati, e spiega uno per uno quelli rifiutati.

   <!-- figure: circulation/checkout-renew | La scheda dell'utente con i pulsanti Rinnova e Rinnova tutti -->

1. Premere **Fine**.

### Dalle restituzioni, quando l'utente porta il libro

1. Aprire **Restituzioni** e leggere il codice del libro. Il libro risulta restituito.
1. Premere **Rinnova invece** nella riga del libro. Il prestito è riaperto e rinnovato: un messaggio dà la nuova
   scadenza e la riga mostra «rinnovato fino al» con la data.

### Da Libri in prestito, per più utenti

1. Aprire **Libri in prestito** e cercare i prestiti, come in [Controllare i libri in prestito](open-loans.md).
1. Selezionare le righe da rinnovare con la casella a sinistra.
1. Premere **Rinnova selezionati**. Il messaggio dice quanti prestiti su quanti sono stati rinnovati.

## Risultato

Il prestito resta aperto con una nuova scadenza, contata con le regole dei prestiti e secondo il calendario della
scuola. Con le impostazioni predefinite la nuova scadenza parte dalla data del rinnovo, e si possono fare fino a cinque
rinnovi per libro (uno solo per i DVD). La colonna **Rinnovi** di **Libri in prestito** conta quelli fatti.

## Possibili problemi

I messaggi dei rinnovi sono elencati nella pagina [Prestiti](../screens/checkout.md); qui i casi più frequenti.

### Il libro è già stato rinnovato il massimo di volte

Il messaggio dice quante volte è stato rinnovato. Il libro deve essere restituito: premere **Restituisci**, che apre
**Restituzioni** con il codice del libro, poi confermare con Invio.

### Il rinnovo non è consentito perché il libro è in ritardo

Con le regole predefinite si può rinnovare anche un libro in ritardo; se l'amministratore ha cambiato la regola, il
messaggio dice quanti giorni di ritardo ha il libro. Premere **Restituisci**.

### La scadenza è già l'ultimo giorno di prestito dell'anno

Se l'amministratore ha fissato una scadenza massima (per esempio la fine delle lezioni), non si può andare oltre. Il
messaggio dà la data; premere **Restituisci**.

### L'amministratore vuole rinnovare comunque

Per l'account Amministrazione, i messaggi di rinnovo non consentito hanno anche **Forza (solo admin)** (non per la
scadenza massima). Si apre la finestra **Forzare il rinnovo?**: scrivere il **Motivo** e premere **Rinnova comunque**.
Il motivo resta nel registro.

### Alcuni libri non sono stati rinnovati

Dopo **Rinnova tutti** o **Rinnova selezionati**, il primo messaggio conta i rinnovi riusciti. Sotto, un messaggio per
ogni libro rifiutato dice perché.

### L'utente è al limite di prestiti ma vuole un altro libro

Il rinnovo non libera un posto: serve la restituzione. Vedere [Prestare un libro](lend-a-book.md).

## Pagine correlate

- [Prestare un libro](lend-a-book.md)
- [Restituire un libro](return-a-book.md)
- [Controllare i libri in prestito](open-loans.md)
- [Impostare le regole dei prestiti](../../admin/guides/set-loan-rules.md)
