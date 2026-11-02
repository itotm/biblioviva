# Aggiungere una lingua

Questa guida spiega come usare BiblioViva in una lingua diversa dall'italiano e dall'inglese, che sono già comprese.
Serve a chi amministra BiblioViva. Le lingue già tradotte si installano dall'elenco con un pulsante; per una lingua che
non è nell'elenco, o per un'installazione senza internet, si carica un pacchetto di traduzioni. In nessun caso occorre
toccare il programma.

Una lingua si può installare anche all'inizio, dalla prima schermata della configurazione guidata: la procedura è nella
sezione [Lingua](../../setup/steps/first-run.md#lingua) del passo [Primo avvio](../../setup/steps/first-run.md).

BiblioViva usa una sola lingua per tutta l'installazione. Un pacchetto è una cartella di file `.json` con i testi
dell'interfaccia: si parte da una copia dell'inglese o dell'italiano e si traducono i testi.

- Tempo: installare dall'elenco richiede qualche minuto; tradurre una lingua nuova da qualche ora a qualche giorno,
  secondo quanto si traduce. I testi non tradotti restano in inglese.
- Account: `admin`.
- Occorrente per installare dall'elenco: la connessione a internet del computer su cui gira BiblioViva.
- Occorrente per tradurre e caricare un pacchetto: un programma per scrivere testo semplice (per esempio il Blocco note di Windows o un editor di testo) e un
  programma per comprimere e scompattare file ZIP, già presente nel computer.

## Procedura

### Installare una lingua dall'elenco

L'elenco comprende le lingue pubblicate con la versione di BiblioViva installata. Ogni pacchetto è controllato prima di
essere installato.

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Configurazione**.
1. Aprire **Aspetto e lingua**.
1. Nel riquadro **Lingua dell'applicazione**, sotto **Aggiungere una lingua**, aprire l'elenco **Lingue disponibili su
   GitHub** e scegliere la lingua desiderata. Nell'elenco compaiono solo le lingue non ancora installate; sotto l'elenco
   sono indicati la percentuale dei testi tradotti e il tipo di traduzione.
1. Premere **Installa**.
1. Attendere il messaggio «Lingua installata:» seguito dal nome. La lingua risulta già scelta nell'elenco **Lingua** del
   riquadro.
1. Per usare la lingua, seguire i passi di «Usare la lingua» più avanti in questa guida.

Se compare l'indicazione «Traduzione automatica, non letta da un madrelingua», la traduzione è stata fatta da un
programma e nessuno che parla quella lingua l'ha ancora riletta: può contenere errori o parole poco naturali. Si può
usare lo stesso e correggere i testi come descritto più avanti.

Per sostituire una lingua già installata con la versione dell'elenco, aprire **Configurazione**, **Interfaccia**,
scorrere fino a **Pacchetti di lingua** e premere **Installa di nuovo** nella sezione **Lingue da installare**.

### Scaricare un esempio

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Configurazione**.
1. Nell'elenco **Impostazioni** aprire **Interfaccia**.
1. Scorrere fino al riquadro **Pacchetti di lingua**.
1. Sotto **Esempi da scaricare:** premere `en` per l'inglese oppure `it` per l'italiano. Il browser salva un file
   `biblioviva-language-en.zip` (o `-it`).

<!-- figure: admin/language-packs | Il riquadro Pacchetti di lingua con i pulsanti degli esempi e Carica un pacchetto (zip) -->

### Preparare la cartella

1. Scompattare il file ZIP. Dentro c'è una cartella con il codice della lingua e i file `.json`.
1. Rinominare la cartella con il codice della nuova lingua: due lettere minuscole, eventualmente seguite dal paese, per
   esempio `de` per il tedesco, `fr` per il francese o `pt-BR` per il portoghese del Brasile. Non si possono usare `en`
   e `it`, che sono già comprese.
1. Aprire il file `pack.json` della cartella con l'editor di testo.
1. Scrivere dopo `"name"` il nome della lingua in inglese, per esempio `"German"`.
1. Scrivere dopo `"nativeName"` il nome della lingua nella lingua stessa, per esempio `"Deutsch"`: è quello che compare
   nei menu.
1. Salvare il file.

### Tradurre

1. Aprire uno alla volta gli altri file `.json` con l'editor di testo.
1. Cambiare soltanto ciò che sta a destra dei due punti. Non cambiare mai i nomi a sinistra dei due punti.
1. Lasciare intatte le parti fra doppie graffe, come `{{name}}`: BiblioViva le sostituisce con i valori veri.
1. Salvare ogni file. Si può tradurre poco alla volta: ciò che manca resta in inglese.

### Caricare il pacchetto

1. Comprimere la cartella della lingua in un file ZIP, in modo che il file contenga la cartella e, dentro, i file
   `.json`. Il comando del sistema si trova nel menu del tasto destro sulla cartella [VERIFY: nome del comando di
   compressione nei sistemi della scuola].
1. In **Aspetto e lingua**, sotto **Aggiungere una lingua**, premere **Carica un pacchetto (zip)** e scegliere il file.
   Lo stesso pulsante c'è in **Configurazione**, **Interfaccia**, nel riquadro **Pacchetti di lingua**. Il pacchetto non
   può superare i 5 MB.
1. Attendere il messaggio «Lingua installata:» seguito dal nome. In **Pacchetti di lingua** il pacchetto è elencato con
   **Valido**. Se mancano dei testi, accanto compare il numero dei «testi mancanti o in più».

Se il pacchetto ha degli errori non viene installato: il messaggio dice quale file e quale chiave correggere. Dopo la
correzione si ricomprime e si ricarica la cartella: un pacchetto con lo stesso codice sostituisce il precedente.

### Usare la lingua

1. Aprire **Amministrazione**, **Configurazione**, **Aspetto e lingua**.
1. Nel riquadro **Lingua dell'applicazione** scegliere la nuova lingua nell'elenco **Lingua** (dopo un'installazione è già
   scelta).
1. Premere **Cambia lingua**. La pagina si ricarica nella nuova lingua.

## Risultato

- La lingua compare nell'elenco **Lingua** di **Aspetto e lingua** e nella configurazione guidata di un'installazione
  nuova.
- Tutto il personale vede BiblioViva nella nuova lingua; i testi non tradotti sono in inglese.

## Possibili problemi

### L'elenco delle lingue non è raggiungibile

Compare «L'elenco delle lingue non è raggiungibile»: il computer di BiblioViva non è collegato a internet oppure la
versione installata non ha ancora un elenco. Il caricamento di un pacchetto zip, descritto più avanti, funziona lo
stesso: scaricare da un computer con internet il file della lingua dalla pagina della versione di BiblioViva (il
collegamento **Pagina della release su GitHub, per scaricare gli zip** sotto l'elenco, oppure l'indirizzo
`https://github.com/itotm/biblioviva/releases`) e caricarlo con **Carica un pacchetto (zip)**.

### Il pacchetto scaricato è danneggiato

Compare «Il pacchetto scaricato è danneggiato e non è stato installato»: il file non è arrivato per intero. Premere di
nuovo **Installa**.

### Lo zip non ha la struttura richiesta

Compare «Lo zip deve contenere solo i file .json della lingua, dentro una sola cartella con il codice della lingua.»:
ricomprimere la cartella rinominata, non i singoli file, e senza altre cartelle o file dentro.

### Il codice di lingua non è valido

Compare «Codice di lingua non valido» seguito dal codice: il nome della cartella non è nella forma `de`, `fr` o
`pt-BR`.

### L'inglese e l'italiano non si sostituiscono

Compare «L'inglese e l'italiano sono già inclusi e non si sostituiscono.»: la cartella ha ancora il nome `en` o `it`.

### Il pacchetto ha errori e non è stato installato

Compare «Il pacchetto ha errori e non è stato installato:» con un elenco: un file manca, un file non è un JSON valido
o una traduzione ha perso una parte fra graffe. Correggere il file indicato.

### Il pulsante Elimina di un pacchetto è spento

È la lingua in uso. Scegliere prima un'altra lingua in **Aspetto e lingua**.

### Si vuole scaricare di nuovo un pacchetto

Il pacchetto si può scaricare di nuovo con il pulsante **Scarica** della sua riga, per tenerne una copia o per
continuare la traduzione.

### Si vuole annullare l'eliminazione di un pacchetto

Eliminare un pacchetto si può annullare dalla [cronologia della configurazione](undo-a-configuration-change.md).

## Pagine correlate

- [Impostare la biblioteca](set-up-the-library.md)
- [Aspetto e lingua](../screens/appearance.md)
- [Esportare e importare la configurazione](export-the-configuration.md): le lingue fanno parte dell'archivio
- [Primi passi dell'amministratore](../first-steps.md)
