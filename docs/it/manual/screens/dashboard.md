# Dashboard

La dashboard è la prima pagina di chi lavora in BiblioViva: mostra la biblioteca di oggi in pochi riquadri numerici,
i pulsanti per cominciare il lavoro e gli avvisi lasciati dai colleghi. La vedono gli account «Amministrazione»,
«Catalogazione», «Tessere e foto» e «Report»; l'account «Gestione prestiti», che ha solo il banco
prestiti, non la vede, perché dopo l'accesso si apre direttamente [Prestiti](checkout.md). Dalle altre pagine si torna
alla dashboard premendo il logo o il nome della biblioteca in alto a sinistra.

Ogni account vede solo ciò che il suo ruolo permette: un pulsante o un riquadro per una pagina non consentita non
compare. L'amministratore può spegnere singole sezioni della dashboard da **Amministrazione** → **Configurazione** →
**Aspetto e lingua**.

<!-- figure: dashboard/overview | La dashboard dell'account «Amministrazione» con i dati dimostrativi -->

1. Nome e logo della biblioteca: [Intestazione](#intestazione).
1. [Azioni rapide](#azioni-rapide).
1. [Segnalazioni in evidenza](#segnalazioni-in-evidenza).
1. [Riquadri dei numeri](#riquadri-dei-numeri).
1. [Aggiunta alla schermata Home](#aggiunta-alla-schermata-home): solo sul telefono.
1. [Inventario in corso](#inventario-in-corso).
1. [Prossime date](#prossime-date).
1. [In scadenza questa settimana](#in-scadenza-questa-settimana).
1. [Prestiti di oggi](#prestiti-di-oggi).

## Intestazione

In cima compaiono il logo, il nome di BiblioViva e il nome della biblioteca. Un'installazione con dati dimostrativi
mostra qui anche un riquadro giallo: «Questa installazione contiene dati dimostrativi caricati il `<data>`:
`<n>` utenti, `<n>` titoli, `<n>` copie, `<n>` prestiti. Sono inventati: nessuna persona reale.» Per toglierli vedere
[Togliere i dati dimostrativi](../../admin/guides/remove-demo-data.md).

## Azioni rapide

La sezione **Azioni rapide** è una fila di pulsanti, ciascuno con il nome della pagina che apre. Compaiono solo quelli
consentiti all'account:

| Pulsante | Apre | Account |
|---|---|---|
| **Prestiti** | [Prestiti](checkout.md) | Amministrazione |
| **Restituzioni** | [Restituzioni](checkin.md) | Amministrazione |
| **Nuovo libro** | [Nuovo libro](new-book.md) | Catalogazione, Amministrazione |
| **Nuovo utente** | [Nuovo utente](patron-record.md#nuovo-utente) | Tessere e foto, Amministrazione |
| **Censimento foto** | [Censimento foto](census.md) | Tessere e foto, Amministrazione (solo con le foto attive) |
| **Stampe** | [Stampe](print-lists.md) | Tessere e foto, Catalogazione, Amministrazione |
| **Inventario** | [Inventario](inventory.md) | Catalogazione, Amministrazione |
| **Report** | [Report](reports.md) | Report, Amministrazione |
| **Amministrazione** | pagina di amministrazione | Amministrazione |
| **Importazioni** | pagina delle importazioni | chi può importare senza essere amministratore |

Il catalogo e l'elenco degli utenti non hanno un pulsante qui: si aprono dal menu laterale (o dalla barra in basso sul
telefono).

## Segnalazioni in evidenza

Sotto le azioni rapide compaiono, come foglietti colorati, le segnalazioni che l'amministratore ha messo in evidenza
(vedere [Segnalazioni](notes.md)). Il pulsante **Apri le segnalazioni** porta all'elenco completo. Senza segnalazioni in
evidenza la sezione non compare.

## Riquadri dei numeri

La sezione, intitolata «La biblioteca oggi» per chi legge con uno screen reader, mostra un riquadro per ogni numero.
Premendo un riquadro si apre la pagina dove il caso si risolve. I riquadri che segnalano un problema sono gialli o
rossi, quelli in ordine verdi; il colore è sempre accompagnato dal testo e dall'icona.

Per chi ha il permesso dei prestiti:

- **Prestati oggi**: apre [Prestiti](checkout.md).
- **Restituiti oggi**: apre [Restituzioni](checkin.md).
- **Prestiti in corso**: apre [Libri in prestito](loans.md).
- **In ritardo**: apre [Solleciti](overdues.md); rosso se c'è almeno un prestito in ritardo.

Per chi ha il permesso degli utenti:

- **Utenti senza tessera stampata**: apre [Stampe](print-lists.md).
- **Utenti senza foto**: apre il [Censimento foto](census.md). Compare solo se le foto sono richieste dalla biblioteca.

Per chi ha il permesso del catalogo:

- **Libri senza etichette**: premendo il riquadro si apre una finestra per stampare le etichette dei libri che ancora
  non le hanno. Con zero libri il riquadro non si può premere. Vedere
  [Stampare le etichette dei libri](../guides/print-book-labels.md).
- **Libri da classificare**: compare solo quando ce ne sono; apre [Da classificare](to-classify.md).

Per l'amministratore:

- **Segnalazioni aperte**: apre [Segnalazioni](notes.md); giallo se ce n'è almeno una.

## Inventario in corso

Mentre un inventario è aperto compare la sezione **Inventario** con il nome della campagna e l'avanzamento («`<n>` su
`<n>` (`<n>`%)» copie viste). Il pulsante **Continua** riprende il lavoro in [Inventario](inventory.md). La vede chi ha
il permesso del catalogo.

## Aggiunta alla schermata Home

Sul telefono, se il browser lo permette, sotto i riquadri compare la sezione **Aggiungi alla schermata Home** con il
testo «BiblioViva si apre come un'app, a schermo intero, dall'icona sul telefono.» **Installa** aggiunge l'icona;
**Non ora** nasconde la sezione in quel browser. In Firefox la sezione rimanda al menu ⋮ del browser, dove scegliere
«Installa» oppure «Aggiungi alla schermata principale». Sul computer la sezione non compare. È un extra facoltativo:
il banco si usa con il computer e il lettore di codici a barre.

## Prossime date

La sezione **Prossime date** elenca le date da ricordare del [Calendario](calendar.md) nei prossimi 30 giorni, le più
vicine per prime. Senza date compare «Nessuna data nei prossimi 30 giorni.»; se sono più di quelle mostrate, «e altre
`<n>`». Il pulsante **Apri il calendario** porta al calendario. La sezione è visibile a tutti gli account.

## In scadenza questa settimana

La sezione **In scadenza questa settimana** elenca, per chi ha il permesso dei prestiti, i libri che devono tornare
entro la fine della settimana, con il nome dell'utente e la scadenza («scade `<giorno>`»). Il numero tra parentesi è il
totale. Se non ce ne sono: «Nessun prestito scade entro `<giorno>`.» La settimana comincia nel giorno scelto
dall'amministratore (impostazione **Primo giorno della settimana**).

## Prestiti di oggi

La sezione **Prestiti di oggi** mostra, per chi ha il permesso dei prestiti, due elenchi: **Prestati oggi** e
**Restituiti oggi**, con l'ora, il nome dell'utente e il titolo. Se non c'è ancora niente: «Ancora niente oggi.» La
stessa coppia di elenchi compare in [Prestiti](checkout.md) mentre non è scelto nessun utente.

## Pagine correlate

- [Prestiti](checkout.md)
- [Restituzioni](checkin.md)
- [Segnalazioni](notes.md)
- [Calendario](calendar.md)
