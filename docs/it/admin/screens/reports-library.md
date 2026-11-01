# Libreria dei report

La **Libreria dei report** elenca i report forniti con BiblioViva e quelli della scuola, e permette di provarli,
scaricarli, crearne di nuovi, personalizzarli o toglierli. È riservata all'account `admin` e si apre dalla scheda
**Libreria dei report** della [Configurazione](configuration.md). Chi consulta i report ogni giorno usa invece la pagina
[Report](../../manual/screens/reports.md). La procedura per scriverne uno è nella guida [Creare un
report](../guides/create-a-report.md); il formato dei file è descritto nel [riferimento tecnico dei
report](../../../reports-authoring.md).

<!-- figure: admin/reports-library | La Libreria dei report con l'elenco dei report e i comandi di ogni riga -->

1. I pulsanti **Nuovo report** e **Carica un report (JSON)**.
2. L'elenco dei report con titolo, codice e indicatori.
3. I comandi di una riga: **Modifica**, **Duplica**, **Prova**, **Scarica** ed **Elimina**.

## Nuovo report

Il pulsante **Nuovo report** apre l'editor con un report vuoto. Dopo **Salva** il report resta nella libreria.

## Carica un report (JSON)

Il pulsante **Carica un report (JSON)** installa un file di report. Prima di installarlo BiblioViva controlla il
formato, la sicurezza della query e le tabelle e le colonne che usa. Un file con lo stesso codice di un report fornito
prende il suo posto; la pagina conferma con «Report … installato» oppure «Report … sostituito». Sono possibili questi
rifiuti:

- «Il file è troppo grande»;
- «Il file non è un JSON valido»;
- «La definizione non è valida»;
- «La query non funziona su questo database»;
- «new» non può essere il codice di un report.

## File non caricati

Quando un file della cartella dei report non può essere letto, un riquadro giallo, «Questi file non vengono caricati», lo
elenca con il motivo. Per i file della scuola il riquadro offre **Elimina**.

## L'elenco dei report

Ogni riga mostra il titolo del report, il suo codice e questi indicatori:

- la categoria: Prestiti, Libri, Utenti oppure Attività;
- la provenienza: **Fornito con BiblioViva**, **Personalizzato** o **Aggiunto**;
- **Solo amministratori**, per i report che altri account non vedono.

I comandi della riga sono:

- **Modifica**: apre l'editor. Per un report fornito il salvataggio crea la copia personalizzata della scuola, con lo
  stesso nome;
- **Duplica**: apre l'editor con una copia del report, da salvare con un nuovo codice;
- **Prova**: esegue il report nella pagina dei report;
- **Scarica**: scarica la definizione in un file JSON, da modificare e ricaricare;
- **Elimina**, solo per i report della scuola. Per un report personalizzato il comando si chiama **Torna all'originale** e
  rimette in uso il report fornito. Una finestra chiede conferma; l'operazione si può annullare dalla
  [Cronologia](config-history.md).

## Editor del report

L'editor ha due modi, **Guidata** e **SQL**. Nel modo guidato si scelgono i **Dati**, le **Righe**, le **Colonne**, i
**Valori**, i **Filtri**, l'**Ordine** e il **Grafico** (Barre, Linee o Ciambella); un report con le colonne diventa una
tabella a doppia entrata, con i **Totali**. **Modifica come SQL** trasforma il report in uno scritto a mano e non si
torna alla modifica guidata. In ogni modo si indicano il codice, la categoria, il titolo e la descrizione in italiano e
in inglese, e la casella «Solo per gli amministratori». **Anteprima** esegue il report con i valori predefiniti dei
parametri, al massimo 200 righe. **Salva** lo registra; **Torna alla libreria** riporta qui.
