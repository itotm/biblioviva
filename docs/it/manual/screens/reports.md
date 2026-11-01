# Report

La pagina **Report** offre le statistiche della biblioteca: prestiti per mese, libri più prestati, copie mai prestate,
utenti per classe e altre. Ogni report è una tabella, a volte con un grafico, che si può stampare e scaricare. Serve a
rispondere alle domande della scuola (quanti prestiti quest'anno, quali libri non escono mai) senza contare a mano.

La pagina si apre dalla voce **Report** del menu (sulla barra in basso del telefono, sotto **Altro**) e dalla
[dashboard](dashboard.md). La usano gli account «Report» e «Amministrazione». Alcuni report contengono
dati più sensibili e sono riservati ad «Amministrazione»: gli altri account non li vedono, mentre «Amministrazione» li
vede con il segno **Solo amministratori**. La procedura è nella guida [Consultare un report](../guides/run-a-report.md).

La pagina ha due parti: l'[elenco dei report](#elenco-dei-report) e la [pagina di un report](#pagina-di-un-report).

## Elenco dei report

<!-- figure: reports/library | L'elenco dei report, raggruppati per categoria -->

Nella figura:

1. Il titolo della categoria: [Categorie](#categorie).
1. La scheda di un report, con titolo e descrizione: [Schede dei report](#schede-dei-report).
1. I contrassegni **Con grafico**, **Solo amministratori** e **Della scuola**: [Contrassegni](#contrassegni).

### Categorie

I report sono raggruppati in quattro categorie, ognuna con la sua icona: **Prestiti**, **Libri**, **Utenti** e
**Attività**. Una categoria senza report non compare.

### Schede dei report

Ogni report è una scheda con il titolo e una breve descrizione. Un clic apre il report. Esempi: i prestiti in ritardo, i
libri più prestati, la durata media dei prestiti, le copie mai prestate, il patrimonio per classificazione, l'indice di
lettura per classe.

### Contrassegni

Sotto la descrizione possono comparire dei contrassegni:

- **Con grafico**: oltre alla tabella, il report disegna un grafico (a barre, a linee o a torta);
- **Solo amministratori**: il report si apre soltanto con l'account «Amministrazione»;
- **Della scuola**: il report non è fornito con BiblioViva ma è stato aggiunto o personalizzato dalla scuola (vedere
  [Creare un report](../../admin/guides/create-a-report.md)).

### File di report non caricati

Solo per «Amministrazione»: se un file dei report della scuola ha un errore, in cima alla pagina un riquadro giallo,
intitolato **File di report non caricati**, spiega: «Questi file della cartella dei report hanno un errore e non
compaiono nell'elenco:». Ogni riga riporta il nome del file e il motivo.

## Pagina di un report

La pagina di un report mostra il titolo e la descrizione, il modulo dei parametri e il risultato. Il pulsante di ritorno
**Tutti i report** riporta all'elenco.

<!-- figure: reports/report-page | Un report con i parametri, il grafico e la tabella dei risultati -->

Nella figura:

1. I pulsanti **Stampa** ed **Esporta**: [Stampa ed esportazione](#stampa-ed-esportazione).
1. Il modulo **Parametri** e il pulsante **Aggiorna**: [Parametri](#parametri).
1. Il numero delle righe e il tempo impiegato: [Risultato](#risultato).
1. Il grafico, se c'è: [Risultato](#risultato).
1. La tabella dei risultati: [Risultato](#risultato).

### Parametri

Il riquadro **Parametri** contiene i campi che il report prevede, per esempio un periodo o un numero. Se il report non
ne ha, la pagina scrive «Questo report non ha parametri.» e il risultato compare subito.

1. Impostare i campi. Una data è un campo singolo; un periodo ha due date, scritte come «etichetta (dal)» e «etichetta
   (al)»; un numero e un testo si scrivono a mano; un campo a scelta offre le voci previste e, se facoltativo, **Tutte**;
   per i report sugli utenti la scelta può essere **Studenti** o **Docenti**.
1. Premere **Aggiorna**. La tabella si ricalcola con i valori scritti.

I parametri si scrivono anche nell'indirizzo della pagina: salvando o inviando il collegamento si riapre lo stesso
report con gli stessi valori.

### Risultato

Sotto i parametri, una riga dice «N righe» e «in N ms», cioè quanto è durato il calcolo. Poi, se il report lo prevede,
un grafico e sempre la tabella. Le intestazioni delle colonne ordinano le righe (non nelle tabelle riepilogative, che
tengono il totale in fondo). Se non c'è nulla, la pagina scrive «Nessun risultato con questi parametri.»

Quando il risultato è molto lungo, la tabella mostra solo le prime righe e la pagina avvisa: «Sono mostrate solo le
prime N righe: per vederle tutte, restringere i parametri.»

## Messaggi dei parametri

Un valore scritto male blocca il calcolo e un riquadro rosso dice quale campo va corretto.

### Parametro mancante

“Manca «etichetta».” Il campo è obbligatorio e va compilato.

### Valore non valido

“Il valore di «etichetta» non è valido.” Occorre correggere il campo, per esempio una data scritta in modo sbagliato.

## Stampa ed esportazione

- **Stampa** apre in una nuova scheda del browser la versione da stampare del report, con la riga «Stampato il» e la
  data, e i parametri usati.
- **Esporta** scarica la tabella, con i parametri in uso, in **CSV (foglio di calcolo, testo)** oppure **ODS
  (LibreOffice / Excel)**.

## Pagine correlate

- [Consultare un report](../guides/run-a-report.md)
- [Creare un report](../../admin/guides/create-a-report.md)
- [Catalogo](catalog.md)
