# Catalogo

Il catalogo è l'elenco di tutti i libri della biblioteca, con le copie disponibili di ciascuno. Serve per cercare un
libro per titolo, autore, codice o ISBN, per aprirne la scheda e, con il permesso del catalogo, per stampare le
etichette e correggere più copie in una volta sola. La procedura per trovare un libro è in
[Cercare un libro](../guides/find-a-book.md).

Il catalogo si apre dalla voce **Catalogo** del menu (sulla barra in basso del telefono, tra le voci principali). Lo
leggono gli account «Gestione prestiti», «Catalogazione», «Report» e «Amministrazione»; l'account
«Tessere e foto» non lo vede. Cercare, filtrare ed esportare sono permessi a tutti questi account; stampare le
etichette, aggiungere libri e cambiare le copie spetta a «Catalogazione» e «Amministrazione».

<!-- figure: catalog/list | Il catalogo con una ricerca e il risultato in elenco -->

Nella figura:

1. Le pagine del catalogo (schede in alto): [Barra del titolo](#barra-del-titolo).
1. Il campo di ricerca: [Ricerca](#ricerca).
1. I filtri: [Filtri](#filtri).
1. Il numero dei risultati: [Risultati](#risultati).
1. L'elenco dei libri: [Elenco dei libri](#elenco-dei-libri).
1. Il menu **Esporta**: [Esportazione](#esportazione).

## Barra del titolo

Sotto il titolo **Catalogo** stanno le pagine dell'area, come schede: **Catalogo**, **Inventario**, **Da classificare**
e, per chi ha il catalogo ma non il banco prestiti, **Lista desideri**. Le schede compaiono solo agli account con il
permesso del catalogo («Catalogazione» e «Amministrazione»): gli altri account vedono la sola pagina **Catalogo**.

Il pulsante **Nuovo libro** (solo «Catalogazione» e «Amministrazione») apre la pagina [Nuovo libro](new-book.md).

## Ricerca

All'apertura il catalogo non mostra nulla: la pagina chiede di cercare («Cerca nel catalogo»). L'elenco compare quando
si scrive nel campo **Cerca per titolo, autore o ISBN…** almeno tre caratteri, oppure un codice di qualsiasi lunghezza
fatto di sole cifre, oppure quando si sceglie un filtro.

La ricerca trova le parole in qualsiasi ordine, anche iniziate soltanto (un prefisso), senza badare agli accenti. Cerca
nel titolo, nel titolo originale delle traduzioni, nell'autore, nell'editore e nei codici. I risultati più vicini a
quanto scritto vengono per primi.

Per aprire subito un libro dal suo codice, leggere con il lettore di codici a barre il codice della copia (l'etichetta
sul libro) o il codice ISBN stampato sul retro, con il cursore nel campo di ricerca. Se il codice è univoco, si apre
direttamente la scheda del libro; altrimenti l'elenco mostra i risultati.

## Filtri

I filtri stringono la ricerca e funzionano anche da soli, senza testo. Quelli che non servono alla scelta fatta non
vengono mostrati.

- **Tipo**: **Tutti**, **Narrativa**, **Saggistica** o **Da classificare** (i libri ancora senza genere o argomento).
- **Genere**: i generi della narrativa. Non compare per la saggistica e per i libri da classificare.
- **Classificazione**: gli argomenti della saggistica, con i loro sottoargomenti. Non compare per la narrativa e per i
  libri da classificare. Il valore di scelta vuoto è **Tutte**.
- **Livello**: il livello di lettura. Compare solo se la biblioteca registra il livello di lettura.
- **Materiale**: il tipo di materiale (libro, DVD…), secondo l'elenco della biblioteca.
- **Formato accessibile**: i libri adatti agli alunni con DSA o con disabilità. Compare solo se l'elenco **Formati
  accessibili** della Configurazione non è vuoto. Le scelte sono **Tutti** (nessun filtro), **Qualsiasi formato
  accessibile** (i libri con almeno un formato) e un formato dell'elenco, per esempio «Audiolibro».
- **Solo disponibili**: tiene i libri con almeno una copia disponibile.
- **Anno da** e **Anno a**: l'intervallo degli anni di pubblicazione, a quattro cifre.
- **Serie**: i libri di una serie. Compare solo se nel catalogo ci sono serie. Il filtro si imposta anche dal pulsante
  della serie nella [Scheda del libro](book-record.md).
- **Mostra anche i libri ritirati**: include i libri le cui copie sono state ritirate.

Il pulsante **Azzera filtri** compare appena un filtro è attivo e li toglie tutti.

## Risultati

Sopra l'elenco una riga dice quanti libri corrispondono: «N titoli corrispondono ai filtri». Se la ricerca ha trovato
anche titoli simili a quanto scritto (un errore di battitura corretto), la riga aggiunge «più N simili, trovati
correggendo un errore di battitura». Il titolo trovato in questo modo porta il segno **Simile**: occorre verificare che
sia quello cercato.

Se nulla corrisponde, la pagina scrive «Nessun libro corrisponde ai filtri.»

## Elenco dei libri

Ogni riga è un libro (un titolo, non una copia). Le colonne sono:

- **Titolo**, con in corsivo il titolo originale se il libro è una traduzione;
- **Serie**, con il numero nella serie;
- **Autore**;
- **Anno**;
- **Classificazione**, con la figura del genere o dell'argomento; un libro non ancora classificato porta la dicitura
  **Da classificare**;
- **Segnatura**, la sigla scritta sul dorso, di cui si legge di più nella sezione [Copie](book-record.md#copie) della
  scheda del libro;
- **ISBN**;
- **Acquisizione**, la data di acquisizione;
- **Copie**: «N di M disponibili», oppure «Nessuna copia». Il segno è verde se almeno una copia è disponibile, arancione
  se tutte sono in prestito o non disponibili, grigio se il libro non ha copie.

Le intestazioni **Titolo**, **Serie**, **Autore**, **Anno**, **Segnatura** e **Acquisizione** ordinano l'elenco.

Un clic sulla riga apre la [Scheda del libro](book-record.md). Per scegliere più libri si usa il clic con il tasto
Ctrl o Maiusc (vedere [Selezione di più libri](#selezione-di-più-libri)).

## Messaggio sul codice di una copia

Se si scrive un numero semplice (solo cifre) che coincide con il codice di una copia numerata in modo semplice, il
catalogo non apre la scheda da solo: scrive “Il codice N è una copia di «titolo».” e offre il collegamento **Apri la
scheda**. In questo modo un numero digitato per cercare non porta alla scheda sbagliata.

## Selezione di più libri

Ctrl-clic (o Maiusc-clic) sulle righe sceglie più libri. Sopra l'elenco compare «N selezionati» e, solo per
«Catalogazione» e «Amministrazione», quattro pulsanti.

### Stampa delle etichette dei selezionati

**Stampa etichette dei selezionati** apre la finestra **Stampa etichette** con le copie di tutti i libri scelti. La
finestra è descritta in [Stampa etichette](book-record.md#stampa-etichette); la procedura è in
[Stampare le etichette dei libri](../guides/print-book-labels.md).

### Aggiunta alla lista di stampa

**Aggiungi selezionati alla lista** mette tutte le copie dei libri scelti in una lista di stampa, per stampare le
etichette più tardi. La finestra è descritta in
[Aggiunta alla lista dal catalogo o dagli utenti](print-lists.md#aggiunta-alla-lista-dal-catalogo-o-dagli-utenti);
la procedura è in [Usare le liste di stampa](../guides/use-print-lists.md).

### Modifica delle copie

**Modifica le copie dei selezionati** apre una finestra, intitolata **Modifica le copie**, che cambia un dato su tutte
le copie dei libri scelti. In alto la finestra indica «N copie». Si procede così:

1. In **Cosa cambiare** scegliere il dato: **Stato**, **Materiale**, **Escluso dal prestito**, **Data di acquisizione**
   e, quando la biblioteca registra il livello di lettura sulle copie, **Livello della copia**.
1. In **Nuovo valore** indicare il valore. Per lo stato le scelte sono **Disponibile**, **Smarrito**, **Danneggiato**,
   **In riparazione** e **Ritirato**. Per il materiale la scelta ha sotto l'avviso «Il materiale è del titolo: cambia
   per tutte le sue copie.»: il materiale è uno per titolo, quindi cambia per tutte le copie di ogni libro scelto.
1. Per lo stato, scrivere il **Motivo**. Il motivo è obbligatorio per le copie smarrite e ritirate e resta nel registro
   di ogni copia.
1. Premere **Controlla**. La finestra dice quante copie cambiano («N copie cambiano») e quali restano come sono: quelle
   in prestito (prima vanno restituite), quelle che hanno già il valore, quelle che non esistono più e, per il livello
   di lettura, quelle di libri che non sono di narrativa. L'elenco di queste ultime si apre da **Copie che restano come
   sono**.
1. Premere «Applica a N copie». Un messaggio conferma «N copie modificate».

Un controllo vale solo per la scelta fatta: cambiando valore, occorre premere di nuovo **Controlla**. **Chiudi** esce
senza cambiare nulla.

### Riclassifica

**Riclassifica** cambia il genere o l'argomento di tutti i libri scelti. La finestra **Riclassifica i titoli
selezionati** indica «N titoli» e chiede il **Tipo** e poi il **Genere** (con il **Livello**, se previsto) oppure la
**Classificazione**. La finestra avvisa: «La segnatura delle copie segue la nuova classificazione. Le fascette (e le etichette, se cambia la
segnatura) tornano tra quelle da stampare.»
Il pulsante **Controlla** dice quanti titoli cambiano («N titoli cambiano»); il pulsante «Riclassifica N titoli» applica
il cambio e un messaggio conferma «N titoli riclassificati, N segnature riscritte». La procedura è in
[Classificare i libri](../guides/classify-books.md).

## Esportazione

Sotto l'elenco il menu **Esporta** scarica i risultati della ricerca, con i filtri in uso, in due formati: **CSV
(foglio di calcolo, testo)** oppure **ODS (LibreOffice)**. Il file contiene, oltre alle colonne dell'elenco, il
numero delle copie e quello delle copie disponibili. C'è anche la
colonna **Formati accessibili**, con i formati del libro separati da «; ».

## Pagine correlate

- [Scheda del libro](book-record.md)
- [Nuovo libro](new-book.md)
- [Da classificare](to-classify.md)
- [Inventario](inventory.md)
- [Stampe](print-lists.md)
- [Cercare un libro](../guides/find-a-book.md)
- [Stampare le etichette dei libri](../guides/print-book-labels.md)
