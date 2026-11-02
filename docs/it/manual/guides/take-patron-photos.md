# Fare le foto degli utenti

Questa pagina spiega come fare la foto agli utenti che ancora non l'hanno, una persona alla volta: classe per classe con
il censimento, oppure dalla scheda di un singolo utente. La foto compare sulla tessera e nella scheda. Per ricavare le
foto di una classe intera da un'unica immagine vedere [Ricavare le foto da un'immagine della
classe](photos-from-class-picture.md).

- Tempo: circa 15 minuti per una classe di 25 alunni, circa 1 minuto per una persona sola.
- Account: Tessere e foto (anche Amministrazione).
- Occorrente: una fotocamera collegata al computer, oppure i file con le foto già salvati sul computer.
- La fotocamera funziona solo con una connessione sicura, cioè con Tailscale. Nell'installazione solo sulla rete locale
  le foto si caricano come file.
- L'amministratore può disattivare le foto. In quel caso la scheda **Censimento foto** e il pulsante **Foto** non
  esistono e questa pagina non serve.

## Procedura

### Fotografare una classe, una persona dopo l'altra

1. Accedere a BiblioViva con l'account Tessere e foto.
1. Aprire **Utenti**.
1. Aprire la scheda **Censimento foto**. La pagina elenca le liste di utenti e le classi, ognuna con i numeri delle foto
   già fatte, per esempio «12 di 14 con foto». Compaiono solo le classi e le liste in cui manca almeno una foto.

   <!-- figure: census/start | La pagina Censimento foto con le classi in cui manca almeno una foto -->

1. Scegliere la classe. Per cercare una persona sola, scrivere il cognome nel campo **Cerca per cognome**.
1. Sotto **Una persona alla volta** premere il nome della prima persona. Si apre un riquadro con il nome in alto e la
   fotocamera accesa.

   <!-- figure: census/camera-stage | Il riquadro del censimento con il nome della persona e la fotocamera accesa -->

1. Inquadrare il viso e premere **Scatta foto**. Senza fotocamera premere **Carica file** e scegliere il file di quella
   persona.
1. Trascinare l'immagine per mettere il viso nel riquadro verticale e, se serve, avvicinare con **Zoom**.
1. Premere **Usa questa foto**. Compare l'avviso «Foto salvata» con il nome e si apre subito la persona successiva che
   non ha la foto.
1. Ripetere dalla fase di scatto fino all'ultima persona. Per passare alla persona seguente senza fotografare questa,
   premere **Salta**. Per chiudere il riquadro prima della fine, premere **Fine**.

Se manca un alunno nell'elenco di una classe, premere **Nuovo utente** in fondo alla pagina della classe, scrivere
**Cognome** e **Nome** e premere **Aggiungi e fotografa**: l'alunno viene aggiunto alla classe e la sua foto è la
prossima.

### Fotografare una persona sola

1. Aprire **Utenti** e cercare la persona scrivendo almeno tre lettere del cognome nel campo **Cerca per cognome…**.
1. Premere la riga della persona. Si apre la **Scheda dell'utente**.
1. Sotto la foto, o il segnaposto grigio, premere **Foto**. Si apre il riquadro **Foto**.

   <!-- figure: patrons/photo-panel | La scheda dell'utente con il riquadro Foto aperto -->

1. Premere **Scatta foto**, oppure **Carica file** per scegliere un file.
1. Inquadrare il viso con il trascinamento e **Zoom**.
1. Premere **Usa questa foto**. Compare l'avviso «Foto salvata».

Per cambiare una foto si ripete la stessa procedura: la nuova sostituisce la vecchia. Per toglierla, premere
**Elimina foto** e confermare con **Elimina foto** nella finestra «Eliminare la foto?».

### Con il telefono (facoltativo)

Il telefono non serve. Se l'installazione usa Tailscale, il censimento si può fare anche con la fotocamera del telefono:
aprire BiblioViva dal telefono e seguire gli stessi passi. Su un telefono il riquadro del censimento occupa tutto lo
schermo, così si lavora con una mano sola.

## Risultato

Nell'elenco del censimento la persona ha la sua miniatura e il numero «N di M con foto» sale. Quando tutti hanno la foto
compare «Tutti hanno la foto.». Se l'amministratore ha attivato il promemoria delle foto, nella pagina **Utenti**
sparisce l'avviso «senza foto» dalla riga e nella Dashboard scende il numero **Utenti senza foto**. La foto compare
nella scheda e sulle tessere stampate da quel momento.

## Possibili problemi

### Una classe non compare nel censimento

Tutte le sue foto sono già fatte («Tutte le classi e le liste hanno le foto.»). Per rifare una foto singola usare la
scheda dell'utente.

### La fotocamera richiede una connessione sicura

Compare «La fotocamera funziona solo con una connessione sicura (https)…»: la rete locale senza Tailscale non permette
la fotocamera. Usare **Carica file**, oppure aprire BiblioViva dall'indirizzo di Tailscale.

### Il permesso della fotocamera è negato

Compare «Permesso negato: consentire l'uso della fotocamera nelle impostazioni del browser e riprovare.»: aprire le
impostazioni del sito nel browser (l'icona vicino all'indirizzo), consentire la fotocamera e ricaricare la pagina.

### Nessuna fotocamera trovata o fotocamera già in uso

Compaiono «Nessuna fotocamera trovata su questo dispositivo.» o «La fotocamera è già in uso da un'altra app.»: collegare
la fotocamera o chiudere l'altro programma che la usa; altrimenti usare **Carica file**.

### La fotocamera non risponde

Compare «La fotocamera non ha risposto…»: il browser potrebbe ancora chiedere il permesso, o il permesso è stato negato
in precedenza per questo sito.

### Il file non viene accettato

Compaiono «File troppo grande: il limite è … MB.», «Il file non è un'immagine leggibile.» o «Formato immagine non
supportato (sono ammessi JPEG, PNG, WebP e HEIC).»: scegliere un altro file.

### Manca la scheda Censimento foto

Non esiste la scheda **Censimento foto**: l'amministratore ha disattivato le foto, come spiega [Disattivare le foto o le
copertine](../../admin/guides/switch-off-photos-or-covers.md).

## Pagine correlate

- [Ricavare le foto da un'immagine della classe](photos-from-class-picture.md)
- [Importare le foto degli utenti](../../admin/guides/import-photos.md), per le foto già archiviate in un altro
  programma
- [Stampare le tessere di una classe](print-class-cards.md)
- [Censimento foto](../screens/census.md)
