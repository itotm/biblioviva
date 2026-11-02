# Correggere i dati di un utente

Questa pagina spiega come correggere i dati di uno studente o di un docente già inserito: un nome scritto male, una
classe sbagliata, un'email, una nota per il banco prestiti. Serve a chi gestisce gli utenti.

- Tempo: circa 2 minuti.
- Account: Tessere e foto (anche Amministrazione).
- Occorrente: il cognome dell'utente, o il numero della sua tessera.
- Il passaggio di tutte le classi all'anno successivo non si fa un utente alla volta: lo fa l'amministratore con
  [Avanzare di classe](../../admin/guides/class-upgrade.md).

## Procedura

### Trovare l'utente

1. Accedere a BiblioViva con l'account Tessere e foto.
1. Aprire **Utenti**.
1. Scrivere almeno tre lettere del cognome nel campo **Cerca per cognome…**. In alternativa usare i filtri **Tipo**,
   **Classe** e quello della sezione. L'elenco compare solo dopo una ricerca o un filtro.
1. Premere la riga dell'utente. Si apre la **Scheda dell'utente**.

### Correggere i dati

1. Premere **Modifica**. Si apre la pagina **Modifica utente**, con i campi compilati.

   <!-- figure: patrons/edit-form | La pagina Modifica utente con i dati di uno studente -->

1. Correggere il campo da cambiare: **Cognome**, **Nome**, **Matricola**, oppure, nella parte **Contatti**, **Email**.
1. Per cambiare classe scegliere in **Classe** un altro anno, poi nel campo seguente la sezione.
1. Lasciare com'è il campo **Numero tessera**. Per una tessera smarrita vedere [Ristampare una
   tessera](replace-a-lost-card.md).
1. Premere **Salva modifiche**. Si riapre la **Scheda dell'utente** con i dati aggiornati.

Per annullare, premere **Annulla**: nulla cambia.

### Correggere solo le note

Le note si cambiano direttamente nella scheda, senza aprire la pagina **Modifica utente**.

1. Nella **Scheda dell'utente** aprire la scheda **Note**.
1. Premere **Modifica note**.
1. Scrivere la **Nota per il banco prestiti**: compare in evidenza al momento del prestito. Le **Note interne** restano
   nella scheda e non compaiono al banco.
1. Premere **Salva**. Compare l'avviso «Note salvate».

## Risultato

La scheda mostra i dati corretti. I prestiti già registrati mantengono la classe che l'utente aveva quel giorno: il
cambio vale da ora in poi. La scheda **Storico** elenca i prestiti passati e non cambia.

## Possibili problemi

### Mancano l'anno o la sezione dello studente

Compaiono «Per uno studente la classe (il livello) è obbligatoria.» e «Per uno studente la sezione è obbligatoria.»:
scegliere l'anno e la sezione.

### La sezione non esiste ancora

Compare «Sezione non trovata tra le classi attive: le classi si creano in Amministrazione → Configurazione →
Classi.»: la sezione non esiste ancora. Chiedere all'amministratore di crearla:
[Impostare le classi](../../admin/guides/set-up-classes.md).

### La sezione non corrisponde alla classe

Compare «Questa sezione non ha questa classe: scegliere una sezione della classe.»: scegliere di nuovo la sezione
dopo aver scelto l'anno.

### La matricola è già assegnata

Compare «Matricola già assegnata a un altro utente.»: la matricola appartiene a un'altra persona; controllare di non
avere inserito due volte lo stesso utente.

### L'indirizzo email non è valido

Compare «Indirizzo email non valido.»: correggere l'indirizzo.

### Il salvataggio non trova modifiche

Compare «Nessuna modifica»: non è stato cambiato nulla nelle note.

## Pagine correlate

- [Iscrivere un alunno](enrol-a-student.md)
- [Ristampare una tessera](replace-a-lost-card.md)
- [Rimuovere un utente](remove-a-patron.md)
- [Scheda dell'utente](../screens/patron-record.md)
