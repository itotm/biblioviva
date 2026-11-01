# Amministrazione

La pagina **Amministrazione** raccoglie la configurazione della biblioteca e i lavori sui dati: account, registro delle
operazioni, copie di sicurezza, importazioni, avanzamento di classe ed esportazioni. È riservata all'account `admin`. Si
apre dalla barra laterale (sul telefono dalla voce **Altro**) e dalla **Dashboard**; le altre pagine di questa sezione
hanno in alto il pulsante **Indietro**, che riporta qui.

<!-- figure: admin/home | La pagina Amministrazione con le sette schede -->

1. Titolo della pagina.
2. Le schede dei sette ambiti, ciascuna con un titolo e una riga di spiegazione.
3. Il pulsante **Svuota dati dimostrativi**, presente soltanto in un'installazione con i dati dimostrativi.

## Configurazione

Apre la [Configurazione](configuration.md): la classificazione e le impostazioni della biblioteca. Dalla Configurazione si
raggiungono anche **Aspetto e lingua**, le **Classi**, i template di stampa e la libreria dei report. Per l'ordine in cui
conviene fare le prime impostazioni vedere [Primi passi dell'amministratore](../first-steps.md).

## Registro operazioni

Apre il [Registro operazioni](audit.md): chi ha fatto che cosa, tra accessi, modifiche e importazioni.

## Account del personale

Apre gli [Account del personale](users.md): gli account condivisi, i ruoli e i permessi. Guide:
[Gestire gli account del personale](../guides/manage-accounts.md) e
[Cambiare una password](../guides/change-a-password.md).

## Backup

Apre i [Backup](backups.md): le copie di sicurezza del database e dei file, la loro creazione, il download e il
ripristino. Guida: [Fare e scaricare una copia di sicurezza](../guides/make-a-backup.md).

## Importazioni

Apre le [Importazioni](imports.md): catalogo, studenti, docenti, prestiti in corso e foto degli utenti. La scheda è
visibile anche agli account che possono importare il catalogo o gli utenti, senza essere amministratori (vedere la pagina
delle importazioni).

## Avanza di classe

Apre [Avanza di classe](rollover.md), la procedura guidata di fine anno. Guida:
[Avanzare di classe](../guides/class-upgrade.md).

## Esportazioni

Apre le [Esportazioni](exports.md): utenti, catalogo, prestiti e tutti i dati in file CSV o JSON.

## Svuota dati dimostrativi

Il pulsante **Svuota dati dimostrativi** compare in alto a destra solo quando l'installazione contiene i dati
dimostrativi (non nella demo pubblica). Prima di agire chiede conferma con la domanda «Svuotare i dati dimostrativi?»:
il database e le foto vengono cancellati e ricreati vuoti (restano le classi e il gruppo dei docenti), e tutti gli
operatori vengono disconnessi. Guida:
[Togliere i dati dimostrativi](../guides/remove-demo-data.md).
