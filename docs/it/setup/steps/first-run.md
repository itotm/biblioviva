# Primo avvio

Il primo avvio è la configurazione guidata che BiblioViva propone nel browser appena è installato: lingua, colori,
scuola, codici a barre e password degli account condivisi. Questa pagina serve a chi ha terminato il passo [Installare
BiblioViva](install.md) e ha davanti l'indirizzo che `setup.sh` ha stampato. Il passo richiede circa 10 minuti.

## Occorrente

- L'indirizzo di BiblioViva stampato da `setup.sh` alla fine del passo 4.
- Un computer con un browser aggiornato (Firefox, Chrome o Edge): normalmente quello del banco prestiti.
- Con Tailscale: l'applicazione di Tailscale su quel computer, collegata all'account della scuola; il primo punto
  della procedura la installa, se non c'è.
- Con la rete locale: quel computer collegato alla stessa rete della scuola del computer di BiblioViva.
- Un foglio e una penna, o un gestore di password, per annotare le password degli account.

## Procedura

La configurazione guidata ha otto passi, indicati in alto come «Passo 1 di 8». In ogni passo il pulsante **Avanti**
resta spento finché i dati richiesti non sono validi; il pulsante **Indietro** riporta al passo precedente senza perdere
quanto già scritto. Quasi tutte le scelte si cambiano più tardi da Amministrazione: le scelte incerte si lasciano come
BiblioViva le propone.

### Aprire l'indirizzo

<!-- variant: tailscale -->
**Con Tailscale**

L'indirizzo di BiblioViva si apre soltanto da un dispositivo con Tailscale acceso e collegato all'account della scuola.
Per il primo avvio basta un solo computer: quello da cui si apre il browser, di norma il computer del banco prestiti.
Gli altri dispositivi si aggiungono al passo [Collegare i dispositivi](devices.md).

1. Se Tailscale non è ancora installato su questo computer, installarlo e accedere con l'account della scuola, come
   descritto nella sezione [Installare Tailscale](devices.md#installare-tailscale) del passo
   [Collegare i dispositivi](devices.md).
1. Aprire nel browser l'indirizzo stampato da `setup.sh`, nella forma `https://biblioviva.<tailnet>.ts.net`.
1. Attendere. Alla prima apertura il certificato HTTPS viene preparato e la pagina può impiegare alcuni secondi.
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

1. Collegare il computer alla rete della scuola, via cavo o Wi-Fi, la stessa a cui è collegato il computer di
   BiblioViva.
1. Aprire nel browser il primo indirizzo stampato da `setup.sh`, nella forma `http://biblioviva.local:8080`.
1. Se la pagina non si apre, aprire il secondo indirizzo stampato, quello numerico, nella forma
   `http://<indirizzo del computer>:8080` (per esempio `http://192.168.1.50:8080`).
<!-- /variant -->

La pagina **Prima configurazione** si apre sul primo passo. La configurazione guidata compare soltanto finché non è
completata e non chiede alcuna password: completarla subito, senza lasciare la pagina aperta e incustodita.

### Lingua

La prima schermata può comparire in inglese. BiblioViva parla una sola lingua per installazione, valida per tutto il
personale.

<!-- figure: setup/language | Il passo Lingua della configurazione guidata -->

1. Scegliere «Italiano». La configurazione guidata passa subito in italiano.
1. Premere **Avanti**.

La lingua si cambia anche dopo, da **Amministrazione** → **Configurazione** → **Aspetto e lingua**.

Per usare una lingua diversa dall'italiano e dall'inglese, già tradotta e pubblicata con questa versione di BiblioViva,
si installa subito, dalla sezione «Serve un'altra lingua?» sotto la scelta della lingua:

1. Premere **Aggiungi una lingua**. Compare il riquadro **Aggiungere una lingua**.
1. Aprire l'elenco **Lingue disponibili su GitHub** e scegliere la lingua. Sotto l'elenco sono indicati la percentuale
   dei testi tradotti e il tipo di traduzione.
1. Premere **Installa**. A installazione conclusa la configurazione guidata passa subito in quella lingua, che risulta
   già scelta.
1. Premere **Avanti**.

La lingua scelta diventa quella dell'installazione, valida per tutto il personale, e si cambia dopo da **Aspetto e
lingua**. Per un computer senza internet, o per un pacchetto preparato da sé, **Carica un pacchetto (zip)** installa
uno zip scaricato altrove. Le altre operazioni sono descritte nella guida [Aggiungere una
lingua](../../admin/guides/add-a-language.md).

Chi sposta BiblioViva su un altro computer, o ricomincia dopo un guasto, non risponde alle domande della configurazione
guidata: sotto la scelta della lingua preme **Ripristina da un backup** e sceglie l'archivio fatto con **Esporta
tutto**. La procedura è nella sezione [Dal primo avvio](../restore.md#dal-primo-avvio) di [Ripartire da una copia di
sicurezza](../restore.md).

### Colori

BiblioViva offre quindici set di colori. Cambiano solo i colori, mai la forma, e restano leggibili anche in bianco e
nero.

<!-- figure: setup/theme | Il passo Colori con i quindici set di colori -->

1. Scegliere un set di colori. L'anteprima si vede subito sulla pagina. Il set proposto è Oceano.
1. Premere **Avanti**.

Anche i colori si cambiano dopo, da **Amministrazione** → **Configurazione** → **Aspetto e lingua**.

### Biblioteca

<!-- figure: setup/library | Il passo Biblioteca con il nome e le due opzioni -->

1. Scrivere nel campo **Nome della biblioteca** il nome che deve comparire in alto a sinistra, sulle tessere e sulle
   stampe, per esempio il nome della scuola preceduto da «Biblioteca». Il campo è obbligatorio.
1. Lasciare attiva la casella **Foto degli utenti** se le tessere devono portare la foto di studenti e docenti. Togliere
   la spunta se la scuola preferisce non conservare foto: allora non c'è alcuna foto in nessuna pagina e le tessere
   escono senza foto.
1. Lasciare attiva la casella **Copertine dei libri** se il catalogo deve mostrare le copertine, cercate in rete,
   fotografate o caricate. Togliere la spunta per non avere alcuna copertina.
1. Premere **Avanti**.

Le due caselle si cambiano dopo da **Amministrazione** → **Configurazione** → **Foto degli utenti** e da
**Amministrazione** → **Configurazione** → **Copertine**; spegnerle non cancella nulla di quanto è già salvato.

### Scuola

Il tipo di scuola propone gli anni, le classi e i livelli di lettura. Le classi si creano subito.

<!-- figure: setup/school | Il passo Scuola con il tipo di scuola, i nomi delle classi e le opzioni -->

1. Scegliere nell'elenco **Tipo di scuola** quello della propria scuola, cercandolo sotto «Italia». Se la scuola
   riunisce più ordini, scegliere l'istituto comprensivo. Il tipo proposto è la scuola primaria.
1. Controllare i nomi delle classi. Per ogni ordine di scuola compare un campo (per esempio «Primaria: nomi delle
   classi, uno per anno») con i nomi delle sezioni, separati da virgole: `A-D` vale A, B, C, D. I nomi si ripetono per
   ogni anno. Un campo vuoto non crea classi.
1. Controllare l'elenco delle classi che verranno create, sotto i campi.
1. Lasciare la scelta di **Come si scrive la classe** com'è, salvo che la scuola scriva le classi in altro modo. Le voci
   mostrano un esempio, come «1 B».
1. Controllare il campo **Gruppo dei docenti**: i docenti entrano in questo gruppo e altri gruppi si aggiungono dopo.
1. Controllare **Inizio dell'anno scolastico**, scritto come mese e giorno nella forma `MM-GG`, per esempio `09-01`.
1. Scegliere in **Nome dell'anno scolastico** se l'anno si scrive con due anni, come «2026/2027», o con l'anno di
   inizio, come «2026». In Italia si usano due anni.
1. Lasciare attiva la casella **Libri di narrativa divisi per livello di lettura** se la biblioteca ordina i romanzi per
   livello. Sotto la casella compaiono i livelli che verranno creati.
1. Lasciare in **Segnatura** la voce proposta, «Genere, poi livello», oppure scegliere un altro ordine. BiblioViva
   calcola la segnatura di ogni copia dalla classificazione, dal livello e dall'autore; con «Libera: scritta a mano su
   ogni copia» la segnatura si scrive invece su ogni copia. Senza livelli di lettura il menu offre soltanto «Genere,
   senza livello» e «Libera: scritta a mano su ogni copia».
1. Lasciare in **Parte finale** la voce proposta, «Iniziali dell'autore, calcolate», oppure sceglierne un'altra. Il menu
   non compare con l'ordine libero.
1. Controllare gli esempi sotto i menu, scritti come «Esempi: B 4 DEL · B DEL · 590 ROS».
1. Premere **Avanti**.

Anni, classi e livelli di lettura si cambiano dopo da **Amministrazione** → **Configurazione** → **Scuola** e da
**Amministrazione** → **Configurazione** → **Classi**. La segnatura si cambia da **Amministrazione** →
**Configurazione** → **Classificazione**: vedere [Modificare la classificazione e i livelli di
lettura](../../admin/guides/classification.md#scegliere-come-si-compone-la-segnatura).

### Codici

Il passo Codici fissa il formato dei codici a barre delle nuove copie e quello delle nuove tessere, scelti ciascuno per
conto suo. I due formati non si possono confondere: chi legge un codice capisce subito se è un libro o una tessera.

<!-- figure: setup/codes | Il passo Codici con i due formati, il carattere di controllo e gli esempi -->

1. Lasciare in **Formato delle copie** la voce proposta, «Anno, controllo e numero (consigliato)», oppure sceglierne
   un'altra.
1. Lasciare in **Formato delle tessere** la voce proposta, «Controllo e numero di 6 cifre (consigliato)», oppure
   sceglierne un'altra.
1. Lasciare in **Carattere di controllo** la voce proposta, «Una lettera (mod 23)».
1. Controllare **Tastiera dei lettori**: deve essere la lingua della tastiera del computer a cui si collega il lettore
   di codici a barre. In italiano è «Italiana». Il valore serve a correggere i caratteri che un lettore impostato per
   un'altra tastiera scrive male; il passo [Provare il lettore e la stampante](scanner-printer.md) lo verifica.
1. Controllare gli esempi sotto i campi, per la **Copia di un libro** e per la **Tessera**.
1. Verificare che compaia il messaggio «Copie e tessere non si possono confondere.» Se compare invece un avviso di
   rifiuto, scegliere un altro formato.
1. Premere **Avanti**.

I formati, i codici di sistemi precedenti e la numerazione si cambiano dopo da **Amministrazione** → **Configurazione**
→ **Codici a barre**. Una biblioteca che ha già libri e tessere con codici stampati da un altro sistema lascia qui le
scelte proposte: i codici esistenti si aggiungono in seguito, e continuano a funzionare.

### Dati di prova

<!-- figure: setup/demo | Il passo Dati di prova con la casella dei dati dimostrativi -->

I dati dimostrativi sono studenti, libri e prestiti inventati, generati secondo la scuola e i codici scelti: servono a
provare BiblioViva prima di inserire i dati veri. Non corrispondono ad alcuna persona reale.

1. Per provare BiblioViva prima dell'uso vero, attivare la casella **Carica dati dimostrativi**. Per iniziare subito con
   i dati veri, lasciarla spenta.
1. Premere **Avanti**.

Con i dati dimostrativi tutti gli account usano la stessa password, semplice da ricordare. I dati dimostrativi si
tolgono quando si è pronti, con un solo pulsante:

1. Accedere come `admin` e aprire **Amministrazione**.
1. Premere **Svuota dati dimostrativi** e confermare.

La cancellazione svuota il database e le foto e disconnette tutti gli operatori; la configurazione e gli account
restano. Dopo la cancellazione cambiare subito le password da **Amministrazione** → **Account del personale**, perché
quelle dei dati dimostrativi sono note a tutti.

Se il database contiene già dei dati, il passo lo segnala e i dati dimostrativi non vengono caricati.

### Password

BiblioViva ha cinque account condivisi, uno per ruolo. Ciascuno entra con il proprio nome utente e la propria password.

<!-- figure: setup/passwords | Il passo Password con i cinque account e le password proposte -->

| Account | Nome utente | Serve per |
|---|---|---|
| **Amministrazione (admin)** | `admin` | tutto: impostazioni, backup, importazioni, account |
| **Gestione prestiti (prestiti)** | `prestiti` | il banco prestiti: prestiti e restituzioni |
| **Catalogazione (catalogo)** | `catalogo` | il catalogo: libri, copie, etichette |
| **Tessere e foto (tessere)** | `tessere` | gli utenti e le tessere |
| **Report (report)** | `report` | i report e le statistiche |

1. Leggere le password proposte: sono generate a caso e vanno bene così. Per cambiarne una, scriverne un'altra nel
   campo, di almeno 8 caratteri.
1. Per avere un'altra password casuale, premere il pulsante **Rigenera** accanto al campo.
1. Premere **Avanti**.

Con i dati dimostrativi attivi i campi non si modificano: tutti gli account usano la password `biblioviva`.

> [!IMPORTANT]
> Le password compaiono soltanto nel riepilogo e nella schermata finale: non vengono mostrate di nuovo. Copiarle e
> conservarle in un luogo sicuro prima di proseguire.

### Riepilogo

<!-- figure: setup/summary | Il Riepilogo con le scelte e le password degli account -->

1. Controllare il riepilogo: lingua, colori, biblioteca, classi, segnatura, codici e dati di prova.
1. Copiare le password di tutti gli account, per esempio su un foglio di carta tenuto al sicuro.
1. Premere **Completa la configurazione**. Durante il salvataggio il pulsante mostra «Salvataggio in corso…».

Se compare un messaggio di errore, rileggere i passi con **Indietro** e riprovare. Dopo il salvataggio compare la
schermata **Configurazione completata**.

### Configurazione completata

<!-- figure: setup/done | La schermata finale con le password e il pulsante Vai all'accesso -->

1. Controllare che le password annotate coincidano con quelle mostrate. Se i dati dimostrativi sono stati caricati,
   compare anche il numero di utenti, titoli, copie e prestiti creati.
1. Premere **Vai all'accesso**.
1. Scrivere `admin` nel campo **Nome utente**.
1. Scrivere la password dell'account `admin` nel campo **Password**.
1. Premere **Entra**.

## Verifica prima di proseguire

- Dopo l'accesso si apre la **Dashboard**, intitolata con il nome della biblioteca scelto nel passo Biblioteca. Con i
  dati dimostrativi un avviso in cima alla pagina ricorda che l'installazione ne contiene.
- Le password dei cinque account sono annotate in un luogo sicuro.

Quando la configurazione guidata non si apre, si vedano i possibili problemi qui sotto e la pagina
[Problemi comuni](../../help/problems.md#indirizzo-che-non-si-apre). Se invece si apre la pagina di accesso, la
configurazione era già stata completata: l'accesso richiede le password scelte allora. Per ricominciare da capo, la
sezione «Resetting an installation» della pagina tecnica
[Deployment notes (technical)](../../../deploy.md#resetting-an-installation-back-to-the-first-run-wizard) (in inglese) spiega
come.

## Possibili problemi

### La pagina non si apre con Tailscale

Il computer non ha Tailscale acceso e collegato all'account della scuola, oppure la funzione dei nomi (MagicDNS) o dei
certificati HTTPS non è attiva nella console di Tailscale. Il passo [Preparare la rete](network.md) descrive entrambi i
controlli.

### La pagina non si apre con la rete locale

Il computer non è sulla stessa rete di BiblioViva, oppure il nome `biblioviva.local` non è riconosciuto. Usare
l'indirizzo numerico del computer, come indicato sopra.

### Una password è stata persa

Le password non si rivedono. Entrando con `admin`, le altre si cambiano da **Amministrazione** → **Account del
personale**. Per la password di `admin` serve la procedura tecnica «Forgotten admin password» della pagina [Deployment
notes (technical)](../../../deploy.md#installing-updating-logs-step-85) (in inglese).

### L'elenco delle lingue non è raggiungibile

Compare «L'elenco delle lingue non è raggiungibile»: il computer di BiblioViva non è collegato a internet. Scaricare da
un computer con internet il file della lingua dalla pagina della versione di BiblioViva (il collegamento **Pagina della
release su GitHub, per scaricare gli zip** sotto l'elenco) e caricarlo con **Carica un pacchetto (zip)**.

### Il pulsante Avanti non si accende

Un campo del passo è vuoto o non valido. Il campo da correggere mostra un avviso: per esempio la password di almeno 8
caratteri o l'inizio dell'anno nella forma `MM-GG`.

## Pagine correlate

- Passo precedente: [Installare BiblioViva](install.md)
- Passo successivo: [Collegare i dispositivi](devices.md)
- [Problemi comuni](../../help/problems.md)
