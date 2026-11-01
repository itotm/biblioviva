# Calendario

Il **Calendario** mostra i mesi dell'anno scolastico con i giorni di apertura e di chiusura della biblioteca e le date
da ricordare, come una lettura in classe o la scadenza di un concorso. Serve a sapere quando cade una scadenza e quando
la biblioteca è chiusa. Lo leggono tutti gli account; gli account che hanno il permesso dei prestiti («Gestione
prestiti» e «Amministrazione») possono anche aggiungere, correggere ed eliminare le date. Per gli account che hanno il
permesso dei prestiti la pagina è la scheda **Calendario** del banco prestiti; gli altri la aprono dal pulsante
**Apri il calendario** della sezione **Prossime date** della [dashboard](dashboard.md).

<!-- figure: circulation/calendar | Il calendario dell'anno scolastico con le chiusure e una data da ricordare -->

1. Titolo e pulsante [Nuova data](#nuova-data).
1. [Scelta dell'anno](#scelta-dellanno).
1. [Impostazioni e legenda](#impostazioni-e-legenda).
1. [Mesi](#mesi).
1. [Date da ricordare](#date-da-ricordare).

## Nuova data

Il pulsante **Nuova data**, in alto a destra, compare solo agli account che hanno il permesso dei prestiti. Apre la
finestra [Finestra della data](#finestra-della-data), già con il giorno di oggi (o il primo giorno dell'anno mostrato, se
oggi non ne fa parte).

## Scelta dell'anno

Sopra i mesi, due pulsanti con l'anno scolastico precedente e quello successivo portano a un altro anno; al centro
sta il titolo «Anno scolastico `<anno>`», per esempio «Anno scolastico 2026/2027». Si apre l'anno in corso.

## Impostazioni e legenda

Sotto il titolo dell'anno una frase riassume le regole in uso: «Giorni di chiusura settimanale: `<giorni>` · festività
nazionali automatiche: sì · calcolo delle scadenze: `<modo>`.», seguita, quando c'è una data limite dei prestiti, da
«Nessuna scadenza oltre il `<data>`.» e, sempre, dalla nota «Le date da ricordare (letture in classe, scadenze del
concorso…) non cambiano le scadenze dei prestiti.»

Il `<modo>` è uno tra:

- «si aggiungono i giorni e si passa al primo giorno di apertura»;
- «si contano solo i giorni di apertura»;
- «si contano i giorni di calendario, senza chiusure».

Queste regole e i giorni di chiusura si cambiano solo in **Amministrazione** → **Configurazione** → **Calendario**:
vedere [Impostare il calendario della scuola](../../admin/guides/set-the-calendar.md).

La legenda spiega i segni dei giorni: **Chiusura settimanale** (grigio), **Festività** (rosso),
**Periodo di chiusura** (giallo) e **Data da ricordare** (numero in grassetto, colorato e sottolineato). I segni sono
sempre accompagnati da un elenco scritto sotto il mese.

## Mesi

Ogni mese ha il suo riquadro con il nome del mese e il numero dei giorni di apertura («`<n>` giorni di apertura»). Le
settimane cominciano dal giorno scelto dall'amministratore. I giorni di chiusura sono colorati secondo la legenda e,
passandoci sopra con il mouse, ne mostrano il motivo (per esempio «Natale»); il giorno di oggi ha un contorno.

Sotto la griglia compaiono:

- l'elenco delle chiusure del mese, con il periodo e il motivo («mar 8 dic · Immacolata»); i giorni consecutivi chiusi
  per lo stesso motivo sono riuniti su una riga;
- l'elenco delle date da ricordare, descritte qui sotto.

Le festività nazionali sono Capodanno, Epifania, Lunedì dell'Angelo, Festa della Liberazione, Festa del Lavoro, Festa
della Repubblica, Ferragosto, Ognissanti, Immacolata, Natale e Santo Stefano.

## Date da ricordare

Ogni data da ricordare compare sotto il mese in cui cade (un periodo compare in ogni mese che attraversa), con il
titolo, il giorno o il periodo («da `<giorno>` a `<giorno>`») ed eventualmente la nota. Gli account che hanno il
permesso dei prestiti premono il titolo per aprire la finestra e correggere o eliminare la data; per gli altri il
titolo è solo testo.

## Finestra della data

La finestra si intitola **Nuova data** per una data nuova e **Modifica la data** per una esistente. Ha questi campi:

- **Titolo**: il nome della data; il campo suggerisce «Lettura in classe, scadenza del concorso…». Obbligatorio.
- **Giorno**: il giorno della data.
- **Fino al**: l'ultimo giorno, se la data dura più giorni. Facoltativo.
- **Nota**: un testo libero.

Sotto i campi compare l'avvertenza «Le date sono visibili a tutti gli account: non inserire dati personali degli
alunni.» I pulsanti sono **Annulla** e **Salva**; per una data esistente c'è anche **Elimina**, che chiede conferma con
«Eliminare la data «`<titolo>`»?». Dopo il salvataggio compare «Data aggiunta», «Data salvata» o «Data eliminata».

Se qualcosa non va, la finestra lo dice sotto i campi:

- «Il titolo è obbligatorio.»
- «Il titolo può avere al massimo `<n>` caratteri.»
- «La nota può avere al massimo `<n>` caratteri.»
- «Scegliere un giorno valido.»
- «La fine del periodo viene prima dell'inizio.»

Le date da ricordare non cambiano le scadenze dei prestiti e non chiudono la biblioteca: per chiuderla vedere
[Impostare il calendario della scuola](../../admin/guides/set-the-calendar.md). Per la procedura passo per passo
vedere [Segnare le chiusure nel calendario](../guides/mark-closures.md).

## Pagine correlate

- [Segnare le chiusure nel calendario](../guides/mark-closures.md)
- [Impostare il calendario della scuola](../../admin/guides/set-the-calendar.md)
- [Dashboard](dashboard.md)
