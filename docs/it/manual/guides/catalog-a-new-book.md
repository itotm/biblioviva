# Catalogare un libro nuovo

Questa guida spiega come inserire in catalogo un libro che ha il codice ISBN: si legge il codice con il lettore,
BiblioViva cerca la scheda nel catalogo nazionale OPAC SBN, la scheda si controlla e si salva insieme alle copie. Serve
a chi cataloga i libri.

- Tempo: circa 2 minuti per libro.
- Account: Catalogazione (anche Amministrazione).
- Occorrente: il libro, il lettore di codici a barre USB e la connessione a Internet del computer di BiblioViva, che
  serve alla ricerca della scheda e della copertina. Per stampare le etichette: la stampante con i fogli adesivi, vedere
  [Stampare le etichette dei libri](print-book-labels.md).

## Procedura

1. Aprire **Catalogo** e premere **Nuovo libro**. Si apre la pagina **Nuovo libro**, con i passi **Codice**,
   **Ricerca**, **Scheda e copie** e **Completato**.

   <!-- figure: catalog/new-book-code | La pagina Nuovo libro, pronta a leggere il codice ISBN -->

1. In **Materiale** scegliere il tipo di materiale delle copie, se non è quello già selezionato (di norma **Libro**). Il
   materiale vale per tutte le copie che si aggiungono con questa scheda.
1. Leggere con il lettore il codice a barre dell'ISBN, stampato sul retro del libro. Il cursore è già nel campo
   **ISBN o EAN**: il lettore inserisce il codice e conferma da solo.
1. Attendere la ricerca. BiblioViva interroga OPAC SBN e apre la scheda più completa tra quelle trovate. Sopra la scheda
   compare l'avviso «La scheda più completa tra le N trovate. Verificare anno e descrizione sulla copia.».
1. Se la scheda non è quella del libro in mano, premere **Altre schede (N)**, scegliere un'altra scheda e premere
   **Usa questa scheda**.
1. Controllare i dati nelle sezioni **Scheda** e **Pubblicazione**, confrontandoli con il frontespizio del libro:
   **Titolo**, **Autore**, **Editore**, **Anno** e **Descrizione fisica**. L'autore si scrive come «Cognome, Nome».

   <!-- figure: catalog/new-book-form | La scheda trovata da OPAC SBN, con la copertina accanto al modulo -->

1. Se il libro non ha un autore personale, premere «Anonimo» oppure «AA. VV.» sotto il campo **Autore**. Se
   l'editore o il luogo non si conoscono, premere «s.n.» sotto **Editore** oppure «s.l.» sotto **Luogo**. Autore ed
   editore sono obbligatori: non possono restare vuoti.
1. Se il libro fa parte di una serie, scrivere il nome in **Serie** e la posizione in **Numero nella serie**, per
   esempio «Harry Potter» e «3». Mentre si scrive compaiono le serie già presenti in catalogo: sceglierne una evita nomi
   scritti in due modi.
1. Nella sezione **Classificazione** scegliere sotto «Che tipo di libro è?» **Narrativa** o **Saggistica**, poi il
   genere o l'argomento. Per la narrativa scegliere anche il **Livello di lettura**, se la biblioteca lo usa. Il modo di
   scegliere è spiegato in [Classificare i libri](classify-books.md). Se non si sa ancora come classificare il libro,
   scegliere **Classifica dopo**.
1. Nella sezione **Copie** scrivere il **Numero di copie** (da 1 a 100) e controllare la **Segnatura**, che BiblioViva
   propone dalla classificazione: per esempio `B 4 DEL` indica genere B, livello di lettura 4, autore con il cognome che
   inizia per DEL. La segnatura si può correggere. La **Data di acquisizione** è quella di oggi.
1. Se la biblioteca ha attiva la copertina, controllare il riquadro **Copertina** accanto al modulo: BiblioViva la
   cerca da sola, e la guida [Aggiungere la copertina](add-a-cover.md) spiega come sostituirla con una foto.
1. Premere **Salva scheda e copie**. Si apre la conferma «Scheda salvata», con i **Codici delle copie** (per esempio
   `2026-E0267`): sono i codici che le etichette porteranno.

   <!-- figure: catalog/new-book-done | La conferma dopo il salvataggio, con i codici delle copie e i pulsanti per proseguire -->

1. Scegliere come proseguire:
   - **Aggiungi un altro** apre di nuovo la pagina per il libro successivo: è la scelta normale quando si catalogano
     molti libri di seguito;
   - **Stampa etichette** apre la finestra di stampa delle etichette di queste copie;
   - **Aggiungi alla lista etichette** mette le copie in una lista di stampa, per stampare le etichette di molti libri
     insieme;
   - **Apri la scheda** mostra la scheda del libro appena salvato.

Le etichette si possono stampare anche in seguito: le copie senza etichette sono contate nella **Dashboard**, nel
riquadro **Libri senza etichette**.

### Facoltativo: leggere l'ISBN con la fotocamera del telefono

Il lettore di codici a barre è il modo normale di leggere l'ISBN. La fotocamera del telefono è un'alternativa e funziona
solo se BiblioViva è raggiunto con Tailscale (connessione HTTPS), vedere
[Scegliere la rete](../../setup/choose-network.md).

1. Aprire **Nuovo libro** sul telefono.
1. Premere **Fotocamera** accanto al campo **ISBN o EAN**.
1. Inquadrare il codice a barre del libro. Al codice letto la ricerca parte da sola.

### Libro dalla lista desideri

1. Aprire **Catalogo**, poi la scheda **Lista desideri**.
1. Premere **Cataloga** sulla riga del libro. Si apre **Nuovo libro** con titolo, autore e serie già scritti.
1. Proseguire come sopra. Al salvataggio il desiderio esce dalla lista («Desiderio tolto dalla lista»).

## Risultato

Il libro ha una scheda in catalogo e una o più copie, ognuna con il proprio codice. Le copie sono disponibili al
prestito quando il libro è classificato; un libro salvato con **Classifica dopo** compare in **Da classificare** e le
sue copie non si prestano finché non viene classificato. Le copie hanno bisogno di un'etichetta con il codice a barre
prima di andare sullo scaffale.

## Possibili problemi

- Compare «Questo ISBN è già in catalogo»: il libro ha già una scheda. Per aggiungere altre copie seguire
  [Aggiungere una copia a un libro già in catalogo](add-a-copy.md).
- Compare «L'ISBN ha una cifra di controllo errata: controllare le cifre.»: la lettura è sbagliata o l'ISBN
  stampato sul libro non è valido. Leggere di nuovo il codice; se l'errore resta, seguire
  [Catalogare un libro senza ISBN](catalog-without-isbn.md).
- Compare «Il codice letto non è un ISBN né un EAN»: il lettore ha letto un codice che non è quello del libro, per
  esempio quello di un'etichetta. Leggere il codice a barre dell'ISBN, di norma sopra il prezzo.
- «Nessuna scheda trovata. La scheda si può compilare a mano.»: OPAC SBN non conosce il libro. Premere **Cerca per
  titolo** per cercare con titolo e autore, oppure **Inserisci a mano** per scrivere la scheda; vedere
  [Catalogare un libro senza ISBN](catalog-without-isbn.md).
- Compare «Il servizio non è raggiungibile. Controllare la connessione a Internet e riprovare più tardi.»: il computer
  di BiblioViva non raggiunge OPAC SBN. Controllare la connessione e premere **Riprova**; in alternativa premere
  **Inserisci a mano**.
- Il salvataggio dice «Esiste già una scheda con questo ISBN»: un altro libro ha già quell'ISBN. Aprirlo da
  **Catalogo** e aggiungere la copia da lì.
- Il salvataggio dice «Il genere è obbligatorio» o «L'argomento è obbligatorio»: scegliere un genere (narrativa) o un
  argomento (saggistica) nella sezione **Classificazione**, oppure **Classifica dopo**.
- La scheda trovata ha un anno o una descrizione diversi dalla copia in mano: succede quando esistono più edizioni
  dello stesso libro. Correggere i campi nel modulo prima di salvare, oppure scegliere un'altra scheda con
  **Altre schede (N)**.

## Pagine correlate

- [Catalogare un libro senza ISBN](catalog-without-isbn.md)
- [Aggiungere una copia a un libro già in catalogo](add-a-copy.md)
- [Aggiungere la copertina](add-a-cover.md)
- [Classificare i libri](classify-books.md)
- [Stampare le etichette dei libri](print-book-labels.md)
- [Registrare un libro desiderato](record-a-wish.md)
- [Nuovo libro](../screens/new-book.md)
