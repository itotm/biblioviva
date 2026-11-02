# Aggiungere un foglio di etichette

Un foglio di etichette adesive è descritto in BiblioViva da poche misure: la grandezza di un'etichetta, quante ce ne
sono per colonna e per riga, i margini del foglio. Questa guida serve all'amministratore che compra un tipo di fogli
diverso da quelli già previsti e vuole stampare le etichette dei libri su di esso.

- Tempo: circa 20 minuti, più il tempo di una stampa di prova.
- Account: `admin`.
- Occorrente: un foglio del nuovo tipo di etichette, un righello (meglio uno trasparente) e carta comune per la prova.
  Le misure sono spesso scritte sulla confezione o sul sito del produttore.

Il foglio è un oggetto separato dal modello delle etichette: il modello decide che cosa si stampa dentro un'etichetta,
il foglio decide dove stanno le etichette sulla pagina. I modelli forniti hanno due disposizioni, una per le etichette
alte e una per quelle basse, e scelgono da soli quella adatta all'altezza del nuovo foglio.

## Procedura

### Misurare il foglio

1. Contare le colonne e le righe di etichette del foglio.
1. Misurare la larghezza e l'altezza di un'etichetta, in millimetri.
1. Misurare la distanza tra il bordo superiore del foglio e il bordo superiore della prima etichetta (margine in alto).
1. Misurare la distanza tra il bordo sinistro del foglio e il bordo sinistro della prima etichetta (margine a sinistra).
1. Misurare lo spazio vuoto tra due etichette vicine, in orizzontale e in verticale. Molti fogli non ne hanno: in quel
   caso i due spazi sono 0.
1. Se gli angoli delle etichette sono arrotondati, stimare il raggio dell'arrotondamento. Con gli angoli retti il valore
   è 0.

### Inserire il foglio

1. Aprire **Amministrazione** → **Configurazione** e scegliere la sezione **Etichette**.
1. Scorrere fino al blocco **Fogli di etichette adesive**. A sinistra c'è l'elenco dei fogli già previsti, ciascuno con
   l'indicazione dei lavori di stampa che lo usano.
1. Premere il foglio più simile a quello nuovo, per esempio `a4-70x48`.
1. Premere **Aggiungi un foglio**. Compare un nuovo foglio con l'indicazione **Nuovo**, copia di quello scelto.
1. Scrivere in **Codice** una sigla breve: lettere minuscole, cifre, trattini e trattini bassi (per esempio
   `a4-105x37`).
1. Scrivere in **Nome** un nome comprensibile, che compare poi negli elenchi (per esempio «Etichette 105 × 37 mm, 2 ×
   8»).
1. Scrivere **Larghezza etichetta (mm)** e **Altezza etichetta (mm)**.
1. Scrivere **Colonne** e **Righe**.
1. Scrivere **Margine in alto (mm)** e **Margine a sinistra (mm)**.
1. Scrivere **Spazio tra le colonne (mm)** e **Spazio tra le righe (mm)**.
1. Scrivere **Angoli arrotondati (mm)**.
1. Controllare il disegno del foglio A4 a destra: segue ogni numero scritto e mostra le etichette nei loro posti. Le
   etichette che escono dal foglio sono in rosso, e sotto i campi compare il motivo.
1. Premere **Salva**. Compare il messaggio «Fogli di etichette salvati» e il foglio perde l'indicazione **Nuovo**.

<!-- figure: admin/label-stocks | Il blocco Fogli di etichette adesive: l'elenco dei fogli, le misure e il disegno del foglio A4 -->

> [!NOTE]
> La coppia di etichette (fascetta del dorso ed etichetta con il codice a barre) occupa due etichette una sopra l'altra:
> un foglio usato per la coppia deve avere un numero pari di righe.

### Controllare con una stampa di prova

1. Premere **Stampa pagina di prova** sotto le misure del foglio. Il pulsante si accende dopo il salvataggio. Si apre in
   una nuova scheda una pagina con il contorno di ogni etichetta numerato.
1. Stampare la pagina su carta comune, al 100 % (senza «adatta alla pagina»), in A4 e senza margini aggiunti dalla
   stampante.
1. Sovrapporre la carta stampata a un foglio di etichette vero e controllare contro luce: ogni contorno deve cadere
   sull'etichetta corrispondente.
1. Se i contorni sono spostati, correggere i margini e gli spazi nel blocco, premere **Salva** e stampare di nuovo la
   pagina di prova.

### Usare il foglio

1. Per stampare le etichette di un libro sul nuovo foglio, aprire **Stampa etichette** da un libro, da una selezione del
   catalogo o da una lista di stampa, e scegliere il foglio in **Foglio di etichette**. Per i dettagli vedere [Stampare
   le etichette dei libri](../../manual/guides/print-book-labels.md).
1. Per far usare il nuovo foglio sempre, senza sceglierlo ogni volta, scegliere **Amministrazione** → **Configurazione**
   → **Etichette**; nel gruppo dell'etichetta (**Coppia: fascetta ed etichetta**, **Solo etichetta con il codice** o
   **Solo fascetta**) scrivere in **Foglio adesivo** il codice del nuovo foglio e premere **Salva**.

## Risultato

Il foglio compare nell'elenco dei fogli, nella stampa di prova e nel dialogo di stampa delle etichette. Le etichette si
stampano nei posti giusti del foglio. Ogni salvataggio è una modifica della configurazione e si può annullare:
[Annullare una modifica della configurazione](undo-a-configuration-change.md).

## Possibili problemi

### Il pulsante Salva è spento e un foglio è «Da correggere»

Una delle misure non è valida. Leggere sotto i campi il motivo: il codice può avere lettere, cifre, trattini e trattini
bassi; un altro foglio può avere già lo stesso codice; il nome è obbligatorio; le misure sono numeri da 0 in su, con
etichette più grandi di zero, e colonne e righe sono numeri interi. Il pulsante **Salva** è spento e il foglio porta
l'indicazione «Da correggere».

### Le etichette sono più larghe del foglio A4

Compare «Le etichette occupano … mm: più della larghezza del foglio A4»: le colonne, la larghezza, gli spazi e il
margine a sinistra, sommati, superano 210 mm. Controllare le misure; lo stesso vale in altezza con 297 mm.

### Per la coppia servono righe in numero pari

Compare «Per la coppia servono righe in numero pari»: il foglio è usato per la coppia di etichette: scegliere un
numero pari di righe oppure usare quel foglio solo per etichette singole.

### Il foglio non si può eliminare

**Elimina** è spento per i fogli in uso: sotto le misure compare «Usato per …». Scegliere prima un altro foglio nelle
impostazioni dell'etichetta.

### Il pulsante Stampa pagina di prova è spento

Il pulsante **Stampa pagina di prova** è spento. Prima salvare le modifiche; il pulsante vale per il foglio già salvato.

### I contorni stampati sono tutti spostati allo stesso modo

Sono i margini a essere sbagliati: correggere **Margine in alto (mm)** e **Margine a sinistra (mm)**. Controllare anche
che la stampa sia al 100 %.

### Una colonna o una riga di contorni è spostata sempre di più

Sono gli spazi tra le etichette a essere sbagliati: correggere **Spazio tra le colonne (mm)** e **Spazio tra le righe
(mm)**.

## Pagine correlate

- [Modificare le etichette e la fascetta del dorso](edit-label-templates.md)
- [Stampare le etichette dei libri](../../manual/guides/print-book-labels.md)
- [Annullare una modifica della configurazione](undo-a-configuration-change.md)
- [Template di stampa](../screens/templates.md)
- [Print templates: authoring guide](../../../templates-authoring.md#labels) (pagina tecnica, in inglese)
