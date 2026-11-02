# Importare le foto degli utenti

Questa guida spiega come caricare in una volta sola le foto di molti utenti, un file per utente, per esempio quelle
estratte da un altro programma. Serve a chi amministra BiblioViva.

- Tempo: da 10 a 30 minuti, secondo il numero di foto.
- Account: `admin`. Nessun altro account può importare le foto.
- Occorrente: una foto per utente, in un file con il numero di tessera come nome; gli utenti già importati.

L'amministratore può disattivare le foto degli utenti: con le foto disattivate la pagina **Foto degli utenti** non esiste
(vedere [Disattivare le foto o le copertine](switch-off-photos-or-covers.md)). Per le foto di una classe sola esistono
modi più comodi: vedere [Fare le foto degli utenti](../../manual/guides/take-patron-photos.md) e
[Ricavare le foto da un'immagine della classe](../../manual/guides/photos-from-class-picture.md).

## Procedura

### Preparare le foto

1. Dare a ogni foto come nome il numero di tessera dell'utente, seguito dall'estensione: per esempio `0000001240.jpg`
   per una tessera di un vecchio formato, `U012345.jpg` per una tessera del formato attuale. Sono accettati i file JPEG,
   PNG, WebP, GIF, BMP, HEIC e AVIF.
1. Mettere tutti i file in un archivio ZIP. Le cartelle dentro l'archivio non contano: conta solo il nome di ogni file.

> [!NOTE]
> BiblioViva ridimensiona ogni foto alle misure impostate e toglie i dati nascosti dell'immagine (posizione, data, nome
> dell'apparecchio). Il browser accetta archivi fino a circa 32 MB: per una quantità maggiore dividere le foto in più
> archivi, o usare la cartella del computer descritta più avanti.

### Caricare l'archivio

1. Premere **Amministrazione**, poi **Importazioni**, poi **Foto degli utenti**. Si apre la pagina **Importa le foto degli
   utenti**.
1. Nel riquadro **Da un archivio ZIP**, nel campo **Archivio ZIP con le foto**, scegliere l'archivio.
1. Se agli utenti che hanno già una foto deve subentrare quella dell'archivio, spuntare **Sostituisci le foto già
   presenti**. Senza la spunta le foto già presenti restano come sono.
1. Premere **Importa le foto**.

### Controllare l'esito

1. Leggere il riquadro **Esito**. Riporta quante foto sono state importate, sostituite, lasciate com'erano perché già
   presenti, quanti file non corrispondono a nessun utente e quanti non sono immagini leggibili.
1. Se ci sono file senza utente, premere **Scarica l'elenco dei file senza utente**: il file `foto-senza-utente.csv`
   elenca i nomi da controllare.

### Usare la cartella del computer (facoltativo)

Quando le foto sono molte e l'archivio sarebbe troppo grande, si possono copiare i file in una cartella del computer di
BiblioViva. Questo passo richiede l'aiuto di chi gestisce il computer.

1. Chiedere a chi gestisce il computer di copiare i file nella cartella indicata dalla pagina, nel riquadro **Dalla
   cartella del server** (è la cartella `imports/photos` dei dati di BiblioViva; i volumi sono descritti nella
   [guida tecnica](../../../deploy.md))
   [VERIFY: il comando esatto per copiare i file nel volume dei dati, non descritto in deploy.md].
1. Aggiornare la pagina: il riquadro dice quanti file ci sono.
1. Se necessario, spuntare **Sostituisci le foto già presenti**.
1. Premere **Importa dalla cartella**.

## Risultato

Gli utenti i cui numeri di tessera corrispondono ai nomi dei file hanno la foto. La foto si vede nella scheda
dell'utente e sulla tessera. Il messaggio «Foto importate» conferma l'importazione dalla cartella.

## Possibili problemi

### Molti file risultano senza utente

Il nome del file non coincide con il numero di tessera: controllare l'elenco scaricato e rinominare i file. Gli utenti
devono essere già stati importati.

### Il file scelto non è uno ZIP

Compare «Il file non è un archivio ZIP valido.»: il file scelto non è uno ZIP. Creare l'archivio di nuovo.

### L'archivio è vuoto

Compare «L'archivio non contiene file.»: l'archivio è vuoto. Controllare di aver compresso i file e non una cartella
vuota.

### Alcune foto non sono leggibili

L'**Esito** elenca i file che non sono immagini valide: sostituirli e importarli di nuovo.

### Una foto non cambia

L'utente aveva già una foto e **Sostituisci le foto già presenti** non era spuntata.

### Le foto arrivano da Koha

Le foto si estraggono con una query già pronta, che scrive un file per utente con il numero di tessera come nome:
vedere [le istruzioni tecniche](../../../import/README.md).

## Pagine correlate

- [Importare gli alunni](import-students.md)
- [Disattivare le foto o le copertine](switch-off-photos-or-covers.md)
- [Fare le foto degli utenti](../../manual/guides/take-patron-photos.md)
- [Importazioni](../screens/imports.md)
