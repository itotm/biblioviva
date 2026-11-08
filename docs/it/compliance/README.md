# Norme

Questa sezione raccoglie ciò che le norme chiedono a una scuola che adotta BiblioViva, ciò che BiblioViva fa al riguardo
e ciò che resta alla scuola. È scritta per il dirigente scolastico, il DSGA, il responsabile della protezione dei dati
(DPO) e il responsabile per la transizione digitale (RTD).

Le pagine danno i fatti utili alle valutazioni della scuola, ciascuno controllato nel codice di BiblioViva; le decisioni
spettano alla scuola e al suo DPO, e le pagine non sono una consulenza legale. Dove la norma lascia un punto aperto, la
pagina lo dice.

## Perché queste norme

Una scuola statale è una pubblica amministrazione: il [D.Lgs. 165/2001, articolo 1, comma
2](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2001-03-30;165~art1) comprende «gli istituti
e scuole di ogni ordine e grado» tra le amministrazioni dello Stato. Per questo agli strumenti che la scuola adotta si
applicano le norme sulle pubbliche amministrazioni, in particolare quelle sul software, sull'accessibilità e sulla
sicurezza informatica, oltre alle norme sulla protezione dei dati che valgono per ogni titolare del trattamento.

Il Codice dell'amministrazione digitale (CAD) affida a ogni amministrazione un responsabile per la transizione digitale
([articolo
17](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82~art17)), l'ufficio o la
persona che segue le questioni digitali, tra cui la sicurezza, l'accessibilità e l'acquisto di software. Nelle scuole è
la figura che di solito valuta, con il dirigente scolastico e il DPO, un software come BiblioViva.

## Quadro delle norme

La tabella elenca le norme che riguardano una scuola che adotta BiblioViva. La colonna «Che cosa fa BiblioViva» dice ciò
che il software fa oggi; la pagina indicata nell'ultima colonna dà i dettagli, ciò che resta alla scuola e i
riferimenti ufficiali.

### Protezione dei dati

| Norma | Che cosa chiede | Che cosa fa BiblioViva | Pagina |
|---|---|---|---|
| Regolamento (UE) 2016/679 (GDPR) | Alla scuola, titolare del trattamento: registro dei trattamenti, informativa, minimizzazione, misure di sicurezza, risposta alle richieste degli interessati | Tiene i dati sul computer della scuola; la scheda dell'utente contiene solo ciò che serve al prestito; la rimozione cancella subito i dati identificativi; esporta i dati di una persona; la pagina dà i testi per registro e informativa | [Protezione dei dati personali](data-protection.md) |
| D.Lgs. 196/2003 (Codice privacy), modificato dal D.Lgs. 101/2018 | Le regole italiane che completano il GDPR, tra cui la base giuridica del trattamento per un compito pubblico | Come sopra; foto e copertine si possono spegnere, e la scelta della base giuridica per le foto resta alla scuola e al DPO | [Protezione dei dati personali](data-protection.md) |

### Accessibilità

| Norma | Che cosa chiede | Che cosa fa BiblioViva | Pagina |
|---|---|---|---|
| Legge 4/2004 e linee guida AgID | Strumenti informatici accessibili, anche se usati su una rete interna; tecnologie assistive al dipendente con disabilità | Ha come obiettivo le WCAG 2.2 di livello AA, verificate con controlli automatici e a mano; i limiti noti sono scritti | [Accessibilità](accessibility.md) |
| EN 301 549 | Il riferimento tecnico delle linee guida: la versione 3.2.1 per le WCAG 2.1 AA, la 4.1.1 per le WCAG 2.2 | Le WCAG 2.2 AA comprendono i criteri delle 2.1 AA; le verifiche sono quelle del progetto, non una certificazione di terzi | [Accessibilità](accessibility.md) |

### Inclusione

| Norma | Che cosa chiede | Che cosa fa BiblioViva | Pagina |
|---|---|---|---|
| Legge 170/2010 (disturbi specifici di apprendimento) | Alla scuola, didattica e strumenti adatti agli alunni con DSA | Livelli di lettura e tipi di materiale configurabili; interfaccia accessibile | [Inclusione](inclusion.md) |
| Legge 104/1992 (persone con disabilità) | Alla scuola, l'integrazione e il diritto allo studio degli alunni con disabilità | Come sopra | [Inclusione](inclusion.md) |

### Inventario dei beni

| Norma | Che cosa chiede | Che cosa fa BiblioViva | Pagina |
|---|---|---|---|
| D.I. 129/2018, articolo 31 | Libri e materiale bibliografico fra i beni inventariati dalla scuola, con numero progressivo, origine, luogo, stato e valore | Non registra il numero d'inventario, il valore né la provenienza; registra la data di acquisizione e il ritiro della copia (il motivo nel registro delle operazioni) | [Inventario della scuola](school-inventory.md) |

### Software nella pubblica amministrazione

| Norma | Che cosa chiede | Che cosa fa BiblioViva | Pagina |
|---|---|---|---|
| CAD, articoli 68 e 69 | Valutazione comparativa prima di acquisire un software; riuso del software sviluppato per la pubblica amministrazione | Software libero con licenza GPL-3.0-or-later, codice pubblico, nessun costo di licenza; esportazioni in formati aperti | [Software libero](open-source.md) |
| Linee guida AgID su acquisizione e riuso | Come fare la valutazione e come pubblicare il software da riusare | Ha il file `publiccode.yml` nel repository, richiesto per il catalogo di Developers Italia | [Software libero](open-source.md) |

### Sicurezza informatica

| Norma | Che cosa chiede | Che cosa fa BiblioViva | Pagina |
|---|---|---|---|
| Misure minime di sicurezza ICT dell'AgID (Circolare 2/2017) | Alla scuola, misure su inventario dei sistemi, configurazioni, utenti amministratori, copie di sicurezza | Account con permessi, password conservate come impronta, registro delle operazioni, copia notturna; non si aggiorna da solo; il modulo dell'AgID lo compila la scuola | [Sicurezza informatica](security.md) |
| GDPR, articolo 32 | Misure tecniche e organizzative adeguate al rischio | Le stesse misure; le copie di sicurezza non sono cifrate | [Sicurezza informatica](security.md) |

### Cloud

| Norma | Che cosa chiede | Che cosa fa BiblioViva | Pagina |
|---|---|---|---|
| Regolamento ACN sui servizi cloud per la pubblica amministrazione | Servizi cloud qualificati dall'ACN per i dati e i servizi dell'amministrazione | È installato sul computer della scuola, non è un servizio cloud; Tailscale e la copia esterna sono scelte facoltative della scuola | [Sicurezza informatica](security.md) |

## Norme che non riguardano BiblioViva

Alcune norme si possono credere applicabili a un software scolastico. [Altre norme](other-rules.md) dice per ciascuna che
cosa chiede e perché non riguarda BiblioViva, o lo riguarda solo in parte.

| Norma | Esito |
|---|---|
| European Accessibility Act (direttiva (UE) 2019/882) | Riguarda prodotti e servizi per i consumatori: non BiblioViva |
| NIS 2 (direttiva (UE) 2022/2555, D.Lgs. 138/2024) | Le scuole non rientrano di norma nell'ambito, secondo le FAQ dell'ACN |
| SPID e CIE (CAD, articolo 64) | Riguardano i servizi online ai cittadini: BiblioViva non ne ha |
| pagoPA (CAD, articolo 5) | Riguarda i pagamenti alla pubblica amministrazione: BiblioViva non gestisce pagamenti |
| Diritto d'autore (Legge 633/1941) | Riguarda in parte le copertine dei libri: spetta alla scuola decidere se tenerle |
| Documenti informatici e loro conservazione (linee guida AgID) | Riguardano gli atti della scuola: BiblioViva tiene registri di lavoro della biblioteca |

L'intera sezione si scarica come un unico file PDF dal sito della documentazione.

## Pagine correlate

- [Panoramica](../features.md)
