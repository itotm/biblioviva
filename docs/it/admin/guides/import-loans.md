# Importare i prestiti in corso

Questa guida spiega come riportare in BiblioViva i libri che al momento sono in prestito, quando si passa da un altro
programma. Serve a chi amministra BiblioViva; si fa una volta sola, il giorno del passaggio.

- Tempo: circa 20 minuti.
- Account: `admin`. Nessun altro account può importare i prestiti.
- Occorrente: l'elenco dei prestiti in corso, con il numero della tessera e il codice a barre della copia di ciascuno;
  gli alunni, i docenti e il catalogo già importati.

Ogni prestito importato mantiene la data e la scadenza originali; quelli già scaduti compaiono subito tra i ritardi.
BiblioViva controlla tutto il file prima di scrivere qualcosa e importa soltanto se non ci sono errori.

## Procedura

### Prima di cominciare

1. Importare gli alunni: vedere [Importare gli alunni](import-students.md).
1. Importare i docenti: vedere [Importare i docenti](import-teachers.md).
1. Importare il catalogo: vedere [Importare il catalogo](import-the-catalogue.md).

Il file dei prestiti si riferisce a persone e libri già presenti: senza i passi precedenti ogni riga sarebbe un errore.

### Preparare il file

1. Premere **Amministrazione**, poi **Importazioni**, poi **Prestiti in corso**. Si apre la pagina **Importa i prestiti in
   corso**.
1. Nel riquadro **Il modello del file** scegliere le colonne e premere **Scarica il modello**.
1. Aprire il modello con un foglio di calcolo e scrivere una riga per prestito.
1. Salvare il foglio in formato CSV.

Le colonne, con i nomi in inglese come nel modello:

| Colonna | Contenuto | Gruppo |
|---|---|---|
| `card_number` | il numero della tessera dell'utente, già importato | obbligatoria |
| `barcode` | il codice a barre della copia, già importata | obbligatoria |
| `issued_on` | la data del prestito, `AAAA-MM-GG` o `GG/MM/AAAA`; se manca, oggi | facoltativa |
| `due_on` | la scadenza, nello stesso formato; se manca, si calcola come al banco | facoltativa |

Senza la colonna `due_on` la scadenza si calcola con le regole dei prestiti e il calendario: vedere
[Impostare le regole dei prestiti](set-loan-rules.md).

### Caricare e controllare

1. Nel passo **File**, nel campo **File CSV**, scegliere il file e premere **Carica**.
1. Nel passo **Colonne** controllare che ogni colonna sia abbinata al campo giusto: **Tessera**, **Codice a barre**,
   **Data del prestito**, **Scadenza**. Le altre si ignorano con **— ignora —**. La pagina avverte se mancano le date.
1. Premere **Verifica il file**.
1. Nel passo **Verifica** leggere la colonna **Esito** di ogni riga: **Nuovo** oppure **Errore**, con la spiegazione in
   **Dettagli**. Per vedere solo le righe da correggere spuntare **Mostra solo gli errori**.
1. Se la pagina scrive che alcuni prestiti sono già scaduti, controllare che le date siano giuste: quei prestiti
   vengono importati e compaiono tra i ritardi.
1. Se ci sono errori, correggere il file, premere **Torna alle colonne**, caricarlo di nuovo e verificare ancora. Con
   anche un solo errore **Importa i prestiti** resta spento.

### Importare

1. Premere **Importa i prestiti**. BiblioViva scrive tutto in una volta.
1. Leggere il riepilogo del passo **Completato**: «… prestiti importati, di cui … già scaduti».

> [!IMPORTANT]
> L'importazione è fatta per il giorno del passaggio e si esegue una volta sola. Un secondo file con gli stessi prestiti
> dà errore, perché le copie risultano già in prestito.

## Risultato

I libri in prestito sono registrati sugli utenti giusti, con le date originali. Aprendo **Prestiti**, poi **Libri in
prestito**, si ritrovano gli stessi prestiti del vecchio programma; chi li restituisce passa dalla pagina **Restituzioni**
come sempre. Il file originale resta conservato sul computer di BiblioViva.

Dopo l'importazione conviene fare un controllo a campione: leggere con il lettore di codici a barre qualche tessera e
qualche etichetta e confrontare i prestiti con il vecchio programma.

## Possibili problemi

### Nessun utente con la tessera indicata

Compare «Nessun utente con la tessera …»: il numero non corrisponde a nessun utente. Importare prima l'utente oppure
correggere il numero.

### Nessuna copia con il codice indicato

Compare «Nessuna copia con il codice …»: il codice non è in catalogo. Importare prima il catalogo oppure correggere il
codice.

### La copia è già in prestito

Compare «La copia … è già in prestito»: la copia ha già un prestito in BiblioViva, o compare due volte nel file
(«Stessa copia già alla riga …»). Togliere il doppione.

### La copia è ritirata

Compare «La copia … è ritirata»: una copia ritirata non si presta. Rimetterla disponibile dalla scheda del libro, oppure
togliere la riga.

### Le date del prestito non sono corrette

Compare «Data del prestito nel futuro» o «La scadenza è prima della data del prestito»: correggere le date.

### La copia è di un libro da classificare

Compare «La copia … è di un libro da classificare»: il prestito viene importato, ma al banco quella copia non si presta
finché il libro non è classificato: vedere [Classificare i libri](../../manual/guides/classify-books.md).

### I prestiti arrivano da Koha

I prestiti in corso si estraggono con una query già pronta, da eseguire il giorno del passaggio: vedere
[le istruzioni tecniche](../../../import/README.md).

## Pagine correlate

- [Importare il catalogo](import-the-catalogue.md)
- [Impostare le regole dei prestiti](set-loan-rules.md)
- [Restituire un libro](../../manual/guides/return-a-book.md)
- [Importazioni](../screens/imports.md)
