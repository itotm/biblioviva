# Controllo installazione

La pagina **Controllo installazione** dice se l'installazione è a posto: il file di configurazione, l'indirizzo, il
profilo del computer, le password degli account e i backup. Propone anche le prove da fare a mano con la stampante, la
fotocamera e il lettore di codici a barre. Mostra lo stato e i collegamenti per correggere: non cambia nessuna
impostazione. È riservata all'account `admin` e si apre dalla scheda **Controllo installazione** di
[Amministrazione](admin.md). Finché un controllo è da correggere, anche la **Dashboard** dell'account `admin` lo ricorda,
con un pulsante che porta qui. Come usarla dopo l'installazione: [Primi passi
dell'amministratore](../first-steps.md).

<!-- figure: admin/setup | La pagina Controllo installazione con i controlli e le prove -->

1. Il pulsante **Ricontrolla**.
2. Il riepilogo.
3. I controlli, una scheda per voce, ciascuna con il suo stato.
4. Le prove con la stampante, la fotocamera e il lettore.

## Ricontrolla

Il pulsante **Ricontrolla** ripete tutti i controlli. Serve dopo ogni correzione: la pagina non si aggiorna da sola.

## Il riepilogo

Sotto il titolo una riga riassume la pagina: «Tutto a posto» quando nessun controllo segnala problemi, oppure quanti
controlli sono da guardare o da correggere. Le prove a mano non entrano nel riepilogo: BiblioViva non può sapere come
stampa la stampante né come scrive il lettore.

## Gli stati

Ogni controllo ha uno stato, sempre con un colore, un'icona e una parola.

- **A posto** (verde): niente da fare.
- **Da guardare** (giallo): funziona, ma qualcosa conviene sistemarlo.
- **Da correggere** (rosso): qualcosa non va davvero.

Una scheda con più righe prende lo stato della riga peggiore. Le schede non a posto hanno in fondo i pulsanti che aprono
la pagina di Amministrazione dove si corregge e il pulsante **Guida**, che apre la pagina della documentazione che
spiega quel problema.

## File di configurazione

La scheda **File di configurazione** rilegge il file dal disco, come farebbe il server all'avvio, e controlla anche i
template, i report e i pacchetti di lingua.

- **A posto**: «Il file di configurazione è valido.»
- **Da guardare**: manca il file `config.json` e BiblioViva usa la configurazione di esempio, perché la configurazione
  guidata non è stata completata; oppure la configurazione ha avvisi, elencati sotto la riga. L'avviso sulle password in
  chiaro non compare qui, ma nella scheda **Password degli account**.
- **Da correggere**: il file sul disco non è valido, con l'elenco degli errori. Il server usa ancora l'ultima
  configurazione valida, ma al prossimo avvio non partirebbe.

I pulsanti aprono la **Configurazione** e la **Cronologia della configurazione**, da cui si annulla l'ultima modifica.
Guida: [Annullare una modifica della configurazione](../guides/undo-a-configuration-change.md).

## Indirizzo e HTTPS

La scheda **Indirizzo e HTTPS** guarda l'indirizzo con cui la pagina è stata aperta, così come lo vede il server.

- **A posto** con HTTPS: la fotocamera e l'installazione come app funzionano.
- **A posto** con HTTP semplice su `localhost`, `127.0.0.1` o `::1`: la pagina è aperta sul computer di BiblioViva
  stesso. Il controllo dell'HTTPS riguarda l'indirizzo che usano gli altri dispositivi, quindi conviene aprire questa
  pagina anche da uno di essi.
- **Da guardare** con HTTP semplice nella modalità di base sulla rete locale, senza Tailscale: tutto funziona con il
  lettore di codici a barre, ma la fotocamera e l'installazione come app no.
- **Da correggere** con HTTP semplice su un altro indirizzo, fuori dalla modalità di base: l'indirizzo non è quello
  sicuro di Tailscale (`https://…ts.net`). Con HTTP semplice la fotocamera non funziona e le password viaggiano in chiaro
  sulla rete.

Nessuna pagina di Amministrazione corregge l'indirizzo: dipende da come è stato installato. La scheda rimanda alla
guida: per la modalità di base [Scegliere la rete](../../setup/choose-network.md#rete-locale), per l'indirizzo non
sicuro il problema «Lucchetto che manca» di [Problemi comuni](../../help/problems.md#lucchetto-che-manca).

## Computer e profilo

La scheda **Computer e profilo** confronta il profilo scelto in **Prestazioni** con il computer: dice la memoria, i
processori e il disco dove sono i dati (scheda SD, disco meccanico o SSD; su alcuni computer il tipo di disco non si
riconosce).

- **A posto**: il computer ha la memoria che il profilo richiede (circa 0,35 GB per il profilo minimo, 1,5 GB per il
  piccolo e per il medio, 3 GB per il grande: BiblioViva è leggero, e un computer con 4 GB e due processori basta per
  il profilo grande).
- Un'indicazione, senza cambiare lo stato: il computer può fare di più e un altro profilo ne sfrutterebbe meglio le
  risorse. Con una scheda SD il profilo adatto resta il piccolo, anche con molta memoria; con un disco meccanico il
  medio; con un SSD il grande, da circa 4 GB di memoria e due processori.
- **Da guardare**: il profilo richiede più memoria di quella che il computer ha. Si sceglie un profilo più leggero.

Il pulsante **Prestazioni** apre la sezione della Configurazione dove si sceglie il profilo (vedere
[Prestazioni](configuration.md#prestazioni)).

## Password degli account

La scheda **Password degli account** guarda gli account attivi.

- **A posto**: nessuna password è scritta in chiaro nel file di configurazione e nessuna è uguale a una di quelle note a
  tutti.
- **Da correggere**: uno o più account hanno ancora la password di esempio (`cambiami`) o quella dei dati dimostrativi
  (`biblioviva`), con i nomi degli account. Chiunque conosca la password può entrare.
- **Da guardare**: uno o più account hanno la password scritta in chiaro in `config.json`, con i nomi degli account.
  Funziona, ma conviene sostituirla.

Il pulsante **Account del personale** apre la pagina degli account. Guide: [Cambiare una password](../guides/change-a-password.md)
e [Gestire gli account del personale](../guides/manage-accounts.md).

## Backup

La scheda **Backup** riunisce più righe: la cartella, l'orario, l'ultima copia e, se è attiva, la copia esterna.

- La cartella dei backup: se non si può scrivere (un disco staccato, i permessi sbagliati), la riga è **Da correggere** e
  dice perché.
- L'orario: **A posto** con l'orario e il momento del prossimo backup; **Da guardare** se i backup automatici non sono in
  funzione, e allora BiblioViva va riavviato; **Da correggere** se l'orario non è valido.
- L'ultima copia: **A posto** con il nome e il momento dell'ultimo backup; un backup fatto all'avvio vale come ogni altro.
  **Da guardare** quando non c'è ancora nessun backup, oppure quando manca quello dell'ultimo orario previsto: un computer
  spento in quel momento lo recupera all'avvio, se l'impostazione di recupero è attiva. **Da correggere** quando l'ultimo
  backup ha più di sette giorni.
- La copia esterna, solo se è attiva: **A posto** con l'ultima copia riuscita; **Da guardare** se non ha scritto il suo
  stato, se è finita male o se è ferma da più di due giorni.

I pulsanti aprono **Backup**, per farne uno subito, e **Orario dei backup**, la sezione della Configurazione. Guide:
[Fare e scaricare una copia di sicurezza](../guides/make-a-backup.md); per i casi di un backup che non parte, i problemi
«Copia di sicurezza non fatta» e «Computer rimasto spento» di [Problemi comuni](../../help/problems.md).

## Stampante

Il riquadro **Stampante** raccoglie le pagine di prova. Ogni riga ha il pulsante **Stampa**, che apre la pagina in una
nuova scheda del browser, da stampare con la scala al 100 % e senza «Adatta alla pagina»: il righello di 10 cm deve
misurare 100 mm.

- **Pagina di prova delle tessere**: unità vuote con i segni di taglio e di piega e il righello.
- **Foglio di esempio delle etichette**: etichette con i codici a barre di copie inventate. Servono anche a provare il
  lettore.
- **Pagina di calibrazione delle etichette**: i contorni del foglio di etichette adesive, da sovrapporre a un foglio vero.
- **Foglio di calibrazione fronte-retro**: per le tessere stampate sui due lati; la sua riga ha anche il pulsante **Guida**
  della procedura completa.

Guide: [Calibrare la stampa fronte-retro](../guides/calibrate-duplex.md) e, per una stampa troppo piccola o sfalsata, il
problema «Stampa troppo piccola o sfalsata» di [Problemi comuni](../../help/problems.md#stampa-troppo-piccola-o-sfalsata).

## Fotocamera

Il riquadro **Fotocamera** ha il pulsante **Prova la fotocamera**, che apre il Censimento foto: il browser chiede il
permesso di usare la fotocamera la prima volta. Con le foto degli utenti disattivate il pulsante apre invece Nuovo libro,
dove la fotocamera legge il codice ISBN.

Con l'indirizzo senza HTTPS il pulsante è spento e il riquadro spiega che la fotocamera non è disponibile: serve una
pagina sicura. Il problema è lo stesso della scheda **Indirizzo e HTTPS**. Guida: il problema «Fotocamera che non si
avvia» di [Problemi comuni](../../help/problems.md#fotocamera-che-non-si-avvia).

## Lettore di codici a barre

Il riquadro **Lettore di codici a barre** ha un campo, **Codice letto dal lettore**, che non cerca e non salva nulla.
Fare clic nel campo e leggere un codice, per esempio quello di un'etichetta del foglio di esempio. Sotto compare:

- **Il lettore ha scritto**: il testo come è arrivato.
- **BiblioViva lo legge come**: il codice che il banco prestiti ne ricava, con le stesse regole di ogni campo dei codici.
- **Tipo**: copia, tessera, ISBN o «Non riconosciuto».
- **Tasto Invio**: se il tasto è arrivato dopo il codice. Se dopo un secondo e mezzo non è arrivato, la riga dice di
  attivare nel lettore il suffisso Invio.

Una riga a colori dà il verdetto. Se il lettore ha scritto un apostrofo `'` al posto del trattino `-`, o un altro carattere
al posto di uno del codice, la riga lo dice: la tastiera dichiarata a BiblioViva non coincide con quella del lettore.
BiblioViva corregge comunque la lettura, ma conviene far coincidere le due: si cambia nel campo **Tastiera dei computer**
della sezione **Codici a barre** della [Configurazione](configuration.md#codici-a-barre). Il pulsante **Pulisci** azzera
il campo e la lettura.

Guida: il problema «Lettore che scrive caratteri strani» di
[Problemi comuni](../../help/problems.md#lettore-che-scrive-caratteri-strani).
