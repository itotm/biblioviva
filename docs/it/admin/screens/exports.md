# Esportazioni

La pagina **Esportazioni** scarica i dati della biblioteca in file da tenere, da reimportare o da portare in un altro
programma. È riservata all'account `admin` e si apre dalla scheda **Esportazioni** di [Amministrazione](admin.md). Non fa
modifiche: ogni voce è soltanto un download.

<!-- figure: admin/exports | La pagina Esportazioni con le sei voci e il pulsante Scarica -->

1. Una voce: titolo e spiegazione.
2. Il pulsante **Scarica** della voce.
3. La nota sui dati di una singola persona.

## Studenti (CSV)

Gli studenti attivi nel formato dell'importazione: si reimportano da [Importazioni](imports.md), voce **Studenti**.

## Docenti (CSV)

I docenti attivi nel formato dell'importazione: si reimportano da [Importazioni](imports.md), voce **Docenti**.

## Catalogo (CSV)

Una riga per copia con i dati del libro, nel formato dell'importazione del catalogo, compresi numero d'inventario,
provenienza e valore (il valore con il punto, per esempio `12.50`). La colonna `accessible_formats`, dopo `subjects`,
porta i formati accessibili del libro separati da «; »: l'importazione la rilegge.

Il catalogo si scarica anche in MARC 21 e in UNIMARC, con le copie, dal menu **Esporta** del
[Catalogo](../../manual/screens/catalog.md#esportazione).

## Prestiti in corso (CSV)

Tessera, copia, data del prestito e scadenza: si reimportano da [Importazioni](imports.md), voce **Prestiti in corso**.

## Storico dei prestiti (CSV)

Tutti i prestiti, con la classe e la sezione del giorno del prestito.

## Tutti i dati (JSON)

Utenti, catalogo, prestiti e liste in un unico file, per passare a un'altra installazione o a un altro programma. Non è un
backup: per le copie di sicurezza vedere [Backup](backups.md).

## Dati di una persona

Sotto l'elenco una nota ricorda che i dati di una singola persona (per esempio per una richiesta di accesso) non si
scaricano da questa pagina, ma dalla sua scheda, con il comando **Esporta i dati della persona**. Vedere
[Scheda dell'utente](../../manual/screens/patron-record.md).
