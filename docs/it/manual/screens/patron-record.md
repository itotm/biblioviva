# Scheda dell'utente

La scheda dell'utente raccoglie i dati di un alunno o di un docente: la foto, la classe, la tessera, i prestiti in
corso, lo storico e le note. Serve per correggere i dati, stampare o riassegnare la tessera, rinnovare un prestito e,
quando un utente lascia la scuola, rimuoverlo.

La scheda si apre da un utente dell'elenco [Utenti](patrons.md), dal salvataggio di un [Nuovo utente](#nuovo-utente),
da [Libri in prestito](loans.md) e dalle liste di stampa. La usano gli account «Tessere e foto» e «Amministrazione».
I comandi per rinnovare un prestito e segnarlo smarrito compaiono soltanto per gli account che hanno anche il banco
prestiti (di norma «Amministrazione»); rimuovere un utente ed esportarne i dati spetta soltanto ad «Amministrazione».

<!-- figure: patrons/record-loans | La scheda di uno studente con i prestiti in corso -->

Nella figura:

1. La foto e i pulsanti **Foto** ed **Elimina foto**: [Foto](#foto).
1. Il nome, il tipo e i contrassegni (classe, tessera, email, nota per il banco): [Intestazione](#intestazione).
1. I pulsanti di azione: [Azioni della scheda](#azioni-della-scheda).
1. Le schede **Prestiti in corso**, **Storico**, **Tessera** e **Note**: [Prestiti in corso](#prestiti-in-corso),
   [Storico](#storico), [Tessera](#tessera), [Note](#note).
1. L'elenco dei prestiti con le icone di rinnovo e di smarrimento: [Prestiti in corso](#prestiti-in-corso).

## Intestazione

In alto stanno il cognome e il nome (nella forma «Cognome Nome») e, sotto, il tipo (**Studente** o **Docente**). I
contrassegni sono:

- **Rimosso**, quando l'utente è stato rimosso (vedere [Rimozione dell'utente](#rimozione-dellutente));
- la classe (`3 B`), oppure **Docente** per un docente senza classe;
- il numero della tessera, oppure **senza tessera**;
- l'indirizzo email, se c'è: un clic apre il programma di posta;
- «Rimosso il» e la data, per un utente rimosso;
- in arancione, la nota per il banco prestiti, se c'è: è la stessa che compare in evidenza durante il prestito.

### Foto

Se le foto degli utenti sono attive (l'amministratore può disattivarle), a sinistra sta la foto, oppure il segnaposto
«Nessuna foto». Sotto la foto due pulsanti (non per un utente rimosso):

- **Foto** apre un pannello per fare la foto. Con **Scatta foto** si usa la fotocamera del dispositivo; con **Carica
  file** si sceglie un'immagine già pronta. Dopo lo scatto si trascina l'immagine per inquadrare il volto, si regola lo
  **Zoom** e si conferma con **Usa questa foto**; **Rifai** ripete lo scatto, **Annulla** esce. Un messaggio conferma
  «Foto salvata». La fotocamera è facoltativa e funziona solo con una connessione sicura (https), cioè con Tailscale;
  caricare un file va bene ovunque.
- **Elimina foto** (se la foto c'è) chiede conferma («Eliminare la foto?») e la cancella dal server.

Le foto di molti utenti insieme si fanno dal [Censimento foto](census.md). La procedura è nella guida
[Fare le foto degli utenti](../guides/take-patron-photos.md).

## Azioni della scheda

L'azione principale è **Modifica**. Se la riga è stretta, le altre passano nel menu **Altre azioni**.

- **Modifica** apre il modulo [Modifica utente](#modifica-utente).
- **Aggiungi alla lista** mette l'utente in una lista di stampa delle tessere (vedere [Stampe](print-lists.md) e
  [Usare le liste di stampa](../guides/use-print-lists.md)). Non è disponibile per un utente rimosso.
- **Esporta i dati della persona**, solo per «Amministrazione», scarica i dati di quella persona, per rispondere a una
  richiesta di accesso ai dati.
- **Rimuovi studente** o **Rimuovi docente** (secondo il tipo), in rosso, solo per «Amministrazione»: vedere
  [Rimozione dell'utente](#rimozione-dellutente).

## Prestiti in corso

La scheda **Prestiti in corso (N)** elenca i libri che l'utente ha in prestito. Per ogni prestito sono indicati il
titolo, l'autore e il codice della copia, e «Scadenza:» con la data; un prestito scaduto porta in rosso «in ritardo».
Quando non c'è nessun prestito, la pagina scrive «Nessun prestito in corso.»

Per gli account che hanno anche il banco prestiti (di norma «Amministrazione») ci sono i comandi seguenti:

- **Stampa promemoria**, se almeno un prestito è in ritardo: apre in una nuova scheda il promemoria da consegnare;
- **Rinnova tutti**, se i prestiti sono più di uno;
- l'icona «Rinnova …» a fianco del prestito, che rinnova quel libro;
- l'icona «Segna smarrito …», in rosso, che chiude il prestito perché il libro non si trova.

Un rinnovo rifiutato spiega perché con un messaggio nella pagina, lo stesso del banco prestiti (vedere [Rinnovi
rifiutati](checkout.md#rinnovi-rifiutati)); per «Amministrazione» la finestra **Forzare il rinnovo?** permette di
procedere comunque con **Rinnova comunque**, scrivendo un motivo.

### Segnalazione di un libro smarrito

L'icona «Segna smarrito …» apre la finestra “Segnare «titolo» come smarrito?”. Il prestito si chiude e la copia risulta
smarrita. Se il libro ricompare, la registrazione della restituzione riporta la copia a disponibile. Il campo **Motivo
(facoltativo)** registra perché; **Segna smarrito** conferma («titolo segnato come smarrito.»).

### Libri smarriti

Sotto i prestiti la sezione **Libri smarriti** elenca i libri segnati come smarriti mentre erano in prestito a
questo utente, con la data. La nota ricorda: «Se tornano, vanno passati nelle restituzioni.»

## Storico

La scheda **Storico** elenca tutti i prestiti dell'utente, dal più recente: **Prestato il**, **Scadenza**, **Restituito
il**, **Esito**, **Titolo**, **Copia** e **Rinnovi**. L'esito è **In corso**, **In ritardo**, **Restituito**,
**Restituito in ritardo** o **Smarrito**. Sopra l'elenco una riga dice «N prestiti in totale» e il menu **Esporta**
scarica l'elenco in CSV o ODS. Se non c'è alcun prestito, la pagina scrive «Nessun prestito registrato.»

## Tessera

La scheda **Tessera** mostra il numero della tessera, il suo codice a barre e se è già stata stampata: «Tessera stampata
il …» oppure «Tessera non ancora stampata.» Se l'utente non ha tessera, la pagina scrive **senza tessera**.

- **Stampa tessera** apre la finestra **Stampa tessere** per questa sola tessera (vedere [Stampa delle
  tessere](patrons.md#stampa-delle-tessere)).
- **Segna come stampata** registra che la tessera è stata stampata («Tessera segnata come stampata»).
- **Riassegna tessera** dà all'utente una nuova tessera, per esempio dopo uno smarrimento. La finestra «Assegnare una
  nuova tessera?» avvisa: «Il numero attuale viene ritirato per sempre e la nuova tessera andrà stampata.» Dopo la
  conferma un messaggio riporta il nuovo numero («Nuova tessera: …»). La tessera vecchia non vale più.

> [!IMPORTANT]
> Il numero ritirato non si riusa. Dopo **Riassegna tessera** occorre stampare la tessera nuova. La procedura è nella
> guida [Ristampare una tessera](../guides/replace-a-lost-card.md).

Un utente rimosso non ha più pulsanti di stampa né di riassegnazione.

## Note

La scheda **Note** contiene due testi: la **Nota per il banco prestiti**, che compare in evidenza al momento del
prestito, e le **Note interne**, che restano qui. In fondo si legge «Creato il» con la data.

1. Premere **Modifica note**.
1. Scrivere la **Nota per il banco prestiti** (al massimo 500 caratteri) e le **Note interne** (al massimo 2000).
1. Premere **Salva**. Un messaggio conferma «Note salvate» (oppure «Nessuna modifica»). **Annulla** esce.

Se non c'è nulla, la pagina scrive «Nessuna nota.»

## Rimozione dell'utente

**Rimuovi studente** (o **Rimuovi docente**) apre la finestra «Rimuovere definitivamente nome?». Vengono cancellati
subito e per sempre il nome e il cognome, l'email, la matricola, le note, il numero di tessera (che viene ritirato) e la
foto; restano soltanto il tipo, la classe, la sezione e lo storico dei prestiti, per le statistiche. L'operazione non si
può annullare. La finestra mostra due avvisi quando servono:

- «Ha N prestiti in corso: prima vanno restituiti o segnati smarriti.» L'utente con prestiti in corso non si rimuove.
- «È stato scelto per N foto nelle immagini della classe (censimento da immagine): quei riquadri vengono coperti.»

Il pulsante di conferma ha lo stesso nome dell'azione. La procedura è nella guida
[Rimuovere un utente](../guides/remove-a-patron.md). Alla fine un messaggio dice «Utente rimosso: i dati personali
sono stati cancellati.» e la scheda mostra **Rimosso**.

> [!WARNING]
> La rimozione è immediata e irreversibile: non c'è un periodo di attesa. Per le persone che lasciano la scuola a fine
> anno si usa, di solito, l'avanzamento di classe dell'amministratore (vedere [Avanzare di
> classe](../../admin/guides/class-upgrade.md)).

## Modifica utente

La pagina **Modifica utente** corregge i dati. Si apre dal pulsante **Modifica** della scheda; la procedura è nella
guida [Correggere i dati di un utente](../guides/edit-a-patron.md). In fondo stanno **Annulla** e **Salva modifiche**. I
campi non validi sono segnalati sotto il campo; l'elenco di quelli sbagliati compare in alto sotto «Controllare i campi
segnalati». Il modulo è lo stesso di [Nuovo utente](#nuovo-utente).

### Sezione Anagrafica

- **Tipo**: **Studente** o **Docente**. Cambiare il tipo cambia i campi della sezione seguente.
- **Cognome** e **Nome**, obbligatori.

### Sezione Classe

Per uno studente:

- **Classe**: l'anno di corso. Se non è scelto, il modulo risponde «Per uno studente la classe (il livello) è
  obbligatoria.»;
- **Sezione**: la sezione, scelta fra le classi che ospitano quell'anno. La parola può cambiare nella scuola, perché
  la stabilisce la configurazione della scuola. Le classi si creano dall'amministratore (vedere [Impostare le
  classi](../../admin/guides/set-up-classes.md)).

Per un docente **Classe** è disattivato e al posto di **Sezione** compare **Gruppo docenti** (di norma «Il gruppo dei
docenti»).

I due campi seguenti valgono per tutti i tipi:

- **Numero tessera**: se vuoto, BiblioViva lo assegna da sola («Vuoto: viene assegnato automaticamente.»);
- **Matricola**: il codice con cui la scuola identifica l'utente, facoltativo.

### Sezione Contatti

Chiusa all'apertura se non c'è già un dato. Contiene l'**Email**: l'indirizzo che la scuola assegna all'alunno o al
docente, che servirà per gli avvisi.

### Sezione Note

Chiusa all'apertura se non c'è già un dato. Contiene la **Nota per il banco prestiti** («Compare in evidenza durante il
prestito.») e le **Note interne**.

## Messaggi del modulo

### Numero di tessera non valido

«Numero di tessera non valido: solo cifre, lettere maiuscole e trattino, con il carattere di controllo giusto.» Il
numero scritto non rispetta il formato delle tessere, che contiene un carattere di controllo. Il campo si può lasciare
vuoto.

### Numero di tessera già assegnato

«Numero di tessera già assegnato a un altro utente.» Ogni tessera è di una persona sola. Nessuna tessera può avere il
numero di una copia: «Il numero di tessera è o sembra il codice di una copia: scegliere un altro numero.»

### Matricola già assegnata

«Matricola già assegnata a un altro utente.»

### Classe o sezione non valide

Per uno studente la sezione è obbligatoria («Per uno studente la sezione è obbligatoria.»). Gli altri messaggi dicono
che la classe non esiste o non si accorda con la sezione: «Classe non prevista dai livelli della scuola.», «Sezione non
trovata tra le classi attive: le classi si creano in Amministrazione → Configurazione → Classi.» e «Questa sezione non
ha questa classe: scegliere una sezione della classe.» Un docente non ha una classe («Un docente non ha una classe.»).

### Indirizzo email non valido

«Indirizzo email non valido.»

## Nuovo utente

La pagina **Nuovo utente** iscrive un utente. Si apre dal pulsante **Nuovo utente** dell'elenco [Utenti](patrons.md) e
dall'azione rapida della [dashboard](dashboard.md). La procedura è nelle guide [Iscrivere un
alunno](../guides/enrol-a-student.md) e [Iscrivere un docente](../guides/enrol-a-teacher.md). Per molti utenti insieme
conviene l'importazione dell'amministratore ([Importare gli alunni](../../admin/guides/import-students.md),
[Importare i docenti](../../admin/guides/import-teachers.md)).

Il modulo è quello di [Modifica utente](#modifica-utente); il pulsante finale è **Crea utente**, **Annulla** torna
all'elenco. Dopo il salvataggio si apre la scheda del nuovo utente.

### Foto del nuovo utente

Se le foto sono attive, sopra il modulo c'è il riquadro **Foto**, con il suggerimento: «La foto è richiesta: si può fare
ora o in seguito dalla pagina dell'utente.» (oppure «La foto si può fare ora o in seguito…», secondo la configurazione
della scuola). **Scatta foto** apre la fotocamera: la foto viene tenuta e salvata insieme all'utente («Si salva insieme
all'utente.»). **Rifai la foto** ripete lo scatto e **Togli** la scarta. Se il salvataggio della foto fallisce, la
scheda si apre comunque e un avviso dice «La foto non è stata salvata: rifalla dalla pagina dell'utente.»

## Pagine correlate

- [Utenti](patrons.md)
- [Censimento foto](census.md)
- [Stampe](print-lists.md)
- [Rinnovare un prestito](../guides/renew-a-loan.md)
- [Iscrivere un alunno](../guides/enrol-a-student.md)
- [Iscrivere un docente](../guides/enrol-a-teacher.md)
- [Correggere i dati di un utente](../guides/edit-a-patron.md)
- [Ristampare una tessera](../guides/replace-a-lost-card.md)
- [Rimuovere un utente](../guides/remove-a-patron.md)
