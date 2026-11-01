# Solleciti

La pagina **Solleciti** raccoglie i prestiti scaduti, divisi per classe, e prepara i fogli da stampare e consegnare agli
insegnanti perché ricordino agli alunni di riportare i libri. La pagina la aprono gli account che hanno il permesso dei
prestiti («Gestione prestiti» e «Amministrazione») dalla scheda **Solleciti** del banco prestiti o dal riquadro
**In ritardo** della [dashboard](dashboard.md). Per la procedura passo per passo vedere
[Stampare i solleciti](../guides/overdue-reminders.md).

<!-- figure: circulation/overdues | Solleciti con i ritardi raggruppati per classe -->

1. [Impostazioni della stampa](#impostazioni-della-stampa).
1. [Riepilogo](#riepilogo).
1. [Gruppi di ritardi](#gruppi-di-ritardi).
1. I pulsanti [Stampa solleciti](#stampa-solleciti) e [Segna solleciti stampati](#segna-solleciti-stampati).

## Impostazioni della stampa

In alto, nel riquadro delle impostazioni:

- **Giorni minimi di ritardo**: un prestito compare nei solleciti solo dopo questi giorni di ritardo (0 = subito). Il
  numero iniziale è quello scelto dall'amministratore (**Giorni di ritardo prima del sollecito**); si può cambiare qui
  per la sola stampa in corso, da 0 a 365.
- **Una pagina per ogni classe**: ogni classe sul suo foglio, da consegnare all'insegnante. Il valore iniziale è
  quello impostato dall'amministratore (**Una pagina per classe**).

## Riepilogo

Sotto le impostazioni il riepilogo dice quanto c'è da sollecitare: «`<n>` prestiti in ritardo in `<m>` gruppi». Se
nessun prestito supera i giorni minimi: «Nessun prestito in ritardo da sollecitare.»

## Gruppi di ritardi

I prestiti in ritardo sono raggruppati per classe, nell'ordine delle classi; i docenti formano un gruppo a parte
(**Docente**, in fondo) e gli utenti senza classe un altro (**Senza classe**). Ogni gruppo ha:

- il nome della classe e il numero dei prestiti («`<n>` in ritardo»);
- la casella **Stampa questo gruppo**, accesa di norma: spegnerla lascia il gruppo fuori dalla stampa e dalla
  marcatura;
- una riga per prestito con il titolo del libro, i giorni di ritardo («`<n>` giorni», in rosso) e, se un sollecito era
  già stato stampato, «ultimo sollecito `<data>`»; il nome dell'utente compare al passaggio del mouse sul titolo.

## Stampa solleciti

Il pulsante **Stampa solleciti** apre in una nuova scheda il foglio dei solleciti per i gruppi scelti: un blocco per
classe con nome dell'utente, titolo e giorni di ritardo, un foglio per classe se è accesa
**Una pagina per ogni classe**. Stampare dalla scheda con le funzioni del browser, a dimensioni reali. Il pulsante è
spento se nessun gruppo è scelto.

## Segna solleciti stampati

Il pulsante **Segna solleciti stampati** registra la data di oggi come ultimo sollecito dei prestiti dei gruppi scelti,
così il giorno dopo si sa chi è già stato sollecitato. Prima di segnare, una finestra chiede conferma: «Segnare `<n>`
solleciti come stampati?», con la spiegazione «La data di oggi compare come ultimo sollecito nell'elenco dei prestiti.»
Alla conferma il pulsante **Segna solleciti stampati** della finestra registra la data e compare «`<n>` solleciti
segnati come stampati.» La data si vede poi nella colonna **Ultimo sollecito** di [Libri in prestito](loans.md). Il
pulsante è spento se nessun gruppo è scelto.

> [!NOTE]
> Stampare e segnare sono due azioni separate: BiblioViva non sa se il foglio è davvero uscito dalla stampante.
> Segnare i solleciti solo dopo aver stampato.

## Pagine correlate

- [Stampare i solleciti](../guides/overdue-reminders.md)
- [Libri in prestito](loans.md)
- [Restituzioni](checkin.md)
