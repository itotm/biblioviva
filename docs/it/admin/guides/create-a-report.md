# Creare un report

Un report è una tabella, con un grafico facoltativo, che risponde a una domanda sulla biblioteca: quanti prestiti per
classe, quali libri non sono mai stati prestati, quanti utenti hanno la foto. Questa guida serve all'amministratore che
vuole un report diverso da quelli forniti con BiblioViva, e lo costruisce scegliendo le voci dall'editor guidato, senza
scrivere codice.

- Tempo: circa 15 minuti.
- Account: `admin`, l'unico che vede la **Libreria dei report** e l'editor. I report, una volta salvati, li consulta
  anche l'account `report`.
- Occorrente: sapere quale domanda deve rispondere il report (che cosa si conta e per che cosa si divide).

Il report guidato si costruisce da tre origini dei dati: i prestiti, le copie e gli utenti. Per un report che richiede
altro, o scritto a mano, esiste l'editor in SQL, descritto nella pagina tecnica [Reports: authoring
guide](../../../reports-authoring.md).

## Procedura

### Partire da un report nuovo o da una copia

1. Aprire **Amministrazione** e premere **Configurazione**.
1. Premere il riquadro **Libreria dei report**, nel gruppo **Aspetto, classi e modelli**. L'elenco mostra ogni report
   con il titolo, il codice, la categoria e l'origine (**Fornito con BiblioViva**, **Personalizzato** o **Aggiunto**).
1. Per un report da zero, premere **Nuovo report**. Si apre l'editor con un report di esempio (prestiti per anno di
   classe, con il periodo chiesto all'apertura) da cambiare.
1. Per partire da un report simile, premere invece **Duplica** sul report scelto. Si apre l'editor con una copia, il cui
   codice e titolo finiscono con «copia».

<!-- figure: admin/reports-library | La libreria dei report, con i pulsanti Modifica, Duplica, Prova e Scarica su ogni report -->

### Dare un nome al report

1. Scrivere in **Codice del report** una sigla breve, solo con lettere minuscole, cifre e trattini (per esempio
   `prestiti-per-materiale`). Il codice non si cambia più dopo il salvataggio.
1. Scegliere la **Categoria** in cui il report compare nell'elenco **Report**: **Prestiti**, **Libri**, **Utenti** o
   **Attività**.
1. Scrivere **Titolo (italiano)** e **Titolo (inglese)**, per esempio «Prestiti per materiale» e «Loans by material».
1. Facoltativo: scrivere **Descrizione (italiano)** e **Descrizione (inglese)**, una frase che spiega che cosa si legge
   nel report.
1. Facoltativo: spuntare **Solo per gli amministratori** se il report non deve essere visto dall'account `report`.

### Scegliere i dati

1. Restare sulla scheda **Guidata**.
1. Scegliere in **Dati** l'origine: **Prestiti**, **Copie** o **Utenti**. Cambiando l'origine le scelte seguenti
   ricominciano da quelle di partenza.
1. Scegliere in **Righe** che cosa dividere in righe (per esempio **Materiale** per i prestiti, oppure **Sezione**).
1. Facoltativo: scegliere un secondo livello in **Righe, secondo livello**, per dividere ogni riga in sottogruppi.
1. Facoltativo: scegliere in **Colonne** una voce i cui valori diventano le colonne di una tabella a doppia entrata, con
   i totali. Con le colonne il report mostra un solo valore.
1. Spuntare in **Valori** che cosa contare, da uno a tre valori: per i prestiti, per esempio, **Prestiti**, **Lettori**,
   **Titoli** e **Giorni in media**.
1. Se ci sono le colonne, scegliere i **Totali**: **Riga e colonna dei totali**, **Colonna dei totali**,
   **Riga dei totali** o **Nessun totale**. Senza colonne, scegliere l'**Ordine**: **Nell'ordine delle righe** oppure
   **Dal valore più alto**.
1. Scegliere in **Grafico** se aggiungere un grafico: **Barre**, **Linee** o **Ciambella**, oppure «— nessuna —».

### Scegliere i filtri

1. Sotto **Filtri** compare un elenco dei filtri possibili per l'origine scelta (per esempio, per i prestiti, il periodo
   del prestito, il tipo di utente, la classe). Per ciascuno scegliere un modo: **Nessun filtro**,
   **Chiesto quando si apre** oppure **Fisso**.
1. Con **Chiesto quando si apre** chi apre il report sceglie il valore, per esempio le date di inizio e fine.
1. Con **Fisso** il valore si sceglie subito e vale sempre: per il periodo compaiono due date, **dal** e **al**.

<!-- figure: admin/report-editor | L'editor guidato di un report: dati, righe, valori, filtri e grafico -->

### Controllare e salvare

1. Premere **Anteprima**. Il report si esegue con i valori predefiniti dei filtri e mostra al massimo 200 righe, con il
   grafico se è stato scelto. Se qualcosa non va, compare l'elenco dei problemi.
1. Premere **Salva**. Compare il messaggio «Report … salvato» e si apre la pagina **Modifica report** dello stesso
   report.
1. Per vedere il risultato come lo vede chi lo consulta, tornare alla libreria con **Torna alla libreria** e premere
   **Prova** sul report. Si apre la pagina del report con i suoi parametri; **Aggiorna** rifà il calcolo.

> [!IMPORTANT]
> Se il codice scritto è quello di un report già esistente, il salvataggio lo sostituisce. Per cambiare un report
> fornito con BiblioViva è giusto: la copia della scuola prende il posto dell'originale, che si recupera con
> **Torna all'originale**. Per un report nuovo, scegliere un codice che non esista.

## Risultato

Il report compare nell'elenco **Report** (voce di menu **Report**), nella categoria scelta, con l'indicazione
**Della scuola**. Chi ha l'account `report` lo apre e lo stampa; il report con **Solo per gli amministratori** lo vede
solo l'amministratore. Ogni salvataggio è una modifica della configurazione e si può annullare: [Annullare una modifica
della configurazione](undo-a-configuration-change.md).

Per correggere il report, premere **Modifica** nella libreria. Per toglierlo, premere **Elimina** (per un report fornito
con BiblioViva e personalizzato, **Torna all'originale**).

## Possibili problemi

### Il salvataggio dice che la definizione non è valida

Il salvataggio dice «La definizione non è valida». Manca o non è valido un dato, di solito il codice (lettere
minuscole, cifre e trattini, non più di 64 caratteri) o il titolo. Il messaggio indica quale.

### La query non funziona su questo database

Il salvataggio dice «La query non funziona su questo database». Il report guidato è stato composto con una combinazione
che il database non riesce a calcolare. Tornare alla scheda **Guidata**, togliere l'ultima scelta e premere
**Anteprima** per vedere quale la provoca.

### «new» non può essere il codice di un report

Il salvataggio dice che «new» non può essere il codice di un report. Scegliere un altro codice.

### L'anteprima non mostra risultati

L'anteprima mostra «Nessun risultato con questi parametri». Il report è corretto ma i dati non ci sono: allargare il
periodo o togliere un filtro fisso.

### Il campo Codice del report è spento

Il codice di un report già salvato non si cambia. Per averne uno diverso, usare **Duplica** dalla libreria.

### Il report non si modifica più con la scheda Guidata

Dopo **Modifica come SQL** il report non si modifica più con la scheda **Guidata**. **Modifica come SQL** trasforma il
report in un report scritto a mano e non si torna alla modifica guidata. Usarlo solo se serve davvero, leggendo prima
[Reports: authoring guide](../../../reports-authoring.md).

### Il report non compare nell'elenco di un altro account

Verificare che non sia spuntato **Solo per gli amministratori** e che l'account abbia il permesso dei report:
[Gestire gli account del personale](manage-accounts.md).

### Un file della libreria è in errore

La libreria elenca, in cima, i file che non si caricano, con il motivo. **Elimina** toglie il file dalla
configurazione; la cancellazione si può annullare dalla cronologia.

## Pagine correlate

- [Consultare un report](../../manual/guides/run-a-report.md)
- [Gestire gli account del personale](manage-accounts.md)
- [Annullare una modifica della configurazione](undo-a-configuration-change.md)
- [Libreria dei report](../screens/reports-library.md)
- [Reports: authoring guide](../../../reports-authoring.md) (pagina tecnica, in inglese)
