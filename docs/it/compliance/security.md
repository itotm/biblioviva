# Sicurezza informatica

Questa pagina riguarda le norme sulla sicurezza informatica che valgono per le scuole come pubbliche amministrazioni e
dice che cosa, di queste, riguarda BiblioViva. È per il dirigente scolastico, per il DSGA, per il DPO e per il
Responsabile per la transizione digitale.

## Che cosa chiede la norma

- Misure minime di sicurezza ICT per le pubbliche amministrazioni (Circolare AgID 18 aprile 2017, n. 2/2017). Ogni
  amministrazione le adotta e le applica ai propri sistemi informatici: riguardano, tra l'altro, l'inventario dei
  dispositivi e dei programmi, le configurazioni, gli utenti con privilegi di amministratore, le copie di sicurezza e la
  protezione dei dati. Il responsabile della struttura che si occupa di organizzazione, innovazione e tecnologia compila e
  firma il modulo di implementazione allegato alla circolare. Le misure riguardano i sistemi della scuola nel loro
  insieme: un singolo software contribuisce a quelle che lo toccano, e non ne certifica il rispetto.
- GDPR, articolo 32. Il titolare del trattamento, cioè la scuola, adotta misure tecniche e organizzative adeguate al
  rischio, tra cui la riservatezza, la capacità di ripristinare i dati dopo un incidente e la verifica periodica delle
  misure. Gli utenti della biblioteca sono in gran parte minorenni. Vedere
  [Protezione dei dati personali](data-protection.md).
- Regolamento dell'ACN sui servizi cloud per la pubblica amministrazione. Le amministrazioni usano servizi cloud
  qualificati dall'Agenzia per la cybersicurezza nazionale, con livelli che dipendono dalla classificazione dei dati e
  dei servizi. I servizi qualificati sono nel catalogo pubblico dell'ACN.

## Che cosa fa BiblioViva

Ciò che segue è controllato nel codice e nella documentazione tecnica
([Security](../../security.md) e [Deployment](../../deploy.md), in inglese).

### Accessi e permessi

- Per usare BiblioViva serve un account. Tutte le pagine, tranne quella di accesso, richiedono di aver fatto l'accesso;
  anche le foto e le copertine.
- Gli account del personale sono definiti nella configurazione; di norma ce n'è uno per ruolo (amministrazione, prestiti,
  catalogo, tessere, report), condiviso da più persone. Si creano anche account personali, uno per persona, da
  **Amministrazione** → **Account del personale**. Vedere [Gestire gli account del
  personale](../admin/guides/manage-accounts.md).
- Le password non sono conservate: nella configurazione c'è soltanto un valore calcolato dalla password con l'algoritmo
  argon2id (un hash, da cui la password non si ricava). La lunghezza minima di una password è otto caratteri. Un account
  di persona può essere creato con l'obbligo di scegliere la propria password al primo accesso.
- Ogni account può fare soltanto ciò che i permessi dei suoi ruoli consentono. I permessi sono verificati dal server a
  ogni richiesta, non solo nascosti nell'interfaccia. Le copie di sicurezza, gli account, il registro delle operazioni e
  le impostazioni sono riservati al permesso di amministrazione, che di norma ha solo l'account `admin`. L'ultimo
  account con il permesso di amministrazione non si può togliere né ridurre.
- Dopo cinque tentativi di accesso falliti in quindici minuti, per lo stesso nome utente o dallo stesso indirizzo di rete,
  gli altri tentativi sono rifiutati. I due numeri sono impostazioni.
- La sessione è identificata da un codice casuale, conservato nel database solo in forma di hash, e dura per i giorni
  impostati (14 di norma), rinnovandosi con l'uso. Un account disattivato o una password cambiata chiudono le sessioni
  di quell'account.
- Il **Registro operazioni** elenca chi ha fatto che cosa: accessi, modifiche, importazioni, copie di sicurezza. Non
  contiene dati personali degli utenti. Le righe sono cancellate dopo i mesi impostati in **Mesi di registro delle
  operazioni** (24 di norma). Con gli account condivisi il registro riporta il nome dell'account e non quello della
  persona; per sapere chi ha fatto che cosa servono account personali. Vedere
  [Registro operazioni](../admin/screens/audit.md).

### Rete e collegamento

- Con Tailscale il computer di BiblioViva è raggiungibile solo dai dispositivi della rete privata della scuola, non
  da internet; il collegamento usa HTTPS con un certificato valido. Il traffico tra i dispositivi è cifrato da Tailscale.
- Con la rete locale BiblioViva è raggiungibile dai dispositivi collegati alla rete della scuola, con il protocollo
  HTTP: il collegamento non è cifrato e le password viaggiano in chiaro su quella rete. La fotocamera e l'uso da fuori
  scuola non sono disponibili. Questa via è adatta a una rete di cui la scuola si fida. Vedere
  [Scegliere la rete](../setup/choose-network.md).
- Nell'installazione con Docker BiblioViva gira in un contenitore con un utente senza privilegi, con il file system in
  sola lettura tranne le tre cartelle dei dati. Le pagine inviano al browser le intestazioni di sicurezza usuali; i file
  caricati (foto, copertine, archivi, file CSV) sono controllati e le immagini sono ricodificate, per togliere anche i
  dati nascosti come la posizione.
- Le ricerche in internet della scheda di un libro e della copertina inviano soltanto l'ISBN, il titolo o l'autore, mai
  dati degli utenti.

### Copie di sicurezza

- BiblioViva fa da sola una copia del database ogni notte (alle 3:00 di norma), copia anche le foto e le copertine e
  tiene le copie di 30 giorni di norma. Se il computer era spento a quell'ora, la copia è fatta all'avvio successivo.
  Una copia si può fare in qualunque momento con **Esegui backup ora** e si scarica da **Amministrazione** → **Backup**.
- Il ripristino parte da una copia dell'elenco o da un archivio caricato. Prima di ripristinare, BiblioViva controlla
  tutto e mostra che cosa cambierebbe; ripristina solo le parti scelte.
- Una copia esterna è facoltativa e si attiva nell'installazione: su un altro disco, su una chiavetta, su un disco di rete
  o su un servizio di archiviazione di cui la scuola ha già un account. La pagina **Backup** mostra l'esito dell'ultima
  copia esterna e segnala una copia più vecchia di due giorni.
- Le copie di sicurezza non sono cifrate. Contengono i dati di alunni e docenti.

### Aggiornamenti

- BiblioViva non si aggiorna da solo: la configurazione fornita non contiene un servizio di aggiornamento automatico.
  L'aggiornamento è un'operazione di chi amministra il computer, che scarica la nuova versione e riavvia BiblioViva;
  prima si fa una copia di sicurezza. Vedere
  [Aggiornare BiblioViva](../setup/update.md).
- Le librerie di cui BiblioViva si serve sono fissate a versioni esatte; l'elenco è nella pagina
  [Informazioni](../manual/screens/about.md).
- Il sistema operativo del computer e il resto del software installato non sono aggiornati da BiblioViva.

### Cloud

BiblioViva si installa su un computer della scuola e vi tiene i suoi dati: non è un servizio cloud acquistato dalla
scuola, e la qualificazione dell'ACN non lo riguarda. Chi lo offrisse alle scuole come servizio ospitato dovrebbe
verificare le regole dell'ACN per i fornitori di servizi cloud. Due scelte della scuola possono invece coinvolgere un
servizio di terzi:

- Tailscale, se scelto, è un servizio di un'azienda statunitense, che tratta i dati dell'account Tailscale e quelli di
  collegamento dei dispositivi; il contenuto del traffico è cifrato da un dispositivo all'altro. La norma non dice
  espressamente se per questo uso valgano le regole sui servizi cloud: la valutazione è della scuola, con il suo DPO e
  il suo Responsabile per la transizione digitale. Con la rete locale questo servizio non c'è.
- Una copia esterna su un servizio di archiviazione online è un servizio cloud della scuola, e le regole dell'ACN
  valgono per quel servizio, non per BiblioViva.

## Che cosa fa la scuola

- Scegliere dove sta il computer di BiblioViva: in un locale non accessibile a chi non è del personale.
- Decidere chi conosce la password dell'account `admin`, cambiarla quando chi la conosceva lascia l'incarico e dare ai
  colleghi account con i soli permessi che servono. Un account personale per ogni persona che deve essere riconoscibile
  nel registro.
- Aggiornare il sistema operativo del computer e, quando esce una nuova versione, BiblioViva.
- Scegliere dove tenere le copie di sicurezza e chi le può prendere: non sono cifrate, e quindi una chiavetta o un disco
  con le copie va custodito come un archivio di dati personali. Per una destinazione fuori dalla scuola valgono le
  regole sulla protezione dei dati della scuola stessa.
- Provare una volta il ripristino di una copia, per sapere che funziona e quanto tempo richiede. Vedere
  [Ripartire da una copia di sicurezza](../setup/restore.md).
- Scegliere la via di collegamento: Tailscale oppure la rete locale. Con la rete locale, usarla solo su una rete di cui ci
  si fida.
- Tenere i dati del trattamento in ordine (registro dei trattamenti, informativa, misure di sicurezza adottate): vedere
  [Protezione dei dati personali](data-protection.md).
- Compilare il modulo di implementazione delle misure minime dell'AgID per i propri sistemi: BiblioViva ne è uno solo.

## Riferimenti

- [Misure minime di sicurezza ICT per le pubbliche amministrazioni](https://www.agid.gov.it/it/sicurezza/misure-minime-sicurezza-ict),
  Circolare AgID 18 aprile 2017, n. 2/2017, sul sito dell'AgID.
- [Regolamento (UE) 2016/679 (GDPR)](https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32016R0679), su EUR-Lex,
  articolo 32.
- [Cloud per la pubblica amministrazione](https://www.acn.gov.it/portale/cloud), sul sito dell'ACN, con il
  [regolamento](https://www.acn.gov.it/portale/cloud/regolamento-cloud-per-la-pa) e il catalogo dei servizi qualificati.
- [Security](../../security.md): la pagina tecnica di BiblioViva sulla sicurezza, in inglese.
- [Deployment](../../deploy.md): la pagina tecnica sull'installazione, le copie di sicurezza e gli aggiornamenti, in
  inglese.
