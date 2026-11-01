# Controllare i libri in prestito

Questa pagina spiega come vedere quali libri sono fuori, chi li ha e quando devono tornare, e come cercare, filtrare,
rinnovare ed esportare l'elenco. È per chi lavora al Banco prestiti con l'account Gestione prestiti.

- Tempo: pochi minuti.
- Account: Gestione prestiti (anche Amministrazione). Aprire la scheda dell'utente da una riga richiede anche il
  permesso degli utenti, che tra gli account predefiniti ha solo Amministrazione.
- Occorrente: niente di particolare.

## Procedura

1. Aprire **Libri in prestito** dalle schede in alto del Banco prestiti. La pagina non mostra subito l'elenco: dice
   quanti libri sono in prestito e invita a cercare.

   <!-- figure: circulation/loans-start | La pagina Libri in prestito prima della ricerca -->

1. Scrivere nel campo **Cerca per cognome o codice del libro** almeno tre lettere del cognome, oppure un codice. Un
   codice di sole cifre si cerca anche con meno di tre.
1. In alternativa, o in più, scegliere un filtro: **Tipo** (Studenti o Docenti), **Classe**, oppure il segno su
   **Solo in ritardo**. Con un filtro l'elenco compare anche senza testo.
1. Leggere l'elenco. Sopra, una riga dice quanti prestiti sono stati trovati. Ogni riga ha l'utente, la classe, il
   titolo, il codice della copia, la scadenza e, se il libro è in ritardo, i giorni di ritardo.

   <!-- figure: circulation/loans-overdue | I prestiti in ritardo di una classe -->

1. Per ordinare l'elenco, fare clic sull'intestazione di **Utente**, **Classe**, **Titolo** o **Giorni ritardo**.
1. Per togliere ricerca e filtri, premere **Togli i filtri**.

### Rinnovare più prestiti

1. Selezionare le righe con la casella a sinistra.
1. Premere **Rinnova selezionati**. Vedere [Rinnovare un prestito](renew-a-loan.md).

### Esportare l'elenco

1. Sotto la tabella, premere **Esporta**.
1. Scegliere il formato: CSV oppure ODS. Il file contiene i prestiti trovati con la ricerca e i filtri in uso.

## Risultato

L'elenco mostra, per ogni prestito, l'utente, la classe, il titolo, il codice della copia, la scadenza, i giorni di
ritardo, i rinnovi fatti e la data dell'ultimo sollecito.

## Possibili problemi

### L'elenco è vuoto

Se la pagina dice che non c'è nessun prestito in corso, non c'è nulla fuori. Se i prestiti ci sono, la ricerca è troppo
stretta: premere **Togli i filtri** e riprovare.

### Un clic sulla riga non fa nulla

La scheda dell'utente si apre solo con un account che ha il permesso dei prestiti e quello degli utenti: tra gli account
predefiniti, solo Amministrazione. L'account Gestione prestiti non ha accesso alle schede degli utenti: per i dati dell'utente
usare l'elenco.

### Serve l'elenco di una classe intera

Scegliere la classe in **Classe**, poi **Esporta**.

### Si cerca un libro e non si sa a chi sia

Scrivere il codice della copia nel campo di ricerca. Per cercare per titolo usare il Catalogo
([Cercare un libro](find-a-book.md)): la **Scheda del libro** mostra chi ha ciascuna copia.

## Pagine correlate

- [Stampare i solleciti](overdue-reminders.md)
- [Rinnovare un prestito](renew-a-loan.md)
- [Prestare o restituire una copia senza etichetta](book-without-label.md)
- [Libri in prestito](../screens/loans.md)
