# Importazioni

La pagina **Importazioni** è l'ingresso delle cinque importazioni: catalogo, studenti, docenti, prestiti in corso e
foto degli utenti. Si apre dalla scheda **Importazioni** di [Amministrazione](admin.md). L'account `admin` vede tutte
le schede; un account che può importare il catalogo o gli utenti senza essere amministratore la raggiunge dalla
**Dashboard** e vede soltanto le schede che il suo permesso consente. Le importazioni si usano al passaggio da un
altro programma, per portare in BiblioViva i suoi dati, e l'importazione degli utenti si usa anche a ogni inizio d'anno, per le classi nuove.
Ogni file viene controllato per intero prima di importare: con un solo errore non si importa nulla.

<!-- figure: admin/imports | La pagina Importazioni con le cinque schede -->

1. La spiegazione sotto il titolo.
2. Le schede delle importazioni consentite all'account.

Le pagine delle singole importazioni condividono le schede in alto (catalogo, studenti, docenti, prestiti in corso,
foto) per passare dall'una all'altra. Le procedure complete sono nelle guide indicate sotto; i formati dei file e le
colonne sono descritti nel [riferimento tecnico delle importazioni](../../../import/README.md).

## Catalogo

Libri e copie da un file CSV, da un file MARC (ISO 2709 o MARCXML, in UNIMARC o in MARC 21) o dall'esportazione di un altro programma. Permesso: **Importa catalogo**. Guida:
[Importare il catalogo](../guides/import-the-catalogue.md).

## Studenti

Le classi dal registro elettronico, a ogni inizio d'anno: nome, cognome e classe. Permesso: **Importa utenti**. Guida:
[Importare gli alunni](../guides/import-students.md).

## Docenti

I docenti della scuola: nome e cognome, con la tessera se c'è già. Permesso: **Importa utenti**. Guida: [Importare i
docenti](../guides/import-teachers.md).

## Prestiti in corso

I prestiti aperti, importati una volta sola al passaggio da un altro programma. Solo l'account `admin`. Guida:
[Importare i prestiti in corso](../guides/import-loans.md).

## Foto degli utenti

Le foto esportate dal programma precedente, una per tessera. Solo l'account `admin`; la scheda compare soltanto quando le
foto sono attive nella sezione Foto degli utenti della [Configurazione](configuration.md#foto-degli-utenti). Guida:
[Importare le foto degli utenti](../guides/import-photos.md).
