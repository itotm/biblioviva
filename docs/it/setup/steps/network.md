# Preparare la rete

Questo passo prepara ciò che serve fuori dal computer di BiblioViva perché gli altri dispositivi della scuola lo
raggiungano: con Tailscale un account della scuola e una chiave di accesso, con la rete locale un indirizzo che non
cambia. Dura circa 15 minuti con Tailscale e circa 10 minuti con la rete locale, più l'attesa di chi gestisce la rete
della scuola. La scelta tra le due strade è spiegata in [Scegliere la rete](../choose-network.md).

## Occorrente

<!-- variant: tailscale -->
**Con Tailscale**

- Un account Google, Microsoft, GitHub o Apple con cui aprire l'account di Tailscale. L'account di Tailscale è uno
  solo per tutta la scuola, non uno per persona: conviene un account della scuola, non personale.
- Un computer qualsiasi con un browser, collegato a internet.
- Un luogo sicuro dove annotare la chiave di accesso fino al passo 4 (un foglio in un cassetto chiuso, un gestore di
  password).
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

- Il nome della persona (o della ditta) che gestisce la rete e il router della scuola.
- Il computer di BiblioViva, con il nome `biblioviva` dato al passo 1, collegato alla rete della scuola.
<!-- /variant -->

## Procedura

<!-- variant: tailscale -->
**Con Tailscale**

### Account

1. Aprire la pagina di iscrizione di [Tailscale](https://login.tailscale.com/start).
1. Scegliere come accedere: «Google», «Microsoft», «GitHub» o «Apple». Tailscale non usa password proprie: si
   entra sempre con uno di questi account. Per scegliere si può leggere la pagina
   [Supported SSO identity providers](https://tailscale.com/kb/1013/sso-providers) di Tailscale.
1. Seguire le domande di Tailscale fino alla console di amministrazione. L'applicazione di Tailscale non va
   installata in questo passo: si installa al passo 5, sul computer del primo avvio, e al passo 6, sugli altri
   dispositivi.

> [!IMPORTANT]
> L'account di Tailscale della scuola è uno solo e serve a ogni dispositivo che usa BiblioViva (il computer del banco,
> gli altri computer, i tablet e i telefoni). L'account scelto deve restare nelle mani della scuola: annotare quale
> è e chi lo conosce. Il confronto con gli account personali è in [Scegliere la rete](../choose-network.md).

### Nomi e certificati

1. Aprire la pagina «DNS» della [console di amministrazione](https://login.tailscale.com/admin/dns) di Tailscale.
1. Verificare che «MagicDNS» sia attivo; se non lo è, premere «Enable MagicDNS». MagicDNS dà ai dispositivi un
   nome leggibile al posto di un numero; è spiegato nella pagina [MagicDNS](https://tailscale.com/kb/1081/magicdns).
1. Nella stessa pagina, alla voce «HTTPS Certificates», premere «Enable HTTPS» e confermare l'avviso. Tailscale
   avverte che i nomi dei computer della rete compaiono nei registri pubblici dei certificati. Il nome del computer di
   BiblioViva è `biblioviva`, senza dati della scuola. La pagina
   [HTTPS certificates](https://tailscale.com/kb/1153/enabling-https) spiega il resto. Questo passo dà a BiblioViva il
   lucchetto del browser, necessario alla fotocamera.
1. Annotare il nome della rete della scuola (in inglese *tailnet*, vedere il
   [glossario](../../help/glossary.md#tailnet)), scritto nella pagina «DNS»: finisce con `.ts.net`. Servirà ai
   passi 5 e 6.

### Etichetta del computer

1. Aprire la pagina «Access controls» della [console di amministrazione](https://login.tailscale.com/admin/acls). Si
   vede il file delle regole di accesso della rete, un testo tra parentesi graffe.
1. Aggiungere al file la voce `tagOwners` con l'etichetta di BiblioViva. L'etichetta (`tag:biblioviva`) è il modo in
   cui Tailscale riconosce il computer di BiblioViva come un servizio della scuola e non come il dispositivo di una
   persona.

   ```json
   "tagOwners": {
     "tag:biblioviva": ["autogroup:admin"]
   },
   ```

   La voce va dentro le parentesi graffe più esterne del file, come una sezione accanto a quelle già presenti, con
   la virgola che separa le sezioni. Se il file contiene già una sezione `tagOwners`, aggiungere soltanto la riga
   `"tag:biblioviva": ["autogroup:admin"]` al suo interno, separata dalle altre da una virgola.

   > [!WARNING]
   > Non cancellare né modificare le altre sezioni del file (`grants`, `acls`, `ssh` e le altre): regolano che cosa i
   > dispositivi della rete possono fare. In caso di dubbio, copiare l'intero testo del file in un documento prima di
   > modificarlo. La sintassi del file è spiegata nella pagina [Policy
   > syntax](https://tailscale.com/kb/1337/policy-syntax).

1. Salvare il file con il pulsante di salvataggio della pagina. Tailscale controlla il testo e segnala gli errori
   prima di salvare. [VERIFY: nome del pulsante di salvataggio nell'editor delle regole, accessibile solo con l'accesso]

### Chiave di accesso

1. Aprire la pagina «Keys» della [console di amministrazione](https://login.tailscale.com/admin/settings/keys).
1. Premere «Generate auth key». La pagina [Auth keys](https://tailscale.com/kb/1085/auth-keys) di Tailscale descrive
   il modulo.
1. Scrivere una descrizione, per esempio `BiblioViva`.
1. Attivare «Reusable» (la chiave si può usare più volte, utile se l'installazione va rifatta).
1. Attivare «Pre-approved». «Ephemeral» resta spento: altrimenti il computer sparirebbe dalla rete quando si spegne.
1. Alla voce «Tags» attivare l'opzione dei tag e scegliere `tag:biblioviva`. Se l'etichetta non è nell'elenco, il
   file delle regole non è stato salvato: tornare alla parte «Etichetta del computer».
1. Lasciare la durata («Expiry») che propone Tailscale, al massimo 90 giorni. La chiave serve solo al passo 4, quando
   il computer entra nella rete: dopo, il computer resta nella rete anche se la chiave scade.
1. Premere «Generate key» e copiare la chiave che compare. Tailscale la mostra una volta sola.
1. Incollare la chiave nel luogo sicuro scelto. Serve al passo 4, quando `setup.sh` la chiede.

> [!IMPORTANT]
> La chiave è un segreto: chi la possiede può aggiungere dispositivi alla rete della scuola. Non spedirla per posta
> elettronica, non scriverla in una chat, non fotografarla. Se è stata vista da chi non deve, revocarla dalla stessa
> pagina «Keys» e generarne un'altra.

<!-- screenshot: tailscale/dns | La pagina DNS della console di Tailscale con MagicDNS e HTTPS Certificates attivi, e il nome della rete che finisce con .ts.net -->
<!-- screenshot: tailscale/auth-key | Il modulo Generate auth key con Reusable, Pre-approved e il tag tag:biblioviva -->
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

1. Chiedere a chi gestisce la rete della scuola di riservare un indirizzo al computer `biblioviva`, cioè di fare in
   modo che il router gli assegni sempre lo stesso indirizzo. Si chiama «prenotazione DHCP» o «indirizzo riservato»
   (vedere il [glossario](../../help/glossary.md#prenotazione-dhcp)). Senza questa riserva l'indirizzo può
   cambiare quando il computer si riavvia, e i segnalibri smettono di funzionare.
1. Dare a chi gestisce la rete il nome del computer (`biblioviva`). Se il router chiede anche l'indirizzo fisico (MAC),
   la persona lo trova nell'elenco dei dispositivi collegati al router.
1. Annotare l'indirizzo riservato che comunica la persona (per esempio `192.168.1.50`): serve per aprire BiblioViva
   dai computer dove il nome `biblioviva.local` non funziona.
1. Chiedere che la porta `8080` non sia bloccata tra i computer del banco e il computer di BiblioViva. In una rete
   domestica o di una scuola piccola non lo è di norma; lo può essere in una rete con filtri o con reti separate per
   il collegamento a cavo e il Wi-Fi.

> [!NOTE]
> Il nome `biblioviva.local` funziona di solito dai computer della stessa rete e si può usare al posto dell'indirizzo;
> la verifica è al passo 6. Su un PC con Debian o Ubuntu il programma di installazione del passo 4 aggiunge il servizio
> necessario (`avahi-daemon`) quando manca; il Raspberry Pi risponde a quel nome da solo.

> [!NOTE]
> Con la rete locale la fotocamera, l'installazione dell'applicazione sul telefono e l'uso da fuori della scuola non
> funzionano. Il lettore di codici a barre USB e il resto di BiblioViva funzionano normalmente. Il confronto
> completo è in [Scegliere la rete](../choose-network.md); la strada si può cambiare più avanti.
<!-- /variant -->

## Verifica prima di proseguire

<!-- variant: tailscale -->
**Con Tailscale**

- Nella pagina «DNS» della console, «MagicDNS» e «HTTPS Certificates» risultano attivi.
- Il file delle regole di accesso, in «Access controls», contiene `tag:biblioviva` nella sezione `tagOwners` ed è
  salvato.
- La chiave di accesso è annotata nel luogo sicuro e comincia con `tskey-auth-`.
- Il nome della rete che finisce con `.ts.net` è annotato.

Se uno dei punti manca, tornare alla procedura prima di passare al passo 4: l'installazione si ferma senza una chiave
valida.
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

- Chi gestisce la rete ha confermato che l'indirizzo è riservato al computer `biblioviva`.
- L'indirizzo (per esempio `192.168.1.50`) è annotato.
- La persona che gestisce la rete sa che la porta `8080` deve restare aperta.

Se la riserva non si può ottenere subito, si può proseguire: BiblioViva funziona comunque, ma l'indirizzo potrebbe
cambiare al primo riavvio del computer, e va rifatta la ricerca descritta al passo 6.
<!-- /variant -->

## Possibili problemi

<!-- variant: tailscale -->
**Con Tailscale**

- Il tag `tag:biblioviva` non compare tra quelli scelti nel modulo della chiave: la voce `tagOwners` non è stata salvata
  o contiene un errore. Aprire di nuovo «Access controls» e controllare che il testo sia salvato.
- Dopo l'installazione l'avviso «requested tags are invalid or not permitted» indica la stessa causa; la soluzione
  tecnica è nella pagina [Deployment notes (technical)](../../../deploy.md) (in inglese).
- Il nome della rete contiene il nome della scuola: nella pagina «DNS» il pulsante «Rename tailnet» permette di
  scegliere un nome casuale tra quelli proposti. Farlo prima di attivare i certificati, perché cambiare il nome più
  tardi interrompe i collegamenti già in uso. La pagina [Tailnet name](https://tailscale.com/kb/1217/tailnet-name)
  descrive i limiti.
<!-- /variant -->
<!-- variant: lan -->
**Con la rete locale**

- Chi gestisce la rete non sa che cosa sia una prenotazione DHCP: è una funzione del router, descritta nelle sue
  impostazioni come «DHCP statico», «indirizzo riservato» o «prenotazione indirizzo». Il glossario ne dà una
  spiegazione per chi non è del mestiere.
<!-- /variant -->

## Pagine correlate

- Passo precedente: [Collegarsi al computer](terminal.md)
- Passo successivo: [Installare BiblioViva](install.md)
- [Scegliere la rete](../choose-network.md)
- [Glossario](../../help/glossary.md)
