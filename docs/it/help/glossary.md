# Glossario

Questo glossario spiega in poche parole i termini di BiblioViva e dell'installazione, in ordine alfabetico. Serve a chi
lavora al banco e a chi installa il programma e incontra una parola che non conosce.

## Account condiviso

Un account di BiblioViva usato da più persone invece che da una sola. BiblioViva ne ha cinque, uno per ruolo, creati
alla prima configurazione: `admin` (tutto), `prestiti` (il banco prestiti, mostrato come «Gestione prestiti»),
`catalogo` (il catalogo), `tessere` (gli utenti e le tessere) e `report` (i report). Ogni account permette soltanto il
lavoro del suo ruolo. Le password si consegnano di persona; si cambiano da **Amministrazione** → **Account del
personale**. Vedere [Collegare i dispositivi](../setup/steps/devices.md).

## Backup (copia di sicurezza)

Una copia dei dati della biblioteca (libri, copie, utenti, prestiti, foto e copertine) da usare se i dati originali
si perdono o si rovinano. BiblioViva ne fa una ogni notte e le tiene per 30 giorni di norma, nella cartella `backups`
accanto ai file dell'installazione; si vedono e si scaricano da **Amministrazione** → **Backup**. Una copia che resta solo sul
computer di BiblioViva non protegge da un guasto del computer: conviene portarne una su una chiavetta o su un disco di
rete. Vedere [Copie di sicurezza](../setup/steps/backups.md).

## Code 128 e Code 39

I due tipi di codice a barre che BiblioViva legge. Le tessere e le etichette nuove sono stampate in Code 128; il Code 39
è accettato in lettura perché lo usavano tessere ed etichette più vecchie. Il lettore di codici a barre li legge
entrambi senza impostazioni.

## Copia

Il singolo libro che sta sullo scaffale, con il suo codice a barre; un titolo può averne più d'una. Al banco si presta e
si restituisce una copia, non il titolo. La parola «esemplare» non si usa. Il codice a barre della copia non
coincide mai con il numero di una tessera.

## Dati dimostrativi

Utenti, libri, copie e prestiti inventati, che la configurazione guidata carica se si sceglie **Carica dati
dimostrativi**. Servono a provare BiblioViva prima di inserire i dati veri. Con i dati dimostrativi tutti gli account
usano la stessa password, nota a chiunque: vanno tolti, con **Svuota dati dimostrativi** in **Amministrazione**, prima
di usare BiblioViva davvero.

## Docker

Il programma che fa girare BiblioViva in un contenitore chiuso, separato dal resto del computer, con tutto ciò che gli
serve. Grazie a Docker l'installazione è la stessa su un PC e su un Raspberry Pi, e l'aggiornamento sostituisce il
contenitore senza toccare i dati. Il programma di installazione lo mette sul computer se manca. Vedere
[Installare BiblioViva](../setup/steps/install.md) e la
[documentazione ufficiale di Docker](https://docs.docker.com/get-started/docker-overview/).

## Fascetta del dorso

La striscia adesiva che si incolla sul dorso di un libro e porta la segnatura, con un pittogramma che indica il genere o
l'argomento. Si stampa insieme all'etichetta con il codice a barre,
in una coppia per libro. Vedere [Stampare le etichette dei libri](../manual/guides/print-book-labels.md).

## HTTPS

Il modo sicuro di aprire una pagina web: l'indirizzo comincia con `https://` e il browser mostra un lucchetto. I
browser permettono la fotocamera e l'installazione come applicazione soltanto alle pagine con HTTPS. Con Tailscale
BiblioViva ha un indirizzo HTTPS; con la rete locale l'indirizzo comincia con `http://`, senza lucchetto, e per questo la
fotocamera non funziona. Vedere [Scegliere la rete](../setup/choose-network.md).

## ISBN

Il numero internazionale che identifica un'edizione di un libro, di solito di 13 cifre, stampato sul retro sopra il
codice a barre. In BiblioViva serve a cercare i dati del libro (titolo, autore, editore) quando lo si cataloga. Si legge
con il lettore di codici a barre nel campo di ricerca o di catalogazione.

## Lettore di codici a barre

L'apparecchio USB che legge i codici a barre di tessere, copie e libri. Si collega al computer del banco e si comporta
come una tastiera: scrive il codice letto nel campo attivo e preme Invio. È lo strumento normale di BiblioViva; il
telefono con la fotocamera è un'aggiunta facoltativa. Se scrive caratteri sbagliati al posto del trattino, vedere
[Lettore che scrive caratteri strani](problems.md#lettore-che-scrive-caratteri-strani).

## Livello di lettura

Un codice, di una scala propria della biblioteca, che indica a che livello di difficoltà è scritto un libro di
narrativa, per consigliarlo a chi ha un certo grado di lettura. Sta sulla scheda del libro oppure, se la biblioteca
sceglie così, su ogni copia. La scala si modifica da **Amministrazione**.

## MagicDNS

La funzione di Tailscale che dà ai dispositivi un nome leggibile al posto di un numero, così che BiblioViva si apra con
`biblioviva.<tailnet>.ts.net`. Si controlla nella pagina «DNS» della console di Tailscale e deve essere attiva. Vedere
la pagina ufficiale [MagicDNS](https://tailscale.com/kb/1081/magicdns).

## Nome del computer

Il nome con cui il computer si presenta nella rete. In questa guida il computer di BiblioViva si chiama `biblioviva`: si
sceglie quando si prepara il computer e serve per raggiungerlo con SSH e, con la rete locale, per l'indirizzo
`biblioviva.local`. Vedere [Preparare il computer](../setup/steps/prepare-computer.md).

## Nome .local

L'indirizzo fatto con il nome del computer seguito da `.local`, per esempio `biblioviva.local`, che funziona nella
rete della scuola al posto del numero. Lo rende possibile un servizio del computer (`avahi-daemon`, che il programma di
installazione aggiunge se manca) e il dispositivo che apre l'indirizzo deve saperlo risolvere: alcuni non ci riescono,
e allora si usa l'indirizzo numerico. Vedere
[Indirizzo che non si apre](problems.md#indirizzo-che-non-si-apre).

## Prenotazione DHCP

La richiesta al router di dare sempre lo stesso indirizzo numerico a un certo computer; si chiama anche «indirizzo
riservato» o «prenotazione dell'indirizzo». Senza di essa l'indirizzo può cambiare a ogni riavvio, e i segnalibri che
usano il numero smettono di funzionare. Si chiede a chi gestisce la rete della scuola, dando il nome del computer.
Vedere [Preparare la rete](../setup/steps/network.md).

## Profilo di prestazioni

La scelta che dice a BiblioViva quanto è potente il computer su cui gira, in modo che chieda la giusta quantità di
memoria e di lavoro. I profili sono quattro: `micro` (computer minimo, 512 MB), `small` (Raspberry Pi 4 con 2 GB e scheda
SD), `medium` (PC non recente con disco rigido) e `large` (PC con disco SSD). Un profilo troppo alto per un computer
piccolo lo rende lento. Lo propone il programma di installazione; si cambia da **Amministrazione** →
**Configurazione** → **Prestazioni**, nel campo **Computer**. Vedere
[Installare BiblioViva](../setup/steps/install.md).

## Rete locale

La rete della scuola, già esistente, a cui sono collegati i computer. È una delle due vie per raggiungere BiblioViva:
non richiede alcun account e funziona senza internet, ma solo dentro la scuola, senza fotocamera e senza
installazione come applicazione. L'altra via è Tailscale. Vedere [Scegliere la rete](../setup/choose-network.md).

## Segnatura

La sigla che dice dove sta un libro sugli scaffali, per esempio `B 4 DEL`. BiblioViva la calcola dalla classificazione,
dal livello di lettura e dalle prime tre lettere del cognome dell'autore; per un libro di autore «Anonimo» o «AA. VV.»
usa le prime tre lettere del titolo. La forma dipende dallo schema scelto dalla biblioteca. Compare sulla scheda della
copia e sulla fascetta del dorso. In BiblioViva si usa sempre questa parola, e non «collocazione». Vedere
[Classificare i libri](../manual/guides/classify-books.md).

## Tailnet

Il nome della rete privata che Tailscale crea per la scuola, tra i suoi dispositivi. Finisce con `.ts.net` e si legge
nella pagina «DNS» della console di Tailscale; compare nell'indirizzo di BiblioViva, `biblioviva.<tailnet>.ts.net`. Vedere
[Preparare la rete](../setup/steps/network.md) e la pagina ufficiale
[Tailnet name](https://tailscale.com/kb/1217/tailnet-name).

## Tailscale

Il servizio, gratuito per un uso come questo, che collega in una rete privata i dispositivi della scuola attraverso
internet e dà a BiblioViva un indirizzo con il lucchetto. Con Tailscale funzionano la fotocamera, l'installazione sul
telefono e l'uso da fuori scuola; su ogni dispositivo va installata la sua applicazione. Non è obbligatorio: la rete
locale è l'alternativa. Vedere [Scegliere la rete](../setup/choose-network.md) e il sito ufficiale
[Tailscale](https://tailscale.com/).

## Terminale

La finestra di testo in cui si scrive un comando e si legge la risposta del computer. I comandi dell'installazione si
copiano e si incollano nel terminale del computer di BiblioViva; con un Raspberry Pi, che non ha tastiera né schermo, il
terminale si apre da un altro computer con SSH, un programma che collega i due computer attraverso la rete. Vedere
[Collegarsi al computer](../setup/steps/terminal.md).

## Tessera

Il cartoncino con il codice a barre che identifica un utente. Al banco si legge la tessera con il lettore e poi si
leggono le copie da prestare. Il numero della tessera non può mai coincidere con il codice di una copia. Si stampa
dalla pagina **Utenti**; il modello si modifica da **Amministrazione**.

## Utente

Chi prende in prestito i libri: un alunno o un docente. Non entra in BiblioViva, che è usato soltanto dal personale della
biblioteca: l'utente è una scheda con la classe e la tessera. Non va confuso con l'account del personale, né con
l'utente del computer, il nome con cui si accede al sistema del computer.

## Volume

Una cartella in cui BiblioViva tiene i suoi dati, fuori dal contenitore, così che sopravvivano agli aggiornamenti. I
volumi sono tre: la configurazione (`config`, impostazioni e modelli di stampa), i dati (database, foto, copertine) e le
copie di sicurezza (`backups`, la cartella accanto ai file dell'installazione, che si copia come una cartella
qualsiasi). Vedere [Copie di sicurezza](../setup/steps/backups.md) e, per i dettagli, la pagina tecnica
[Deployment notes](../../deploy.md#volumes) (in inglese).
