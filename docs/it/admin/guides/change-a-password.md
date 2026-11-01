# Cambiare una password

Questa guida spiega come dare una nuova password a un account del personale: dopo il primo avvio, dopo aver tolto i dati
dimostrativi, quando una password è stata persa o quando un collega lascia la scuola. Serve a chi amministra BiblioViva.

- Tempo: 2 minuti per account.
- Account: `admin`. Gli altri account non cambiano la propria password.
- Occorrente: la nuova password, di almeno 8 caratteri, e un posto sicuro dove annotarla.

## Procedura

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Account del personale**.
1. Trovare la scheda dell'account di cui cambiare la password.
1. Premere **Nuova password** sulla scheda. Si apre una finestra con il titolo «Nuova password per» seguito dal nome
   dell'account.
1. Scrivere la password nel campo **Password (almeno 8 caratteri)**.
1. Scrivere di nuovo la stessa password nel campo **Ripeti la password**.
1. Premere **Salva**. Compare il messaggio «Password cambiata».

<!-- figure: admin/account-password | La finestra Nuova password per prestiti -->

> [!IMPORTANT]
> La password non si rivede più: BiblioViva ne conserva soltanto una forma protetta. Annotarla in un posto sicuro e
> consegnarla di persona a chi usa l'account, non per posta elettronica né in una chat.

## Risultato

- L'account entra con la nuova password; la vecchia non vale più.
- Chi è collegato con quell'account in quel momento deve entrare di nuovo.

## Possibili problemi

- Compare «La password deve avere almeno 8 caratteri.»: scegliere una password più lunga.
- Compare «Le due password non coincidono.»: riscrivere la password nel campo **Ripeti la password**.
- Il pulsante **Salva** resta spento: uno dei due campi è vuoto o la password è troppo corta.
- La password di `admin` è stata persa e non si riesce a entrare: serve una procedura tecnica, descritta nella pagina
  [Deployment notes](../../../deploy.md#installing-updating-logs-step-85) (in inglese), alla voce «Forgotten admin
  password». Per tutti gli altri account basta entrare con `admin` e seguire i passi sopra.
- La scheda dell'account mostra «Password in chiaro nel file»: la password è scritta a mano nei file della
  configurazione. Seguire i passi sopra per sostituirla con una password protetta.

## Pagine correlate

- [Gestire gli account del personale](manage-accounts.md)
- [Togliere i dati dimostrativi](remove-demo-data.md)
- [Account del personale](../screens/users.md)
