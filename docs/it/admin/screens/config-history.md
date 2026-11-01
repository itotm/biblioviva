# Cronologia della configurazione

La **Cronologia della configurazione** elenca le modifiche fatte alla configurazione dall'amministrazione, dalla più
recente, e permette di annullarne una. È riservata all'account `admin` e si apre dalla scheda **Cronologia** in alto
nella [Configurazione](configuration.md). Ogni modifica fatta dall'amministrazione conserva la versione precedente dei
file che tocca; la cronologia tiene le ultime 50 modifiche. La procedura è nella guida [Annullare una modifica della
configurazione](../guides/undo-a-configuration-change.md).

<!-- figure: admin/config-history | La Cronologia della configurazione con l'elenco delle modifiche -->

1. Le schede **Sezioni** e **Cronologia**.
2. Una riga dell'elenco: quando, che cosa, i file toccati.
3. Il pulsante **Ripristina** della riga.

## L'elenco delle modifiche

Senza modifiche la pagina dice «Nessuna modifica fatta dall'amministrazione finora.» Altrimenti una tabella mostra, per
ogni modifica:

- **Quando**: data e ora;
- **Cosa**: che cosa è stato cambiato. Il testo dice, per esempio, «Colori», «Lingua», «Logo della biblioteca», «Prima
  configurazione», «Sezione» seguito dal nome della sezione, «Ripristino della modifica del …»; le altre azioni
  (account, template, report, pacchetti di lingua) compaiono come «Modifica» seguita dal nome tecnico dell'azione;
- **File**: i file della configurazione toccati, ciascuno con il suo percorso; un file creato dalla modifica porta
  l'indicazione «nuovo».

## Ripristina

Il pulsante **Ripristina** di una riga riporta i file com'erano prima di quella modifica. Una finestra chiede conferma:
«Ripristinare i file com'erano prima di questa modifica?». Tornano come prima solo i valori cambiati da quella modifica.
Il ripristino è a sua volta una modifica: resta nella cronologia e si può annullare.

Il ripristino può essere rifiutato. I messaggi sono questi.

- «Questa modifica ha creato config.json: non si può annullare.»
- «Non si può ripristinare: dopo questa modifica sono cambiati di nuovo …», con l'elenco delle chiavi. Per tornare
  indietro si annullano prima le modifiche più recenti.
- «La modifica non è più nella cronologia.»
- «Il salvataggio toglierebbe qualcosa che è ancora in uso», con l'elenco (per esempio un tipo di copia che ha ancora
  copie, un codice di classificazione che ha ancora libri, un anno con studenti), quando il ripristino farebbe sparire
  qualcosa che la biblioteca usa. In questo caso conviene prima spostare quelle voci.
