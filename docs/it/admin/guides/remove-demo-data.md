# Togliere i dati dimostrativi

Questa guida spiega come cancellare gli studenti, i libri e i prestiti inventati che il primo avvio può caricare per
provare BiblioViva, prima di inserire i dati veri. Serve a chi amministra BiblioViva e ha scelto **Carica dati
dimostrativi** al primo avvio.

I dati dimostrativi non corrispondono ad alcuna persona reale. Sulla dashboard compare un riquadro che comincia con
«Questa installazione contiene dati dimostrativi»: finché c'è, i dati sono ancora quelli di prova.

- Tempo: circa 5 minuti.
- Account: `admin`.
- Occorrente: nessun dato vero ancora inserito. La cancellazione svuota utenti, libri, prestiti e foto; le classi restano.

> [!WARNING]
> La cancellazione non distingue i dati di prova da quelli veri: svuota utenti, libri, prestiti e foto. Farla prima di
> importare o inserire dati veri, non dopo.

## Procedura

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Premere **Svuota dati dimostrativi**, in alto a destra. Il pulsante compare soltanto finché i dati dimostrativi ci
   sono.
1. Alla domanda «Svuotare i dati dimostrativi?» premere **Svuota dati dimostrativi**. Gli utenti, i libri, i prestiti e
   le foto dimostrativi vengono cancellati; le classi e il gruppo dei docenti scelti al primo avvio restano. Tutti gli
   operatori vengono disconnessi.
1. Leggere il messaggio «Dati dimostrativi rimossi. È necessario accedere di nuovo.» BiblioViva apre la pagina
   **Accesso** e un secondo avviso ricorda che gli account hanno ancora la password dimostrativa «biblioviva» e che va
   cambiata.
1. Entrare con `admin`. Con i dati dimostrativi tutti gli account avevano la stessa password semplice, mostrata
   al primo avvio.
1. Cambiare subito le password di tutti gli account: vedere [Cambiare una password](change-a-password.md).

<!-- figure: admin/clear-demo | La pagina Amministrazione con il pulsante Svuota dati dimostrativi -->

## Risultato

- Il database è vuoto: nessun utente, libro, copia o prestito. Il riquadro dei dati dimostrativi non compare più sulla
  dashboard.
- Restano la configurazione (nome, colori, impostazioni, modelli di stampa), gli account del personale e le classi create
  al primo avvio.
- Gli operatori devono entrare di nuovo.

## Possibili problemi

### Il pulsante Svuota dati dimostrativi non compare

I dati dimostrativi non ci sono, perché non sono stati caricati al primo avvio o sono già stati tolti. Il pulsante manca
anche nella demo pubblica, che si ricrea da sola.

### Dopo la cancellazione si vogliono i dati di prova

Non è possibile da qui. Per ricominciare da capo serve la procedura tecnica «Resetting an installation back to the
first-run wizard» della pagina
[Deployment notes](../../../deploy.md#resetting-an-installation-back-to-the-first-run-wizard) (in inglese).

## Pagine correlate

- [Cambiare una password](change-a-password.md)
- [Importare gli alunni](import-students.md)
- [Impostare le classi](set-up-classes.md)
- [Primi passi dell'amministratore](../first-steps.md)
- [Amministrazione](../screens/admin.md)
