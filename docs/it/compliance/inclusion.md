# Inclusione

Questa pagina riguarda le norme sull'inclusione scolastica degli alunni con disabilità e con disturbi specifici
dell'apprendimento (DSA), per la parte che tocca la biblioteca. È per il dirigente scolastico, per i referenti per
l'inclusione e per chi, a scuola, valuta BiblioViva. Quelle norme non pongono requisiti a un software di gestione della
biblioteca: chiedono alla scuola di dare agli alunni gli strumenti e i materiali di cui hanno bisogno. BiblioViva ha
perciò un ruolo limitato, che la pagina descrive.

## Che cosa chiede la norma

- Legge 8 ottobre 2010, n. 170, sui disturbi specifici di apprendimento (dislessia, disgrafia, disortografia,
  discalculia). Gli studenti con diagnosi di DSA hanno diritto a provvedimenti dispensativi e compensativi di flessibilità
  didattica (art. 5, comma 1). Le istituzioni scolastiche garantiscono una didattica individualizzata e personalizzata e
  l'introduzione di strumenti compensativi, compresi i mezzi di apprendimento alternativi e le tecnologie informatiche
  (art. 5, comma 2, lettere a e b).
- Linee guida allegate al D.M. 12 luglio 2011, n. 5669. Attuano la Legge 170/2010 e dicono come la scuola organizza
  gli strumenti e le misure per gli alunni con DSA, a partire dal piano didattico personalizzato.
- Legge 5 febbraio 1992, n. 104, sull'assistenza, l'integrazione sociale e i diritti delle persone con disabilità.
  L'integrazione scolastica si realizza anche con la dotazione alle scuole di attrezzature tecniche, di sussidi didattici
  e di ogni forma di ausilio tecnico (art. 13, comma 1, lettera b), e con le attività di sostegno (art. 13, comma 3).
- Il Piano per l'inclusione (D.Lgs. 13 aprile 2017, n. 66, art. 8). Ogni scuola lo predispone nell'ambito del Piano
  triennale dell'offerta formativa: definisce come si usano le risorse e come si superano le barriere, per progettare e
  programmare gli interventi di miglioramento della qualità dell'inclusione. L'articolo non nomina la biblioteca: se e
  come la biblioteca vi compare lo decide la scuola.

Nessuna di queste norme indica requisiti di funzioni per un software di biblioteca. La parte che riguarda
direttamente BiblioViva come strumento di lavoro del personale è l'accessibilità dell'interfaccia, trattata nella pagina
[Accessibilità](accessibility.md).

## Che cosa fa BiblioViva

### Per chi lavora in biblioteca

L'interfaccia per il personale è progettata per rispettare le WCAG 2.2 di livello AA: uso con la sola tastiera,
lettori di schermo, ingrandimento, contrasto dei colori. I criteri, le verifiche e i limiti noti sono nella pagina
[Accessibilità](accessibility.md).

### Per gli alunni

BiblioViva non ha un catalogo pubblico né account per gli alunni: l'alunno non usa il software, lo usa il personale al
banco. Non contiene diagnosi, piani didattici personalizzati né dati sulla salute degli alunni, e non ha una funzione per
segnare che un alunno ha un DSA o una disabilità.

Per aiutare chi sceglie un libro per un alunno, il catalogo offre:

- I materiali. L'elenco **Materiali** della sezione **Biblioteca e scuola** della Configurazione contiene i tipi di
  materiale della biblioteca (libro, DVD, rivista…). L'amministratore ne aggiunge altri, per esempio un materiale per gli
  audiolibri, e il filtro **Materiale** del catalogo permette di cercare soltanto quel materiale. Ogni materiale può
  avere le sue regole di prestito, come la durata e il numero di libri (vedere [Impostare le regole dei
  prestiti](../admin/guides/set-loan-rules.md)).
- I livelli di lettura. Se la biblioteca li usa, la narrativa porta un **Livello**, un codice di una scala che la scuola
  definisce nel riquadro **Livelli di lettura** della classificazione; i codici forniti con BiblioViva vanno da 1 a 5.
  Il filtro **Livello** del catalogo trova la narrativa di un livello. La scala è della scuola: BiblioViva non dice a
  quale difficoltà di lettura corrisponda un livello, né lo collega a un DSA.
- I soggetti. Il campo **Soggetti** della scheda di un libro contiene parole chiave scelte dalla scuola, e la ricerca del
  catalogo le trova.
- La **Descrizione fisica** e le note del libro, campi di testo liberi.
- I formati accessibili. La scheda di un libro può avere uno o più formati accessibili (alta leggibilità, in simboli per
  la comunicazione aumentativa e alternativa, audiolibro, caratteri grandi, tattile). L'elenco dei formati è della
  scuola: l'amministratore lo modifica nel campo **Formati accessibili** della sezione **Catalogo** della
  Configurazione. Il filtro **Formato accessibile** del catalogo trova i libri con un formato o con uno qualsiasi, e il
  report «Libri accessibili per formato» elenca i libri di ogni formato, con le copie e i prestiti del periodo. I
  referenti per l'inclusione possono così trovare che cosa prestare a un alunno con un DSA o con una disabilità.

I formati accessibili sono un dato del libro, non dell'alunno: BiblioViva non registra nulla sugli alunni che li
usano. Con l'elenco dei formati vuoto il catalogo non li mostra.

BiblioViva non conserva i file dei libri digitali né li legge ad alta voce: registra la copia fisica o il supporto
(per esempio un CD) e il suo prestito.

## Che cosa fa la scuola

- Decidere con i referenti per l'inclusione se la biblioteca fa parte degli strumenti previsti dal piano per l'inclusione
  e dai piani didattici personalizzati, e quali materiali accessibili acquisire.
- Scegliere i formati accessibili dell'elenco della Configurazione e assegnarli ai libri che li hanno; per i materiali
  di tipo diverso dal libro, per esempio i supporti sonori, si può anche usare un materiale dedicato.
- Mettere a disposizione del personale con disabilità la tecnologia assistiva di cui ha bisogno al banco, come detto nella
  pagina [Accessibilità](accessibility.md).
- Non registrare in BiblioViva diagnosi o condizioni di salute degli alunni, nemmeno nelle note: sono categorie
  particolari di dati (art. 9 del GDPR), per le quali la scuola ha altri strumenti. Vedere [Protezione dei dati
  personali](data-protection.md).

## Riferimenti

- [Legge 8 ottobre 2010, n. 170](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2010-10-08;170), su
  Normattiva: nuove norme in materia di disturbi specifici di apprendimento in ambito scolastico.
- [Decreto ministeriale 12 luglio 2011, n. 5669](https://www.istruzione.it/esame_di_stato/Primo_Ciclo/normativa/allegati/prot5669_11.pdf),
  sul sito del Ministero, con le linee guida allegate per il diritto allo studio degli alunni e degli studenti con DSA.
- [Disturbi specifici dell'apprendimento (DSA)](https://www.mim.gov.it/en/disturbi-specifici-dell-apprendimento-dsa-), la
  pagina del Ministero dell'istruzione e del merito.
- [Legge 5 febbraio 1992, n. 104](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1992-02-05;104), su
  Normattiva: legge-quadro per l'assistenza, l'integrazione sociale e i diritti delle persone handicappate.
- [Decreto legislativo 13 aprile 2017, n. 66](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2017-04-13;66),
  su Normattiva: norme per la promozione dell'inclusione scolastica degli studenti con disabilità.
- [Alunni con disabilità](https://www.mim.gov.it/en/alunni-con-disabilita), la pagina del Ministero dell'istruzione e del
  merito.

## Pagine correlate

- [Accessibilità](accessibility.md)
- [Impostare le regole dei prestiti](../admin/guides/set-loan-rules.md)
- [Cercare un libro](../manual/guides/find-a-book.md)
