# Chiedere aiuto

Questa pagina spiega come segnalare un problema o fare una domanda sul sito del progetto, e che cosa scrivere perché
chi risponde possa capire che cosa è successo. Serve a chiunque usi BiblioViva, dopo aver provato le soluzioni di
[Problemi comuni](problems.md).

## Dove scrivere

Le segnalazioni si scrivono nella pagina delle segnalazioni del progetto su GitHub:
[github.com/itotm/biblioviva/issues](https://github.com/itotm/biblioviva/issues). Serve un account GitHub gratuito
([registrazione](https://github.com/signup)). Prima di scrivere conviene cercare nell'elenco: un problema uguale può
essere già stato segnalato.

## Che cosa scrivere

Una segnalazione utile contiene quattro cose.

1. La versione di BiblioViva. Si legge nella pagina **Informazioni**, alla riga **Versione**: la pagina si apre dal
   menu dell'account, in alto, oppure dal numero di versione in fondo alla barra laterale.
1. Che cosa si stava facendo, passo per passo, a partire dalla pagina da cui si è cominciato.
1. Che cosa è comparso: il testo esatto del messaggio, copiato o fotografato, oppure la descrizione di ciò che si è
   visto.
1. Che cosa ci si aspettava.

Aiutano anche il tipo di computer (PC, Raspberry Pi), il modo scelto per l'installazione (Tailscale o rete locale) e il
browser usato.

<!-- figure: about/about | La pagina Informazioni con la versione di BiblioViva -->

> [!IMPORTANT]
> Una segnalazione è pubblica: non scrivere né allegare nomi, cognomi, foto o numeri di tessera degli utenti, e nessuna
> password né chiave (per esempio la chiave di Tailscale o il contenuto del file `.env`). Nelle fotografie dello
> schermo coprire i nomi. Per descrivere un caso bastano parole come «un alunno» o «una copia».

## Il registro di diagnostica

Quando il problema resta oscuro, chi ha installato BiblioViva può attivare il registro di diagnostica, che scrive passo
per passo ciò che l'applicazione fa. Il registro non contiene nomi, foto né numeri di tessera, ma solo codici,
dimensioni ed esiti. Il procedimento usa il terminale del computer di BiblioViva
([Collegarsi al computer](../setup/steps/terminal.md)).

1. Aprire il file delle impostazioni con l'editor del terminale.

   ```sh
   nano ~/biblioviva/.env
   ```

1. Cambiare la riga `LOG_LEVEL=info` in `LOG_LEVEL=debug`. Salvare con Ctrl+O e Invio, poi uscire con Ctrl+X.
1. Riavviare BiblioViva con la nuova impostazione.

   ```sh
   cd ~/biblioviva && docker compose up -d
   ```

1. Ripetere l'operazione che dà il problema.
1. Leggere le righe del registro che portano la parola `debug`.

   ```sh
   cd ~/biblioviva && docker compose logs app | grep debug
   ```

1. Copiare nella segnalazione le righe che riguardano il momento del problema, senza altre.
1. Rimettere `LOG_LEVEL=info` e ripetere il comando del punto 3.

Le aree del registro e i comandi per leggerlo sono descritti nella pagina tecnica
[Deployment notes](../../deploy.md#installing-updating-logs-step-85) (in inglese).

## Pagine correlate

- [Problemi comuni](problems.md)
- [Glossario](glossary.md)
- [Aiuto](README.md)
