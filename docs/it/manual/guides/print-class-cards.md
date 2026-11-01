# Stampare le tessere di una classe

Questa pagina spiega come stampare in una volta le tessere di tutti gli alunni di una classe, tagliarle e piegarle.
Serve a chi prepara le tessere, di solito a inizio anno o dopo l'avanzamento di classe. Le stesse operazioni valgono per
la tessera di una sola persona.

- Tempo: circa 10 minuti per una classe di 25 alunni, più il tempo del taglio.
- Account: Tessere e foto (anche Amministrazione).
- Occorrente: una stampante collegata al computer e fogli A4; forbici o taglierina e un righello.
- Prima di stampare conviene che gli alunni abbiano la foto: vedere [Fare le foto degli utenti](take-patron-photos.md).
  Se l'amministratore ha disattivato le foto, le tessere si stampano senza foto.
- Per stampare solo alcune tessere, per esempio quelle non ancora stampate, usare una lista di stampa: vedere [Usare le
  liste di stampa](use-print-lists.md).

## Procedura

### Scegliere la classe

1. Accedere a BiblioViva con l'account Tessere e foto.
1. Aprire **Stampe**.
1. Scorrere sotto le liste fino alla parte **Classi**. In una scuola con più ordini le classi sono divise per ordine.

   <!-- figure: printing/lists-classes | La pagina Stampe con la parte Classi e il pulsante Stampa tessere di ogni
   classe -->

1. Trovare la scheda della classe, con il suo nome e il numero di utenti, e premere **Stampa tessere**. Si apre la
   finestra **Stampa tessere**, che riporta il numero delle tessere.

La stessa finestra si apre da **Utenti**: scegliere la classe nel filtro di sezione, poi premere il pulsante «Stampa
tessere» seguito dal nome della classe, per esempio **Stampa tessere 3 B**. Oppure selezionare alcune righe (tenendo
premuto Ctrl o Maiusc mentre si preme) e premere **Stampa tessere**. Dalla scheda di un utente, nella scheda
**Tessera**, il pulsante è **Stampa tessera**.

### Scegliere come stampare

<!-- figure: printing/card-dialog | La finestra Stampa tessere con le due scelte di Come stampare e le istruzioni per la finestra del browser -->

1. In **Come stampare** scegliere **Fronte e retro affiancati** se la stampante stampa su una sola facciata. Fronte e
   retro stanno uno accanto all'altro e la tessera si piega a metà. Di norma stanno quattro tessere su un foglio A4.
1. Scegliere invece **Sui due lati del foglio** se la stampante stampa su entrambe le facciate: il retro cade dietro il
   fronte, senza piegare, e su un foglio stanno dieci tessere. La finestra parte dalla scelta fatta dall'amministratore.
1. Leggere le istruzioni sotto «Nella finestra di stampa del browser:». Cambiano con la scelta e con le impostazioni
   dell'amministratore, e vanno ripetute nel punto seguente.
1. Premere **Stampa**. Il foglio si apre in una nuova scheda del browser. **Chiudi** chiude la finestra senza stampare.

Con **Sui due lati del foglio**, la prima volta, o se i retri non cadono dietro i fronti, l'amministratore deve
calibrare la stampa: vedere [Calibrare la stampa fronte-retro](../../admin/guides/calibrate-duplex.md).

### Stampare e tagliare

1. Nella nuova scheda premere Ctrl+P per aprire la finestra di stampa del browser.
1. Scegliere la stampante e il foglio A4.
1. Impostare la scala al 100 %, cioè «Dimensioni effettive», e non «Adatta alla pagina»: le tessere hanno una misura
   precisa in millimetri.
1. Impostare i margini su «Nessuno».
1. Con **Sui due lati del foglio** scegliere «Fronte-retro» con il capovolgimento che la finestra **Stampa tessere** ha
   indicato (sul lato lungo o sul lato corto).
1. Stampare. I nomi esatti delle voci dipendono dal browser: vedere [Impostare la finestra di
   stampa](../../setup/steps/scanner-printer.md#impostare-la-finestra-di-stampa).
1. Ritagliare ogni tessera come indica la finestra. Con i segni di taglio, unirli con il righello; con la linea
   colorata, tagliare lungo la linea; altrimenti tagliare lungo il bordo.
1. Con **Fronte e retro affiancati** piegare ogni tessera a metà sul lato corto, così che fronte e retro stiano sulle
   due facce. Con **Sui due lati del foglio** non c'è nulla da piegare: il retro è già dietro il fronte.

### Segnare le tessere come stampate

La stampa da sola non segna nulla: BiblioViva non sa se il foglio è uscito dalla stampante. Un utente la cui tessera non
è segnata come stampata risulta «Tessera non ancora stampata» e conta nel numero **Utenti senza tessera stampata** della
Dashboard.

1. Per la classe stampata da **Stampe**: dopo aver premuto **Stampa**, la finestra **Stampa tessere** resta aperta e
   mostra **Segna come stampate**. Premere il pulsante dopo la stampa: un avviso conferma «N tessere segnate come
   stampate». Sono segnate le tessere della classe che la pagina di stampa contiene (non quelle di utenti senza numero).
1. Per una tessera sola: aprire la **Scheda dell'utente**, aprire la scheda **Tessera** e premere
   **Segna come stampata**.
1. Per molte tessere: stampare da una lista di stampa e premere **Segna come stampate**, come descrive [Usare le liste
   di stampa](use-print-lists.md#segnare-le-tessere-come-stampate).

## Risultato

Il foglio ha le tessere con il nome, la classe, la foto e il codice a barre, ognuna da ritagliare e piegare. Con la
tessera si presta un libro: il lettore di codici a barre legge il codice della tessera al banco prestiti.

## Possibili problemi

- Le tessere escono ridotte o non entrano nel foglio: la scala non è al 100 %. Riaprire la finestra di stampa con Ctrl+P
  e scegliere «Dimensioni effettive».
- I retri non cadono dietro i fronti: l'amministratore deve eseguire la calibrazione descritta in [Calibrare la stampa
  fronte-retro](../../admin/guides/calibrate-duplex.md).
- Alcuni alunni mancano nel foglio: le tessere di utenti rimossi o senza numero non vengono stampate.
- La finestra «Stampa tessere» non offre l'aspetto desiderato: la grafica della tessera la modifica l'amministratore,
  come spiega [Modificare il modello delle tessere](../../admin/guides/edit-the-card-template.md).

## Pagine correlate

- [Usare le liste di stampa](use-print-lists.md)
- [Ristampare una tessera](replace-a-lost-card.md)
- [Fare le foto degli utenti](take-patron-photos.md)
- [Stampe](../screens/print-lists.md) e [Utenti](../screens/patrons.md)
