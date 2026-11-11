# Software libero nella pubblica amministrazione

Questa pagina riguarda le norme del Codice dell'amministrazione digitale sulla scelta e sul riuso del software nelle
pubbliche amministrazioni. È per il dirigente scolastico, per il DSGA e per il Responsabile per la transizione digitale
che devono motivare l'adozione di un software.

## Che cosa chiede la norma

- Codice dell'amministrazione digitale (CAD, D.Lgs. 82/2005), articolo 68. Prima di acquisire un software
  l'amministrazione fa una valutazione comparativa di tipo tecnico ed economico tra le soluzioni disponibili. L'articolo
  le elenca: il software sviluppato per conto della pubblica amministrazione, il riuso di software di altre
  amministrazioni, il software libero o a codice sorgente aperto, il software in cloud, il software proprietario con
  licenza d'uso e le combinazioni di queste soluzioni. La valutazione tiene conto del costo complessivo, dell'uso di
  formati di dati aperti e di standard di interoperabilità, e delle garanzie del fornitore su sicurezza, protezione dei
  dati e livelli di servizio.
- CAD, articolo 69. Riguarda il riuso: l'amministrazione che è titolare di software sviluppato su sue specifiche
  indicazioni deve renderne disponibile il codice sorgente, con la documentazione, in un repertorio pubblico e con
  licenza aperta. Non riguarda una scuola che usa un software già esistente, come BiblioViva.
- Linee guida dell'AgID su acquisizione e riuso di software per le pubbliche amministrazioni. Spiegano come fare la
  valutazione comparativa e come pubblicare il software da riusare.
- Catalogo di Developers Italia. È l'elenco del software libero che le amministrazioni possono riusare. Vi si entra
  con un file di descrizione, `publiccode.yml`, nel repository pubblico del software.

La norma non dice se e come documentare la valutazione comparativa per un software che si scarica gratuitamente: è una
decisione della scuola.

## Che cosa fa BiblioViva

### Licenza

BiblioViva è software libero, con licenza GNU General Public License versione 3 o successiva (GPL-3.0-or-later).
La licenza permette a chiunque, scuola compresa, di:

- usare il software per qualunque scopo, senza pagare alcuna licenza;
- studiarne il codice sorgente;
- modificarlo;
- ridistribuirlo, anche modificato, con la stessa licenza.

Il codice sorgente è pubblico su [GitHub](https://github.com/itotm/biblioviva). La licenza e l'indirizzo del codice si
leggono anche nella pagina [Informazioni](../manual/screens/about.md) di BiblioViva; la stessa pagina elenca le
**Librerie utilizzate**, cioè i programmi di altri che sono dentro BiblioViva.

### Il file publiccode.yml

Nella cartella principale del repository c'è il file
[publiccode.yml](https://github.com/itotm/biblioviva/blob/main/publiccode.yml). È scritto secondo lo standard
[publiccode.yml](https://yml.publiccode.tools) (versione `0`) e descrive il software in modo che un catalogo lo possa
leggere da sé: il nome, l'indirizzo del codice e della documentazione, la licenza, la categoria (sistema integrato di
biblioteca), il tipo (applicazione web), lo stato di sviluppo (beta), l'ambito (istruzione, Italia), le descrizioni in
italiano e in inglese, il riferimento di chi mantiene il progetto e la dipendenza da Docker.

Il catalogo di Developers Italia legge il file dai repository pubblici. Se BiblioViva sia presente nel catalogo si
controlla sul sito di [Developers Italia](https://developers.italia.it). Un test del progetto controlla che il file
rispetti i campi obbligatori e i valori ammessi dallo standard.

### Dati utilizzabili fuori da BiblioViva

I dati restano nei formati seguenti, leggibili senza BiblioViva (la pagina [Esportazioni](../admin/screens/exports.md)
descrive le voci).

- Elenchi in CSV, da **Amministrazione** → **Esportazioni**: alunni, docenti, catalogo (una riga per copia), prestiti
  in corso e storico dei prestiti. I primi quattro sono nel formato delle importazioni di BiblioViva.
- Il catalogo in MARC 21 e in UNIMARC, in ISO 2709 e in MARCXML, dal menu **Esporta** del Catalogo (anche per una lista
  di stampa di copie e per le copie mancanti di un inventario): sono i formati in cui i programmi di biblioteca si
  scambiano i record.
- Un unico file JSON con utenti, catalogo, prestiti e liste, «per passare a un'altra installazione o a un altro
  programma».
- I dati di una singola persona, in JSON, dalla scheda dell'utente, per rispondere a una richiesta di accesso.
- Le tabelle e i report che si scaricano dai loro elenchi, in CSV o in ODS (il formato aperto dei fogli di
  calcolo di LibreOffice).
- La configurazione come un unico archivio ZIP, da **Amministrazione** → **Configurazione**.
- Le copie di sicurezza: il database è un file SQLite, un formato aperto e documentato, e **Esporta tutto** scarica un
  archivio ZIP con il database, le foto, le copertine e la configurazione. Si ripristinano su un'altra installazione
  di BiblioViva.

Il catalogo si esporta nei formati MARC 21 e UNIMARC, che molti programmi di biblioteca leggono, e si importa da un file
MARC: una scuola può quindi lasciare BiblioViva o arrivarci da un altro programma (Koha, SebinaNEXT, Clavis). Se il
programma di destinazione legga i campi delle copie come BiblioViva li scrive va controllato al momento del passaggio.

## Che cosa fa la scuola

- La valutazione comparativa dell'articolo 68 resta alla scuola, che confronta BiblioViva con le altre soluzioni che
  ritiene possibili e ne motiva la scelta.
- Nella valutazione la scuola può citare: la licenza libera e l'assenza di costo di licenza; il codice pubblico; la
  documentazione, che è pubblica; il file `publiccode.yml`, con la presenza o meno nel catalogo di Developers Italia; i
  formati di esportazione descritti sopra, che rispondono al criterio dei formati di dati aperti.
- Considerare nel costo complessivo anche ciò che il software gratuito non include: il computer su cui installarlo, chi
  lo gestisce e come si ottiene assistenza; il file `publiccode.yml` dichiara una manutenzione di comunità.
- Le garanzie su sicurezza e protezione dei dati che l'articolo 68 chiede ai fornitori, per BiblioViva sono quelle che
  la scuola stessa assicura sul proprio computer: vedere [Sicurezza informatica](security.md) e [Protezione dei dati
  personali](data-protection.md).

## Riferimenti

- [Codice dell'amministrazione digitale (D.Lgs. 7 marzo 2005, n. 82)](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82),
  su Normattiva, con l'[articolo 68](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82~art68)
  e l'[articolo 69](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82~art69).
- [Linee guida su acquisizione e riuso di software per le pubbliche amministrazioni](https://www.agid.gov.it/it/design-servizi/riuso-open-source/linee-guida-acquisizione-riuso-software-pa),
  sul sito dell'AgID.
- [Developers Italia](https://developers.italia.it), il catalogo del software libero per la pubblica amministrazione.
- [Standard publiccode.yml](https://yml.publiccode.tools).
- [GNU General Public License, versione 3](https://www.gnu.org/licenses/gpl-3.0.html), testo della licenza.
- Il codice di BiblioViva su [GitHub](https://github.com/itotm/biblioviva).
