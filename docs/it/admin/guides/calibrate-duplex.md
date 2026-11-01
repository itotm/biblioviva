# Calibrare la stampa fronte-retro

Quando le tessere si stampano sui due lati del foglio, il retro deve cadere esattamente dietro il fronte. Ogni stampante
sposta un poco il retro: la calibrazione misura di quanto e lo corregge per sempre. Questa guida serve
all'amministratore, dopo aver acquistato una nuova stampante, o quando il retro delle tessere risulta spostato rispetto
al fronte.

- Tempo: circa 15 minuti.
- Account: `admin`, l'unico che vede la pagina di calibrazione.
- Occorrente: la stampante delle tessere con la stampa fronte-retro, un foglio di carta o di cartoncino, forbici o
  taglierino e un righello. Meglio usare la stessa carta e la stessa stampante delle tessere.

La calibrazione serve soltanto per la stampa **Sui due lati del foglio**. Con **Fronte e retro affiancati** (da piegare)
non occorre. Si fa una volta sola per stampante: va ripetuta se si cambia stampante.

## Procedura

### Aprire la pagina

1. Aprire **Amministrazione** → **Configurazione** e scegliere la sezione **Tessere**.
1. Nel blocco **Template per tipo di utente** premere **Calibra la stampa fronte-retro**. Si apre la pagina con lo
   stesso nome.
1. Leggere la riga che dice come gira il foglio e di quanto sono spostati i retri: per esempio «Come gira il foglio: Sul
   lato lungo. Spostamento attuale dei retri: 0 mm in orizzontale, 0 mm in verticale».

<!-- figure: admin/duplex-calibration | La pagina Calibra la stampa fronte-retro, con i passi, il disegno dei righelli e i due campi -->

> [!NOTE]
> La stessa pagina si apre anche dal dialogo di stampa delle tessere, quando è scelto **Sui due lati del foglio**, dal
> collegamento **Calibra la stampa fronte-retro**. Il dialogo di stampa delle tessere è descritto in [Stampare le
> tessere di una classe](../../manual/guides/print-class-cards.md).

### Stampare il foglio di calibrazione

1. Premere **Stampa il foglio di calibrazione**. Si apre in una nuova scheda il foglio, che porta una tessera grande, di
   150 × 100 mm, con il numero «1» su un lato e il numero «2» sull'altro.
1. Aprire la finestra di stampa del browser e scegliere «Fronte-retro» capovolgendo sul lato indicato nella pagina (la
   riga della pagina dice **Sul lato lungo** o **Sul lato corto**), la scala al 100 % e nessun margine.
1. Stampare.

> [!IMPORTANT]
> Il lato scelto nella finestra di stampa deve essere lo stesso scritto nella pagina di calibrazione. Se la stampante
> gira il foglio in altro modo, cambiare l'impostazione **Come gira il foglio** nella sezione **Tessere**, nel blocco
> **Stampa sui due lati**, prima di calibrare.

### Misurare lo spostamento

1. Sul lato con il grande «1» ritagliare con cura lungo la linea nera.
1. Girare il cartoncino ritagliato. Sul lato «2» ci sono due righelli, uno orizzontale e uno verticale, con un segno
   ogni millimetro e i numeri ogni cinque.
1. Leggere il numero che il bordo tagliato attraversa sul righello orizzontale, con il segno + o −.
1. Leggere il numero che il bordo tagliato attraversa sul righello verticale, con il segno + o −. Il disegno nella
   pagina (**Che cosa leggere**) mostra dove leggere. Se il bordo cade sullo zero, il valore è 0.

> [!NOTE]
> Se il bordo cade tra due tacche, scrivere il valore più vicino, anche con il mezzo millimetro (per esempio 1,5).

### Salvare la correzione

1. Scrivere il primo numero in **Righello orizzontale (mm)** e il secondo in **Righello verticale (mm)**.
1. Controllare la riga sotto i campi: dice di quanto saranno spostati i retri dopo il salvataggio.
1. Premere **Salva la calibrazione**. Compare il messaggio «Calibrazione salvata», con i nuovi spostamenti, e i due
   campi tornano a 0.

### Verificare

1. Premere di nuovo **Stampa il foglio di calibrazione** e ripetere la stampa, il taglio e la lettura.
1. Controllare che il bordo tagliato passi sullo 0 di entrambi i righelli. Se non è così, scrivere i numeri letti e
   salvare di nuovo: i valori si sommano a quelli già salvati.
1. Stampare una tessera vera sui due lati e controllare che il retro cada dietro al fronte.

## Risultato

Le tessere stampate sui due lati hanno il retro dietro al fronte. Lo spostamento calcolato è memorizzato nelle
impostazioni **Spostamento dei retri, in orizzontale (mm)** e **Spostamento dei retri, in verticale (mm)**, nella
sezione **Tessere**, e vale per ogni stampa successiva. Ogni salvataggio è una modifica della configurazione e si può
annullare: [Annullare una modifica della configurazione](undo-a-configuration-change.md).

## Possibili problemi

- Non si sa quale lato scegliere nella finestra di stampa. La pagina lo scrive sopra l'elenco dei passi, nella riga
  «Come gira il foglio». Se la stampante gira il foglio in altro modo, cambiare **Come gira il foglio** nella sezione
  **Tessere** e ripetere la calibrazione.
- I valori letti sono molto grandi. Controllare che la stampa sia al 100 % e senza margini aggiunti, e che il lato della
  finestra di stampa sia quello indicato.
- Dopo il salvataggio il bordo tagliato non è ancora sullo 0. Ripetere la lettura e salvare i nuovi numeri: la
  correzione si somma.
- I campi non accettano il numero. Ammessi numeri da −20 a 20 mm, a passi di mezzo millimetro.
- La pagina non si apre. La calibrazione la vede solo l'account `admin`.
- Si vuole annullare la correzione. Annullare la modifica dalla cronologia della configurazione: [Annullare una modifica
  della configurazione](undo-a-configuration-change.md).

## Pagine correlate

- [Modificare il modello delle tessere](edit-the-card-template.md)
- [Stampare le tessere di una classe](../../manual/guides/print-class-cards.md)
- [Annullare una modifica della configurazione](undo-a-configuration-change.md)
- [Template di stampa](../screens/templates.md)
