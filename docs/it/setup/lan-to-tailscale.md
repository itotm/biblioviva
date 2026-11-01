# Passare dalla rete locale a Tailscale

Questa pagina spiega come cambiare il modo in cui i dispositivi raggiungono BiblioViva, dalla rete locale della scuola a
Tailscale, per ottenere la fotocamera, l'installazione sul telefono e l'uso da fuori della scuola. In fondo è descritta
la strada inversa. I dati restano: utenti, libri, prestiti, foto e impostazioni non si toccano.

- Tempo: circa 30 minuti, più il tempo di mettere Tailscale sui dispositivi.
- Occorrente: il terminale del computer di BiblioViva (vedere [Collegarsi al computer](steps/terminal.md)), un account
  Tailscale della scuola e l'account `admin` di BiblioViva per la copia di sicurezza.
- BiblioViva resta fermo per alcuni minuti durante il passaggio: farlo quando nessuno lavora al banco.

## Procedura

### Fare una copia di sicurezza

1. Fare una copia di sicurezza con **Esegui backup ora**, come descritto nella sezione
   [Fare una copia subito](steps/backups.md#fare-una-copia-subito) del passo [Copie di sicurezza](steps/backups.md).

### Preparare Tailscale

1. Eseguire la parte «Con Tailscale» del passo [Preparare la rete](steps/network.md): l'account della scuola, i
   certificati HTTPS, l'etichetta del computer e la chiave di accesso. Alla fine servono la chiave, che inizia con
   `tskey-auth-`, e il nome della rete della scuola, che finisce con `.ts.net`.

### Cambiare il modo di collegamento

1. Aprire il terminale del computer di BiblioViva.
1. Copiare il comando seguente, incollarlo e premere Invio. L'opzione `--network tailscale` dice al programma di
   installazione di cambiare il modo di collegamento di un'installazione che esiste già; `--lang it` lo fa scrivere in
   italiano.

   ```sh
   curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang it --network tailscale
   ```

1. Il programma riconosce l'installazione e scrive che i dati restano.

   ```
   BiblioViva è già installato in /home/<utente>/biblioviva (lan): aggiornamento.
   Cambio del modo di collegamento: da lan a tailscale. I dati restano.
   ```

1. Quando il programma chiede la chiave, incollarla e premere Invio. È l'unica domanda: il tipo di computer e il resto
   restano come erano.

   ```
   Incollare la chiave di autenticazione di Tailscale (inizia con tskey-auth-):
   ```

1. Attendere «BiblioViva è pronto.» e annotare l'indirizzo `https://biblioviva.<tailnet>.ts.net` che il programma
   scrive. La prima apertura può richiedere qualche secondo.

### Mettere Tailscale sui dispositivi

1. Installare Tailscale e accedere con l'account della scuola su ogni dispositivo che usa BiblioViva, come
   descritto nella sezione [Installare Tailscale](steps/devices.md#installare-tailscale) del passo
   [Collegare i dispositivi](steps/devices.md).
1. Sostituire nei segnalibri e nei collegamenti l'indirizzo `http://…:8080` con quello che il programma ha scritto: il
   vecchio non funziona più.
1. Accedere di nuovo a BiblioViva con il proprio account, perché l'indirizzo è un altro.

## La strada inversa: da Tailscale alla rete locale

1. Preparare la rete locale: l'indirizzo riservato al computer, come nel passo [Preparare la rete](steps/network.md),
   variante con la rete locale.
1. Nel terminale del computer di BiblioViva, eseguire il comando seguente. Il programma non chiede nulla.

   ```sh
   curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang it --network lan
   ```

1. Annotare gli indirizzi `http://biblioviva.local:8080` e `http://<indirizzo>:8080` che il programma scrive.
1. Eliminare dalla console di Tailscale la macchina `biblioviva`, che resta nell'elenco ma fuori linea, come descritto
   nella sezione [Con Tailscale: liberare il nome](move.md#con-tailscale-liberare-il-nome) di
   [Spostare BiblioViva su un altro computer](move.md).

Con la rete locale la fotocamera, l'installazione come applicazione e l'accesso da fuori della scuola non funzionano
più; il lettore di codici a barre USB e il resto di BiblioViva continuano a funzionare. Il confronto è in
[Scegliere la rete](choose-network.md).

## Risultato

BiblioViva risponde all'indirizzo di Tailscale, con gli stessi dati di prima. Con Tailscale la fotocamera parte nei punti in cui
serve (foto degli utenti, copertine).

## Possibili problemi

- Il programma non scrive «Cambio del modo di collegamento…» ma fa le domande dell'installazione iniziale: la cartella
  `biblioviva` non è quella dell'utente con cui ci si è collegati. Usare lo stesso utente dell'installazione.
- «Il nodo è nella tailnet, ma i certificati HTTPS non sono attivi…»: attivare «HTTPS Certificates» nella pagina «DNS»
  della console di Tailscale e ripetere il comando (vedere [Installare
  BiblioViva](steps/install.md#possibili-problemi)).
- Il comando non accetta le opzioni: il testo `bash -s --` prima delle opzioni serve a passarle al programma;
  copiare il comando per intero.

## Pagine correlate

- [Scegliere la rete](choose-network.md)
- [Preparare la rete](steps/network.md)
- [Collegare i dispositivi](steps/devices.md)
- [Installare BiblioViva](steps/install.md)
