# Scegliere la rete

BiblioViva si raggiunge dal browser, e l'installazione offre due vie per farlo: Tailscale oppure la rete locale della
scuola. Questa pagina le confronta per aiutare chi installa a sceglierne una; nessuna delle due è sbagliata.

## Confronto

| | Tailscale | Rete locale |
|---|---|---|
| Che cos'è | Una rete privata tra i dispositivi della scuola, creata da un servizio gratuito | La rete della scuola, già esistente |
| Indirizzo | `https://biblioviva.<tailnet>.ts.net` | `http://biblioviva.local:8080` oppure `http://<indirizzo del computer>:8080` |
| Fotocamera (foto degli utenti, copertine, lettura con il telefono) | Funziona | Non funziona: il browser la nega sulle pagine senza HTTPS |
| Installazione come app sul telefono | Possibile | Non possibile |
| Uso da fuori scuola | Possibile, da ogni dispositivo con Tailscale | No: solo dentro la rete della scuola |
| Account | Un account Tailscale gratuito per la scuola | Nessuno |
| Internet | Necessario | Non necessario per usare BiblioViva |
| Dispositivi | Su ognuno va installata e collegata l'app di Tailscale | Nessuna installazione: basta il browser |

Con entrambe le vie funzionano il banco prestiti, il catalogo, le tessere, le stampe, i report e
l'amministrazione, con il lettore di codici a barre USB, che scrive come una tastiera, e con il caricamento di file
(foto, copertine, elenchi da importare).

## Tailscale

[Tailscale](https://tailscale.com/) collega i dispositivi della scuola in una rete privata attraverso internet. Il
computer di BiblioViva ottiene un indirizzo con un vero certificato HTTPS, e per questo il browser ne accetta le
funzioni riservate alle pagine sicure.

Tailscale è la via completa. È adatta a chi:

- vuole usare la fotocamera, per esempio per fotografare le copertine o leggere un codice con il telefono;
- vuole installare BiblioViva come app sul telefono o sul tablet;
- vuole poter lavorare anche da casa o da un altro edificio;
- può creare un account gratuito e installare un'app su ogni dispositivo che usa BiblioViva.

L'indirizzo `https://biblioviva.<tailnet>.ts.net` funziona solo da un dispositivo che ha l'app di Tailscale, con
l'account della scuola. Il computer della scuola e la connessione a internet devono funzionare perché ci si colleghi.

### Account Tailscale della scuola

Un account Tailscale può essere usato in due modi.

1. Un account della scuola, usato su ogni dispositivo. Si crea un solo account gratuito, per esempio con
   l'indirizzo di posta della biblioteca, e lo si usa per accedere dal computer del banco, dal telefono e dal tablet. È il modo
   più semplice e rientra nel piano gratuito, i cui limiti sono sulla pagina dei
   [prezzi di Tailscale](https://tailscale.com/pricing).
1. Account personali invitati. Ogni persona usa il proprio account Tailscale e riceve un invito alla rete della
   scuola. Si tiene così traccia di chi si collega e si può togliere l'accesso a una persona sola, ma l'amministrazione
   è più laboriosa e il piano gratuito limita il numero di utenti (vedere la pagina dei prezzi).

Per una biblioteca scolastica il primo modo è quello consigliato. Gli utenti di Tailscale e quelli di BiblioViva sono
cose distinte: chi usa BiblioViva accede con uno degli account condivisi dei ruoli (`admin`, `prestiti`, `catalogo`,
`tessere`, `report`), qualunque sia l'account Tailscale con cui si collega la rete.

Il passo [Preparare la rete](steps/network.md) descrive la creazione dell'account.

## Rete locale

Con la rete locale BiblioViva è raggiungibile da ogni dispositivo collegato alla rete della scuola, senza account e
senza installare nulla: basta aprire l'indirizzo nel browser. È la via di base.

La rete locale è adatta a chi:

- lavora solo al banco prestiti e in biblioteca, con il lettore di codici a barre USB;
- preferisce non creare account né installare app;
- non ha bisogno della fotocamera né dell'uso da fuori scuola.

Due cautele valgono per questa via.

- Il collegamento non è cifrato (HTTP): le password dei ruoli viaggiano in chiaro sulla rete. La via è adatta a una
  rete di cui la scuola si fida.
- L'indirizzo del computer non deve cambiare nel tempo. Si chiede a chi gestisce la rete della scuola di riservare al
  computer un indirizzo fisso sul router. Il nome `biblioviva.local` funziona in molti casi senza altro, ma non su
  tutti i dispositivi; in tal caso si usa l'indirizzo numerico, per esempio `http://192.168.1.50:8080`.

Il passo [Preparare la rete](steps/network.md) descrive la riserva dell'indirizzo.

## Cambiare via più avanti

La scelta non è definitiva. Si può cominciare con la rete locale e passare a Tailscale quando serve la fotocamera,
conservando tutti i dati: vedere [Passare dalla rete locale a Tailscale](lan-to-tailscale.md). Anche il percorso
inverso, da Tailscale alla rete locale, conserva i dati ed è descritto nella stessa pagina, nella sezione
[La strada inversa: da Tailscale alla rete locale](lan-to-tailscale.md#la-strada-inversa-da-tailscale-alla-rete-locale).

## Pagine correlate

- [Scegliere il computer](choose-computer.md)
- [Occorrente](material.md)
- [Installazione](README.md)
- [Problemi comuni](../help/problems.md)
