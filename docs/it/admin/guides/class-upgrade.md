# Avanzare di classe

Questa guida spiega come far passare tutti gli studenti all'anno successivo alla fine dell'anno scolastico: ogni classe
avanza con i suoi studenti (la `3 B` diventa `4 B`) e chi finisce l'ultimo anno lascia la scuola. Serve a chi amministra
BiblioViva e va eseguita una volta l'anno, quando lo decide l'amministratore: BiblioViva non la esegue mai da sola.

- Tempo: da 20 a 40 minuti, più il tempo per importare i nuovi studenti.
- Account: `admin`.
- Occorrente: nessun libro in prestito agli studenti dell'ultimo anno (o la decisione di tenerli a scuola), l'elenco dei
  nuovi studenti delle classi prime.

> [!WARNING]
> I dati personali degli studenti che lasciano la scuola (nome, cognome, contatti, matricola, numero di tessera, foto)
> vengono cancellati subito e per sempre; restano soltanto la classe e le statistiche. L'operazione non si annulla, se non
> ripristinando il backup fatto al primo passo.

Che cosa fa l'avanzamento, in breve:

- ogni classe passa all'anno successivo e mantiene i suoi studenti; una pluriclasse (una classe che ospita più anni) fa
  avanzare ciascuno studente nel suo anno;
- gli studenti dell'ultimo anno lasciano la scuola e vengono rimossi;
- le classi rimaste senza studenti vengono archiviate;
- i docenti e i loro gruppi non cambiano;
- i prestiti già fatti conservano la classe del giorno del prestito, quindi le statistiche degli anni passati restano
  giuste;
- le immagini di classe caricate per il censimento delle foto vengono cancellate.

## Procedura

### Prima di cominciare

1. Aprire **Prestiti**, poi **Restituzioni**, e registrare la restituzione dei libri degli studenti dell'ultimo anno.
   Un libro perso si segna come smarrito. Chi ha ancora libri in prestito blocca l'avanzamento, a meno che si decida di
   tenerlo a scuola (passo **Uscite**).

### Eseguire l'avanzamento

1. Accedere a BiblioViva con l'account `admin`.
1. Premere **Amministrazione**, poi **Avanza di classe**. La pagina mostra i passi **Backup**, **Classi**, **Uscite**,
   **Conferma** e **Completato**.

### Il passo Backup

1. Premere **Crea il backup**. Compare il messaggio «Backup creato: …» con il nome del file.
1. Premere **Avanti**. Il pulsante si attiva soltanto dopo il backup.

### Il passo Classi

<!-- figure: admin/rollover-classes | Il passo Classi dell'avanzamento, con una classe aperta -->

1. Leggere l'elenco: ogni riga mostra il passaggio, per esempio «3 B → 4 B», e il numero di studenti. Un segno
   **Si chiude** indica una classe che resta senza studenti e viene archiviata.
1. Per vedere gli studenti di una classe premere la sua riga.
1. Per uno studente che ripete l'anno, spuntare **Ripete**. Resta nel suo anno e nella classe che lo ospiterà, di
   norma quella con lo stesso nome.
1. Per uno studente che cambia sezione, scegliere la nuova classe nel menu **Classe**.
1. Dove il percorso si divide in più anni possibili, scegliere l'anno nel menu **L'anno dopo**.
1. Se la pagina scrive «… studenti aspettano la scelta della classe», scegliere **Scegli la classe…** per ciascuno: il
   pulsante **Avanti** resta spento finché non sono tutti sistemati.
1. Premere **Avanti**.

### Il passo Uscite

1. Leggere l'elenco degli studenti dell'ultimo anno, ciascuno con la spunta **Esce**.
1. Togliere la spunta a chi resta a scuola, per esempio a chi ripete l'ultimo anno.
1. Se uno studente ha libri in prestito, la riga mostra «… libri in prestito» e sopra compare un avviso. Premere **Vai a
   Restituzioni**, registrare la restituzione (o segnare il libro smarrito) e tornare al passo; oppure togliere la
   spunta.
1. Premere **Avanti**. Il pulsante si attiva quando nessuno che esce ha libri in prestito.

### Il passo Conferma

1. Leggere il riepilogo: quanti studenti passano all'anno successivo, quanti ripetono, quanti cambiano classe, quante
   classi si chiudono, quanti lasciano la scuola e vengono cancellati.
1. Se l'ultimo avanzamento risale a meno di sei mesi fa, spuntare la casella «L'ultimo avanzamento è stato fatto il …,
   meno di sei mesi fa. Confermo di volerlo ripetere.».
1. Premere **Avanza di classe**.

### Il passo Completato

1. Leggere i numeri: gli studenti promossi e quelli che ripetono, le classi avanzate e archiviate, gli studenti
   rimossi.

### Dopo l'avanzamento

1. Per creare le classi prime premere **Amministrazione**, poi **Configurazione**, poi **Classi**, poi **Nuove classi**:
   vedere [Impostare le classi](set-up-classes.md).
1. Per caricare i nuovi studenti premere **Importa i nuovi studenti** nel passo **Completato**, oppure
   **Amministrazione**, **Importazioni**, **Studenti**: vedere [Importare gli alunni](import-students.md). Con un file
   che contiene tutti gli studenti della scuola scegliere **Sincronizza studenti**; con un file dei soli nuovi studenti
   scegliere **Aggiungi e aggiorna**.
1. Stampare le tessere dei nuovi studenti con **Stampa le tessere dei nuovi** e fare le foto con **Censimento foto**.

## Risultato

Gli studenti sono nelle classi dell'anno nuovo, i diplomati sono stati rimossi e le classi vuote sono archiviate.
L'operazione compare nel **Registro operazioni**.

## Possibili problemi

### Qualche studente che esce ha ancora libri in prestito

Compare «Qualche studente che esce ha ancora libri in prestito.»: registrare la restituzione dei libri, segnarli
smarriti, oppure togliere la spunta **Esce** a quello studente.

### Il backup non è stato trovato o è troppo vecchio

Compare «Il backup non è stato trovato o è troppo vecchio: rifallo dal primo passo.»: il backup vale per due ore.
Tornare al passo **Backup**, premere **Crea il backup** e ripetere i passi.

### Alcuni studenti non hanno ancora la classe

Compare «Alcuni studenti non hanno ancora la classe: sceglierla al passo Classi.»: tornare al passo **Classi** e
scegliere la classe per ciascuno.

### Serve la conferma perché l'ultimo avanzamento è recente

Compare «Serve la conferma: l'ultimo avanzamento è recente.»: spuntare la casella di conferma nel passo **Conferma**.

### Dopo l'avanzamento si è sbagliato qualcosa

Ripristinare il backup fatto al primo passo da **Amministrazione**, **Backup**: vedere
[Fare e scaricare una copia di sicurezza](make-a-backup.md). Tutto ciò che si è fatto dopo il backup va perso.

## Pagine correlate

- [Impostare le classi](set-up-classes.md)
- [Importare gli alunni](import-students.md)
- [Fare e scaricare una copia di sicurezza](make-a-backup.md)
- [Stampare le tessere di una classe](../../manual/guides/print-class-cards.md)
- [Avanza di classe](../screens/rollover.md)
