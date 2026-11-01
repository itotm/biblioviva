# Segnare le chiusure nel calendario

Questa pagina spiega come consultare il calendario della biblioteca, come aggiungere le date da ricordare (una lettura
in classe, la scadenza di un concorso) e come segnare i giorni in cui la biblioteca è chiusa, che spostano le scadenze
dei prestiti. Le date da ricordare le scrive chi lavora al banco; le chiusure le segna l'amministratore.

- Tempo: pochi minuti.
- Account: per consultare il calendario, qualsiasi account. Per aggiungere le date da ricordare, Gestione prestiti o
  Amministrazione. Per segnare le chiusure, solo Amministrazione.
- Occorrente: le date delle chiusure della scuola (vacanze, ponti, giornate senza lezione).

## Procedura

### Consultare il calendario

1. Aprire **Calendario** dalle schede in alto del Banco prestiti. Gli altri account lo aprono dalla dashboard, nel
   riquadro **Prossime date**, con **Apri il calendario**.
1. Leggere l'anno scolastico mostrato nel titolo. Per cambiare anno premere il pulsante con l'anno precedente o con
   quello successivo, ai lati del titolo.

   <!-- figure: calendar/year | Il calendario di un anno scolastico con chiusure e date da ricordare -->

1. Guardare i mesi. Sotto ogni mese compaiono il numero dei giorni di apertura, le chiusure con il motivo e le date da
   ricordare. I colori e il testo si leggono nella **Legenda**: **Chiusura settimanale**, **Festività**,
   **Periodo di chiusura** e **Data da ricordare**.

### Aggiungere una data da ricordare

1. Premere **Nuova data**. Si apre la finestra **Nuova data**.
1. Scrivere il **Titolo**, per esempio una lettura in classe.
1. Scegliere il **Giorno**. Per un periodo di più giorni scegliere anche **Fino al**.
1. Se serve, scrivere una **Nota**.
1. Premere **Salva**. Un avviso dice **Data aggiunta** e la data compare sotto il suo mese, con l'icona del
   calendario.

   <!-- figure: calendar/new-date | La finestra Nuova data -->

1. Per correggere una data, fare clic sul suo titolo, modificare i campi e premere **Salva**. Per cancellarla premere
   **Elimina** e confermare.

> [!IMPORTANT]
> Le date sono visibili a tutti gli account: non scrivere dati personali degli alunni. Le date da ricordare non
> cambiano le scadenze dei prestiti.

### Segnare i giorni di chiusura (amministratore)

1. Con l'account Amministrazione, aprire **Amministrazione**, poi **Configurazione**, poi **Calendario**.
1. Per chiudere un giorno, fare clic su quel giorno nel calendario del blocco **Calendario della biblioteca**. Per
   riaprire un giorno chiuso a mano, fare di nuovo clic.
1. Per chiudere più giorni di fila, premere **Aggiungi un periodo**, scegliere **Dal** e **Al** e scrivere il
   **Motivo**.
1. Premere **Salva**. Un avviso dice **Calendario salvato**.

I giorni di chiusura di ogni settimana (**Giorni di chiusura ogni settimana**) e le festività nazionali sono già nel
calendario. I dettagli sono in
[Impostare il calendario della scuola](../../admin/guides/set-the-calendar.md).

## Risultato

Le chiusure compaiono nel **Calendario** con il loro motivo. Un prestito la cui scadenza cade in un giorno chiuso ha la
scadenza spostata al primo giorno di apertura e il banco lo dice in un messaggio. Le date da ricordare compaiono
anche nel riquadro **Prossime date** della dashboard, quando mancano al massimo trenta giorni.

## Possibili problemi

### Il pulsante Nuova data non c'è

Solo gli account Gestione prestiti e Amministrazione possono aggiungere date. Gli altri account leggono il calendario
senza poterlo modificare.

### Le chiusure non si possono cambiare dal calendario

Dal Banco prestiti il calendario non cambia le chiusure: servono l'account Amministrazione e la pagina
**Amministrazione** → **Configurazione** → **Calendario**.

### I prestiti già registrati non cambiano scadenza

La scadenza di un prestito si calcola con il calendario del giorno in cui il libro viene prestato: una chiusura
aggiunta dopo non sposta le scadenze dei prestiti già in corso. Per spostare una scadenza che cade in un giorno di
chiusura, rinnovare il prestito.

### La data da ricordare non compare in Prossime date

La dashboard mostra le date dei prossimi trenta giorni: una data più lontana compare più avanti.

### Il titolo è troppo lungo o il periodo è sbagliato

La finestra segna il campo: accorciare il titolo, oppure scegliere un **Fino al** non precedente al **Giorno**.

## Pagine correlate

- [Impostare il calendario della scuola](../../admin/guides/set-the-calendar.md)
- [Impostare le regole dei prestiti](../../admin/guides/set-loan-rules.md)
- [Calendario](../screens/calendar.md)
