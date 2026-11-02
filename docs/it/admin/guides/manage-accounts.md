# Gestire gli account del personale

Questa guida spiega come creare, modificare, disattivare ed eliminare gli account con cui il personale entra in
BiblioViva. Serve a chi amministra BiblioViva e vuole, per esempio, un account in più per un secondo banco o un account
con meno permessi.

BiblioViva usa account condivisi, di norma uno per ruolo, creati dal [primo
avvio](../../setup/steps/first-run.md):

| Account | Nome utente | Serve per |
|---|---|---|
| **Amministrazione (admin)** | `admin` | tutto: impostazioni, backup, importazioni, account |
| **Gestione prestiti (prestiti)** | `prestiti` | il Banco prestiti: prestiti e restituzioni |
| **Catalogazione (catalogo)** | `catalogo` | il catalogo: libri, copie, etichette |
| **Tessere e foto (tessere)** | `tessere` | gli utenti e le tessere |
| **Report (report)** | `report` | i report e le statistiche |

Ogni account ha uno o più *ruoli*, e ogni ruolo è un insieme di *permessi*. Un account può fare solo ciò che i
permessi dei suoi ruoli consentono. Non esistono account personali, uno per persona.

- Tempo: circa 5 minuti per account.
- Account: `admin`.
- Occorrente: il nome utente e la password da dare al nuovo account, o l'account da modificare.

## Procedura

### Vedere gli account

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Account del personale**. Ogni account ha una scheda con il nome utente, lo stato (**Attivo** o
   **Disattivato**), i **Ruoli**, i **Permessi** e l'**Ultimo accesso**.

<!-- figure: admin/users | La pagina Account del personale con le schede degli account e il riquadro Ruoli e permessi -->

### Creare un account

1. Premere **Nuovo account**. Si apre una finestra.
1. Scrivere nel campo **Nome utente** il nome con cui si entra: da 2 a 32 caratteri, soltanto lettere minuscole, cifre,
   punto, trattino e trattino basso.
1. Scrivere nel campo **Nome mostrato** il nome che compare nelle pagine, per esempio «Banco 2». Il campo è facoltativo.
1. Spuntare, sotto **Ruoli**, almeno un ruolo.
1. Lasciare attiva la casella **Account attivo (può entrare)**.
1. Scrivere la password nel campo **Password (almeno 8 caratteri)** e di nuovo nel campo **Ripeti la password**.
1. Premere **Salva**. Compare il messaggio «Account creato».

> [!IMPORTANT]
> La password non si rivede più: BiblioViva ne conserva soltanto una forma protetta. Annotarla prima di premere
> **Salva** e consegnarla di persona a chi usa l'account.

### Modificare un account

1. Nella scheda dell'account premere **Modifica**.
1. Cambiare il **Nome utente**, il **Nome mostrato**, i **Ruoli** o lo stato dell'account.
1. Premere **Salva**. Compare il messaggio «Account salvato».

Per cambiare la password di un account vedere [Cambiare una password](change-a-password.md).

### Disattivare ed eliminare un account

Un account disattivato non può più entrare, ma resta nell'elenco e si può riattivare. Un account si elimina solo dopo
averlo disattivato.

1. Nella scheda dell'account premere **Modifica**.
1. Togliere la spunta alla casella **Account attivo (può entrare)** e premere **Salva**. Sulla scheda compare
   **Disattivato**.
1. Per eliminarlo, premere **Elimina** sulla scheda. Il pulsante compare soltanto sugli account disattivati.
1. Alla domanda «Eliminare <nome dell'account>?» premere **Elimina**. Compare il messaggio «Account eliminato».

Le operazioni fatte dall'account restano nel registro con il suo nome. L'eliminazione si può annullare dalla
[cronologia della configurazione](undo-a-configuration-change.md).

### Cambiare i ruoli e i permessi

Il riquadro **Ruoli e permessi**, sotto le schede, elenca i ruoli e, per ciascuno, i permessi: **Tutto**, **Prestiti**,
**Utenti**, **Importa utenti**, **Catalogo**, **Importa catalogo**, **Report**, **Anonimizza** e **Amministrazione**.

1. Nella riga di un ruolo spuntare o togliere i permessi. Il permesso **Tutto** comprende ogni permesso, anche quelli
   che BiblioViva potrà aggiungere in futuro.
1. Per un ruolo da aggiungere, premere **Aggiungi un ruolo** e scrivere il nome nel campo **Ruolo**: lettere, cifre,
   trattini e trattini bassi, al massimo 32.
1. Premere **Salva**. Compare il messaggio «Ruoli salvati».

Rinominare un ruolo aggiorna gli account che lo usano. Sotto il nome di ogni ruolo sono elencati gli account che lo
usano, oppure «nessun account».

## Risultato

- Il nuovo account entra dalla pagina **Accesso** con il suo nome utente e la sua password.
- Ogni account vede solo le pagine consentite dai suoi permessi.
- Gli account disattivati o eliminati non entrano più.

## Possibili problemi

### Il nome utente è già usato

Compare «Il nome utente … è già usato.»: scegliere un altro nome.

### Non si può togliere l'ultimo amministratore

Compare «Deve restare almeno un account attivo con il permesso di amministrazione.»: non si può disattivare, eliminare
o privare del permesso l'ultimo account che amministra. Prima va dato il permesso **Amministrazione** a un altro
account.

### L'account va disattivato prima di eliminarlo

Compare «Disattiva l'account prima di eliminarlo.»: seguire i passi di disattivazione sopra.

### Il pulsante per eliminare un ruolo è spento

Il ruolo è usato da qualche account. Togliere prima il ruolo a quegli account con **Modifica**.

### Una scheda segnala la password in chiaro

L'account è stato scritto a mano nei file della configurazione con la password leggibile. Assegnargli una password con
**Nuova password**, come descritto in [Cambiare una password](change-a-password.md).

### Un account è stato tolto dalla configurazione

L'account non è più nei file della configurazione, e le sue operazioni restano nel registro. Non si può né modificare
né eliminare.

### I file della configurazione sono stati modificati a mano

Il pulsante **Ricarica configurazione**, in alto, fa rileggere i file della configurazione modificati a mano. Serve
soltanto a chi li modifica fuori da BiblioViva.

## Pagine correlate

- [Cambiare una password](change-a-password.md)
- [Account del personale](../screens/users.md)
- [Esportare e importare la configurazione](export-the-configuration.md): l'archivio contiene gli account
- [Primi passi dell'amministratore](../first-steps.md)
