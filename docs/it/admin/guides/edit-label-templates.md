# Modificare le etichette e la fascetta del dorso

Le etichette di ogni libro sono due: la fascetta del dorso, con il pittogramma e la segnatura, e l'etichetta con il
codice a barre. Questa guida serve all'amministratore che vuole cambiare che cosa e dove si stampa su ciascuna,
disegnando con il mouse nell'editor dei template, senza scrivere codice.

- Tempo: circa 30 minuti, più il tempo di una stampa di prova.
- Account: `admin`, l'unico che vede la pagina **Template di stampa**.
- Occorrente: un foglio di carta comune per la prova e un foglio di etichette adesive per il controllo finale. Il foglio
  di etichette deve essere già descritto in BiblioViva: vedere [Aggiungere un foglio di
  etichette](add-a-label-stock.md).

BiblioViva ha tre modelli di etichetta forniti: **Coppia** (`pair-default`, fascetta del dorso sopra ed etichetta con il
codice a barre sotto, un'unità per libro), **Solo barcode** (`barcode-default`) e **Solo fascetta** (`spine-default`). I
modelli forniti non si modificano direttamente: si crea una copia modificabile, che lascia sempre disponibile
l'originale. La grandezza di ogni etichetta non si decide nel modello ma nel foglio adesivo scelto.

## Procedura

### Creare la copia da modificare

1. Aprire **Amministrazione** e premere **Configurazione**.
1. Premere il riquadro **Template di stampa**, nel gruppo **Aspetto, classi e modelli**.
1. Premere la scheda **Etichette**. L'elenco mostra i tre modelli, ciascuno con il tipo di etichetta e l'indicazione
   **Fornito con BiblioViva**.
1. Premere **Personalizza** sul modello da cambiare, per esempio `pair-default`.
1. Premere **Personalizza** nella finestra. Compare il messaggio «Template personalizzato: la copia è modificabile».

<!-- figure: admin/templates-labels | L'elenco dei template delle etichette, con Personalizza sul modello fornito -->

> [!NOTE]
> **Personalizza** tiene lo stesso nome: le impostazioni che usano `pair-default` usano subito la copia. Con **Duplica**
> si crea invece un modello con un altro nome da scegliere poi nelle impostazioni (ultimo passo di questa guida).

### Disegnare l'etichetta

1. Premere **Modifica** sul modello personalizzato. Si apre la pagina di modifica del modello, nella vista **Disegno**.
1. Scegliere sopra il disegno l'etichetta da cambiare, nel gruppo **Facce o etichette**. Ogni pulsante porta il nome di
   un'etichetta dell'unità (per la coppia, quella in alto e quella in basso) e, se il modello ha più disposizioni, la
   variante: una per i fogli con etichette alte, un'altra per quelli con etichette basse.
1. Controllare l'anteprima sotto la scheda: mostra l'etichetta come si stampa, su un foglio che usa quella variante. Se
   compare l'avviso «Nessun foglio di etichette fa usare questa variante», il disegno si vede senza anteprima.
1. Cliccare un riquadro per sceglierlo, trascinarlo per spostarlo, trascinare l'angolo per cambiarne la misura. Con
   **Griglia** si cambia il passo a cui si agganciano le posizioni, con **Ingrandimento** si ingrandisce il disegno. Le
   frecce della tastiera spostano di un passo della griglia; il pannello a destra permette di scrivere i numeri in
   **X (mm)**, **Y (mm)**, **Larghezza** e **Altezza**.
1. Per cambiare il dato di un riquadro, sceglierlo e scegliere un altro valore in **Campo**. Per le etichette sono
   disponibili, tra gli altri, **Segnatura**, **Segnatura: prima riga**, **Segnatura: seconda riga**, **Titolo breve**,
   **Autore breve**, **Codice a barre (testo)**, **Codice di classificazione**, **Nome della classe** e
   **Livello di lettura**.
1. Per cambiare l'aspetto di un testo, usare **Dimensione (pt)**, **Carattere**, **Grassetto**, **Corsivo**,
   **Maiuscolo**, **Allineamento** e **Colore**.
1. Per aggiungere un elemento, premere uno dei pulsanti sotto **Aggiungi**: **Campo**, **Testo**, **Codice a barre**,
   **Pittogramma**, **Immagine**, **Riquadro** o **HTML libero**. Il pulsante **Immagine** funziona solo dopo aver
   caricato un'immagine tra i file del template (**Carica un file** nell'elenco dei template).
1. Per togliere un elemento, sceglierlo e premere **Elimina**.
1. Premere **Salva**. Compare il messaggio «Template salvato».

<!-- figure: admin/label-designer | L'editor della coppia di etichette: la fascetta del dorso e il pannello delle proprietà -->

> [!IMPORTANT]
> Le etichette dei modelli forniti si adattano da sole alla grandezza del foglio. Appena si sposta un elemento di
> un'etichetta, le posizioni di tutti gli elementi di quell'etichetta vengono scritte nel file, e quell'etichetta resta
> ferma sulla grandezza del foglio con cui è stata disegnata. Sotto il disegno compare l'avviso «… elementi di questa
> faccia sono disposti dal foglio di stile». Se serve un modello valido per fogli di grandezze diverse, cambiare con il
> mouse soltanto i colori, i testi e i campi e non spostare nulla.

> [!NOTE]
> La fascetta mostra il pittogramma e il colore della classificazione. I pittogrammi e i colori si scelgono in
> **Configurazione** → **Classificazione**: vedere [Modificare la classificazione e i livelli di
> lettura](classification.md). Con una stampante in bianco e nero, la banda colorata delle fascette basse diventa un
> tratteggio: l'opzione è **Stampante in bianco e nero** nella sezione **Etichette**.

### Controllare l'etichetta sul foglio

1. Tornare alla pagina **Template di stampa** e premere la scheda **Anteprime**, poi **Etichette**.
1. Scegliere nell'elenco il modello modificato.
1. Scegliere il foglio in **Supporto adesivo**. Le misure dell'unità e la variante usata compaiono sopra l'anteprima.
1. Premere **Narrativa** o **Saggistica**: il modello cambia secondo il tipo di libro (la fascetta ha un aspetto diverso
   per la narrativa e per la saggistica).
1. Premere **Foglio di esempio**. Si apre in una nuova scheda il foglio intero, con dati di prova.
1. Premere **Stampa pagina di calibrazione**, stampare su carta comune al 100 % (senza «adatta alla pagina») e
   sovrapporre il foglio stampato a un foglio di etichette, controllando contro luce che i contorni cadano sulle
   etichette. Se non cadono, correggere i margini del foglio: [Aggiungere un foglio di etichette](add-a-label-stock.md).

<!-- figure: admin/label-preview | L'anteprima di un modello di etichette su un foglio adesivo, con il foglio di esempio -->

### Usare un modello con un altro nome

Questo passo serve solo per un modello creato con **Duplica**.

1. Aprire **Amministrazione** → **Configurazione** e scegliere la sezione **Etichette**.
1. Nel gruppo dell'etichetta da cambiare (**Coppia: fascetta ed etichetta**, **Solo etichetta con il codice** o
   **Solo fascetta**) scrivere in **Modello** il nome del nuovo modello.
1. Premere **Salva**.

## Risultato

Le etichette stampate dal momento del salvataggio, dal catalogo, da una lista di stampa o dalla scheda di un libro,
usano il modello modificato. Le etichette già stampate non cambiano. Ogni salvataggio è una modifica della
configurazione e si può annullare: [Annullare una modifica della configurazione](undo-a-configuration-change.md).

Per tornare al modello originale, nell'elenco premere **Torna all'originale** sul modello personalizzato.

## Possibili problemi

### Il pulsante Salva è spento

Non ci sono modifiche, oppure il modello non si può stampare: leggere il riquadro rosso «Il template non si può stampare
così» sopra il disegno.

### L'anteprima non cambia

L'anteprima si aggiorna poco dopo ogni modifica. Se non si aggiorna, controllare che la variante scelta sia quella usata
dal foglio di etichette.

### Una parte dell'etichetta non si può muovere

Le parti dentro una sezione di codice si modificano nella vista **Codice**; il disegno lo segnala sotto l'etichetta. Per
il codice vedere [Print templates: authoring guide](../../../templates-authoring.md#labels).

### Le etichette escono spostate sul foglio

Il modello non c'entra: la posizione dipende dal foglio. Stampare la pagina di calibrazione e correggere i margini:
[Aggiungere un foglio di etichette](add-a-label-stock.md).

### Il foglio non ha il numero di righe giusto per la coppia

La coppia usa due etichette una sopra l'altra: il foglio deve avere un numero pari di righe.

## Pagine correlate

- [Aggiungere un foglio di etichette](add-a-label-stock.md)
- [Modificare la classificazione e i livelli di lettura](classification.md)
- [Stampare le etichette dei libri](../../manual/guides/print-book-labels.md)
- [Modificare il modello delle tessere](edit-the-card-template.md)
- [Template di stampa](../screens/templates.md)
- [Print templates: authoring guide](../../../templates-authoring.md) (pagina tecnica, in inglese)
