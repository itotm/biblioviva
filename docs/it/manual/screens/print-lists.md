# Stampe

La pagina **Stampe** raccoglie le liste di stampa: elenchi di utenti, di cui stampare le tessere, o di copie, di cui
stampare le etichette. Una lista permette di preparare le stampe quando conviene (per esempio i nuovi iscritti
dell'anno) e di sapere che cosa è stato stampato e che cosa no. Sotto le liste ci sono le classi, di cui si stampano le
tessere senza creare una lista.

La pagina si apre dalla voce **Stampe** del menu (sulla barra in basso del telefono, sotto **Altro**), dal pulsante
**Liste di stampa** nella barra in alto e dalla [dashboard](dashboard.md). La usano gli account «Catalogazione», per le
liste di libri, «Tessere e foto», per le liste di utenti, e «Amministrazione», per entrambe: ogni account vede
soltanto il tipo di lista che gli spetta. La procedura è nella guida [Usare le liste di
stampa](../guides/use-print-lists.md).

<!-- figure: print/lists | La pagina Stampe con una lista di utenti, una lista di libri e le classi, vista da Amministrazione -->

Nella figura:

1. I pulsanti **Nuova lista utenti** e **Nuova lista libri**: [Creazione di una lista](#creazione-di-una-lista).
1. La scelta del tipo **Tutte**, **Utenti**, **Libri**: [Barra del titolo](#barra-del-titolo).
1. Le liste, ciascuna con il tipo, il numero delle voci e l'ultima stampa: [Le liste](#le-liste).
1. Le classi con il pulsante **Stampa tessere**: [Le classi](#le-classi).
1. Il pulsante **Liste di stampa** nella barra in alto: [Pulsante Liste di stampa](#pulsante-liste-di-stampa).

## Barra del titolo

Sotto il titolo stanno i pulsanti per creare una lista e, per un account che vede entrambi i tipi, la scelta del tipo
(**Tipo**): **Tutte**, **Utenti** o **Libri**. La scelta filtra le liste mostrate sotto.

## Creazione di una lista

I pulsanti sono **Nuova lista utenti** (per chi ha il permesso sugli utenti) e **Nuova lista libri** (per chi ha il
permesso sul catalogo).

1. Premere **Nuova lista utenti** o **Nuova lista libri**.
1. Nel campo **Nome della lista** scrivere un nome, oppure lasciarlo vuoto: la lista prende il nome proposto, nella
   forma «Lista 3 del 29/10/2026».
1. Premere ancora **Nuova lista utenti** o **Nuova lista libri** nella finestra. Un messaggio dice «Lista creata» e si
   apre la lista, vuota.

Le liste si creano anche aggiungendo utenti o copie da altre pagine (vedere [Aggiungere alla lista dal catalogo o dagli
utenti](#aggiunta-alla-lista-dal-catalogo-o-dagli-utenti)).

## Le liste

Ogni lista è una scheda con il nome (un collegamento), il tipo (**Utenti** o **Libri**), il numero delle voci («N voci»)
e la data dell'ultima stampa: «Stampata il …» oppure «Mai stampata». I pulsanti sono:

- **Apri**: apre la [Pagina di una lista](#pagina-di-una-lista);
- **Elimina**, in rosso: chiede conferma («Eliminare la lista «nome»?») e avvisa: «Le voci vengono tolte dalla lista;
  gli utenti restano in archivio.» La lista sparisce; gli utenti e le copie restano dove sono.

Se non ci sono liste, la pagina scrive «Nessuna lista. Le liste si creano qui o con «Aggiungi alla lista» nelle pagine
Utenti e Catalogo.»

## Le classi

Sotto le liste, per gli account che gestiscono gli utenti, la sezione **Classi** mostra una scheda per ogni classe (in
una scuola con più ordini di scuola, ordine per ordine), con il segno **Classe** e il numero degli utenti. La nota dice:
«Le tessere di tutta una classe, senza crearne la lista.» Il pulsante **Stampa tessere** apre la finestra di stampa
delle tessere di quella classe, descritta in [Stampa delle tessere](patrons.md#stampa-delle-tessere).

## Pulsante Liste di stampa

Nella barra in alto, accanto all'account, il pulsante **Liste di stampa** porta un numero: le liste che hanno ancora
qualcosa da stampare. Il suo menu elenca le liste nella forma «nome (N)»: una voce apre la lista. Se non ce n'è nessuna,
il menu dice «Nessuna lista da stampare». La voce **Tutte le liste** apre questa pagina. L'icona compare per gli account
che possono stampare tessere o etichette.

## Pagina di una lista

La pagina di una lista mostra il nome, sotto di esso la data dell'ultima stampa («Stampata il …» oppure «Mai stampata»),
e le voci. A sinistra stanno le voci della lista, a destra i modi di aggiungerne.

<!-- figure: print/list-patrons | Una lista di utenti con le voci a sinistra e le aggiunte a destra -->

Nella figura:

1. I pulsanti **Stampa tessere** e **Rinomina**: [Azioni della lista](#azioni-della-lista).
1. Il numero delle voci e la casella **Svuota la lista dopo la stampa**: [Segnare le tessere come
   stampate](#tessere-segnate-come-stampate).
1. Il pulsante **Segna come stampate**: [Tessere segnate come stampate](#tessere-segnate-come-stampate).
1. Le voci della lista: [Voci della lista](#voci-della-lista).
1. Il riquadro **Aggiungi con lo scanner**: [Aggiunta con lo scanner](#aggiunta-con-lo-scanner).
1. Il riquadro **Aggiungi con i filtri**: [Aggiunta con i filtri](#aggiunta-con-i-filtri).

### Azioni della lista

Il pulsante principale dipende dal tipo: **Stampa tessere** per una lista di utenti, **Stampa etichette** per una lista
di libri (il pulsante è spento se la lista è vuota). **Rinomina** apre un campo con il nome, da confermare con **Salva**
(**Annulla** esce); un nome vuoto non viene accettato; un messaggio conferma «Lista rinominata».

- **Stampa tessere** apre la finestra descritta in [Stampa delle tessere](patrons.md#stampa-delle-tessere).
- **Stampa etichette** apre la finestra descritta in [Stampa etichette](book-record.md#stampa-etichette), con tutte le
  copie della lista.

### Voci della lista

Sopra le voci, una riga dice «N utenti nella lista» o «N copie nella lista». Se la lista è vuota, la pagina spiega
come riempirla: «La lista è vuota. Gli utenti si aggiungono con i filtri rapidi, con lo scanner o dalla pagina Utenti.»
(per i libri: «Le copie si aggiungono con i filtri rapidi, con lo scanner o dal catalogo.»)

Le voci sono nell'ordine in cui verranno stampate. Per cambiarlo si trascinano le voci («Trascinare le voci per cambiare
l'ordine di stampa.»), oppure si usano le icone **Sposta su** e **Sposta giù** della voce. L'icona **Togli dalla lista**
toglie la voce; l'utente o la copia restano in archivio. Una voce di utente mostra anche se la tessera è già stata
stampata (**Tessera stampata**: sì o no); una voce di libro mostra lo stato delle etichette (**Etichette stampate**,
**Manca una etichetta** o **Etichette da stampare**). Un clic sul nome apre la scheda dell'utente o del libro.

Per una lista di libri, sotto le voci il menu **Esporta** scarica l'elenco in CSV o ODS.

In fondo alla lista stanno **Svuota**, che toglie tutte le voci dopo conferma («Svuotare la lista?»), e **Elimina**, che
cancella la lista.

### Tessere segnate come stampate

Dopo aver stampato, la lista va segnata, perché BiblioViva ricordi che cosa è stato stampato: i filtri e la dashboard
mostrano così chi è ancora senza tessera stampata.

1. Se la lista serve una volta sola, spuntare **Svuota la lista dopo la stampa**.
1. Per una lista di libri, scegliere nell'elenco accanto quali etichette sono state stampate: **Coppia**, **Solo
   barcode** o **Solo fascetta**.
1. Premere **Segna come stampate**. Un messaggio dice «N tessere segnate come stampate» (o «N copie segnate come
   stampate»).

Se la lista era di tessere, anche la scheda dell'utente mostra «Tessera stampata il …».

### Aggiunta con lo scanner

Il riquadro **Aggiungi con lo scanner** serve per riempire la lista con il lettore di codici a barre. Per una lista di
utenti la nota dice «Leggere la tessera di ogni utente: viene aggiunto alla lista. Le tessere già presenti vengono
ignorate.»; per una lista di libri, «Leggere il codice a barre di ogni copia, anche lungo lo scaffale: la copia viene
aggiunta alla lista. Le copie già presenti vengono ignorate.» Il campo ha già il cursore. Ogni lettura produce un
avviso:

- verde: «nome aggiunto» oppure «titolo (codice) aggiunta»;
- giallo: «nome è già nella lista» oppure «titolo (codice) è già nella lista»;
- rosso: «Nessun utente con la tessera N», «Nessuna copia con il codice N», «Il codice letto non è una tessera» o «Il
  codice letto non è una copia» (quando si legge un codice dell'altro tipo).

### Aggiunta con i filtri

Il riquadro **Aggiungi con i filtri** aggiunge in una volta tutti gli utenti o tutte le copie che corrispondono alle
scelte. La nota dice: «Chi è già nella lista non viene aggiunto due volte.» Dopo aver scelto, premere **Aggiungi alla
lista**; la pagina dice quanti sono stati aggiunti («N aggiunti, N già presenti»), oppure «Nessun utente corrisponde ai
filtri.» (o «Nessuna copia corrisponde ai filtri.»). I filtri non scelti non limitano.

Per una lista di utenti:

- **Ordine di scuola** (solo nelle scuole con più ordini), **Classe** (l'anno) e **Sezione** (la parola può cambiare
  nella scuola);
- **Tipo**: **Studente** o **Docente**;
- **Solo chi non ha ancora la tessera stampata**;
- **Solo chi non ha la foto** (solo se la scuola chiede la foto);
- **Importazione**: gli utenti di una importazione precedente, nella forma «n. 3 · nome del file · N nuovi»;
- **Creati dal**: una data di partenza.

Per una lista di libri:

- **Etichette da stampare**: **Coppia**, **Solo barcode**, **Solo fascetta** oppure «— tutte le copie —»;
- **Acquisite dal** e **al**: l'intervallo delle date di acquisizione;
- **Genere** e **Classe di saggistica**;
- **Materiale**;
- **Importazione**: le copie di una importazione del catalogo, nella forma «n. 3 · nome del file · N copie».

## Aggiunta alla lista dal catalogo o dagli utenti

La finestra **Aggiungi alla lista di stampa** compare quando si preme **Aggiungi alla lista** nella scheda di un libro o
di un utente, **Aggiungi selezionati alla lista** nel [Catalogo](catalog.md) o negli [Utenti](patrons.md), o **Aggiungi
alla lista etichette** dopo il salvataggio di un [Nuovo libro](new-book.md).

1. Scegliere **Lista esistente** e, nell'elenco, la lista (con il numero delle voci), oppure **Nuova lista** e scrivere
   il **Nome della nuova lista**, o lasciarlo vuoto per il nome proposto.
1. Premere **Aggiungi**. Un messaggio dice «N aggiunti a «nome», N già presenti».

Sono offerte soltanto le liste del tipo giusto (utenti per gli utenti, libri per le copie); se non ce ne sono, la
finestra propone subito di crearne una. Nel catalogo si aggiungono tutte le copie di ciascun libro.

## Pagine correlate

- [Catalogo](catalog.md)
- [Utenti](patrons.md)
- [Stampare le etichette dei libri](../guides/print-book-labels.md)
- [Stampare le tessere di una classe](../guides/print-class-cards.md)
- [Usare le liste di stampa](../guides/use-print-lists.md)
