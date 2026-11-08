# Altre norme

Questa pagina elenca le norme che si possono credere applicabili a una scuola che adotta un software di biblioteca, ma che
non riguardano BiblioViva, o lo riguardano solo in parte. Per ciascuna dice che cosa chiede la norma e perché non si
applica, oppure che cosa fa BiblioViva al riguardo. È per il dirigente scolastico, il DSGA, il DPO e il responsabile per
la transizione digitale.

## European Accessibility Act

La direttiva (UE) 2019/882, recepita in Italia con il D.Lgs. 82/2022, fissa requisiti di accessibilità per alcuni prodotti
e servizi offerti ai consumatori: per esempio computer, commercio elettronico, servizi bancari, libri elettronici e
trasporti. Un software gratuito che una scuola installa per il proprio personale non è un prodotto né un servizio per i
consumatori, e la direttiva non riguarda BiblioViva. Le regole di accessibilità che valgono per la scuola sono quelle
della Legge 4/2004, descritte nella pagina [Accessibilità](accessibility.md).

## NIS 2

La direttiva (UE) 2022/2555 (NIS 2), recepita con il D.Lgs. 138/2024, chiede ai soggetti che rientrano nel suo ambito di
registrarsi sulla piattaforma dell'Agenzia per la cybersicurezza nazionale (ACN), di adottare misure di sicurezza e di
notificare gli incidenti significativi. Tra le pubbliche amministrazioni rientrano quelle elencate nell'allegato III del
decreto, indipendentemente dalla dimensione.

Le domande frequenti dell'ACN (risposta AMB.PU.1, sull'ambito) elencano le scuole tra i soggetti che, in via generale, non
rientrano nell'ambito di applicazione. L'elenco è detto indicativo e non esaustivo, e l'eccezione riguarda i soggetti che
svolgono attività degli allegati I e II del decreto o che ricevono una comunicazione di designazione dall'ACN. Lo stesso
risultato è riportato da [ItaliaOggi](https://www.italiaoggi.it/settori/scuola/nuove-regole-per-la-cybersecurity-scuole-fuori-gdnx5m35):
le scuole primarie e secondarie sono fuori dall'ambito e non devono registrarsi sulla piattaforma dell'ACN.
Salvo una designazione dell'ACN, dalla NIS 2 non nasce quindi per la scuola un obbligo che riguardi BiblioViva.
Restano le misure minime di sicurezza ICT dell'AgID e l'articolo 32 del GDPR, descritti nella pagina [Sicurezza
informatica](security.md).

## Identità digitale, SPID e CIE

L'articolo 64 del CAD dispone che le pubbliche amministrazioni, quando per un servizio online chiedono
l'identificazione dell'utente, la facciano con SPID (il Sistema pubblico di identità digitale) o con la carta d'identità
elettronica (CIE). La norma riguarda i servizi che l'amministrazione offre ai cittadini in rete. BiblioViva non ha un
accesso per alunni, famiglie o altri cittadini: vi entra soltanto il personale della biblioteca, con un account definito
nella configurazione o creato dall'amministratore. La norma non riguarda BiblioViva.

## pagoPA

L'articolo 5 del CAD obbliga le pubbliche amministrazioni ad accettare i pagamenti a loro favore con strumenti
elettronici, tramite la piattaforma nazionale pagoPA. BiblioViva non gestisce pagamenti: non prevede multe, penali o
altri importi per i ritardi o per i libri smarriti (di un ritardo si mostrano soltanto i giorni), e non registra il
prezzo delle copie. La norma non riguarda BiblioViva.

## Diritto d'autore e copertine

La Legge 633/1941 protegge il diritto d'autore. Le copertine dei libri sono immagini che possono essere protette, e
BiblioViva le tratta così:

- Per impostazione predefinita cerca la copertina per ISBN presso Amazon e Open Library e la salva sul computer della
  scuola, ridotta di norma a 600 pixel di larghezza; Google Books è disponibile ma spento (`covers.providers` in
  `config/config.example.json`). L'operatore può anche fotografare o caricare la copertina di una copia.
- Le copertine si vedono soltanto nelle pagine del catalogo, dopo l'accesso con un account del personale: BiblioViva non
  ha un catalogo pubblico e non le pubblica altrove.
- Le copertine si spengono con l'impostazione **Copertine dei libri** (`covers.enabled`): non si cercano più in rete, non
  si fotografano né si caricano, e il catalogo non le mostra. Spegnerle non cancella i file già salvati. La procedura è
  nella guida [Disattivare le foto o le copertine](../admin/guides/switch-off-photos-or-covers.md).

La legge non prevede espressamente questo uso interno delle copertine, cioè mostrarle al solo personale dentro un
catalogo di biblioteca. BiblioViva non dà una risposta: la decisione di tenere le copertine accese è della scuola, che
può chiedere il parere del suo DPO o di un legale.

BiblioViva stesso è software libero con licenza GPL-3.0-or-later; le librerie che contiene mantengono le loro licenze, e
la pagina [Informazioni](../manual/screens/about.md) le elenca nella sezione **Librerie utilizzate**. Della licenza
tratta la pagina [Software libero](open-source.md).

## Documenti informatici e conservazione

Le linee guida dell'AgID sulla formazione, gestione e conservazione dei documenti informatici regolano come le
pubbliche amministrazioni formano, protocollano, tengono e conservano i propri documenti: il sistema di gestione
documentale della scuola, con il suo protocollo informatico e la conservazione degli atti.

BiblioViva non è un sistema di gestione documentale né di conservazione. Tiene i registri di lavoro della biblioteca:
l'anagrafica degli utenti, il catalogo, i prestiti, le liste e i report. Un atto della scuola, per esempio il decreto con
cui il dirigente scolastico scarica un bene dall'inventario, si forma, si protocolla e si conserva con il sistema di
protocollo della scuola. Un elenco esportato da BiblioViva in CSV o in ODS può accompagnare l'atto, se la scuola lo
decide.

La norma non dice espressamente se i registri di una biblioteca scolastica, come lo storico dei prestiti, siano da
trattare come documenti amministrativi da conservare: la risposta spetta alla scuola, al suo responsabile della gestione
documentale e al suo DPO. Il tempo di conservazione dei dati degli utenti e dei prestiti è descritto nella pagina
[Protezione dei dati personali](data-protection.md).

## Riferimenti

- [Direttiva (UE) 2019/882](https://eur-lex.europa.eu/eli/dir/2019/882/oj/ita), su EUR-Lex, e il
  [D.Lgs. 27 maggio 2022, n. 82](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2022-05-27;82),
  su Normattiva.
- [Direttiva (UE) 2022/2555 (NIS 2)](https://eur-lex.europa.eu/eli/dir/2022/2555/oj/ita), su EUR-Lex, e il
  [D.Lgs. 4 settembre 2024, n. 138](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2024-09-04;138),
  su Normattiva.
- [NIS](https://www.acn.gov.it/portale/nis), la pagina dell'ACN, e le sue
  [domande frequenti sull'ambito](https://www.acn.gov.it/portale/faq/nis/ambito) (risposta AMB.PU.1).
- [Nuove regole per la cybersecurity, scuole fuori](https://www.italiaoggi.it/settori/scuola/nuove-regole-per-la-cybersecurity-scuole-fuori-gdnx5m35),
  articolo di ItaliaOggi (in parte a pagamento).
- CAD, [articolo 5](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82~art5)
  (pagamenti) e [articolo 64](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82~art64)
  (identità digitale), su Normattiva.
- [SPID](https://www.spid.gov.it/), [CIE](https://www.cartaidentita.interno.gov.it/) e
  [pagoPA](https://www.pagopa.gov.it/), i siti dei tre sistemi.
- [Legge 22 aprile 1941, n. 633](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1941-04-22;633), su
  Normattiva.
- [Linee guida](https://www.agid.gov.it/it/linee-guida) dell'AgID, con le linee guida sulla formazione, gestione e
  conservazione dei documenti informatici.

## Pagine correlate

- [Norme](README.md)
- [Accessibilità](accessibility.md)
- [Sicurezza informatica](security.md)
- [Software libero](open-source.md)
