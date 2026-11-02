# Scegliere i formati dei codici a barre

Questa guida spiega come scegliere la forma dei codici delle copie dei libri e dei numeri delle tessere, e come
controllare che non si possano confondere. Serve a chi amministra BiblioViva ed è una scelta da fare all'avvio: i codici
già stampati continuano sempre a funzionare, e il formato nuovo vale soltanto per le copie e le tessere create da quel
momento in poi.

- Tempo: da 10 a 20 minuti.
- Account: `admin`.
- Occorrente: nessuna scelta è obbligatoria; i formati proposti dal primo avvio vanno bene a quasi tutte le scuole.

I formati proposti sono questi: una copia ha un codice come `2026-E0267` (anno, trattino, lettera di controllo, numero
progressivo) e una tessera un numero come `U012345` (lettera di controllo e numero progressivo). La *lettera di
controllo* è un carattere calcolato dalle cifre: se un codice viene letto o scritto male, BiblioViva se ne accorge.

Il lettore di codici a barre USB scrive il codice come se fosse digitato da una tastiera, quindi BiblioViva riconosce
da solo se un codice è di una copia, di una tessera o un ISBN. Una regola vale sempre: le copie e le tessere non
possono mai essere confuse. BiblioViva rifiuta una scelta in cui i due formati potrebbero dare lo stesso codice o
somigliarsi troppo.

## Procedura

### Scegliere i formati

1. Accedere a BiblioViva con l'account `admin`.
1. Premere **Amministrazione**, poi **Configurazione**, poi **Codici a barre**.
1. Nel riquadro **Formato dei codici**, nel campo **Formati pronti**, scegliere una delle forme: **Standard (2026-E0267,
   U012345)**, **Classico (2026-02678, 0000012344)** oppure **Con lettera davanti (L-2602670, T0123455)**. Il formato
   Classico è quello a cifre, con il numero di tessera di 10 cifre.
1. Nel campo **Carattere di controllo** scegliere **Lettera (mod 23)** (la più sicura, e rende le tessere diverse a colpo
   d'occhio dai codici delle copie), **Cifra (Damm)** oppure **Cifra (Luhn)**.
1. Sotto **Copie** e **Tessere** leggere gli **Esempi di nuovi codici:**. Sono i codici che BiblioViva darà alle prossime
   copie e alle prossime tessere.

<!-- figure: admin/barcode-formats | Il riquadro Formato dei codici con i formati pronti e gli esempi -->

### Controllare che non si confondano

1. Sotto i formati leggere la verifica. Se è tutto a posto compare «Copie e tessere non si possono confondere.».
1. Se compare invece «Con questi formati copie e tessere si potrebbero confondere:», la pagina elenca i motivi e mostra
   due codici d'esempio che si confonderebbero. In quel caso il pulsante **Salva** resta spento: scegliere un altro
   formato pronto o un altro carattere di controllo.
1. Nel campo **Prova un codice** scrivere (o leggere con il lettore) un codice a caso. Il risultato dice come BiblioViva
   lo riconosce: per esempio «…: codice di una copia», «…: numero di tessera», «…: ISBN», oppure «…: non riconosciuto o
   carattere di controllo errato».

### Salvare

1. Premere **Salva** in fondo al riquadro. Compare il messaggio «Formati dei codici salvati».

### Scegliere da quale numero cominciano le tessere (facoltativo)

1. Nel riquadro **Numerazione e anteprima**, sotto **Numeri delle nuove tessere**, lasciare **Dopo il numero più alto
   delle tessere che esistono già** per continuare dall'ultimo numero in uso, oppure scegliere **Da questo numero in
   poi:** e scrivere un numero nel campo **Primo numero delle nuove tessere**.
1. Controllare «Prossima tessera: …» e «Prossima copia: …»: la pagina mostra anche i due codici a barre disegnati. Le
   anteprime non consumano numeri.
1. Premere **Salva**. Il messaggio è «Numerazione salvata».

Un numero già usato non torna mai: se il numero scelto è più basso dell'ultimo in uso, si continua da dove si è arrivati.

### Scrivere un formato diverso (facoltativo)

I formati pronti coprono la maggior parte dei casi. Chi ha bisogno di una forma particolare apre **Avanzate: i formati uno
per uno** e scrive il formato nei campi **Formato delle copie** e **Formato delle tessere**.

1. Premere **Avanzate: i formati uno per uno**.
1. Scrivere il formato con i segni indicati sopra al campo: `YYYY` o `YY` per l'anno, `N` per ogni cifra del numero
   progressivo, `C` per il carattere di controllo, `-` per un trattino, una lettera maiuscola tra apici (`'T'`) per una
   lettera fissa. Le lettere I, O e Q non sono ammesse.
1. Leggere gli esempi e la verifica che compaiono sotto i campi, poi premere **Salva**.

### Tenere in vita i codici di un altro programma

1. Nell'elenco **Codici del sistema precedente** di ciascun tipo sono indicati i formati vecchi che BiblioViva
   riconosce ancora. Per aggiungerne uno scriverlo nel campo, per esempio `YYYY-NNNN`, e premere **Aggiungi formato
   vecchio**.
1. Se le tessere o le copie del vecchio programma erano numeri semplici, indicare nel campo **Cifre dei vecchi numeri
   semplici** quante cifre hanno al massimo; la pagina indica anche qual è il numero più lungo trovato in archivio.
1. Premere **Salva**.

Un formato sostituito resta nell'elenco **Formati usati in passato**. Un formato con codici ancora in archivio non si
può togliere: la pagina scrive quanti codici ci sono.

### Impostare la tastiera e il tipo di codice

1. Nella scheda **Impostazioni** della stessa pagina, nel campo **Tastiera dei computer**, scegliere la disposizione
   della tastiera dei computer a cui sono collegati i lettori: serve a correggere i caratteri che un lettore impostato
   per un'altra tastiera scrive male.
1. Nei gruppi **Tessere degli utenti** e **Copie dei libri** lasciare **Code 128** nei campi **Tipo di codice a barre
   delle tessere** e **Tipo di codice a barre delle copie**. Scegliere **Code 39** soltanto se i lettori della
   biblioteca non leggono il Code 128.
1. Premere **Salva**.

## Risultato

Le copie e le tessere create dopo il salvataggio hanno il formato scelto. Le etichette e le tessere già stampate restano
valide e non vanno ristampate: i loro codici sono riconosciuti anche se hanno un formato diverso.

## Possibili problemi

### Il pulsante Salva è spento

Il formato non è valido o i due formati si confondono. Leggere i messaggi sotto i campi, che dicono quale parte
correggere.

### Un formato non si può togliere

Compare «Il formato … ha ancora … codici in archivio: non si può togliere.»: si è cercato di togliere un formato che ha
ancora copie o tessere. Lasciare il formato nell'elenco: serve a riconoscere i codici già stampati.

### Il lettore dà un codice non riconosciuto

Un codice letto dal lettore risulta «non riconosciuto o carattere di controllo errato»: il codice è stato letto male,
oppure il lettore è impostato per una tastiera diversa da quella scelta in **Tastiera dei computer**. Leggere di nuovo
l'etichetta; se capita spesso, correggere la tastiera.

### Una tessera di un programma precedente non viene riconosciuta

Aggiungere il suo formato tra i **Codici del sistema precedente**.

## Pagine correlate

- [Importare gli alunni](import-students.md)
- [Importare il catalogo](import-the-catalogue.md)
- [Modificare il modello delle tessere](edit-the-card-template.md)
- [Stampare le etichette dei libri](../../manual/guides/print-book-labels.md)
- [Configurazione](../screens/configuration.md)
