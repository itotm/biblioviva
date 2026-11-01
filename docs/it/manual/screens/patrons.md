# Utenti

La pagina **Utenti** elenca gli alunni e i docenti iscritti alla biblioteca. Serve per trovare un utente, aprirne la
scheda, stampare le tessere (di una classe intera o di alcuni utenti scelti) e, con il permesso giusto, rimuovere gli
utenti che hanno lasciato la scuola.

La pagina si apre dalla voce **Utenti** del menu (sulla barra in basso del telefono, tra le voci principali) e dalla
scheda **Utenti** del [Censimento foto](census.md). La usano gli account «Tessere e foto» e «Amministrazione».
Rimuovere gli utenti spetta ad «Amministrazione».

<!-- figure: patrons/list | L'elenco degli utenti con una classe scelta -->

Nella figura:

1. Le schede dell'area: [Barra del titolo](#barra-del-titolo).
1. Il campo di ricerca: [Ricerca](#ricerca).
1. I filtri: [Filtri](#filtri).
1. Il pulsante **Stampa tessere** della classe scelta: [Stampa delle tessere](#stampa-delle-tessere).
1. L'elenco degli utenti con lo stato di ciascuno: [Elenco degli utenti](#elenco-degli-utenti).
1. Il menu **Esporta**: [Esportazione](#esportazione).

## Barra del titolo

Sotto il titolo stanno le schede dell'area: **Utenti** e **Censimento foto**. La seconda compare soltanto se le foto
degli utenti sono attive (l'amministratore può disattivarle). Il pulsante **Nuovo utente** apre il modulo [Nuovo
utente](patron-record.md#nuovo-utente).

## Ricerca

Come il catalogo, l'elenco all'apertura è vuoto: la pagina scrive «Cerca un utente» e «Ricerca per nome, tessera o con i
filtri.» L'elenco compare quando nel campo **Cerca per cognome…** si scrivono almeno tre caratteri, oppure un numero di
sole cifre (anche di una cifra sola), oppure quando si sceglie un filtro. Per trovare un utente dalla tessera occorre
leggerne il codice con il lettore di codici a barre mentre il cursore è nel campo di ricerca.

Gli errori di battitura vengono corretti: i risultati trovati in questo modo portano il segno **Simile** e la riga dei
risultati lo dice (vedere [Risultati](#risultati)).

## Filtri

I filtri funzionano anche da soli, senza testo.

- **Tipo**: **Tutti**, **Studente** o **Docente**.
- **Ordine**: l'ordine di scuola (per esempio primaria o secondaria). Compare soltanto in una scuola con più ordini; le
  voci hanno la forma «Ordine: nome».
- **Classe**: l'anno di corso. Le voci hanno la forma «Classe: 3». Se è scelto un ordine, sono quelle di quell'ordine.
- **Sezione**: la sezione della classe, per esempio B. Le voci hanno la forma «Sezione: B»; la parola può cambiare nella
  scuola, perché la scelgono le impostazioni della scuola. Se è scelto un anno, restano le sezioni che lo ospitano.
- **Stato**: **Attivo** oppure **Rimosso**. Un utente rimosso conserva solo il tipo, la classe e lo storico dei prestiti
  per le statistiche; non ha più nome.

Il pulsante **Azzera filtri** compare appena un filtro è attivo.

## Risultati

Sopra l'elenco una riga dice «N utenti corrispondono ai filtri», con «più N simili, trovati correggendo un errore di
battitura» quando ci sono risultati approssimati. Se nulla corrisponde, la pagina scrive **Nessun utente corrisponde ai
filtri.**

## Elenco degli utenti

Ogni riga è un utente. Le colonne sono:

- **Cognome e nome**;
- **Tipo**: Studente o Docente;
- **Classe**: la classe, per esempio `3 B`; per i docenti il nome del gruppo dei docenti;
- **Tessera**: il numero della tessera, o niente se l'utente non ne ha una;
- **Stato**: i segni di ciò che richiede attenzione, ciascuno con colore, icona e testo: «N in prestito», «N in ritardo»
  (in rosso), «senza foto» (in arancione, solo se la scuola chiede la foto).

Le intestazioni **Cognome e nome**, **Tipo** e **Classe** ordinano l'elenco. Un clic sulla riga apre la [Scheda
dell'utente](patron-record.md); per scegliere più utenti si usa il clic con il tasto Ctrl o Maiusc.

## Stampa delle tessere

Quando è scelta una classe nel filtro **Sezione**, accanto al campo di ricerca compare il pulsante **Stampa tessere**
seguito dal nome della classe (per esempio «Stampa tessere 3 B»). Con più utenti scelti nell'elenco, **Stampa tessere**
della barra di selezione stampa soltanto le tessere dei selezionati.

Il pulsante apre la finestra **Stampa tessere**. La procedura completa, con il taglio e la piegatura, è nella guida
[Stampare le tessere di una classe](../guides/print-class-cards.md). La finestra contiene:

- **Come stampare**: **Fronte e retro affiancati** (fronte e retro vicini sullo stesso lato del foglio, da ritagliare e
  piegare: va bene per qualsiasi stampante) oppure **Sui due lati del foglio** (la stampante stampa fronte e retro,
  dieci tessere per foglio A4);
- l'elenco «Nella finestra di stampa del browser:», che dice che cosa impostare nella finestra di stampa: il
  fronte-retro con il lato di capovolgimento indicato (solo per la stampa sui due lati), la scala al 100 %
  («Dimensioni effettive», non «Adatta alla pagina») e i margini a zero. L'ultima riga dice come ritagliare le
  tessere, secondo il modello (segni di taglio, linea colorata o bordo);
- **Stampa**, che apre la pagina di stampa delle tessere in una nuova scheda del browser, e **Chiudi**, che esce senza
  stampare;
- per l'amministratore, con la stampa sui due lati, il collegamento **Calibra la stampa fronte-retro**, da usare la
  prima volta o se i retri non cadono dietro i fronti (vedere [Calibrare la stampa
  fronte-retro](../../admin/guides/calibrate-duplex.md)).

Dopo la stampa, la tessera va segnata come stampata dalla scheda dell'utente (vedere
[Tessera](patron-record.md#tessera)) o dalla lista di stampa (vedere [Segnare le tessere come
stampate](print-lists.md#tessere-segnate-come-stampate)).

## Selezione di più utenti

Il clic con Ctrl o Maiusc sulle righe sceglie più utenti. Sopra l'elenco compare «N selezionati» con i pulsanti:

- **Stampa tessere**: vedere [Stampa delle tessere](#stampa-delle-tessere);
- **Aggiungi selezionati alla lista**: mette gli utenti in una lista di stampa (vedere
  [Aggiunta alla lista dal catalogo o dagli utenti](print-lists.md#aggiunta-alla-lista-dal-catalogo-o-dagli-utenti));
- **Rimuovi selezionati**, in rosso, solo per «Amministrazione»: vedere
  [Rimozione di più utenti](#rimozione-di-più-utenti).

### Rimozione di più utenti

**Rimuovi selezionati** apre la conferma «Rimuovere N utenti?». La finestra avvisa che per ognuno vengono cancellati
subito e per sempre il nome e il cognome, i contatti, la matricola, le note, il numero di tessera e la foto, e che
restano soltanto il tipo, la classe, la sezione e lo storico dei prestiti per le statistiche. Gli utenti che hanno
ancora prestiti in corso non vengono rimossi: restano in archivio, e un messaggio finale dice «N rimossi, N con prestiti
in corso lasciati in archivio».

> [!WARNING]
> La rimozione cancella i dati personali in modo immediato e irreversibile. Non esiste un periodo di attesa né un modo
> di annullare. La procedura per un solo utente è nella guida [Rimuovere un utente](../guides/remove-a-patron.md).

## Esportazione

Il menu **Esporta**, sotto l'elenco, scarica gli utenti trovati, con i filtri in uso, in **CSV (foglio di calcolo,
testo)** oppure **ODS (LibreOffice / Excel)**.

## Pagine correlate

- [Scheda dell'utente](patron-record.md)
- [Censimento foto](census.md)
- [Stampe](print-lists.md)
- [Iscrivere un alunno](../guides/enrol-a-student.md)
- [Stampare le tessere di una classe](../guides/print-class-cards.md)
