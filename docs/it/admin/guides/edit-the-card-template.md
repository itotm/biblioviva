# Modificare il modello delle tessere

Il modello della tessera stabilisce che cosa si stampa su fronte e retro: logo, nome della biblioteca, foto, nome,
classe, codice a barre, sfondo. Questa guida serve all'amministratore che vuole cambiare l'aspetto delle tessere
disegnando con il mouse, senza scrivere codice.

- Tempo: circa 30 minuti per un primo ritocco, più il tempo di una stampa di prova.
- Account: `admin`, l'unico che vede la pagina **Template di stampa**.
- Occorrente: la stampante delle tessere e un foglio di carta comune per la prova. Per un logo o uno sfondo propri, il
  file dell'immagine (PNG, JPEG, WebP, GIF o SVG).

I modelli forniti con BiblioViva non si modificano direttamente: si crea prima una copia modificabile, che è il vero
oggetto di questa guida. L'originale resta disponibile per tornare indietro in qualsiasi momento.

## Procedura

### Creare la copia da modificare

1. Aprire **Amministrazione** e premere **Configurazione**.
1. Premere il riquadro **Template di stampa**, nel gruppo **Aspetto, classi e modelli**. Si apre la pagina con le schede
   **Tessere**, **Etichette** e **Solleciti**.
1. Restare sulla scheda **Tessere**. L'elenco mostra i modelli: quello di norma in uso si chiama `default` e porta
   l'indicazione **Fornito con BiblioViva**.
1. Premere **Personalizza** sul modello `default`. Si apre una finestra che spiega che si crea una copia con lo stesso
   nome, la quale prende il posto dell'originale.
1. Premere **Personalizza** nella finestra. Compare il messaggio «Template personalizzato: la copia è modificabile» e il
   modello porta l'indicazione **Personalizzato**.

<!-- figure: admin/templates-list | L'elenco dei template delle tessere, con Personalizza e Duplica sul modello fornito -->

> [!NOTE]
> **Personalizza** tiene lo stesso nome: le impostazioni che usano `default` usano subito la copia. **Duplica** crea invece
> un modello con un altro nome, da scegliere poi nelle impostazioni (vedere «Usare un modello con un altro nome»).

### Caricare le immagini proprie (facoltativo)

1. Aprire l'elenco «Immagini e caratteri» sul modello personalizzato.
1. Premere **Carica un file** e scegliere l'immagine. Formati ammessi: PNG, JPEG, WebP, GIF, SVG; la dimensione massima
   è indicata sotto il pulsante.
1. Ripetere per ogni immagine necessaria. Il file compare nell'elenco con l'indicazione «non usato» finché nessun
   elemento lo usa.

### Disegnare la tessera

1. Premere **Modifica** sul modello personalizzato. Si apre la pagina di modifica del modello, nella vista **Disegno**,
   con il **Fronte** della tessera a grandezza reale.
1. Cliccare un riquadro della tessera per sceglierlo. Il riquadro scelto mostra le sue maniglie e il pannello a destra
   ne elenca le proprietà.
1. Trascinare il riquadro per spostarlo, oppure trascinare l'angolo per cambiarne la misura. Le posizioni si agganciano
   alla griglia; la distanza della griglia si cambia con **Griglia**, e **Ingrandimento** mostra la tessera più grande
   per lavorare con precisione.
1. In alternativa al mouse, usare le frecce della tastiera (un passo della griglia per volta) oppure scrivere i numeri
   nei campi **X (mm)**, **Y (mm)**, **Larghezza** e **Altezza** del pannello.
1. Per cambiare un dato stampato (per esempio il cognome), scegliere il riquadro e cambiare **Campo** nel pannello. I
   dati disponibili sono quelli della tessera: nome, cognome, numero di tessera, classe e sezione, nome della
   biblioteca, anno scolastico, date di emissione e di validità.
1. Per cambiare un testo fisso, scegliere il riquadro di tipo **Testo** e scrivere in **Testo**.
1. Per cambiare l'aspetto di un riquadro di testo, usare **Dimensione (pt)**, **Carattere**, **Grassetto**, **Corsivo**,
   **Maiuscolo**, **Allineamento** e **Colore**.
1. Per aggiungere un elemento, premere uno dei pulsanti sotto **Aggiungi**: **Campo**, **Testo**, **Codice a barre**,
   **Foto**, **Immagine**, **Riquadro** o **HTML libero**. Il pulsante **Immagine** funziona solo dopo aver caricato
   almeno un'immagine.
1. Per togliere un elemento, sceglierlo e premere **Elimina** nel pannello, oppure il tasto Canc.
1. Se due elementi si sovrappongono, sceglierne uno e usare **Porta avanti** o **Porta indietro**.

<!-- figure: admin/card-designer | L'editor della tessera: il fronte a grandezza reale e il pannello delle proprietà -->

> [!IMPORTANT]
> Tenere scritte e foto dentro la linea tratteggiata che compare sulla tessera, a 2 mm dal bordo: stampando fronte e
> retro sui due lati del foglio, il retro può spostarsi di circa un millimetro.

> [!NOTE]
> Il riquadro **Foto** si stampa solo se le foto degli utenti sono attive. Se l'amministratore le ha disattivate, la
> tessera esce senza foto: vedere [Disattivare le foto o le copertine](switch-off-photos-or-covers.md).

### Cambiare lo sfondo e il formato

1. Premere **Retro** per passare alla faccia posteriore.
1. Cliccare in uno spazio vuoto della tessera, in modo che nessun elemento resti scelto. Il pannello mostra
   **Sfondo della faccia**.
1. Per usare uno sfondo già pronto, premere **Scegli uno sfondo** e cliccare l'immagine desiderata. Gli sfondi pronti
   vanno 3 mm oltre il bordo della tessera: la parte in più si taglia via.
1. Per usare un'immagine propria, premere **Carica un'immagine** e scegliere il file; in alternativa scegliere un file
   già caricato in **Immagine di sfondo**.
1. Per un colore al posto dell'immagine, attivare **Colore di sfondo** e sceglierlo.
1. Per cambiare la misura della tessera, scrivere i nuovi valori in **Larghezza (mm)** e **Altezza (mm)** sotto
   **Formato della tessera**. Il pulsante **Ruota: verticale o orizzontale** scambia le due misure. Il formato vale per
   questo modello soltanto; quello di tutte le tessere si cambia in **Configurazione** → **Tessere**.

<!-- figure: admin/card-background-picker | La finestra Sfondi pronti dell'editor della tessera -->

### Salvare e controllare

1. Controllare l'anteprima: si aggiorna da sola poco dopo ogni modifica. Se il modello non si può stampare, compare un
   riquadro rosso con il motivo e **Salva** resta spento.
1. Premere **Salva**. Compare il messaggio «Template salvato».
1. Per rinunciare alle modifiche non ancora salvate, premere **Annulla modifiche**.
1. Tornare alla pagina **Template di stampa** e premere la scheda **Anteprime**.
1. Scegliere il modello nell'elenco. A destra compaiono **Fronte** e **Retro** a grandezza reale.
1. Premere **Utente reale** e cercare per cognome un utente, per vedere la tessera con dati veri. Con
   **Utente di esempio** si vedono dati di prova.
1. Premere **Foglio intero** per vedere come la tessera sta sul foglio A4.
1. Premere **Stampa pagina di prova**, stampare su carta comune al 100 % (senza «adatta alla pagina») e controllare che
   il righello di 10 cm stampato misuri 100 mm.

<!-- figure: admin/card-preview | L'anteprima della tessera, con il fronte e il retro a grandezza reale -->

### Usare un modello con un altro nome

Questo passo serve solo per un modello creato con **Duplica**, oppure per dare ai docenti una tessera diversa da quella
degli alunni.

1. Aprire **Amministrazione** → **Configurazione** e scegliere la sezione **Tessere**.
1. Nel blocco **Template per tipo di utente** scegliere il modello in **Tessera degli studenti**, in
   **Tessera dei docenti** o in entrambi. La voce che inizia con «Come il predefinito» usa il modello predefinito.
1. Premere **Salva**. Compare il messaggio «Template delle tessere salvato».

## Risultato

Le tessere stampate dal momento del salvataggio usano il modello modificato. Le tessere già stampate non cambiano. Ogni
salvataggio è una modifica della configurazione e si può annullare: vedere [Annullare una modifica della
configurazione](undo-a-configuration-change.md).

Per tornare al modello originale, nell'elenco dei modelli premere **Torna all'originale** sul modello personalizzato: la
copia viene eliminata e torna in uso il modello fornito con BiblioViva.

## Possibili problemi

- Il pulsante **Personalizza** manca. Il modello è già personalizzato o è stato aggiunto: usare **Modifica**.
- Il pulsante **Salva** è spento. O non c'è nessuna modifica da salvare, oppure il modello non si può stampare. Leggere
  il riquadro rosso «Il template non si può stampare così» sopra il disegno: indica il campo sconosciuto o il file
  mancante.
- L'immagine non si carica. Il file deve essere PNG, JPEG, WebP, GIF o SVG (senza script), oppure un carattere WOFF2,
  WOFF o TTF, e non superare la dimensione massima indicata sotto **Carica un file**.
- Una parte della tessera non si può muovere nel disegno. Le parti dentro una sezione di codice si modificano nella
  vista **Codice**: il disegno lo segnala sotto la tessera. Per il codice vedere [Print templates: authoring
  guide](../../../templates-authoring.md#editing-from-the-admin-ui-drawing-and-code).
- Le scritte stampate escono tagliate o spostate. Tenerle dentro la linea tratteggiata. Se il retro non cade dietro al
  fronte, calibrare la stampa: [Calibrare la stampa fronte-retro](calibrate-duplex.md).
- Uscendo dalla pagina compare «Uscire senza salvare?». Ci sono modifiche non salvate: premere **Esci senza salvare**
  per perderle, oppure restare e premere **Salva**.
- Il modello non si può eliminare. Un modello usato da un'impostazione non si elimina: scegliere prima un altro modello
  in **Configurazione** → **Tessere**.

## Pagine correlate

- [Calibrare la stampa fronte-retro](calibrate-duplex.md)
- [Disattivare le foto o le copertine](switch-off-photos-or-covers.md)
- [Stampare le tessere di una classe](../../manual/guides/print-class-cards.md)
- [Annullare una modifica della configurazione](undo-a-configuration-change.md)
- [Template di stampa](../screens/templates.md)
- [Print templates: authoring guide](../../../templates-authoring.md) (pagina tecnica, in inglese)
