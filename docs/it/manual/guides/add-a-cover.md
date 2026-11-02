# Aggiungere la copertina

Questa guida spiega come mettere la copertina sulla scheda di un libro: BiblioViva la cerca da sola in rete, e quando
non la trova o è sbagliata si carica una foto o un file. Serve a chi cataloga i libri.

- Tempo: meno di 1 minuto per scaricarla, circa 3 minuti per fotografarla.
- Account: Catalogazione (anche Amministrazione).
- Occorrente: per scaricarla, la connessione a Internet del computer di BiblioViva e un libro che ha l'ISBN; per
  fotografarla, il libro e una fotocamera (la fotocamera del telefono, facoltativa) oppure un file immagine.

> [!NOTE]
> L'amministratore può disattivare le copertine. In quel caso la scheda non mostra il riquadro della copertina né i
> pulsanti di questa guida: vedere
> [Disattivare le foto o le copertine](../../admin/guides/switch-off-photos-or-covers.md).

## Procedura

### Controllare la copertina mentre si cataloga un libro

1. Catalogare il libro con **Nuovo libro**, vedere [Catalogare un libro nuovo](catalog-a-new-book.md).
1. Guardare il riquadro **Copertina** accanto al modulo. BiblioViva cerca la copertina in rete dall'ISBN e scrive lo
   stato: «Ricerca della copertina online…», poi «Trovata su …: si salva con la scheda.» oppure «Nessuna copertina
   trovata online: è possibile fotografarla.».

   <!-- figure: catalog/new-book-cover | Il riquadro Copertina con la copertina trovata in rete -->

1. Se la copertina è quella del libro, proseguire e premere **Salva scheda e copie**: la copertina si salva con la
   scheda.
1. Se la copertina è sbagliata, premere **Sostituisci con una foto** e seguire i passi di
   [Fotografare o caricare la copertina](#fotografare-o-caricare-la-copertina). Per toglierla senza sostituirla premere
   **Togli**.
1. Se non è stata trovata, premere **Fotografa la copertina**.

### Scaricare la copertina da una scheda già salvata

1. Aprire la scheda del libro da **Catalogo**.
1. Sotto l'immagine della copertina premere **Scarica copertina**. Il pulsante c'è solo se la scheda ha un ISBN.
1. Attendere. Un avviso dice «Copertina scaricata da …» e la copertina compare sulla scheda.

### Fotografare o caricare la copertina

Questo metodo serve quando la copertina non si trova in rete, è sbagliata o il libro non ha ISBN. Se il libro ha già una
copertina il pulsante si chiama **Cambia copertina**.

1. Aprire la scheda del libro da **Catalogo**.
1. Premere **Fotografa la copertina**. Si apre il riquadro **Copertina**.

   <!-- figure: catalog/cover-panel | Il riquadro per fotografare o caricare la copertina sulla scheda di un libro -->

1. Scegliere come avere l'immagine:
   - con una fotocamera: inquadrare tutta la copertina, anche di sbieco, e premere **Scatta**;
   - con un file già pronto sul computer (per esempio una foto fatta con il telefono e trasferita): premere **Carica un
     file**. Sono ammessi JPEG, PNG, WebP e HEIC.
1. Attendere la ricerca dei bordi: «Ricerca dei bordi della copertina…». La prima volta il programma di raddrizzamento
   si scarica e l'attesa è più lunga, mentre si legge «Caricamento del modulo di raddrizzamento…».
1. Controllare i quattro angoli sull'immagine. Se non coincidono con i bordi della copertina trascinarli uno per uno sui
   bordi, come dice l'avviso «Trascinare i quattro angoli sui bordi della copertina, poi raddrizzare.».
1. Premere **Raddrizza**. Sotto **Risultato** compare la copertina dritta.
1. Se il risultato è giusto premere **Usa questa copertina**; altrimenti premere **Rifai** e ripetere dal controllo
   degli angoli. L'avviso «Copertina salvata» conferma il salvataggio.

La fotocamera funziona solo se BiblioViva è raggiunto con Tailscale (HTTPS): vedere
[Scegliere la rete](../../setup/choose-network.md). Con la rete locale e senza HTTPS resta **Carica un file**.

### Togliere la copertina

1. Aprire la scheda del libro da **Catalogo**.
1. Premere **Rimuovi copertina** e confermare con **Rimuovi copertina** nella finestra «Rimuovere la copertina?».
   L'immagine viene cancellata dal server.

## Risultato

La scheda del libro mostra la copertina a sinistra del titolo.

## Possibili problemi

### Nessuna copertina trovata online

Compare «Nessuna copertina trovata online per questo ISBN: è possibile fotografarla.»: nessuno dei servizi consultati
ha la copertina. Fotografarla o caricare un file.

### La scheda non ha un ISBN

Compare «La scheda non ha un ISBN: la copertina va fotografata.»: senza ISBN la ricerca in rete non è possibile.
Fotografare il libro.

### La fotocamera richiede una connessione sicura

Compare «La fotocamera funziona solo con una connessione sicura (https)…»: BiblioViva è aperto dalla rete locale
senza Tailscale: usare **Carica un file**.

### Permesso negato o fotocamera non trovata

Compare «Permesso negato…» o «Nessuna fotocamera trovata su questo dispositivo.»: consentire l'uso della fotocamera
nelle impostazioni del browser, oppure usare **Carica un file**.

### File troppo grande o formato non supportato

Compare «File troppo grande» o «Formato immagine non supportato»: il file supera il limite indicato nell'avviso o non
è JPEG, PNG, WebP o HEIC. Ridurre l'immagine o salvarla in un altro formato.

### Il modulo di raddrizzamento non si carica

Compare «Impossibile caricare il modulo di raddrizzamento…»: il computer non ha raggiunto il file del programma di
raddrizzamento. Controllare la connessione e riprovare.

### La copertina scaricata è del libro sbagliato

Succede se l'ISBN della scheda è quello di un'altra edizione. Sostituirla con **Cambia copertina**.

## Pagine correlate

- [Catalogare un libro nuovo](catalog-a-new-book.md)
- [Correggere la scheda di un libro](edit-a-record.md)
- [Scheda del libro](../screens/book-record.md)
- [Disattivare le foto o le copertine](../../admin/guides/switch-off-photos-or-covers.md)
