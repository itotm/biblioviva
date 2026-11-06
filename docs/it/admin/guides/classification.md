# Modificare la classificazione e i livelli di lettura

Questa guida spiega come cambiare i generi della narrativa, gli argomenti della saggistica, i loro colori e pittogrammi, e
i livelli di lettura dei libri. Serve a chi amministra BiblioViva; è un'operazione che si fa di rado, perché i codici
della classificazione sono scritti sui libri, nelle segnature e sulle fascette dei dorsi.

- Tempo: da 10 a 30 minuti, secondo le modifiche.
- Account: `admin`.
- Occorrente: l'elenco dei generi e degli argomenti da aggiungere, rinominare o togliere; le immagini dei pittogrammi
  (PNG, JPEG o WebP), se se ne vogliono di nuovi.

La *classificazione* divide i libri in *generi* (la narrativa: romanzi, avventura, fumetti…) e *argomenti* (la
saggistica, con i *sottoargomenti*). Ogni genere e ogni argomento ha un codice, un nome, un colore e un
*pittogramma*, cioè l'immagine stampata sulla fascetta del dorso. Un libro di narrativa può avere anche un *livello
di lettura*, per esempio il livello `4` che si legge nella segnatura `B 4 DEL`. I livelli di lettura sono una scala
propria della biblioteca, indipendente dalle classi della scuola.

Le modifiche restano in bozza finché non si preme **Salva**; una versione precedente del file viene conservata nella
cronologia della configurazione.

## Procedura

### Aprire la classificazione

1. Accedere a BiblioViva con l'account `admin`.
1. Premere **Amministrazione**, poi **Configurazione**, poi **Classificazione**. La pagina ha le schede **Narrativa**,
   **Saggistica**, **Dewey** e **Opzioni**; accanto a ogni nome è scritto quante voci contiene la scheda.

<!-- figure: admin/classification | La scheda Narrativa della classificazione con un genere aperto a destra -->

### Modificare un genere o un argomento

1. Aprire la scheda **Narrativa** (per i generi) o **Saggistica** (per gli argomenti).
1. Premere la riga da modificare. A destra compare il riquadro **Genere**, **Argomento** o **Sottoargomento** (sul
   telefono si apre una finestra). Accanto a ogni riga è scritto quanti libri la usano.
1. Cambiare i campi **Codice**, **Nome**, **Colore** e **Pittogramma**. Il colore si sceglie dal selettore o si scrive
   nel campo **Codice del colore**, nella forma `#e8231b`.
1. Per il pittogramma premere **Carica un'immagine** (PNG, JPEG o WebP: viene salvata come PNG), oppure **Scegli tra le
   immagini** per riusare un'immagine già presente. **Togli l'immagine** la rimuove: sulla fascetta del dorso compare
   allora un cerchio con il colore e il codice. Un sottoargomento senza colore o senza immagine usa quelli del suo
   argomento.
1. Guardare l'**Anteprima della fascetta** in fondo al riquadro: mostra un libro d'esempio come verrebbe stampato, a
   grandezza reale.

> [!NOTE]
> Cambiare il **Codice** di un genere o di un argomento in uso rinomina anche i libri che lo usano. Al salvataggio i libri
> passano al codice nuovo e BiblioViva calcola di nuovo le segnature delle loro copie (per esempio `B 4 DEL` diventa
> `A 4 DEL`).

### Aggiungere, ordinare ed eliminare

1. Per aggiungere premere **Aggiungi un genere** (scheda **Narrativa**) oppure **Aggiungi un argomento** (scheda
   **Saggistica**). Per un sottoargomento selezionare l'argomento e premere **Aggiungi un sottoargomento**. Scrivere
   il codice, che non può essere usato anche da un altro genere o argomento, e il nome.
1. Per cambiare l'ordine in cui compaiono nelle scelte del catalogo trascinare le righe, oppure usare **Sposta su** e
   **Sposta giù**.
1. Per spostare un sottoargomento sotto un altro argomento cambiare il campo **Posizione**.
1. Per eliminare premere **Elimina il genere** o **Elimina l'argomento** e confermare con **Elimina**. Eliminando un
   argomento si eliminano anche i suoi sottoargomenti.

### Associare un numero Dewey a un argomento

1. Aprire la scheda **Dewey**. Ogni riga associa un prefisso Dewey (da 1 a 3 cifre) a un argomento.
1. Per aggiungere una riga premere **Aggiungi una corrispondenza**, scrivere il **Prefisso Dewey** e scegliere
   l'**Argomento**.
1. Scrivere un numero Dewey nel campo **Prova un numero Dewey**: la pagina mostra l'argomento che verrebbe proposto.
   Quando un libro di saggistica arriva con un numero Dewey (per esempio dal catalogo SBN), BiblioViva propone
   l'argomento del prefisso più lungo che corrisponde.

### Impostare i livelli di lettura

1. Aprire la scheda **Opzioni**.
1. Spuntare **La narrativa è divisa per livello di lettura** se la biblioteca usa i livelli. Togliendo la spunta i
   campi dei livelli scompaiono da schede, etichette, filtri e report.
1. Nel riquadro **Livelli di lettura**, in ordine dal più semplice, scrivere per ogni livello il **Codice del livello**
   (è il segno stampato nella segnatura, per esempio `4`) e il **Nome del livello**. Usare **Aggiungi un livello** per
   aggiungerne, **Sposta su** e **Sposta giù** per ordinarli, **Togli il livello** per eliminarne uno.
1. Spuntare **Il livello di lettura sta su ogni copia** soltanto se copie dello stesso libro stanno in scaffali di
   livelli diversi; altrimenti il livello sta sul libro. Al salvataggio il livello di ogni libro passa alle sue copie
   (o torna sul libro, se non ci sono copie di livelli diversi).

### Scegliere come si compone la segnatura

BiblioViva calcola la segnatura di ogni copia da uno schema e non la scrive mai per intero: ogni copia la conserva e
BiblioViva la calcola di nuovo dopo ogni modifica che la riguarda (la classificazione, l'autore, il titolo, il livello
di una copia, lo schema stesso). Le etichette con una segnatura cambiata tornano tra quelle da stampare. Lo schema si
compone con due scelte, anche nella configurazione guidata, nel passo **Scuola**.

1. Aprire la scheda **Opzioni** e cercare il gruppo **Schemi della segnatura**. Sotto il titolo del gruppo BiblioViva
   spiega che cambiando lo schema, al salvataggio, le segnature si calcolano di nuovo e le etichette che cambiano
   tornano tra quelle da stampare.
1. Nel menu **Segnatura** scegliere l'ordine delle parti. Sotto il menu compare «Come si compone la segnatura:
   BiblioViva la calcola dalla classificazione, dal livello e dall'autore.»
1. Nel menu **Parte finale** scegliere come finisce la segnatura. Il menu non compare con l'ordine «Libera: scritta a
   mano su ogni copia».
1. Leggere gli esempi sotto i menu, scritti come «Esempi: B 4 DEL · B DEL · 590 ROS»: cambiano insieme alle scelte.

Gli ordini offerti nel menu **Segnatura**:

| Voce | Forma | Esempio |
|---|---|---|
| «Genere, poi livello» (proposta) | genere, livello, parte finale | `B 4 DEL` |
| «Livello, poi genere» | livello, genere, parte finale | `4 B DEL` |
| «Genere, senza livello» | genere, parte finale | `B DEL` |
| «Libera: scritta a mano su ogni copia» | nessuna: BiblioViva non la calcola | |

Per un libro di saggistica la segnatura comincia con la classe, per esempio `590 ROS`. Senza livelli di lettura il menu
offre soltanto «Genere, senza livello» e «Libera: scritta a mano su ogni copia».

Le voci del menu **Parte finale**:

- «Iniziali dell'autore, calcolate» (proposta): le prime tre lettere del cognome, che non si possono modificare.
- «Iniziali dell'autore, modificabili per titolo»: la stessa cosa, ma chi cataloga può cambiarle per ogni titolo nel
  campo **Testo della segnatura** di **Modifica scheda**; lasciato vuoto, il campo usa le iniziali proposte.
- «Nessuna»: la segnatura non ha una parte finale.

> [!NOTE]
> Un libro il cui autore è un valore speciale (`Anonimo`, `AA. VV.`) prende le prime tre lettere del titolo, saltando un
> articolo iniziale: «Enciclopedia dei ragazzi» diventa `030 ENC`.

> [!NOTE]
> Passando all'ordine «Libera: scritta a mano su ogni copia» ogni copia tiene la segnatura che ha, come testo scritto a
> mano: non cambia nulla finché qualcuno non la modifica nella scheda della copia. Sotto i menu compare «Ogni copia ha
> la segnatura scritta nella sua scheda: BiblioViva non la calcola.»

### Scrivere uno schema a mano

Per una segnatura diversa da quelle offerte si scrive lo schema a mano. L'ordine mostra allora la voce
«Personalizzata», con la frase «Lo schema è scritto a mano negli schemi qui sotto.»

1. Nel gruppo **Schemi della segnatura** aprire la sezione **Schemi scritti a mano**.
1. Scrivere lo schema per **Narrativa**, **Narrativa con classe associata** e **Saggistica**, con i segnaposto elencati
   sopra i campi: `{{genre}}`, `{{class}}`, `{{code}}`, `{{author3}}`, `{{title1}}`, `{{text}}` e `{{copytext}}`. Il
   segnaposto `text` è un testo per titolo (in **Modifica scheda**), `copytext` un testo per copia. Sotto ogni schema
   compare un esempio.
1. Se uno schema usa `{{text}}`, compare **Valore proposto per il testo del titolo**: scegliere «Iniziali
   dell'autore», «Iniziale del titolo» o «Nessuno».

### Salvare

1. Premere **Salva** in alto. Si apre la finestra **Salva la classificazione**, che mostra che cosa cambia nel catalogo.
1. Se si è eliminato o rinominato un codice usato da alcuni libri, la finestra chiede dove spostarli: scegliere per ogni
   codice il nuovo valore nel menu **Scegli…**. Il codice nuovo va sui libri e all'inizio delle loro segnature.
1. Se si è tolto un livello di lettura con libri, la finestra chiede nello stesso modo a quale livello passano i
   libri, oppure **Nessun livello**.
1. Se cambiano segnature, la finestra le conta: «N copie cambiano segnatura: le loro etichette tornano tra quelle da
   stampare.» Succede anche rinominando o togliendo un genere, una classe o un livello, spostando il livello tra libro e
   copie e cambiando lo schema.
1. Per rimettere tra le etichette da stampare anche le fascette che cambiano solo nome, colore o pittogramma, spuntare la
   casella che lo propone. Lasciarla spenta se la differenza sulle fascette già attaccate non conta.
1. Premere **Salva**. Compare il messaggio «Classificazione salvata», con il numero di libri spostati, di segnature
   riscritte e di fascette da ristampare.

Per tornare indietro prima del salvataggio premere **Annulla modifiche**. Uscendo dalla pagina con modifiche non salvate
BiblioViva chiede conferma.

## Risultato

La classificazione salvata vale subito nel catalogo, nelle scelte di chi cataloga e sulle etichette. I libri spostati hanno
il codice e la segnatura calcolata di nuovo; le loro fascette, e le etichette con la segnatura cambiata, tornano tra
quelle da stampare. Il salvataggio entra nella cronologia della configurazione: vedere
[Annullare una modifica della configurazione](undo-a-configuration-change.md).

## Possibili problemi

### Il codice è già usato

Compare «Questo codice è già usato da un altro genere o argomento»: un codice non può essere usato due volte, nemmeno da
un genere e da un argomento. Scegliere un altro codice.

### Il colore non è scritto bene

Compare «Il colore si scrive come #rrggbb, per esempio #e8231b»: correggere il codice del colore.

### Il pulsante Salva è spento

I campi con un errore sono segnati in rosso; correggerli.

### Nel catalogo ci sono codici che la classificazione non contiene

Compare «Nel catalogo ci sono libri con codici che la classificazione non contiene»: alcuni libri hanno un codice che
non è nella classificazione. Aggiungere quei codici qui oppure riclassificare quei libri dal catalogo.

### Lo schema scritto a mano non è accettato

Compare «Lo schema non può essere vuoto.» oppure «Segnaposto sconosciuti: …»: ogni schema va scritto e può contenere
soltanto i segnaposto elencati sopra i campi. Correggere lo schema.

### Dopo il salvataggio molte etichette sono da stampare

La finestra di salvataggio ha contato «N copie cambiano segnatura: le loro etichette tornano tra quelle da stampare.»:
con il nuovo schema, o con il codice o il livello cambiato, la segnatura di quelle copie è diversa da quella stampata.
Stampare le etichette dal riquadro **Libri senza etichette** della **Dashboard**, come descritto in [Stampare le
etichette dei libri](../../manual/guides/print-book-labels.md#stampare-le-etichette-che-mancano).

### Il colore o il pittogramma di un sottoargomento non cambia

Senza un colore o un'immagine propri il sottoargomento usa quelli del suo argomento.

### L'immagine non viene accettata

Compare «Il file non è un'immagine» o «Formato non accettato: sono ammessi PNG, JPEG e WebP»: scegliere un'immagine in
uno di questi formati. «L'immagine è troppo grande»: ridurla e caricarla di nuovo.

### Alcuni libri hanno copie in classi diverse

La finestra di salvataggio segnala libri con copie in classi diverse: prima di togliere la classe dalle copie, dare la
stessa classe a tutte le copie di ogni libro.

## Pagine correlate

- [Annullare una modifica della configurazione](undo-a-configuration-change.md)
- [Importare il catalogo](import-the-catalogue.md)
- [Classificare i libri](../../manual/guides/classify-books.md)
- [Stampare le etichette dei libri](../../manual/guides/print-book-labels.md)
- [Configurazione](../screens/configuration.md)
