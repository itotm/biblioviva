# Avanza di classe

La pagina **Avanza di classe** è la procedura guidata di fine anno: tutti gli studenti passano all'anno successivo e chi
finisce l'ultimo anno lascia la scuola. È riservata all'account `admin` e si apre dalla scheda **Avanza di classe** di
[Amministrazione](admin.md). La procedura ha cinque passi, indicati in alto: **Backup**, **Classi**, **Uscite**,
**Conferma**, **Completato**. La procedura passo per passo è nella guida [Avanzare di classe](../guides/class-upgrade.md).

<!-- figure: admin/rollover-classes | Il passo Classi dell'avanzamento, con le classi aperte e le scelte per ogni studente -->

1. L'indicatore dei cinque passi.
2. Il riepilogo di una classe: da dove a dove passa, quanti studenti, eventuali eccezioni.
3. La riga di uno studente, con **Ripete**, **L'anno dopo** e **Classe**.
4. I pulsanti **Indietro** e **Avanti**.

## Passo Backup

Il primo passo propone una copia di sicurezza del database: se qualcosa non va, si torna indietro da
[Backup](backups.md). Il pulsante **Crea il backup** la fa e scrive «Backup creato» con il nome del file. **Avanti** resta
spento finché la copia non esiste. Senza questa copia la procedura non parte.

## Passo Classi

Ogni studente passa all'anno successivo con la sua classe; in questo passo si segnano chi ripete l'anno e chi cambia
classe. Per ogni classe c'è una riga ripiegabile con il titolo «da → a» (per esempio la classe di quest'anno e quella
dell'anno dopo) e questi indicatori:

- **Si chiude** (la classe dell'ultimo anno viene archiviata) oppure **Resta**, quando la classe non avanza;
- il numero di studenti;
- il numero di eccezioni (studenti che ripetono o che cambiano classe);
- il numero di studenti con libri in prestito.

Aprendo la riga, ogni studente ha:

- la casella **Ripete**: lo studente resta nel suo anno;
- il menu **L'anno dopo**, dove il percorso si divide (per esempio dopo un ordine di scuola): serve a scegliere l'anno da
  frequentare, oppure «Esce dalla scuola»;
- il menu **Classe**, per scegliere la classe dell'anno dopo. Quando la classe non si ricava da sola il menu dice
  «Scegli la classe…»; la voce «Senza classe» lascia lo studente senza classe.

Un riquadro giallo avvisa quando degli studenti aspettano la scelta della classe («studenti aspettano la scelta della
classe»); **Avanti** si accende solo quando ogni studente ha la sua classe. Senza studenti che passano all'anno
successivo la pagina dice «Nessuno studente che passa all'anno successivo.»

## Passo Uscite

Gli studenti dell'ultimo anno lasciano la scuola: i loro dati vengono cancellati subito e per sempre, restano solo i
numeri delle statistiche. Ogni studente ha la casella **Esce**; togliendo la spunta lo studente resta (per esempio chi
ripete l'ultimo anno) e compare il menu per la sua classe. Chi ha ancora libri mostra l'indicatore con il numero dei
libri in prestito.

Se uno studente che esce ha ancora libri, un riquadro giallo lo dice con i nomi e **Avanti** resta spento: il riquadro
offre il collegamento **Vai a Restituzioni** per registrare le restituzioni, oppure si segna la copia come smarrita
([Togliere una copia smarrita o rovinata](../../manual/guides/withdraw-a-copy.md)), oppure si toglie la spunta a
quello studente. Senza studenti all'ultimo anno la pagina dice «Nessuno studente all'ultimo anno.»

## Passo Conferma

Il riepilogo elenca quello che succederà:

- quanti studenti passano all'anno successivo;
- quanti ripetono l'anno;
- quanti cambiano classe;
- quante classi si chiudono e vengono archiviate (solo se ce ne sono);
- quanti lasciano la scuola e vedono i loro dati cancellati (in rosso).

Se l'ultimo avanzamento è stato fatto meno di sei mesi prima, il riepilogo aggiunge una casella da spuntare per
confermare di volerlo ripetere; senza spunta il pulsante **Avanza di classe** resta spento. **Avanza di classe** esegue la
procedura. Un riquadro rosso riporta l'errore se l'esecuzione non riesce.

## Messaggi di errore

- «Qualche studente che esce ha ancora libri in prestito.»: tornare al passo Uscite.
- «Serve la conferma: l'ultimo avanzamento è recente.»: spuntare la casella del passo Conferma.
- «Il backup non è stato trovato o è troppo vecchio: rifallo dal primo passo.»: tornare al passo Backup e rifare la copia.
- «Una classe scelta non esiste o non ospita l'anno dello studente.»: scegliere di nuovo la classe al passo Classi.
- «Alcuni studenti non hanno ancora la classe: sceglierla al passo Classi.»
- «Uno degli anni scelti non è tra quelli possibili: ricaricare la pagina.»

## Passo Completato

Al termine la pagina riassume quanti studenti sono passati, ripetono o hanno cambiato classe, quante classi sono
avanzate e quante archiviate, quanti studenti hanno lasciato la scuola. Il testo ricorda i passi successivi: creare le
nuove classi prime, se servono ([Classi](classes.md)), e importare i nuovi studenti con il pulsante **Importa i nuovi
studenti**, che apre l'importazione degli studenti ([Importazioni](imports.md); guida [Importare gli
alunni](../guides/import-students.md)).
