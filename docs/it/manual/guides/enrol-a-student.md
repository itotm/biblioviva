# Iscrivere un alunno

Questa pagina spiega come inserire in BiblioViva un alunno che non c'è ancora, con il numero della tessera e, se si
vuole, la foto. Serve a chi gestisce gli utenti, per esempio quando un alunno arriva ad anno scolastico iniziato. Per iscrivere
molti alunni in una volta, per esempio a settembre, esiste l'importazione descritta in [Importare gli
alunni](../../admin/guides/import-students.md).

- Tempo: circa 3 minuti, circa 5 con la foto.
- Account: Tessere e foto (anche Amministrazione).
- Occorrente: cognome, nome, anno e sezione dell'alunno. La classe deve già esistere: le classi le prepara
  l'amministratore. Facoltativi: la matricola (il codice del registro elettronico) e l'indirizzo email.
- Per la foto: un file con la foto dell'alunno oppure, solo con Tailscale, la fotocamera del computer. Se
  l'amministratore ha disattivato le foto, la pagina non ne parla e questa parte si salta.

## Procedura

### Compilare i dati

1. Accedere a BiblioViva con l'account Tessere e foto.
1. Aprire **Utenti**.
1. Premere **Nuovo utente**. Si apre la pagina **Nuovo utente**. La stessa pagina si apre anche dalla voce
   **Nuovo utente** delle azioni rapide della Dashboard.

   <!-- figure: patrons/new-student | La pagina Nuovo utente con la scheda Foto sopra il modulo -->

1. Controllare che in **Tipo** sia scelto **Studente**. È la scelta di partenza.
1. Scrivere il cognome nel campo **Cognome**.
1. Scrivere il nome nel campo **Nome**.
1. Scegliere in **Classe** l'anno dell'alunno.
1. Scegliere nel campo seguente la sezione. Dopo la scelta dell'anno, l'elenco mostra solo le sezioni di quell'anno. Il
   nome del campo è la parola scelta dalla scuola per la classe, di norma **Sezione**.
1. Lasciare vuoto il campo **Numero tessera**: BiblioViva assegna da sola il numero.
1. Se serve, scrivere il codice del registro elettronico nel campo **Matricola**.
1. Se serve, aprire la parte **Contatti** e scrivere l'indirizzo nel campo **Email**.
1. Se serve, aprire la parte **Note** e scrivere nel campo **Nota per il banco prestiti** un avviso breve. L'avviso
   compare in evidenza ogni volta che l'alunno prende un libro. Le altre annotazioni vanno in **Note interne** e restano
   nella scheda.

### Aggiungere la foto (facoltativo)

La scheda **Foto** si trova sopra il modulo. La foto si può anche fare dopo, dalla scheda dell'utente: vedere [Fare le
foto degli utenti](take-patron-photos.md).

1. Nella scheda **Foto** premere **Scatta foto**. Si apre il riquadro della fotocamera.
1. Inquadrare il viso dell'alunno e premere **Scatta foto**. Senza fotocamera, o senza Tailscale, premere
   **Carica file** e scegliere un file con la foto.
1. Trascinare l'immagine per mettere il viso nel riquadro verticale e, se serve, avvicinare con **Zoom**.
1. Premere **Usa questa foto**. La scheda **Foto** mostra l'anteprima e la scritta «Si salva insieme all'utente.».

Per sostituire la foto scelta premere **Rifai la foto**; per scartarla premere **Togli**.

### Salvare

1. Premere **Crea utente**. Si apre la **Scheda dell'utente**, con il nome, la classe e il numero della tessera.

### Stampare la tessera

1. Nella **Scheda dell'utente** aprire la scheda **Tessera**.
1. Premere **Stampa tessera** e seguire la finestra che si apre. Il taglio e la piegatura sono spiegati in [Stampare le
   tessere di una classe](print-class-cards.md#stampare-e-tagliare).
1. Dopo la stampa premere **Segna come stampata**. La stampa da sola non lo segna.

## Risultato

L'alunno compare in **Utenti**: scrivendo almeno tre lettere del cognome nel campo **Cerca per cognome…** la riga appare
con la classe e il numero della tessera. La scheda **Tessera** mostra il numero e il codice a barre, e la scritta
«Tessera non ancora stampata.» finché la tessera non viene segnata come stampata. Con la tessera in mano, l'alunno può
prendere libri al banco.

## Possibili problemi

- «Per uno studente la classe (il livello) è obbligatoria.» e «Per uno studente la sezione è obbligatoria.»: scegliere
  l'anno e la sezione prima di premere **Crea utente**.
- «Sezione non trovata tra le classi attive: le classi si creano in Amministrazione → Configurazione → Classi.»: la
  classe non esiste. Chiedere all'amministratore di crearla, come spiegato in [Impostare le
  classi](../../admin/guides/set-up-classes.md).
- «Questa sezione non ha questa classe: scegliere una sezione della classe.»: l'anno e la sezione scelti non vanno
  insieme. Scegliere di nuovo la sezione, tra quelle che l'elenco propone dopo la scelta dell'anno.
- «Matricola già assegnata a un altro utente.»: l'alunno è probabilmente già inserito. Cercarlo in **Utenti** prima di
  crearlo una seconda volta.
- «Il numero di tessera è o sembra il codice di una copia: scegliere un altro numero.» o «Numero di tessera già
  assegnato a un altro utente.»: svuotare il campo **Numero tessera** e lasciare che BiblioViva scelga il numero.
- «Indirizzo email non valido.»: correggere l'indirizzo o svuotare il campo.
- «La fotocamera funziona solo con una connessione sicura (https)…»: l'installazione senza Tailscale non può usare la
  fotocamera. Premere **Carica file** e scegliere una foto già salvata sul computer.
- «File troppo grande…» o «Formato immagine non supportato (sono ammessi JPEG, PNG, WebP e HEIC).»: scegliere un altro
  file.
- «La foto non è stata salvata: rifalla dalla pagina dell'utente.»: l'alunno è stato creato ma la foto no. Aprire la
  scheda dell'utente e premere **Foto**.
- La scheda **Foto** non compare: l'amministratore ha disattivato le foto, come spiega [Disattivare le foto o le
  copertine](../../admin/guides/switch-off-photos-or-covers.md).

## Pagine correlate

- [Iscrivere un docente](enrol-a-teacher.md)
- [Fare le foto degli utenti](take-patron-photos.md)
- [Stampare le tessere di una classe](print-class-cards.md)
- [Correggere i dati di un utente](edit-a-patron.md)
- [Utenti](../screens/patrons.md) e [Scheda dell'utente](../screens/patron-record.md)
