# Annullare una modifica della configurazione

Questa guida spiega come riportare le impostazioni com'erano prima di una modifica sbagliata: un valore cambiato per
errore, un account eliminato, un'importazione che non andava fatta. Serve a chi amministra BiblioViva.

Ogni modifica fatta dall'amministrazione conserva la versione precedente dei file che tocca, per le ultime 50 modifiche.
Il ripristino riguarda soltanto la configurazione. I dati della biblioteca (libri, utenti, prestiti) si rimettono con
una [copia di sicurezza](../../setup/restore.md).

- Tempo: circa 3 minuti.
- Account: `admin`.
- Occorrente: sapere quale modifica annullare e più o meno quando è stata fatta.

## Procedura

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Configurazione**.
1. Aprire **Cronologia**, la seconda scheda in alto, accanto a **Sezioni**.
1. Trovare la modifica nell'elenco. Ogni riga ha la data in **Quando**, la descrizione in **Cosa** (per esempio
   la sezione modificata, i colori o la lingua) e i file toccati in **File**.
1. Premere **Ripristina** sulla riga della modifica.
1. Alla domanda «Ripristinare i file com'erano prima di questa modifica?» premere **Ripristina**. Compare il messaggio
   «Versione precedente ripristinata».

<!-- figure: admin/config-history | La Cronologia della configurazione con l'elenco delle modifiche e il pulsante Ripristina -->

Tornano com'erano soltanto i valori cambiati da quella modifica; le modifiche fatte dopo ad altri valori restano. Anche
il ripristino è una modifica: compare nella cronologia e si può annullare a sua volta.

## Risultato

- I valori di quella modifica tornano a quelli di prima.
- La cronologia mostra una nuova riga «Ripristino della modifica del» seguito dalla data.

## Possibili problemi

### Il valore è cambiato di nuovo

Compare «Non si può ripristinare: dopo questa modifica sono cambiati di nuovo» seguito dai nomi dei valori: quegli
stessi valori sono stati cambiati ancora. Annullare prima le modifiche più recenti, dall'alto verso il basso.

### La modifica ha creato config.json

Compare «Questa modifica ha creato config.json: non si può annullare.»: è la prima configurazione, scritta dal primo
avvio.

### La modifica non è più nella cronologia

Compare «La modifica non è più nella cronologia.»: la cronologia tiene le ultime 50 modifiche e questa è stata
superata. Se esiste un archivio della configurazione, vedere [Esportare e importare la
configurazione](export-the-configuration.md).

### L'elenco delle modifiche è vuoto

L'elenco mostra «Nessuna modifica fatta dall'amministrazione finora.»: non c'è nulla da annullare.

### Una modifica non compare nella cronologia

Un'impostazione è stata cambiata modificando a mano i file della configurazione: quella modifica non è nella
cronologia.

## Pagine correlate

- [Esportare e importare la configurazione](export-the-configuration.md)
- [Cronologia della configurazione](../screens/config-history.md)
- [Configurazione](../screens/configuration.md)
