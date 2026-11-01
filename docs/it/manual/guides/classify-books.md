# Classificare i libri

Questa guida spiega come dare a un libro il genere o l'argomento e, per la narrativa, il livello di lettura: da questa
scelta dipendono la segnatura, il pittogramma sulla fascetta del dorso e lo scaffale. Serve a chi cataloga i libri, sia
al momento del salvataggio sia in seguito, per i libri salvati con **Classifica dopo**.

- Tempo: circa 30 secondi per libro.
- Account: Catalogazione (anche Amministrazione).
- Occorrente: il libro, o almeno titolo, autore e soggetti della scheda.

La scelta è una sola, tra due strade:

- narrativa: si sceglie un genere (una lettera, per esempio `B`) e, se la biblioteca lo usa, un livello di
  lettura (per esempio `4`);
- saggistica: si sceglie un argomento (un numero come quelli Dewey, per esempio `590`), cercandolo in due livelli:
  prima l'argomento principale, poi un argomento più preciso.

La segnatura è la sigla stampata sull'etichetta e sulla fascetta, che dice dove va il libro. Si ricava dalla
classificazione e dalle prime tre lettere del cognome dell'autore. Esempi: `B 4 DEL` è un romanzo di genere B, livello
di lettura 4, di un autore il cui cognome inizia per DEL; `B DEL` è lo stesso libro in una biblioteca che non usa i
livelli; `590 ROS` è un libro di saggistica dell'argomento 590 di un autore il cui cognome inizia per ROS. BiblioViva
propone la segnatura da sola e si può correggere.

Il livello di lettura è un codice che la biblioteca sceglie per i romanzi (nella configurazione di partenza da `1` a
`5`) e non coincide con la classe dell'utente. Se il livello è assegnato a ogni copia e non al libro, si sceglie nel
modulo delle copie, vedere [Aggiungere una copia a un libro già in catalogo](add-a-copy.md).

## Procedura

### Classificare mentre si cataloga

1. Nel modulo della scheda cercare la sezione **Classificazione**.
1. Sotto «Che tipo di libro è?» premere **Narrativa** o **Saggistica**.

   <!-- figure: catalog/classification-picker | Il selettore della classificazione nel modulo della scheda -->

1. Per la narrativa scegliere il genere sotto «Scegli il genere»: ogni genere è un riquadro con il pittogramma, la
   lettera e il nome.
1. Per la narrativa scegliere anche il **Livello di lettura**, se compare. **Nessuna** lascia il libro senza livello.
1. Per la saggistica scegliere l'argomento principale sotto «Scegli l'argomento». Se ha argomenti più precisi si apre
   l'elenco «Argomenti di …»: sceglierne uno. Per fermarsi all'argomento principale premere «Usa … in generale». Per
   tornare indietro premere **Torna agli argomenti principali**.
1. Se la scheda ha un numero Dewey, BiblioViva propone da sola l'argomento («Argomento proposto dal numero Dewey …»):
   controllarlo e cambiarlo se serve.
1. Se non si sa ancora come classificare il libro premere **Classifica dopo**: il libro va nell'elenco «Da
   classificare». Le sue copie non si prestano e la fascetta del dorso non si stampa finché non viene classificato.

### Classificare i libri messi da parte

1. Aprire **Catalogo** e poi la scheda **Da classificare**. L'elenco mostra, dal più vecchio, i libri senza
   classificazione, con il numero in alto («N libri da classificare»). Il numero è anche nel riquadro **Libri da
   classificare** della **Dashboard**.

   <!-- figure: catalog/to-classify-list | L'elenco dei libri da classificare -->

1. Premere **Inizia a classificare**. Si apre **Classifica il libro** sul primo libro dell'elenco. Per partire da un
   libro preciso premere la sua riga, oppure **Classifica** sulla sua scheda.
1. Leggere titolo, autore, editore, soggetti e note del libro, con la copertina se c'è. Se la scheda ha un numero Dewey
   compare «Il numero Dewey … corrisponde all'argomento …» e l'argomento è già selezionato.
1. Scegliere genere o argomento come sopra. Appena la scelta è fatta compare la **Segnatura delle copie** che le copie
   riceveranno.
1. Premere **Salva e avanti**. Compare l'avviso «… classificato» e si apre il libro successivo.
1. Se il libro non si riesce a classificare premere **Salta**: il libro resta nell'elenco.
1. Alla fine compare «Non ci sono altri libri da classificare in questo giro.». Premere **Torna all'elenco**.

### Cambiare la classificazione di molti libri insieme

1. Aprire **Catalogo** e cercare i libri da riclassificare, vedere [Cercare un libro](find-a-book.md).
1. Selezionare i libri con Ctrl + clic (o Maiusc + clic per un gruppo) sulle righe.
1. Premere **Riclassifica**. Si apre la finestra «Riclassifica i titoli selezionati».
1. Scegliere il **Tipo**, poi il **Genere** o la **Classificazione** e, per la narrativa, il **Livello**.
1. Per aggiornare anche le segnature delle copie spuntare «Riscrivere le segnature delle copie secondo la nuova
   classificazione».
1. Premere **Controlla**. La finestra dice quanti titoli cambiano.
1. Premere **Riclassifica** seguito dal numero di titoli. Un avviso conferma «… titoli riclassificati, … segnature
   riscritte». Le fascette (e le etichette, se la segnatura è cambiata) tornano tra quelle da stampare: vedere
   [Stampare le etichette dei libri](print-book-labels.md).

## Risultato

Il libro ha un genere o un argomento, mostrato sulla scheda e nella colonna **Classificazione** del **Catalogo**, e le
sue copie hanno la segnatura. Un libro appena classificato si può prestare e la sua fascetta si può stampare.

## Possibili problemi

- «Il genere è obbligatorio» o «L'argomento è obbligatorio»: il salvataggio richiede la scelta. Scegliere genere o
  argomento, oppure **Classifica dopo**.
- Il livello di lettura non compare: la biblioteca non usa i livelli, oppure li assegna a ogni copia (vedere sopra).
  L'amministratore decide in [Modificare la classificazione e i livelli di
  lettura](../../admin/guides/classification.md).
- Un libro non trova posto tra i generi o gli argomenti: scegliere il più vicino e annotarlo. L'elenco di generi e
  argomenti lo modifica l'amministratore.
- Una scheda già classificata va ricollocata: il modulo **Modifica scheda** cambia la classificazione ma non riscrive
  le segnature delle copie. Per aggiornarle usare **Riclassifica** come sopra.
- Compare «Questo libro è già classificato»: qualcun altro lo ha classificato nel frattempo. Premere **Salta**.

## Pagine correlate

- [Catalogare un libro nuovo](catalog-a-new-book.md)
- [Correggere la scheda di un libro](edit-a-record.md)
- [Stampare le etichette dei libri](print-book-labels.md)
- [Da classificare](../screens/to-classify.md)
- [Modificare la classificazione e i livelli di lettura](../../admin/guides/classification.md)
