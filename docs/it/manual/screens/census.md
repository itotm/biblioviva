# Censimento foto

Il censimento foto serve a dare una foto a tutti gli utenti, classe per classe: si fotografano le persone una alla
volta, oppure si carica l'immagine di una classe intera (il tabellone del fotografo, un foglio di fototessere) e
BiblioViva ritaglia le singole foto. La foto compare sulla tessera e sul banco prestiti, dove aiuta a riconoscere
l'utente.

La pagina si apre dalla scheda **Censimento foto** dell'area [Utenti](patrons.md), dalla [dashboard](dashboard.md)
(l'azione **Censimento foto** e il riquadro degli utenti senza foto) e al termine dell'importazione degli studenti. La
usano gli account «Tessere e foto» e «Amministrazione». L'amministratore può disattivare le foto: in tal caso il
censimento, le immagini di classe e l'importazione delle foto non sono offerti da nessuna parte.

Il censimento ha tre pagine: la scelta della classe o della lista, la pagina di una classe e la pagina di un'immagine.
Le procedure sono nelle guide [Fare le foto degli utenti](../guides/take-patron-photos.md) e [Ricavare le foto da
un'immagine della classe](../guides/photos-from-class-picture.md).

## Scelta della classe o della lista

<!-- figure: patrons/census-choice | La scelta della classe o della lista nel censimento foto -->

Nella figura:

1. Le schede **Utenti** e **Censimento foto**: [Scelta della classe o della lista](#scelta-della-classe-o-della-lista).
1. Il campo **Cerca per cognome**: [Ricerca di una persona](#ricerca-di-una-persona).
1. Le liste di utenti: [Liste e classi](#liste-e-classi).
1. Le classi, ordine di scuola per ordine di scuola: [Liste e classi](#liste-e-classi).

### Ricerca di una persona

Il campo **Cerca per cognome** porta direttamente a una persona: scelto il nome, si apre la classe e parte la foto di
quell'utente.

### Liste e classi

Sotto **Scegli una lista o una classe** compaiono le liste di utenti (**Liste di utenti**) e le classi (**Classi**; in
una scuola con più ordini, una sezione per ordine). La pagina avvisa: «Compaiono solo le classi e le liste in cui manca
almeno una foto.» Ogni scelta è un riquadro con il nome e l'avanzamento «N di M con foto»; le classi senza classe
assegnata compaiono come **Senza classe**. Quando tutto è fotografato, la pagina scrive «Tutte le classi e le liste
hanno le foto.»

## Pagina di una classe

Scegliendo un riquadro si apre la pagina della classe (o della lista). Il pulsante di ritorno **Cambia classe o lista**
riporta alla scelta; l'indirizzo ricorda la classe, quindi anche il tasto Indietro del browser e il ricaricamento
restano sulla classe. In alto una riga riporta il nome e l'avanzamento: «N di M con foto».

<!-- figure: patrons/census-class | La pagina di una classe nel censimento, con la fotocamera aperta su un utente -->

Nella figura:

1. Il pulsante **Cambia classe o lista**: [Pagina di una classe](#pagina-di-una-classe).
1. La fotocamera con il nome della persona e i pulsanti **Salta** e **Fine**: [Una persona alla
   volta](#una-persona-alla-volta).
1. L'elenco delle persone, con la foto già fatta: [Una persona alla volta](#una-persona-alla-volta).
1. Il riquadro **Da un'immagine con più foto**: [Da un'immagine con più foto](#da-unimmagine-con-più-foto).

### Una persona alla volta

Sotto il titolo **Una persona alla volta** sta l'elenco delle persone della classe, ognuna con la miniatura della foto
(o un segnaposto). Un clic su un nome apre la fotocamera per quella persona:

1. Inquadrare il volto dell'utente. In alternativa premere **Carica file** per scegliere un'immagine già pronta.
1. Premere **Scatta foto**.
1. Trascinare l'immagine per inquadrare, regolare lo **Zoom** e premere **Usa questa foto**. **Rifai** ripete lo scatto.
   In alternativa al trascinamento, toccare il punto da portare al centro del riquadro oppure, con la tastiera,
   premere Tab per scegliere il riquadro e spostare l'immagine con le frecce (Maiusc per passi più lunghi).
1. Un messaggio dice «Foto salvata: nome» e la pagina passa da sola alla persona seguente senza foto.

La fotocamera è facoltativa e funziona solo con una connessione sicura (https), cioè con Tailscale; senza, si carica un
file per ogni persona. Sul telefono la fotocamera occupa lo schermo intero e resta accesa tra uno scatto e l'altro.

Il pulsante **Salta** passa alla persona seguente senza foto; **Fine** chiude la fotocamera. Quando tutti hanno la foto,
la pagina scrive «Tutti hanno la foto.»

### Nuovo utente

Per una classe o per il gruppo dei docenti (non per una lista né per **Senza classe**), il pulsante **Nuovo utente**
aggiunge subito una persona che manca. La pagina
avvisa: «Viene aggiunto a nome della classe e la sua foto è la prossima.»

1. Premere **Nuovo utente**.
1. Scrivere **Cognome** e **Nome**. Se la classe ospita più anni di corso, scegliere la **Classe**.
1. Premere **Aggiungi e fotografa**. L'utente è creato e si apre la fotocamera per la sua foto.

Gli errori compaiono sotto il modulo. Per i dati completi dell'utente si usa poi la [scheda
dell'utente](patron-record.md).

### Da un'immagine con più foto

Il riquadro **Da un'immagine con più foto** serve quando le foto stanno su un'unica immagine: un tabellone del
fotografo, le tessere disposte su un tavolo, un foglio di fototessere. La pagina spiega: «Immagini con più foto […]:
rilevamento automatico delle foto e assegnazione a ciascun utente.»

- **Carica immagine** sceglie un file dal computer. BiblioViva lo ridimensiona e lo apre nella
  [pagina dell'immagine](#pagina-dellimmagine).
- **Fotografa il foglio** compare soltanto sul telefono e scatta l'immagine con la fotocamera del telefono.
- Con i dati dimostrativi, mentre manca una foto, ci sono anche **Esempio da scanner** ed **Esempio da foto**: due
  immagini di prova, una piatta e una scattata di sbieco.

Sotto, l'elenco delle immagini già caricate per la classe, dalla più recente: ciascuna riporta «N foto trovate · N
salvate · N da fare», oppure **Da elaborare** se le foto non sono state ancora cercate. Un clic riapre l'immagine. Se
non ce ne sono, la pagina scrive «Nessuna immagine per questa classe o lista.»

## Pagina dell'immagine

La pagina **Foto da un'immagine** apre un'immagine caricata e permette di assegnare ogni foto a una persona. Il pulsante
di ritorno **Torna alla classe** riporta alla classe. In alto a destra stanno **Salva le foto** (spento finché non c'è
nulla da salvare) e **Elimina immagine**.

<!-- figure: patrons/census-sheet | La pagina dell'immagine di una classe con i riquadri trovati e un elenco a discesa per ogni foto -->

Nella figura:

1. L'avanzamento della classe: [Ricerca delle foto](#ricerca-delle-foto).
1. La barra con **Foto**/**Scansione** e **Correggi riquadri**: [Correzione dei riquadri](#correzione-dei-riquadri).
1. L'immagine con i riquadri numerati: [Correzione dei riquadri](#correzione-dei-riquadri).
1. L'elenco delle foto trovate, con la scelta di chi è: [Assegnare le foto](#assegnare-le-foto).
1. I pulsanti **Salva le foto** ed **Elimina immagine**: [Salvare le foto](#salvare-le-foto).

### Ricerca delle foto

La prima volta che l'immagine si apre, il browser cerca le foto: la pagina scrive «Ricerca delle foto nell'immagine…»
(la prima volta si carica anche un modulo di riconoscimento, con la barra di avanzamento). Alla fine dice «Foto trovate:
N. Scegliere per ciascuna l'utente.» oppure “Nessuna foto trovata. Con «Correggi riquadri» si possono disegnare a mano.”
Sopra la riga dell'avanzamento: «nome della classe: N di M con foto».

### Correzione dei riquadri

Sopra l'immagine una barra offre:

- il tipo di immagine, **Foto** oppure **Scansione**. **Foto** è per un'immagine scattata di sbieco: ogni angolo di un
  riquadro si sposta da solo, per seguire la prospettiva. **Scansione** è per un'immagine fatta con lo scanner: i
  riquadri restano rettangoli e si possono soltanto ruotare. Finché nessun utente è stato scelto, cambiando tipo le foto
  vengono cercate di nuovo;
- **Correggi riquadri**, che mostra i riquadri sull'immagine per correggerli (poi diventa **Fine correzioni**). Toccare
  un riquadro e trascinarne gli angoli; in una scansione, un angolo allarga o stringe il riquadro e il cerchio in alto
  lo ruota. Con la tastiera, Tab sceglie un riquadro e Invio lo seleziona; poi Tab raggiunge i suoi angoli (in una
  scansione, anche il cerchio) e le frecce li spostano;
- **Aggiungi riquadro**, per una foto mancante: si trascina sull'immagine da un angolo all'altro della foto, oppure si
  tocca l'immagine per aggiungere un riquadro della misura abituale centrato in quel punto; con la tastiera, Invio
  sull'immagine ne aggiunge uno al centro;
- **Elimina riquadro N**, per togliere un riquadro sbagliato (compare dopo averlo scelto).

### Assegnare le foto

Accanto all'immagine, una riga per ogni foto trovata: **Foto N** con la miniatura ritagliata e un elenco a discesa **Chi
è?** con i nomi della classe. Ogni nome indica se «ha già una foto» o è «senza foto». Una persona può avere una sola
foto in questa immagine: se è già stata scelta altrove, il suo nome compare come «(già nella foto N)» e non è
selezionabile.

Il pulsante **Ignora** segna una foto che non è di nessuno della classe (per esempio un'insegnante o una persona di
un'altra classe): la riga diventa grigia e **Ripristina** la riporta com'era. Una foto di un utente rimosso nel
frattempo è coperta e la riga lo dice («Utente rimosso: il riquadro è stato coperto nell'immagine.»).

### Salvare le foto

1. Premere **Salva le foto**. La finestra **Salvare le foto scelte?** riassume: «Foto da salvare: N.»
1. Se alcune sostituiscono una foto che c'è già, la finestra elenca i nomi: «Sostituiscono la foto che c'è già: …». Se
   restano foto senza nessuno scelto, dice «Riquadri senza nessuno scelto: N (restano come sono).»
1. Premere **Salva le foto** nella finestra. Un messaggio conferma «Foto salvate: N.»

Dopo il salvataggio la riga diventa verde: «Salvata come foto di nome». Se qualcuno della classe è ancora senza foto, il
riquadro **Ancora senza foto** ne elenca i nomi, con il pulsante **Fotografali uno per uno**, che riporta alla classe.

**Elimina immagine** chiede conferma («Eliminare l'immagine?»): l'immagine e i suoi riquadri vengono cancellati; le foto
già salvate restano agli utenti.

## Messaggi della pagina

Sotto la barra dei pulsanti possono comparire questi avvisi.

### Immagine troppo grande

«L'immagine è troppo grande (al massimo N MB).» Occorre ridurre l'immagine o scattarla di nuovo.

### Formato non supportato

«Formato non supportato: sono ammessi JPEG, PNG, WebP e HEIC.» «Il file non è un'immagine leggibile.» e «Il file è
vuoto.» dicono che il file non va bene.

### Troppe foto in un'immagine

«Al massimo N foto per immagine.» Occorre dividere l'immagine.

### Persona già scelta

«Già scelto per la foto N: liberarla prima di sceglierlo qui.» Ogni persona ha una sola foto per immagine.

### Foto già salvata

«Questa foto è già stata salvata.» Il riquadro non si cambia più.

### Sostituzione da confermare

«N foto sostituiscono quelle esistenti: confermare per procedere.» La finestra di salvataggio chiede la conferma.

### Niente da salvare

«Scegliere almeno un utente prima di salvare.»

### Immagine o classe non trovate

«Immagine non trovata.» e «La classe o la lista non esiste più.» compaiono se l'immagine o la classe è stata cancellata
nel frattempo.

### Modulo di riconoscimento non caricato

«Impossibile caricare il modulo di raddrizzamento. Controllare la connessione e riprovare.» Il modulo che trova le foto
viene scaricato la prima volta; occorre una connessione a Internet.

## Pagine correlate

- [Utenti](patrons.md)
- [Scheda dell'utente](patron-record.md)
- [Fare le foto degli utenti](../guides/take-patron-photos.md)
- [Ricavare le foto da un'immagine della classe](../guides/photos-from-class-picture.md)
