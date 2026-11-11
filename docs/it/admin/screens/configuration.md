# Configurazione

La pagina **Configurazione** elenca tutte le impostazioni di BiblioViva e gli editor di ciò che la biblioteca possiede:
aspetto, classi, classificazione, template di stampa e report. È riservata all'account `admin` e si apre dalla scheda
**Configurazione** di [Amministrazione](admin.md). Le impostazioni sono raccolte in sezioni, ciascuna salvata in un file
della cartella di configurazione; ogni modifica fatta da qui conserva la versione precedente nella
[Cronologia](config-history.md). L'elenco completo dei valori è nel
[riferimento tecnico della configurazione](../../../config-reference.md).

<!-- figure: admin/configuration | La pagina Configurazione con gli editor e le sezioni -->

1. Le schede **Sezioni** e **Cronologia** che cambiano pagina dentro la Configurazione.
2. Il pulsante **Ricarica**.
3. L'avviso sullo stato dei file (valido, modificato a mano, con errori).
4. Il gruppo «Aspetto, classi e modelli».
5. Il gruppo «Impostazioni», una scheda per sezione, con il nome del file in cui è salvata.
6. Il pannello «Archivio della configurazione».

## Ricarica

Il pulsante **Ricarica** rilegge i file della cartella di configurazione. Serve quando i file sono stati modificati a
mano. Se i file hanno errori resta in uso la configurazione precedente e compare il messaggio «I file hanno errori:
resta in uso la configurazione precedente.».

## Stato dei file

Sopra le schede un riquadro dice in quale stato si trova la configurazione:

- verde: «La configurazione è valida», con il numero dei file;
- azzurro: «I file sono stati modificati a mano: premere «Ricarica» per usare le modifiche.»;
- giallo: «La configurazione non è ancora stata creata: si usano i valori di esempio.»;
- rosso: «I file della configurazione hanno degli errori», con l'elenco dei file e delle chiavi da correggere. La
  biblioteca continua con la versione precedente finché gli errori non sono corretti.

Quando ci sono avvisi, un elenco ripiegabile con il loro numero li mostra uno per uno. Un avviso non impedisce il
funzionamento.

## Aspetto, classi e modelli

Cinque schede aprono gli editor dedicati, ciascuno in una pagina propria.

- **Aspetto e lingua**: nome e logo della biblioteca, colori, lingua e sezioni della dashboard. Vedere
  [Aspetto e lingua](appearance.md). Guida: [Impostare la biblioteca](../guides/set-up-the-library.md).
- **Classi**: le classi della scuola e i gruppi dei docenti. Vedere [Classi](classes.md). Guida:
  [Impostare le classi](../guides/set-up-classes.md).
- **Classificazione**: generi, argomenti, pittogrammi, Dewey e schema della segnatura, con i livelli di lettura. Guida:
  [Modificare la classificazione e i livelli di lettura](../guides/classification.md).
- **Template di stampa**: le cartelle dei template di tessere, etichette, ricevute e solleciti. Vedere
  [Template di stampa](templates.md).
- **Libreria dei report**: i report forniti e quelli della scuola. Vedere [Libreria dei report](reports-library.md).

## Archivio della configurazione

In fondo alla pagina il pannello «Archivio della configurazione» tiene tutta la configurazione in un solo file:
impostazioni, modelli di stampa, fogli adesivi, pittogrammi, logo, report e lingue (non la cronologia). Serve a tenerne
una copia o a portarla su un'altra installazione.

- **Esporta configurazione** scarica l'archivio.
- **Importa configurazione** carica un archivio, lo controlla e mostra quanti file sono nuovi, modificati, tolti o
  uguali e quali sezioni cambiano; con **Importa** si applica, dopo una conferma. L'importazione accetta anche un backup
  o un archivio «Esporta tutto»: ne prende solo la configurazione, i dati della biblioteca non cambiano.
- Il comando **Esporta le parti scelte**, nel riquadro «Scegli cosa esportare», limita l'archivio ad alcune parti.

Se l'archivio ha problemi (non è uno ZIP, non è di BiblioViva, contiene percorsi non ammessi) l'importazione non parte e
il motivo è scritto in rosso. Guida: [Esportare e importare la configurazione](../guides/export-the-configuration.md).

## Una sezione delle impostazioni

Ogni scheda del gruppo «Impostazioni» apre una pagina con le impostazioni di quella sezione. Le pagine sono tutte fatte
allo stesso modo:

- In alto il nome della sezione e, sotto, «Salvata in» seguito dal nome del file. Se la sezione viene da più file compare
  anche «Anche da».
- Le due modalità **Impostazioni** e **JSON**. **Impostazioni** è il modulo; **JSON** mostra la sezione come è scritta nel
  file, per chi la modifica a mano.
- Nel modulo ogni impostazione ha il suo nome, una spiegazione, il valore predefinito («Predefinito: …») e, quando il
  valore è stato cambiato, il comando **Torna al predefinito**. Le impostazioni sono raggruppate sotto titoli; le chiavi
  della sezione stessa stanno sotto **Generale**.
- **Salva** e **Annulla modifiche** compaiono in alto a destra; con modifiche non ancora salvate compare **Modifiche non
  salvate**. Un valore non valido è segnato e blocca **Salva** (messaggio «Correggere i valori segnati prima di
  salvare.»). Uscendo con modifiche non salvate la pagina chiede conferma («Uscire senza salvare?»).
- Se il salvataggio toglierebbe qualcosa che è ancora in uso (per esempio un materiale con libri, o una classe con
  utenti) la pagina lo dice e non salva.
- In fondo, «Altre impostazioni di questa sezione» elenca le chiavi che si modificano altrove, con il comando **Apri**
  verso l'editor giusto, oppure «Per ora nella scheda JSON».

Le sezioni sono qui sotto, nell'ordine dell'elenco.

### Biblioteca e scuola

Nome, contatto e calendario della scuola: **Nome della biblioteca**, **Email di contatto**, **Inizio dell'anno
scolastico**, **Nome dell'anno scolastico**, **Fuso orario**, **Primo giorno della settimana**. Contiene anche l'elenco
dei **Materiali** (libro, DVD, rivista…), che decide le regole di prestito: il codice di un materiale si cambia
solo spostando i suoi libri sul nuovo codice. Il nome e il logo si cambiano più comodamente in [Aspetto e
lingua](appearance.md). Guida: [Impostare la biblioteca](../guides/set-up-the-library.md).

### Scuola

Gli ordini di scuola e gli anni, come si scrive la classe, che cosa succede alle classi a fine anno: **Come si scrive la
classe**, **Parola per la classe**, **Classe sulla tessera**, **Nome del gruppo dei docenti**, **A fine anno, nello stesso
ordine di scuola**, **A fine anno, nel passaggio a un altro ordine**, più l'editor «Ordini di scuola e anni». Le classi
stesse si creano in [Classi](classes.md). Guide: [Impostare le classi](../guides/set-up-classes.md) e
[Avanzare di classe](../guides/class-upgrade.md).

### Catalogo

I valori da usare quando autore, editore o luogo sono sconosciuti: **Autori speciali**, **Editore sconosciuto**, **Luogo
sconosciuto**. Autore ed editore sono sempre obbligatori in scheda; questi valori sono le scelte rapide. Uso nel
catalogo: [Catalogare un libro nuovo](../../manual/guides/catalog-a-new-book.md).

Il gruppo «Inventario della scuola» ha due impostazioni. L'interruttore **Inventario della scuola** («Ogni copia ha il
numero d'inventario, la provenienza e il valore; i report elencano le copie entrate e scaricate in un periodo.») è spento
in modo predefinito: acceso, ogni copia ha tre dati in più (numero d'inventario, provenienza, valore) nelle finestre e
nella tabella delle copie, e le campagne di inventario degli scaffali mostrano il numero d'inventario. Spegnerlo non
cancella nulla: i campi spariscono, i valori restano. L'elenco **Provenienze** («Una per riga: le provenienze proposte
nella scheda della copia (per esempio Acquisto, Dono).») contiene le scelte per la provenienza; di norma Acquisto, Dono,
Altro. Che cosa chiede la norma e che cosa registra BiblioViva: [Inventario dei beni della
scuola](../../compliance/school-inventory.md).

L'elenco **Formati accessibili** («Uno per riga: i formati che un libro può avere per gli alunni con DSA o con disabilità
(alta leggibilità, in simboli, audiolibro…). Con l'elenco vuoto il catalogo non li mostra.») contiene i nomi dei formati
che la scheda di un libro può avere; di norma Alta leggibilità, In simboli (CAA), Audiolibro, Caratteri grandi, Tattile.
I nomi sono al massimo 20, di 40 caratteri ciascuno. Svuotando l'elenco spariscono le caselle della scheda e il filtro
del catalogo. Un formato tolto dall'elenco resta sui libri che già lo hanno, e si vede ancora nel loro modulo, ma non si
può più dare ad altri. Uso: [Catalogare un libro nuovo](../../manual/guides/catalog-a-new-book.md) e [Cercare un
libro](../../manual/guides/find-a-book.md). Che cosa chiedono le norme sull'inclusione e che cosa registra BiblioViva:
[Inclusione](../../compliance/inclusion.md).

### Codici a barre

Il formato dei codici di tessere e copie: **Tastiera dei computer**, **Suono della fotocamera** (facoltativo, vale solo
per la lettura con il telefono), **Tipo di codice a barre delle tessere**, **Tipo di codice a barre delle copie**, sotto
i titoli «Tessere degli utenti» e «Copie dei libri». Gli editor «Formato dei codici» e «Numerazione e anteprima» fanno
scegliere il formato dei codici nuovi, i formati precedenti che continuano a funzionare e il numero di partenza delle
nuove tessere. Guida: [Scegliere i formati dei codici a barre](../guides/barcode-formats.md).

### Prestiti

Le regole di prestito: «Regole per gli studenti» e «Regole per i docenti» (**Giorni di prestito**, **Libri in prestito
al massimo**, **Rinnovi al massimo**, **Giorni di rinnovo**), **Calcolo della scadenza**, **Il rinnovo parte da**,
**Rinnovo anche dopo la scadenza**, **Niente nuovi prestiti con libri in ritardo**, **Scadenza massima**, **Ricevuta di
prestito** e, sotto «Solleciti», **Modello dei solleciti**, **Una pagina per classe** e **Giorni di ritardo prima del
sollecito**. L'editor «Regole per materiale» cambia una regola per un materiale (per esempio i DVD per 5
giorni). Guida: [Impostare le regole dei prestiti](../guides/set-loan-rules.md).

### Calendario

I giorni di chiusura: l'opzione **Festività nazionali italiane** e l'editor «Calendario della biblioteca», con i giorni di
chiusura settimanale, i giorni chiusi scelti con un clic e i «Periodi di chiusura». Guida:
[Impostare il calendario della scuola](../guides/set-the-calendar.md). Le chiusure si segnano anche dal calendario del
banco: [Segnare le chiusure nel calendario](../../manual/guides/mark-closures.md).

### Z39.50 (SBN)

I cataloghi da cui arrivano le schede dei libri: **Server predefinito**, **Tempo massimo di attesa (ms)**, **Risultati per
ISBN**, **Risultati per ricerca** e l'editor «Cataloghi Z39.50», in cui **Prova connessione** fa una ricerca vera senza
salvare. Uso: [Catalogare un libro nuovo](../../manual/guides/catalog-a-new-book.md).

### Dati dei libri

Le fonti dei dati per la ricerca per ISBN: **Fonti dei dati**, **Giorni di memoria delle ricerche**, **Tempo massimo di attesa
(ms)**. Uso: [Catalogare un libro nuovo](../../manual/guides/catalog-a-new-book.md).

### Prestazioni

Il computer su cui gira BiblioViva e le regolazioni che ne dipendono: **Computer** (il profilo), **Cache del database
(MB)**, **Memoria mappata del database (MB)**, **Pagine prima del checkpoint**, **Immagini elaborate insieme**,
**Ricerche Z39.50 insieme**, **Stampe ed esportazioni alla volta**, **Memoria per controllare le password (MB)**,
**Risparmio di memoria**. Di norma basta scegliere il profilo giusto; gli altri valori si adeguano. Dettagli tecnici:
[riferimento della configurazione](../../../config-reference.md) e [installazione](../../../deploy.md).

### Classificazione

La sezione non ha una pagina di impostazioni: si modifica con il suo editor (vedere
[Aspetto, classi e modelli](#aspetto-classi-e-modelli)). Guida:
[Modificare la classificazione e i livelli di lettura](../guides/classification.md).

### Tessere

Formato delle tessere e del foglio di stampa: **Modello delle tessere**, **Stampa delle tessere**, **Validità (mesi)**,
**Foto sulla tessera** (solo con le foto attive), le dimensioni sotto «Dimensioni della tessera», il «Foglio di stampa»
(**Formato del foglio**, **Tessere per foglio**, margini, segni di piegatura e di taglio) e la «Stampa sui due lati» con
lo «Spostamento dei retri». L'editor «Template per tipo di utente» sceglie il modello di studenti e docenti. Dalla
sezione si apre anche **Calibra la stampa fronte-retro**. Guide: [Modificare il modello delle
tessere](../guides/edit-the-card-template.md) e [Calibrare la stampa fronte-retro](../guides/calibrate-duplex.md).

### Etichette

Le etichette e le fascette dei libri: **Etichette predefinite**, **Lettere del titolo**, **Stampante in bianco e nero**
e, per ciascun lavoro («Coppia: fascetta ed etichetta», «Solo etichetta con il codice», «Solo fascetta»), il **Modello**
e il **Foglio adesivo**. L'editor «Fogli di etichette adesive» definisce le misure dei fogli e stampa la pagina di
prova. Guide: [Modificare le etichette e la fascetta del dorso](../guides/edit-label-templates.md) e [Aggiungere un
foglio di etichette](../guides/add-a-label-stock.md).

### Foto degli utenti

L'interruttore **Foto degli utenti**, **Foto richiesta**, le dimensioni e il formato delle foto (**Larghezza (px)**,
**Altezza (px)**, **Formato dei file**, **Qualità**, **Dimensione massima caricabile (byte)**) e i limiti delle immagini
con più foto sotto «Immagini con più foto (censimento da immagine)». Con l'interruttore spento non si scattano né si
mostrano foto, ma quelle già salvate restano. Guida: [Disattivare le foto o le
copertine](../guides/switch-off-photos-or-covers.md).

### Copertine

L'interruttore **Copertine dei libri**, le dimensioni (**Larghezza (px)**, **Altezza massima (px)**, **Larghezza minima
(px)**), **Formato dei file**, **Qualità**, **Paese**, **Cerca la copertina da sola**, **Tempo massimo di attesa (ms)**
e l'editor «Da dove scaricare le copertine», che elenca le fonti nell'ordine in cui si provano e permette di spegnerle
una per una. Guida: [Disattivare le foto o le copertine](../guides/switch-off-photos-or-covers.md). Uso nel catalogo:
[Aggiungere la copertina](../../manual/guides/add-a-cover.md).

### Privacy

**Mesi di registro delle operazioni**: le righe del [Registro operazioni](audit.md) più vecchie vengono cancellate.

### Backup

**Orario del backup** (nella forma cron, per esempio ogni notte alle 3), **Backup all'avvio se saltato**, **Giorni di
conservazione**, **Copia esterna attiva** e **Destinazione della copia**; sotto, «Prossimi backup» mostra le prossime
esecuzioni nel fuso della biblioteca. Guida: [Fare e scaricare una copia di sicurezza](../guides/make-a-backup.md). La
pagina dei backup è [Backup](backups.md); la copia esterna si prepara come descritto in
[Copie di sicurezza](../../setup/steps/backups.md).

### Sicurezza e accessi

**Durata della sessione (giorni)**, **Tentativi di accesso** e **Pausa dopo troppi tentativi (minuti)**. Gli account e i
ruoli si modificano in [Account del personale](users.md). Guide: [Gestire gli account del
personale](../guides/manage-accounts.md) e [Cambiare una password](../guides/change-a-password.md).

### Interfaccia

**Pausa della postazione prestiti (secondi)** e l'editor «Pacchetti di lingua», che installa, scarica ed elimina le lingue
aggiunte. Colori, lingua e dashboard stanno invece in [Aspetto e lingua](appearance.md). Guida:
[Aggiungere una lingua](../guides/add-a-language.md).
