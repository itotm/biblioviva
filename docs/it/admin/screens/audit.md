# Registro operazioni

Il **Registro operazioni** elenca chi ha fatto che cosa in BiblioViva: accessi, modifiche, importazioni e le altre azioni
registrate. Serve a ritrovare l'origine di una modifica. È riservato all'account `admin` e si apre dalla scheda
**Registro operazioni** di [Amministrazione](admin.md). Le righe non contengono dati personali degli utenti.

<!-- figure: admin/audit | Il Registro operazioni con i filtri e l'elenco delle operazioni -->

1. Il menu **Esporta**.
2. I filtri: **Dal**, **Al**, **Account** e **Operazione**.
3. Il conteggio delle righe mostrate.
4. L'elenco delle operazioni.

## Esporta

Il menu **Esporta** scarica l'elenco, con i filtri impostati, in formato «CSV (foglio di calcolo, testo)» oppure «ODS
(LibreOffice / Excel)».

## Filtri

Quattro filtri restringono l'elenco; per ognuno, la voce **Tutti** toglie il filtro.

- **Dal** e **Al**: le date di inizio e di fine.
- **Account**: l'account che ha fatto l'operazione.
- **Operazione**: il tipo di operazione, per esempio un accesso o una modifica della configurazione.

Sotto i filtri una riga dice quante operazioni sono mostrate sul totale («… di … operazioni»). Quando nessuna operazione
corrisponde ai filtri compare «Nessuna operazione registrata con questi filtri.»

## L'elenco

Ogni riga ha sei colonne.

- **Quando**: data e ora dell'operazione.
- **Account**: l'account che l'ha fatta; per le operazioni che BiblioViva fa da sola (per esempio la copia notturna)
  compare «sistema».
- **Operazione**: il tipo di operazione.
- **Oggetto**: che cosa è stato toccato (un libro, un utente, una sezione della configurazione).
- **ID**: il numero interno dell'oggetto.
- **Dettagli**: i particolari dell'operazione, nella forma in cui sono registrati.

Le righe più vecchie del numero di mesi scelto nell'impostazione **Mesi di registro delle operazioni** (sezione
[Privacy](configuration.md#privacy) della Configurazione) vengono cancellate.
