# Rimuovere un utente

Questa pagina spiega come rimuovere dall'archivio uno studente o un docente che non frequenta più la scuola. La
rimozione cancella subito e per sempre i dati personali: non si può annullare. Serve a chi ha il permesso di rimuovere
gli utenti, di norma solo l'amministratore.

> [!WARNING]
> La rimozione è immediata e irreversibile. Nome e cognome, email, matricola, note, numero di tessera e foto vengono
> cancellati e non esiste alcun modo di recuperarli. Restano soltanto il tipo (studente o docente), la classe e lo
> storico dei prestiti, che servono alle statistiche e non indicano più chi era la persona.

- Tempo: circa 2 minuti.
- Account: Amministrazione. Di norma il permesso di rimuovere gli utenti non fa parte dell'account Tessere e foto: se
  il pulsante non compare, entrare con l'account Amministrazione.
- Occorrente: nessun prestito in corso a nome dell'utente. I libri vanno prima restituiti al banco prestiti, oppure
  segnati come smarriti: dalla scheda dell'utente con l'account Amministrazione (serve il permesso dei prestiti insieme
  a quello degli utenti), oppure cambiando lo stato della copia, come in
  [Togliere una copia smarrita o rovinata](withdraw-a-copy.md).
- Per togliere in una volta tutti gli alunni che hanno lasciato la scuola esiste la sincronizzazione con l'elenco della
  scuola: vedere [Importare gli alunni](../../admin/guides/import-students.md).

## Procedura

### Controllare i prestiti in corso

1. Accedere a BiblioViva con l'account Amministrazione.
1. Aprire **Utenti**.
1. Scrivere almeno tre lettere del cognome nel campo **Cerca per cognome…** e premere la riga dell'utente. Si apre la
   **Scheda dell'utente**.
1. Aprire la scheda **Prestiti in corso**. Se è vuota, compare «Nessun prestito in corso.» e si può proseguire.
1. Se ci sono libri in prestito, farli restituire al banco prestiti. Un libro che non torna si segna smarrito con
   **Segna smarrito**, seguito dal titolo, e poi **Segna smarrito** nella finestra di conferma.

### Rimuovere un utente

1. Nella **Scheda dell'utente** premere **Rimuovi studente** (per un docente **Rimuovi docente**). Se i pulsanti non
   stanno tutti nella riga, il comando si trova nel menu **Altre azioni**.

   <!-- figure: patrons/remove-dialog | La finestra di conferma Rimuovere definitivamente, con l'avviso sulle foto nelle
   immagini della classe -->

1. Leggere la finestra «Rimuovere definitivamente …?». Se l'utente era stato scelto per delle foto in un'immagine della
   classe, la finestra lo dice e avvisa che quei riquadri vengono coperti.
1. Premere **Rimuovi studente** (o **Rimuovi docente**) nella finestra. Compare l'avviso «Utente rimosso: i dati
   personali sono stati cancellati.».

### Rimuovere più utenti insieme

1. Aprire **Utenti** e usare i filtri per far comparire gli utenti da rimuovere, per esempio una classe.
1. Selezionare le righe tenendo premuto Ctrl, oppure Maiusc per un intervallo, mentre si preme sulla riga.
1. Premere **Rimuovi selezionati**. Si apre la finestra «Rimuovere N utenti?», che ripete quali dati si cancellano.
1. Premere **Rimuovi selezionati** nella finestra. L'avviso dice quanti utenti sono stati rimossi e quanti, avendo
   ancora prestiti in corso, sono rimasti in archivio.

## Risultato

La scheda dell'utente mostra il segno **Rimosso** e la scritta «Rimosso il …. Restano solo i dati per le statistiche.».
Nome, cognome, contatti, numero di tessera e foto non esistono più. La tessera dell'utente non vale più. Nelle immagini
della classe usate per il censimento il riquadro dell'utente è coperto e il suo file è cancellato, mentre l'immagine
resta alla classe. Gli utenti rimossi si ritrovano in **Utenti** scegliendo il filtro **Stato** → **Rimosso**.

## Possibili problemi

### L'utente ha ancora prestiti in corso

Compare «Ha N prestiti in corso: prima vanno restituiti o segnati smarriti.»: l'utente ha ancora dei libri. Restituirli
al banco prestiti o segnarli smarriti, poi ripetere la rimozione.

### Manca il pulsante per rimuovere lo studente

Il pulsante **Rimuovi studente** non c'è: l'account non ha il permesso di rimuovere gli utenti. Entrare con l'account
Amministrazione.

### Dopo una rimozione multipla alcuni utenti restano

Rimuovendo più utenti insieme, quelli con prestiti in corso non vengono rimossi e restano in archivio, senza alcun
messaggio per ciascuno. Il numero finale dell'avviso li conta.

### È stato rimosso l'utente sbagliato

Non c'è modo di annullare. Se l'alunno esiste ancora si può inserirlo di nuovo come utente nuovo, con un numero di
tessera nuovo: vedere [Iscrivere un alunno](enrol-a-student.md). I prestiti passati non tornano a suo nome.

## Pagine correlate

- [Correggere i dati di un utente](edit-a-patron.md)
- [Restituire un libro](return-a-book.md)
- [Avanzare di classe](../../admin/guides/class-upgrade.md), per gli alunni che hanno finito la scuola
- [Scheda dell'utente](../screens/patron-record.md)
