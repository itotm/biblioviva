# Accessibilità

Questa pagina riguarda le norme sull'accessibilità degli strumenti informatici delle pubbliche amministrazioni, cioè la
Legge 4/2004 e le linee guida dell'AgID. È per il dirigente scolastico, per il Responsabile per la transizione digitale
e per chi, a scuola, valuta BiblioViva prima di adottarlo.

## Che cosa chiede la norma

- Legge 4/2004 (detta «Legge Stanca»), modificata dal D.Lgs. 106/2018, che recepisce la direttiva (UE) 2016/2102.
  Obbliga le pubbliche amministrazioni, scuole statali comprese, a rendere accessibili i loro strumenti informatici.
- Linee guida dell'AgID sull'accessibilità degli strumenti informatici. Rimandano alla norma europea EN 301 549 nella
  versione 3.2.1. Per i contenuti web la norma richiede la conformità alle WCAG 2.1 di livello AA. Le WCAG («Web Content
  Accessibility Guidelines») sono le linee guida internazionali del W3C: un elenco di criteri verificabili, come il
  contrasto dei colori, l'uso con la sola tastiera, i messaggi di errore comprensibili. Il livello AA è il livello
  intermedio, quello richiesto.
- Applicazioni su una rete interna. Le linee guida (paragrafo 2.2) estendono i requisiti del web anche alle
  applicazioni internet rese disponibili su reti intranet. BiblioViva si apre dal browser sulla rete della scuola o su
  quella privata di Tailscale: è un'applicazione web usata su una rete interna. Per prudenza conviene trattarla come
  soggetta ai requisiti, perché rientra nella descrizione delle linee guida.
- Dipendenti con disabilità (Legge 4/2004, art. 4, comma 4). Il datore di lavoro dà al dipendente con disabilità
  l'hardware, il software e le tecnologie assistive adatti al suo lavoro. Un membro del personale che usa un lettore di
  schermo o un ingranditore deve poter lavorare al banco della biblioteca con BiblioViva.
- Versione 4.1.1 della EN 301 549. È stata pubblicata ed è allineata alle WCAG 2.2. Diventa il riferimento di legge
  quando viene citata nella Gazzetta ufficiale dell'Unione europea e l'AgID aggiorna le sue linee guida. Le WCAG 2.2
  comprendono i criteri delle WCAG 2.1.
- European Accessibility Act (direttiva (UE) 2019/882, D.Lgs. 82/2022). Riguarda prodotti e servizi offerti ai
  consumatori. Un software gratuito che una scuola installa per il proprio personale non è uno di questi: la norma non
  riguarda BiblioViva.
- Dichiarazione di accessibilità. È il documento, compilato sul modulo dell'AgID, con cui un'amministrazione dice a
  che punto è l'accessibilità dei propri siti web e delle proprie applicazioni mobili. Le linee guida non prevedono
  espressamente una dichiarazione per uno strumento interno come BiblioViva. Se la scuola decide di farne una, questa
  pagina e la [pagina tecnica](../../accessibility.md) sono il materiale di partenza.

## Che cosa fa BiblioViva

L'obiettivo del progetto è la conformità alle WCAG 2.2 di livello AA, che comprende il livello AA delle WCAG 2.1 richiesto
oggi. Vale per l'applicazione, per il sito della documentazione e per la pagina di presentazione.

### Come si verifica

- Ogni pagina principale è controllata da uno strumento automatico di verifica dell'accessibilità a ogni esecuzione dei
  test del progetto, sia nella finestra da computer sia in quella da telefono. Lo stesso controllo è fatto su un modulo
  con errori, su una finestra di dialogo aperta e sulla fotocamera aperta su un telefono. Il progetto non ammette
  violazioni gravi.
- Il banco prestiti è provato con la sola tastiera, come avviene con il lettore di codici a barre USB, che scrive come
  una tastiera. Sono provati anche il collegamento per saltare al contenuto, che il primo tasto Tab raggiunge, il segno
  visibile del punto in cui si trova la tastiera e lo spostamento negli elenchi con le frecce.
- Undici pagine principali sono provate alla larghezza di 320 pixel, quella di una pagina ingrandita al 400 %, e nessun
  elemento deve uscire dalla finestra.
- Il contrasto dei colori è controllato per ognuno dei set di colori di BiblioViva: testi, pulsanti, bordi dei campi e
  testo di suggerimento.
- Nei moduli, il suggerimento e gli errori di un campo sono collegati al campo stesso, così che un lettore di schermo li
  legga insieme ad esso. Un lettore di schermo è un software che legge ad alta voce ciò che compare nella pagina, usato
  da chi non vede o vede poco.

Queste sono verifiche del progetto stesso. Gli strumenti automatici non coprono tutti i criteri. Per questo il progetto
prevede anche verifiche a mano prima di ogni versione che cambia le schermate: un lettore di schermo sul banco prestiti
(NVDA con Firefox o Chrome, Orca su Linux), un modulo con errori, gli elenchi, le finestre di dialogo e le notifiche; lo
zoom al 200 % e al 400 %; la spaziatura del testo; i temi a contrasto elevato di Windows.

### Che cosa è rispettato

- La lingua della pagina segue quella dell'installazione. Ogni pagina ha un titolo proprio, una sola area principale,
  un collegamento per saltare al contenuto e menu con un nome.
- I messaggi del banco prestiti sono annunciati dai lettori di schermo e dicono sempre che cosa è successo con colore,
  icona e testo: il colore non è mai l'unico indizio. Dopo ogni lettura il cursore resta nel campo di lettura.
- La fotocamera non è mai indispensabile. Ogni codice si può scrivere o leggere con il lettore USB, e ogni foto o
  copertina si può caricare come file.
- Nessuna operazione richiede di trascinare con il mouse: il ritaglio di una foto, gli angoli di una copertina e le
  cornici di una foto di classe si spostano con le frecce e con un tocco. Nel disegno dei modelli di stampa le posizioni
  si regolano con le frecce e con campi numerici.
- Le finestre di dialogo tengono la tastiera al loro interno, si chiudono con il tasto Esc e riportano la tastiera dove
  era prima. I pulsanti con la sola icona hanno un nome leggibile dai lettori di schermo.
- La pagina di accesso accetta il gestore di password e l'incolla della password e non propone prove di memoria o di
  calcolo.
- L'accesso dura giorni e si rinnova con l'uso: nessun limite di tempo interrompe il lavoro.
- Le dimensioni del testo seguono quelle del browser e lo zoom non è mai bloccato. Sul telefono i pulsanti sono grandi
  almeno 44 pixel. Se il sistema chiede meno movimento, le animazioni sono disattivate.

### Limiti noti

- Sul computer la barra in alto mostra il titolo della pagina su una sola riga; il titolo intero è nella descrizione
  che compare al passaggio del mouse e nell'intestazione della pagina. Sul telefono, e quindi con qualunque ingrandimento
  forte, il titolo è mostrato per intero.
- Il tasto Tab raggiunge prima il menu, poi la pagina e infine i pulsanti della barra in alto (aiuto, account): è
  l'ordine del documento.
- Un titolo in una lingua diversa da quella dell'installazione, per esempio il titolo di un libro in inglese in una
  scheda in italiano, non è segnalato come tale ai lettori di schermo, perché la scheda di un libro non ha un campo per
  la lingua.

Il dettaglio dei criteri e dei test è nella pagina tecnica [Accessibility](../../accessibility.md), in inglese.

## Che cosa fa la scuola

- Prendere questa pagina e la [pagina tecnica](../../accessibility.md) come autovalutazione del software, da citare nella
  valutazione di BiblioViva.
- Decidere con il Responsabile per la transizione digitale se la scuola vuole una dichiarazione di accessibilità che
  comprenda BiblioViva. Le linee guida non lo chiedono espressamente, come detto sopra.
- Dare al membro del personale che ne ha bisogno la tecnologia assistiva necessaria al lavoro al banco: un lettore di
  schermo, un ingranditore, una tastiera adatta.
- Provare BiblioViva con la tecnologia assistiva che la scuola ha già, e segnalare i problemi trovati.
- Segnalare un problema di accessibilità aprendo una segnalazione («issue») tra le [segnalazioni del
  progetto su GitHub](https://github.com/itotm/biblioviva/issues): serve un account GitHub, gratuito.

## Riferimenti

- [Legge 9 gennaio 2004, n. 4](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2004-01-09;4), su Normattiva.
- [Decreto legislativo 10 agosto 2018, n. 106](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2018-08-10;106),
  su Normattiva.
- [Direttiva (UE) 2016/2102](https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32016L2102), su EUR-Lex.
- [Accessibilità e usabilità](https://www.agid.gov.it/it/ambiti-intervento/accessibilita-usabilita), pagina dell'AgID con
  le linee guida e il modulo della dichiarazione.
- [Linee guida per l'accessibilità dei contenuti Web (WCAG) 2.2](https://www.w3.org/Translations/WCAG22-it/),
  traduzione italiana autorizzata dal W3C. Fa fede il testo inglese, [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- [EN 301 549 v3.2.1](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf) e
  [EN 301 549 v4.1.1](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/04.01.01_60/en_301549v040101p.pdf), su
  ETSI, in inglese.
- [Accessibility](../../accessibility.md): la pagina tecnica di BiblioViva, in inglese.
