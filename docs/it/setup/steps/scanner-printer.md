# Provare il lettore e la stampante

Questo passo collega il lettore di codici a barre USB al computer del banco prestiti e verifica che BiblioViva stampi
tessere ed etichette nelle misure giuste. Serve a chi ha completato il [primo avvio](first-run.md) ed è entrato come
`admin`. Il passo richiede circa 30 minuti, compresa la stampa di prova.

## Occorrente

- Il lettore di codici a barre USB, di quelli che «scrivono» il codice come una tastiera, con il proprio cavo.
- Il computer del banco prestiti, con la stampante già installata e funzionante: l'installazione della stampante è
  descritta dal suo produttore.
- Fogli A4 di carta comune per la stampa di prova.
- Un righello in millimetri.
- Se si useranno etichette adesive: un foglio di etichette del tipo che si userà davvero.
- Un libro con un codice a barre stampato (qualsiasi libro con il codice ISBN sul retro).

## Procedura

### Collegare il lettore

Il lettore si collega al computer del banco prestiti, non al computer su cui gira BiblioViva. Il lettore si comporta
come una tastiera: ogni codice letto viene scritto nel campo attivo, seguito dal tasto Invio.

1. Collegare il cavo USB del lettore a una porta del computer del banco prestiti.
1. Attendere che il lettore dia il segnale di pronto, di solito un breve suono o una luce.

### Provare il lettore in un campo di testo

1. Aprire BiblioViva nel browser del computer del banco prestiti ed entrare come `admin`.
1. Aprire **Catalogo**.
1. Fare clic nel campo di ricerca **Cerca per titolo, autore o ISBN…**.
1. Leggere con il lettore il codice a barre di un libro, quello dell'ISBN.
1. Controllare che le cifre comparse nel campo siano uguali a quelle stampate sotto il codice a barre.

Il campo non cambia nulla nei dati: la lettura serve solo a vedere che cosa il lettore scrive.

### Provare il carattere «-» e la tastiera

I codici delle copie hanno un trattino, come `2026-E0267`. Un lettore impostato per una tastiera diversa da quella del
computer scrive un altro carattere al suo posto, di solito l'apostrofo `'`. Per provarlo serve un codice con il
trattino: il foglio di esempio delle etichette ne ha uno.

1. Aprire **Amministrazione** → **Configurazione** → **Template di stampa**.
1. Aprire la scheda **Anteprime**.
1. Aprire la scheda **Etichette**.
1. Premere **Foglio di esempio**. Il foglio si apre in una nuova scheda del browser.
1. Premere Ctrl+P per aprire la finestra di stampa e stampare il foglio su carta comune, con le impostazioni della
   sezione [Impostare la finestra di stampa](#impostare-la-finestra-di-stampa).
1. Tornare al campo **Cerca per titolo, autore o ISBN…** di **Catalogo**.
1. Leggere con il lettore il codice a barre di una delle etichette stampate.
1. Controllare che il codice nel campo sia uguale a quello scritto sull'etichetta, trattino compreso.

Se compare un apostrofo `'` o un altro carattere al posto del trattino, la tastiera dichiarata a BiblioViva non coincide
con quella del computer.

1. Aprire **Amministrazione** → **Configurazione** → **Codici a barre**.
1. Scegliere in **Tastiera dei computer** la lingua della tastiera del computer a cui è collegato il lettore. In Italia
   è «Italiana».
1. Premere **Salva** e ripetere la lettura del codice dell'etichetta.

BiblioViva accetta comunque i codici letti con le due tastiere, ma conviene che anche il lettore sia impostato sulla
tastiera del computer. Il manuale del lettore descrive il procedimento, che dipende dal modello e di norma
prevede la lettura di codici a barre di programmazione.

### Impostare la finestra di stampa

Il browser apre la propria finestra di stampa con Ctrl+P. Le misure delle tessere e delle etichette sono in millimetri e
valgono solo se la pagina non viene ridotta né ingrandita.

1. Scegliere la stampante e il foglio A4.
1. Impostare la scala al 100 %. Il browser la chiama «Dimensioni effettive» o «100»; non scegliere «Adatta alla pagina»
   né «Adatta all'area di stampa».
1. Impostare i margini su «Nessuno».
1. Disattivare «Intestazioni e piè di pagina», cioè la data e l'indirizzo che il browser aggiunge in alto e in basso.
1. Stampare.

[VERIFY: i nomi esatti delle voci della finestra di stampa di Firefox, Chrome ed Edge]

### Stampare la pagina di prova delle tessere

1. Aprire **Amministrazione** → **Configurazione** → **Template di stampa**.
1. Aprire la scheda **Anteprime**.
1. Aprire la scheda **Tessere**.
1. Premere **Stampa pagina di prova**. La pagina si apre in una nuova scheda.
1. Stampare con le impostazioni della sezione [Impostare la finestra di stampa](#impostare-la-finestra-di-stampa).
1. Misurare con il righello il segno «Righello 10 cm» stampato nella pagina: deve misurare 100 mm.
1. Misurare un'unità della pagina, cioè fronte e retro affiancati: con il template fornito misura 171,2 × 54 mm, con la
   piega a 85,6 mm. [VERIFY: sul foglio di prova reale]

Il foglio di prova mostra le unità vuote, con i segni di taglio e di piega: le tessere vere si stampano dopo, dalla
pagina degli utenti.

### Stampare la pagina di calibrazione delle etichette

Il foglio di etichette adesive ha una misura fissa: la pagina di calibrazione disegna ogni etichetta con il suo
contorno, da confrontare con un foglio vero.

1. Aprire **Amministrazione** → **Configurazione** → **Template di stampa**.
1. Aprire la scheda **Anteprime**.
1. Aprire la scheda **Etichette**.
1. Scegliere in **Supporto adesivo** il foglio che la biblioteca userà. Il foglio proposto ha etichette di 70 × 48 mm,
   18 per foglio.
1. Premere **Stampa pagina di calibrazione**. La pagina si apre in una nuova scheda.
1. Stampare su carta comune con le impostazioni della sezione [Impostare la finestra di
   stampa](#impostare-la-finestra-di-stampa).
1. Misurare con il righello il segno «Righello 10 cm» stampato nella pagina: deve misurare 100 mm.
1. Sovrapporre il foglio di prova a un foglio di etichette vere, controluce o contro una finestra.
1. Controllare che i contorni stampati coincidano con le etichette.

Se i contorni non coincidono, le misure del foglio di etichette non sono quelle di BiblioViva. Le misure si correggono
in **Amministrazione** → **Configurazione** → **Etichette** → **Fogli di etichette adesive**; la procedura per misurare
un foglio non previsto è nella pagina tecnica
[Print templates: authoring guide](../../../templates-authoring.md#measuring-a-sheet-and-checking-the-output) (in
inglese).

## Verifica prima di proseguire

- Un codice letto dal lettore compare nel campo di ricerca uguale a quello stampato, con il trattino e senza altri
  caratteri. Se così non è, controllare **Tastiera dei computer** come descritto sopra.
- Il «Righello 10 cm» della pagina di prova delle tessere e quello della pagina di calibrazione misurano 100 mm. Se
  misurano meno o più, la finestra di stampa ha ridotto o ingrandito la pagina: tornare a [Impostare la finestra di
  stampa](#impostare-la-finestra-di-stampa).
- I contorni della pagina di calibrazione coincidono con le etichette del foglio vero.

## Possibili problemi

### Il lettore non scrive nulla

Provare un'altra porta USB e controllare di aver fatto clic nel campo prima di leggere. Il lettore deve essere
collegato al computer del banco prestiti.

### Il lettore scrive il codice ma BiblioViva non lo accetta

Al banco il lettore deve inviare il tasto Invio dopo il codice, perché i campi dei codici lo accettano solo con Invio.
Il manuale del lettore spiega come attivare il suffisso Invio.

### Il lettore scrive caratteri sbagliati al posto del trattino

Vedere la sezione sulla tastiera, sopra, e la pagina
[Problemi comuni](../../help/problems.md#lettore-che-scrive-caratteri-strani). La spiegazione tecnica è nella pagina [Deployment notes (technical)](../../../deploy.md#installing-updating-logs-step-85)
(in inglese).

### Il righello stampato misura meno di 100 mm

La scala della finestra di stampa non è al 100 %.

### La stampa ha date e indirizzi ai bordi del foglio

Le intestazioni e i piè di pagina del browser sono attivi.

## Pagine correlate

- Passo precedente: [Collegare i dispositivi](devices.md)
- Passo successivo: [Copie di sicurezza](backups.md)
- [Problemi comuni](../../help/problems.md)
