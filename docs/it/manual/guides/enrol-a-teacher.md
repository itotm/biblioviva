# Iscrivere un docente

Questa pagina spiega come inserire in BiblioViva un docente che non c'è ancora, con il numero della tessera e, se si
vuole, la foto. Serve a chi gestisce gli utenti. Per inserire tutti i docenti in una volta esiste l'importazione
descritta in [Importare i docenti](../../admin/guides/import-teachers.md).

- Tempo: circa 3 minuti, circa 5 con la foto.
- Account: Tessere e foto (anche Amministrazione).
- Occorrente: cognome e nome del docente. Facoltativi: la matricola e l'indirizzo email.
- Per la foto: un file con la foto oppure, solo con Tailscale, la fotocamera del computer. Se l'amministratore ha
  disattivato le foto, questa parte si salta.

Un docente non ha una classe: appartiene a un gruppo di docenti. Di norma esiste un solo gruppo, quello proposto da
BiblioViva, e non occorre scegliere nulla.

## Procedura

### Compilare i dati

1. Accedere a BiblioViva con l'account Tessere e foto.
1. Aprire **Utenti**.
1. Premere **Nuovo utente**. Si apre la pagina **Nuovo utente**.
1. In **Tipo** scegliere **Docente**. Il campo **Classe** si disattiva e il campo seguente cambia nome in
   **Gruppo docenti**.

   <!-- figure: patrons/new-teacher | La pagina Nuovo utente con il tipo Docente e il campo Gruppo docenti -->

1. Scrivere il cognome nel campo **Cognome**.
1. Scrivere il nome nel campo **Nome**.
1. Lasciare in **Gruppo docenti** la voce «Il gruppo dei docenti», a meno che la scuola abbia più gruppi: in quel caso
   scegliere quello giusto.
1. Lasciare vuoto il campo **Numero tessera**: BiblioViva assegna da sola il numero.
1. Se serve, scrivere il codice del registro elettronico nel campo **Matricola**.
1. Se serve, aprire la parte **Contatti** e scrivere l'indirizzo nel campo **Email**.

### Aggiungere la foto (facoltativo)

La foto si aggiunge con la scheda **Foto**, sopra il modulo, con gli stessi passi dell'alunno: vedere
[Iscrivere un alunno](enrol-a-student.md#aggiungere-la-foto-facoltativo). La foto si può anche fare dopo, dalla scheda
dell'utente: vedere [Fare le foto degli utenti](take-patron-photos.md).

### Salvare e stampare la tessera

1. Premere **Crea utente**. Si apre la **Scheda dell'utente**.
1. Aprire la scheda **Tessera**.
1. Premere **Stampa tessera** e seguire la finestra che si apre. Il taglio e la piegatura sono spiegati in [Stampare le
   tessere di una classe](print-class-cards.md#stampare-e-tagliare).
1. Dopo la stampa premere **Segna come stampata**.

## Risultato

Il docente compare in **Utenti**, filtrando **Tipo** su **Docente** oppure cercando le prime lettere del cognome. La sua
scheda mostra il tipo «Docente» al posto della classe e il numero della tessera. Sulla tessera stampata, di norma, al
posto della classe compare «Docente».

## Possibili problemi

### La matricola è già assegnata

Compare «Matricola già assegnata a un altro utente.»: il docente è probabilmente già inserito. Cercarlo in **Utenti**.

### Il numero di tessera non è accettato

Compare «Il numero di tessera è o sembra il codice di una copia: scegliere un altro numero.»: svuotare il campo
**Numero tessera**.

### La fotocamera richiede una connessione sicura

Compare «La fotocamera funziona solo con una connessione sicura (https)…»: senza Tailscale usare **Carica file**.

### La scheda Foto non compare

L'amministratore ha disattivato le foto.

## Pagine correlate

- [Iscrivere un alunno](enrol-a-student.md)
- [Fare le foto degli utenti](take-patron-photos.md)
- [Ristampare una tessera](replace-a-lost-card.md)
- [Correggere i dati di un utente](edit-a-patron.md)
