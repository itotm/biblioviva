# Consultare un report

Questa pagina spiega come aprire un report, scegliere il periodo, leggere i numeri, stamparli o salvarli in un foglio di
calcolo. Serve a chi vuole sapere come va la biblioteca: quanti prestiti, quali libri, quali classi leggono di più,
quali prestiti sono in ritardo.

- Tempo: circa 3 minuti.
- Account: Report (anche Amministrazione).
- Occorrente: nessun materiale. Per stampare, una stampante e un foglio A4.
- Alcuni report sono riservati all'amministratore e non compaiono agli altri account. Report nuovi, fatti per la scuola,
  li crea l'amministratore: vedere [Creare un report](../../admin/guides/create-a-report.md).

## Procedura

### Aprire un report

1. Accedere a BiblioViva con l'account Report.
1. Aprire **Report**. La pagina raggruppa i report in quattro parti: **Prestiti**, **Libri**, **Utenti** e **Attività**.
   Ogni report ha un titolo e una riga di spiegazione.

   <!-- figure: reports/library | La pagina Report con i report divisi per categoria -->

1. Scegliere il report. Alcuni hanno il segno **Con grafico**, quelli fatti dalla scuola hanno il segno
   **Della scuola**. Il segno **Solo amministratori** indica un report riservato.
1. Premere il report. Si apre la sua pagina. Il report parte subito con i valori di partenza e mostra le righe.

### Scegliere il periodo e gli altri parametri

<!-- figure: reports/report | La pagina di un report con i parametri, il grafico e la tabella -->

1. Nella parte **Parametri** leggere i campi. Per esempio il report «Libri più prestati» ha i campi «Dal», «Al» e
   «Quanti». Di norma il periodo va dall'inizio dell'anno scolastico a oggi.
1. Modificare le date o gli altri valori. Un report che non ne ha scrive «Questo report non ha parametri.».
1. Premere **Aggiorna**. Il report si rifà con i valori scelti.

### Leggere il risultato

1. Leggere il numero delle righe, per esempio «20 righe», e il tempo impiegato.
1. Se il report ha un grafico, si trova sopra la tabella.
1. Leggere la tabella. Premere il titolo di una colonna per ordinare le righe.
1. Se compare «Sono mostrate solo le prime N righe: per vederle tutte, restringere i parametri.», restringere il periodo
   o gli altri valori e premere **Aggiorna**.

### Stampare il report

1. Premere **Stampa**. Il report si apre in una nuova scheda, con il titolo, i parametri e la data di stampa.
1. Premere Ctrl+P. La pagina è impostata in orizzontale su un foglio A4. Per le altre impostazioni vedere [Impostare la
   finestra di stampa](../../setup/steps/scanner-printer.md#impostare-la-finestra-di-stampa).

### Salvare il report in un foglio di calcolo

1. Premere **Esporta**.
1. Scegliere «CSV (foglio di calcolo, testo)» oppure «ODS (LibreOffice)». Il browser scarica un file con le
   righe del report, con gli stessi parametri della pagina.

## Risultato

La pagina mostra i numeri del periodo scelto. L'indirizzo della pagina contiene i parametri: copiandolo e incollandolo
in un altro browser lo stesso report si riapre con gli stessi valori.

## Possibili problemi

### Nessun risultato con questi parametri

Compare «Nessun risultato con questi parametri.»: nel periodo scelto non c'è nulla. Allargare il periodo.

### Manca un campo obbligatorio

Compare «Manca «Dal».» (o il nome di un altro campo): il campo è obbligatorio e va compilato.

### Il valore di un campo non è valido

Compare «Il valore di «…» non è valido.»: la data o il numero non hanno un valore ammesso. Correggere il campo.

### Un report non compare

Potrebbe essere riservato all'amministratore. I report che mostrano i singoli lettori, come «Lettori più assidui», sono
visibili solo a lui.

### Un report della scuola non compare nell'elenco

Ha probabilmente un errore. L'amministratore vede in cima alla pagina l'avviso «File di report non caricati» con il
motivo.

### Due report danno numeri diversi per la stessa classe

Le classi del report sono quelle di oggi, mentre i prestiti conservano la classe del giorno in cui sono stati fatti: due
report possono quindi dare numeri diversi per la stessa classe, se gli alunni hanno cambiato classe.

## Pagine correlate

- [Controllare i libri in prestito](open-loans.md)
- [Stampare i solleciti](overdue-reminders.md)
- [Report](../screens/reports.md)
- [Creare un report](../../admin/guides/create-a-report.md)
