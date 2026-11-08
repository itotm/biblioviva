# Libri in prestito

La pagina **Libri in prestito** mostra tutti i libri che in questo momento sono fuori dalla biblioteca, con l'utente che
li ha, la scadenza e i giorni di ritardo. Serve a trovare un prestito (a chi è un certo libro? che cosa ha ancora una
classe?), a rinnovare più prestiti insieme e a esportare l'elenco. La pagina la aprono gli account che hanno il
permesso dei prestiti («Gestione prestiti» e «Amministrazione») dalla scheda **Libri in prestito** del banco prestiti o
dal riquadro **Prestiti in corso** della [dashboard](dashboard.md). Per la procedura passo per passo vedere
[Controllare i libri in prestito](../guides/open-loans.md).

<!-- figure: circulation/loans-filtered | Libri in prestito filtrati sui soli ritardi di una classe -->

1. [Ricerca e filtri](#ricerca-e-filtri).
1. [Pagina iniziale](#pagina-iniziale): finché non si cerca nulla.
1. [Elenco dei prestiti](#elenco-dei-prestiti).
1. [Rinnovo dei prestiti scelti](#rinnovo-dei-prestiti-scelti).
1. [Esportazione](#esportazione).

## Ricerca e filtri

In alto stanno il campo di ricerca e i filtri:

- **Cerca per cognome o codice del libro**: il campo cerca tra gli utenti e i codici delle copie. Per un nome servono
  almeno tre lettere; un codice si cerca già con poche cifre.
- **Tipo**: **tutti**, **Studenti** oppure **Docenti**.
- **Classe**: **tutte** oppure una classe dell'elenco.
- **Solo in ritardo**: mostra soltanto i prestiti scaduti.
- **Togli i filtri**: compare quando almeno un filtro o una ricerca sono attivi e li azzera.

Il browser ricorda ricerca e filtri: tornando indietro da un altro punto del programma l'elenco si ritrova com'era.

## Pagina iniziale

Finché non c'è né una ricerca né un filtro, al posto dell'elenco compare il riquadro **Cerca tra i libri in prestito**
con il testo «`<n>` libri in prestito. Ricerca per nome dell'utente, codice del libro o con i filtri.» L'elenco non si
carica da solo perché, con migliaia di prestiti, sarebbe lungo da scorrere; per vedere tutti i prestiti scegliere un
filtro, per esempio **Studenti**, poi **Docenti**.

## Elenco dei prestiti

Dopo una ricerca o un filtro, sopra la tabella compare il numero dei risultati: «`<n>` prestiti trovati». Senza
risultati: «Nessun prestito in corso.» La tabella ha una riga per prestito e queste colonne:

| Colonna | Contenuto |
|---|---|
| **Utente** | cognome e nome |
| **Classe** | la classe dell'utente; **Docente** per i docenti |
| **Titolo** | il titolo del libro |
| **Codice** | il codice della copia |
| **Scadenza** | la data in cui il libro deve tornare |
| **Giorni ritardo** | «`<n>` gg» per i prestiti scaduti, vuoto per gli altri |
| **Rinnovi** | quante volte il prestito è stato rinnovato |
| **Ultimo sollecito** | quando è stato stampato l'ultimo sollecito, se c'è stato |

Le colonne **Utente**, **Classe**, **Titolo** e **Giorni ritardo** si ordinano premendo l'intestazione. La colonna
**Prestato il**, con la data del prestito, è nell'esportazione ma non nella tabella.

Premere una riga apre la scheda dell'utente ([Scheda dell'utente](patron-record.md)), ma solo per gli account che hanno
il permesso degli utenti: l'account «Gestione prestiti» non può aprire le schede degli utenti e premere la riga non fa
nulla.

## Rinnovo dei prestiti scelti

Selezionando una o più righe con la casella a inizio riga, al posto dei filtri compare «`<n>` selezionati» con il
pulsante **Rinnova selezionati**. Il pulsante rinnova i prestiti scelti, uno dopo l'altro, e sotto la barra compare il
riepilogo «Rinnovati `<n>` prestiti su `<totale>`.», seguito, per ogni rinnovo rifiutato, dal motivo, con i pulsanti
**Restituisci** e, per l'amministratore, **Forza (solo admin)**. I motivi sono spiegati in
[Rinnovi rifiutati](checkout.md#rinnovi-rifiutati) di Prestiti.

## Esportazione

Sotto la tabella il menu **Esporta** scarica l'elenco mostrato (con la ricerca e i filtri attivi) come file CSV, per un
foglio di calcolo, o ODS, per LibreOffice. Il file contiene anche la data del prestito.

## Pagine correlate

- [Controllare i libri in prestito](../guides/open-loans.md)
- [Rinnovare un prestito](../guides/renew-a-loan.md)
- [Solleciti](overdues.md)
- [Prestiti](checkout.md)
