# Impostare il calendario della scuola

Questa guida spiega come dire a BiblioViva in quali giorni la biblioteca è chiusa: i giorni di chiusura di ogni
settimana, le festività nazionali, le festività della scuola e i periodi di chiusura come le vacanze di Natale e
l'estate. Serve a chi amministra BiblioViva. Le scadenze dei prestiti tengono conto di questi giorni.

- Tempo: circa 15 minuti.
- Account: `admin`.
- Occorrente: il calendario scolastico dell'anno, con le festività della scuola e le vacanze.

## Procedura

### Aprire il calendario

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Configurazione**.
1. Nell'elenco **Impostazioni** aprire **Calendario**.

<!-- figure: admin/config-calendar | La sezione Calendario con i giorni di chiusura settimanale, i mesi e i periodi di chiusura -->

### Le festività nazionali

1. Controllare la casella **Festività nazionali italiane**. Attiva, le festività nazionali, Pasqua compresa, sono giorni
   di chiusura senza doverle scrivere a mano.
1. Se si preferisce non usare la chiusura automatica, togliere la spunta: si accende il pulsante «Aggiungi le festività
   nazionali del» seguito dall'anno scolastico, che chiude le festività di quell'anno come giorni scelti a mano.

### I giorni di chiusura di ogni settimana

1. Nel gruppo **Giorni di chiusura ogni settimana** premere i giorni in cui la biblioteca è sempre chiusa, per esempio
   il sabato e la domenica. I giorni evidenziati sono chiusi tutte le settimane. Premere di nuovo un giorno per
   toglierlo.

### Le festività della scuola

I mesi dell'anno scolastico sono mostrati uno sotto l'altro. Il calendario parte dall'anno scolastico in corso; le
frecce **Anno scolastico precedente** e **Anno scolastico successivo** cambiano anno.

1. Premere un giorno aperto per chiuderlo. Il giorno diventa **Chiuso (scelto qui)**.
1. Premere di nuovo un giorno chiuso a mano per riaprirlo.

I giorni di chiusura settimanale, le festività nazionali e i giorni dentro un periodo di chiusura non si cambiano con un
clic sul giorno. La legenda sotto i mesi
spiega i colori: **Aperto**, **Chiusura settimanale**, **Festività nazionale**, **Chiuso (scelto qui)** e **Periodo di
chiusura**.

### I periodi di chiusura

1. Premere **Aggiungi un periodo**. Compare una riga con le date del giorno in corso.
1. Scegliere la data di inizio in **Dal** e quella di fine in **Al**.
1. Scrivere in **Motivo** la causa, per esempio «Vacanze di Natale».
1. Ripetere i tre passi per ogni periodo, per esempio per l'estate.
1. Per togliere un periodo premere il pulsante **Elimina** della sua riga.

### Salvare

1. Premere **Salva** nel riquadro **Calendario della biblioteca**. Compare il messaggio «Calendario salvato».
1. Se la casella **Festività nazionali italiane** è stata cambiata, premere anche **Salva**, in alto a destra.

Per ritirare le modifiche non ancora salvate del riquadro, premere **Annulla modifiche**.

### Controllare il risultato

1. Aprire **Prestiti**, poi **Calendario**. La pagina mostra i mesi dell'anno scolastico con i giorni di chiusura e il
   motivo di ciascuno.

## Risultato

- Una scadenza che cade in un giorno di chiusura passa al primo giorno di apertura successivo, con il calcolo proposto
  da BiblioViva. Il calcolo si cambia in **Calcolo della scadenza**, nella sezione **Prestiti** (vedere [Impostare le
  regole dei prestiti](set-loan-rules.md)).
- La stessa impostazione **Scadenza massima** della sezione **Prestiti** fissa un ultimo giorno oltre il quale nessun
  prestito scade, per esempio la fine delle lezioni.
- Le chiusure restano nelle impostazioni e si possono riportare indietro dalla [cronologia della
  configurazione](undo-a-configuration-change.md).

## Possibili problemi

- Compare «La fine è prima dell'inizio.» su un periodo: correggere le date di **Dal** e **Al**. Il pulsante **Salva**
  resta spento finché il periodo non è valido.
- Un giorno non si lascia chiudere con un clic: è già chiuso per la settimana, perché è una festività nazionale o perché
  cade in un periodo di chiusura.
- Le date da ricordare del banco, come una lettura in classe, non sono giorni di chiusura e non cambiano le scadenze:
  vedere [Calendario](../../manual/screens/calendar.md).

## Pagine correlate

- [Impostare le regole dei prestiti](set-loan-rules.md)
- [Calendario](../../manual/screens/calendar.md)
- [Configurazione](../screens/configuration.md)
- [Primi passi dell'amministratore](../first-steps.md)
