# Occorrente

Questa pagina elenca tutto ciò che serve per installare BiblioViva e per usarlo al banco prestiti, con i collegamenti
alle pagine ufficiali dove acquistare o scaricare. Si rivolge a chi prepara l'acquisto del
materiale.

## Il computer

Il tipo di computer si sceglie prima: vedere [Scegliere il computer](choose-computer.md). Il resto dell'elenco dipende
dalla scelta.

### Con un vecchio PC

- Un PC a 64 bit con almeno 2 GB di memoria e Linux installato o da installare (Debian o Ubuntu).
- Un altro computer e una chiavetta USB da 8 GB o più per scrivere l'installatore di Linux, se il PC non ha già Debian
  o Ubuntu.

### Con un Raspberry Pi

- Un [Raspberry Pi 4 o 5](https://www.raspberrypi.com/products/) con almeno 2 GB di memoria.
- Un alimentatore adatto al modello, preferibilmente quello ufficiale del Raspberry Pi: un alimentatore troppo debole
  provoca spegnimenti e blocchi.
- Una scheda microSD da 32 GB, di una marca nota: sulla scheda si scrivono il sistema e i dati di BiblioViva.
- Un involucro con dissipatore o ventola, consigliato per un computer sempre acceso.
- Un altro computer, con un lettore di schede microSD (anche con adattatore USB), per preparare la scheda con il
  programma [Raspberry Pi Imager](https://www.raspberrypi.com/software/).

## La rete

- Un cavo di rete tra il computer di BiblioViva e il router, da preferire al Wi-Fi: la connessione è più stabile e
  l'indirizzo del computer più facile da tenere fisso. Il Wi-Fi funziona, se il cavo non è possibile.
- Con la rete locale: la possibilità di chiedere a chi gestisce la rete della scuola una riserva di indirizzo sul
  router.
- Con Tailscale: una connessione a internet e un indirizzo di posta per l'account. Vedere
  [Scegliere la rete](choose-network.md).

## Il lettore di codici a barre

Il lettore di codici a barre USB è il normale strumento di lavoro al banco prestiti: legge tessere, libri e ISBN.

- Un lettore USB che scrive come una tastiera (si dice anche modalità «HID»): collegato al computer, scrive il codice
  letto nel punto in cui si trova il cursore, seguito dal tasto Invio. Quasi tutti i lettori USB di uso comune lo
  fanno senza configurazione.
- Il lettore deve leggere i codici Code 128 (il formato che BiblioViva stampa) e Code 39 (il formato di molte tessere
  ed etichette di altri sistemi), entrambi abilitati. Il lettore deve poter aggiungere Invio dopo il codice.
- Un lettore con filo è più semplice di uno senza fili, che richiede ricarica e abbinamento.

Il passo [Provare il lettore e la stampante](steps/scanner-printer.md) indica come verificare la lettura e la
disposizione della tastiera.

## La stampante e la carta

- Una stampante laser o a getto d'inchiostro per fogli A4, collegata al computer da cui si stampa (il computer del
  banco), non a quello di BiblioViva.
- Fogli di etichette adesive per i libri. BiblioViva stampa di norma una coppia di etichette per ogni libro: la
  fascetta del dorso e l'etichetta con il codice a barre, su un foglio A4 da 18 etichette di 70 × 48 mm (3 colonne per
  6 righe), che dà 9 libri per foglio. Sono previsti anche fogli da 70 × 24 mm (3 × 12), da 63,5 × 33,9 mm (3 × 8) e da
  38,1 × 21,2 mm (5 × 13). La misura dei fogli posseduti si imposta in BiblioViva dall'amministrazione.
- Fogli per le tessere: fogli A4 da cui si ritagliano le tessere. BiblioViva stampa quattro tessere per foglio,
  ciascuna con fronte e retro affiancati, da piegare lungo il lato corto. Il formato di una tessera è quello delle
  carte di credito (85,6 × 54 mm). Carta comune o più spessa, e l'eventuale plastificazione, sono scelte della scuola
  [VERIFY: grammatura consigliata per i fogli delle tessere, da chiedere al proprietario].
- Forbici o taglierina e, se si vuole, una plastificatrice.

Il passo [Provare il lettore e la stampante](steps/scanner-printer.md) indica come stampare con la scala corretta.

## Il telefono

Un telefono o un tablet è facoltativo. Serve solo a chi sceglie Tailscale e vuole leggere un codice con la
fotocamera, fotografare gli utenti o le copertine, oppure installare BiblioViva come app. Il lettore di codici a barre
USB resta lo strumento normale.

## Pagine correlate

- [Scegliere il computer](choose-computer.md)
- [Scegliere la rete](choose-network.md)
- [Installazione](README.md)
