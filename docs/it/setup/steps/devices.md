# Collegare i dispositivi

Questo passo, da fare dopo la prima configurazione nel browser (passo 5), collega a BiblioViva il computer del banco
e, se servono, gli altri computer, i tablet e i telefoni, e consegna al personale gli account per entrare. Il computer
del banco richiede circa 10 minuti; ogni altro dispositivo circa 5 minuti.

## Occorrente

<!-- variant: tailscale -->
**Con Tailscale**

- L'account di Tailscale della scuola, quello aperto al passo 3 (l'indirizzo con cui si accede e, se serve, la persona
  che lo conosce).
- Il nome della rete della scuola che finisce con `.ts.net`, annotato al passo 3.
- Le password degli account di BiblioViva, annotate alla fine del passo 5.
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

- L'indirizzo riservato al computer di BiblioViva, annotato al passo 3 (per esempio `192.168.1.50`), oppure quello
  stampato da `setup.sh` al passo 4.
- Le password degli account di BiblioViva, annotate alla fine del passo 5.
- Ogni computer collegato alla rete della scuola, con un browser.
<!-- /variant -->

## Procedura

<!-- variant: tailscale -->
**Con Tailscale**

### Installare Tailscale

Su ogni dispositivo che deve usare BiblioViva va installata l'applicazione di Tailscale, con l'accesso fatto
all'account della scuola. Il computer usato per il primo avvio (passo 5) l'ha già: per quello si passa alla sezione
successiva.

1. Aprire la pagina di scaricamento del sistema del dispositivo:
   [Windows](https://tailscale.com/download/windows), [macOS](https://tailscale.com/download/mac),
   [Linux](https://tailscale.com/download/linux), [Android](https://tailscale.com/download/android),
   [iPhone e iPad](https://tailscale.com/download/ios). Per un Chromebook vedere la pagina
   [Download](https://tailscale.com/download). [VERIFY: la pagina di Tailscale per ChromeOS]
1. Installare l'applicazione seguendo le indicazioni della pagina.
1. Aprire l'applicazione ed effettuare l'accesso con l'account di Tailscale della scuola, lo stesso del passo 3.
   [VERIFY: il testo del pulsante di accesso dell'applicazione, diverso tra Windows, macOS e Linux]

### Il computer del banco

1. Se Tailscale non è già installato su questo computer, installarlo come descritto sopra.
1. Aprire nel browser l'indirizzo `https://biblioviva.<tailnet>.ts.net`, sostituendo `<tailnet>` con il nome annotato
   al passo 3 (il nome si legge anche nella pagina «DNS» della
   [console di Tailscale](https://login.tailscale.com/admin/dns)). Si apre la pagina **Accesso** di BiblioViva, con il
   lucchetto del browser.

   <!-- figure: login/login | La pagina di accesso di BiblioViva -->

1. Aggiungere l'indirizzo ai segnalibri del browser.

### Altri computer, tablet e telefoni

Per ogni altro dispositivo che deve usare BiblioViva:

1. Installare Tailscale come descritto sopra.
1. Aprire nel browser l'indirizzo `https://biblioviva.<tailnet>.ts.net`.
1. Aggiungere l'indirizzo ai segnalibri.

### Installare BiblioViva come applicazione sul telefono (facoltativo)

Un telefono con Tailscale può avere BiblioViva come applicazione con la sua icona. Non serve per lavorare al banco,
dove il lettore di codici a barre USB è lo strumento normale.

1. Aprire l'indirizzo `https://biblioviva.<tailnet>.ts.net` nel browser del telefono ed entrare.
1. Nella **Dashboard** premere **Installa** nel riquadro **Aggiungi alla schermata Home**. Se il riquadro non compare,
   aprire il menu del browser e scegliere "Installa app" oppure "Aggiungi alla schermata Home", secondo il browser.
   [VERIFY: il nome della voce nel menu del browser di Android e di iPhone]
1. Confermare il nome proposto. L'icona di BiblioViva compare tra le applicazioni del telefono.

<!-- screenshot: phone/install-app | Il menu del browser del telefono con la voce per installare BiblioViva -->
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

### Il computer del banco

1. Aprire nel browser l'indirizzo `http://biblioviva.local:8080`. Si apre la pagina **Accesso** di BiblioViva.

   <!-- figure: login/login | La pagina di accesso di BiblioViva -->

1. Se non si apre, aprire al suo posto `http://<indirizzo>:8080`, sostituendo `<indirizzo>` con quello annotato al
   passo 3 (per esempio `http://192.168.1.50:8080`).
1. Aggiungere l'indirizzo che funziona ai segnalibri del browser.

### Altri computer

1. Aprire l'indirizzo che ha funzionato sul computer del banco da ogni altro computer collegato alla rete della scuola.
   Un computer fuori dalla rete della scuola non lo raggiunge.
1. Aggiungere l'indirizzo ai segnalibri.

> [!NOTE]
> Con la rete locale il browser non permette la fotocamera né l'installazione di BiblioViva come applicazione sul
> telefono: il motivo è l'indirizzo senza lucchetto. Si può passare a Tailscale più avanti; vedere
> [Scegliere la rete](../choose-network.md).
<!-- /variant -->

### Gli account del personale

I dispositivi dei due modi usano gli stessi account: uno per ruolo, condivisi, ognuno con il solo lavoro del suo ruolo.
Gli account e le password sono quelli scelti o generati al passo 5; la tabella è nella sezione
[Password](first-run.md#password) di quel passo.

1. Consegnare di persona a ogni collega la password dell'account del suo ruolo, a voce o su un foglio. Non spedirla per posta
   elettronica né in una chat.
1. Entrare con l'account del ruolo: nella pagina **Accesso** scrivere il **Nome utente** e la **Password**, poi
   premere **Entra**.

Per cambiare una password più avanti vedere i possibili problemi del passo [Primo avvio](first-run.md).

## Verifica prima di proseguire

<!-- variant: tailscale -->
**Con Tailscale**

- Sul computer del banco l'indirizzo `https://biblioviva.<tailnet>.ts.net` apre la pagina **Accesso** con il
  lucchetto.
- Con il nome utente `admin` e la sua password si entra e si apre la pagina iniziale di BiblioViva.
- Ogni altro dispositivo ha l'applicazione di Tailscale con l'accesso fatto e apre lo stesso indirizzo.

Se l'indirizzo non si apre, si vedano i possibili problemi qui sotto e
[Problemi comuni](../../help/problems.md#indirizzo-che-non-si-apre).
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

- Sul computer del banco `http://biblioviva.local:8080` o `http://<indirizzo>:8080` apre la pagina **Accesso**.
- Con il nome utente `admin` e la sua password si entra e si apre la pagina iniziale di BiblioViva.
- Dagli altri computer della rete lo stesso indirizzo si apre.

Se l'indirizzo non si apre, si vedano i possibili problemi qui sotto e
[Problemi comuni](../../help/problems.md#indirizzo-che-non-si-apre).
<!-- /variant -->

## Possibili problemi

<!-- variant: tailscale -->
**Con Tailscale**

- Il browser non trova `biblioviva.<tailnet>.ts.net`: l'applicazione di Tailscale non è attiva sul dispositivo, oppure
  è collegata a un altro account, oppure MagicDNS è spento nella pagina «DNS» della console (passo 3).
- Il lucchetto manca o il browser segnala un certificato non valido: i certificati HTTPS non sono attivi nella pagina
  «DNS» della console (passo 3).
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

- `biblioviva.local` non si apre su un computer: usare l'indirizzo con il numero. Se non è più quello annotato
  (l'indirizzo non era riservato, vedere il passo 3), leggerlo sul computer di BiblioViva con il comando seguente, che
  stampa gli indirizzi del computer; il primo è lo stesso che il programma di installazione scrive alla fine del
  passo 4.

  ```sh
  hostname -I
  ```
- L'indirizzo con il numero non si apre dagli altri computer: la porta `8080` può essere bloccata nella rete; chiedere a
  chi la gestisce (passo 3).
<!-- /variant -->

## Pagine correlate

- Passo precedente: [Primo avvio](first-run.md)
- Passo successivo: [Provare il lettore e la stampante](scanner-printer.md)
- [Problemi comuni](../../help/problems.md)
