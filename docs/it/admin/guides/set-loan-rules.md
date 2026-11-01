# Impostare le regole dei prestiti

Questa guida spiega come fissare quanto dura un prestito, quanti libri si possono avere insieme, quante volte si può
rinnovare e che cosa succede quando un libro è in ritardo. Serve a chi amministra BiblioViva e vuole adattare le regole
a quelle della biblioteca.

Le regole sono due, una per gli *studenti* e una per i *docenti*. Per un tipo di copia (per esempio i DVD) si può
cambiare una regola sola, senza toccare le altre.

- Tempo: circa 10 minuti.
- Account: `admin`.
- Occorrente: le regole decise dalla biblioteca, cioè i giorni, il numero di libri e il numero di rinnovi per studenti e
  docenti.

## Procedura

### Aprire le impostazioni

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Configurazione**.
1. Nell'elenco **Impostazioni** aprire **Prestiti**.

<!-- figure: admin/config-circulation | La sezione Prestiti della configurazione con le regole per studenti e docenti -->

### Regole per studenti e docenti

I gruppi **Regole per gli studenti** e **Regole per i docenti** hanno gli stessi quattro campi.

1. Scrivere in **Giorni di prestito** quanti giorni dura un prestito.
1. Scrivere in **Libri in prestito al massimo** quanti libri si possono avere insieme.
1. Scrivere in **Rinnovi al massimo** quante volte si può rinnovare lo stesso prestito. Il valore 0 vuol dire mai.
1. Scrivere in **Giorni di rinnovo** di quanti giorni si allunga il prestito a ogni rinnovo.

I valori proposti per gli studenti sono 15 giorni, 1 libro, 5 rinnovi e 15 giorni di rinnovo; per i docenti 15 giorni,
4 libri, 5 rinnovi e 15 giorni di rinnovo. Sotto ogni campo, **Predefinito** indica il valore proposto e **Torna al
predefinito** lo ripristina.

### Scadenze e rinnovi

1. In **Calcolo della scadenza** scegliere come si conta la durata rispetto ai giorni di chiusura:
   - **Giorni di calendario, poi il primo giorno di apertura**: la scadenza che cade in un giorno di chiusura passa al
     primo giorno di apertura successivo;
   - **Solo i giorni di apertura**: si contano soltanto i giorni in cui la biblioteca è aperta;
   - **Giorni di calendario, senza guardare le chiusure**: la scadenza può cadere anche in un giorno di chiusura.
1. In **Il rinnovo parte da** scegliere se i giorni di rinnovo si contano dal giorno del rinnovo (**Il giorno del
   rinnovo**) o dalla scadenza in corso (**La scadenza attuale**).
1. Spuntare **Rinnovo anche dopo la scadenza** se si può rinnovare anche un prestito già scaduto.
1. Spuntare **Niente nuovi prestiti con libri in ritardo** se chi ha un libro in ritardo non deve poterne prendere altri
   finché non lo restituisce.
1. In **Scadenza massima** scegliere una data oltre la quale nessun prestito scade, per esempio la fine delle lezioni.
   Lasciare vuoto per non avere limiti.
1. Spuntare **Ricevuta di prestito** per mostrare al Banco prestiti il pulsante che stampa la ricevuta.

I giorni di chiusura si impostano nel calendario: vedere [Impostare il calendario della
scuola](set-the-calendar.md).

### Solleciti

Il gruppo **Solleciti** regola i fogli dei libri in ritardo.

1. In **Giorni di ritardo prima del sollecito** scrivere dopo quanti giorni di ritardo un prestito compare nei
   solleciti. Il valore proposto è 5; 0 vuol dire subito.
1. Spuntare **Una pagina per classe** per stampare ogni classe su un foglio, da consegnare all'insegnante. La scelta si
   può cambiare anche al momento della stampa.
1. In **Modello dei solleciti** lasciare di norma il modello proposto.

### Salvare le regole generali

1. Premere **Salva**, in alto a destra. Compare il messaggio «Impostazioni salvate».

I valori sbagliati sono segnati in rosso e **Salva** aspetta che siano corretti. Per ritirare le modifiche non ancora
salvate, premere **Annulla modifiche**.

### Cambiare una regola per un tipo di copia

Il riquadro **Regole per tipo di copia** sta in fondo alla stessa pagina. Ha una riga per ogni tipo di copia (per
esempio Libro e DVD) e le stesse quattro colonne. Le regole valgono sia per gli studenti sia per i docenti.

1. Scrivere un valore nella colonna da cambiare, sulla riga del tipo di copia. Per i DVD, per esempio, 5 in **Giorni di
   prestito**.
1. Lasciare vuoto ciò che non cambia: vale la regola di studenti e docenti, che il campo mostra in grigio.
1. Premere **Salva** nel riquadro. Compare il messaggio «Regole per tipo di copia salvate».

I tipi di copia si aggiungono e si rinominano nella sezione **Biblioteca e scuola**, nel riquadro **Tipi di copia**.

## Risultato

- Al Banco prestiti ogni nuovo prestito prende la durata e il limite di libri della regola dell'utente e del tipo di
  copia.
- I prestiti già in corso mantengono la scadenza che avevano.

## Possibili problemi

- Compare «Correggere i valori segnati prima di salvare.»: un campo ha un valore non valido, per esempio un testo al
  posto di un numero. Correggere il campo segnato in rosso.
- Compare «Il salvataggio non è riuscito:» con un elenco: le voci dicono quale chiave correggere.
- I valori delle regole per tipo di copia mostrano il messaggio «Almeno 1.»: i giorni e i libri devono essere almeno 1;
  soltanto i rinnovi possono essere 0.
- Si esce dalla pagina con modifiche non salvate: BiblioViva chiede una conferma prima di perderle.

## Pagine correlate

- [Impostare il calendario della scuola](set-the-calendar.md)
- [Configurazione](../screens/configuration.md)
- [Stampare i solleciti](../../manual/guides/overdue-reminders.md)
- [Primi passi dell'amministratore](../first-steps.md)
