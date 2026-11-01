# Account del personale

La pagina **Account del personale** elenca gli account con cui il personale entra in BiblioViva, i ruoli e i permessi
che li regolano e il modo in cui si accede. È riservata all'account `admin` e si apre dalla scheda **Account del
personale** di [Amministrazione](admin.md). Di norma c'è un account condiviso per ciascun ruolo: **Amministrazione
(admin)**, **Gestione prestiti (prestiti)**, **Catalogazione (catalogo)**, **Tessere e foto (tessere)** e **Report (report)**. Le procedure sono nelle guide
[Gestire gli account del personale](../guides/manage-accounts.md) e
[Cambiare una password](../guides/change-a-password.md).

<!-- figure: admin/users | La pagina Account del personale con le schede degli account e l'editor dei ruoli -->

1. I pulsanti **Nuovo account** e **Ricarica configurazione**.
2. La scheda di un account, con il suo stato.
3. I comandi della scheda: **Modifica**, **Nuova password** ed **Elimina**.
4. L'editor «Ruoli e permessi».
5. Il riquadro «Accesso».
6. L'elenco ripiegabile per chi modifica i file a mano.

## Nuovo account

Il pulsante **Nuovo account** apre la finestra «Nuovo account». Per ogni account si indicano il **Nome utente**
(minuscole, cifre, punto, trattino e trattino basso, da 2 a 32 caratteri), il **Nome mostrato**, i **Ruoli** (almeno
uno), la password (almeno otto caratteri) e la sua ripetizione. La casella «Account attivo (può entrare)» decide se
l'account può accedere. BiblioViva non conserva la password: nella configurazione scrive soltanto il suo hash.

## Ricarica configurazione

Il pulsante **Ricarica configurazione** rilegge i file di configurazione, utile quando sono stati modificati a mano. Se la
configurazione non è valida resta attiva quella precedente («Configurazione non valida: resta attiva quella precedente»);
se il file `config.json` non esiste, un avviso giallo ricorda che è in uso la configurazione di esempio.

## Le schede degli account

Ogni account ha una scheda con:

- il nome mostrato e, sotto, il nome utente;
- lo stato, **Attivo** oppure **Disattivato**;
- i **Ruoli** dell'account, i **Permessi** che ne risultano (per esempio Prestiti, Utenti, Catalogo, Report,
  Amministrazione) e l'**Ultimo accesso**, che per un account mai usato dice «mai»;
- un avviso giallo quando la password è scritta in chiaro nel file («Password in chiaro nel file») oppure quando l'account
  esiste ancora nel database ma è stato tolto dalla configurazione («Tolto dalla configurazione»).

I comandi della scheda sono tre.

- **Modifica** apre la finestra «Modifica» dell'account: nome mostrato, ruoli e stato attivo.
- **Nuova password** apre la finestra per cambiare la password. Chi è collegato con quell'account dovrà entrare di nuovo.
- **Elimina** compare soltanto sugli account disattivati. Chiede conferma («Eliminare … ?»): l'account esce dalla
  configurazione, le operazioni che ha fatto restano nel [Registro operazioni](audit.md) con il suo nome, e
  l'eliminazione si può annullare dalla [Cronologia della configurazione](config-history.md).

Alcune azioni sono rifiutate con un messaggio: deve restare almeno un account attivo con il permesso di amministrazione;
un nome utente già usato non si ripete; un account va disattivato prima di essere eliminato.

## Ruoli e permessi

L'editor «Ruoli e permessi» mostra una riga per ruolo e una colonna per permesso. Un ruolo è un insieme di permessi; ogni
account ha uno o più ruoli. I permessi sono:

- Prestiti;
- Utenti;
- Importa utenti;
- Catalogo;
- Importa catalogo;
- Report;
- Anonimizza;
- Amministrazione.

Il permesso «Tutto» li dà tutti, anche quelli che arriveranno con le prossime versioni. Sotto il nome di un ruolo non
usato da nessuno compare «nessun account». I comandi sono **Aggiungi un ruolo**, **Salva** e **Annulla modifiche**.
Rinominare un ruolo aggiorna gli account che lo usano; un ruolo usato da un account non si elimina.

## Accesso

Il riquadro «Accesso» spiega come si entra. Con gli account della configurazione, il caso normale: «Si entra con gli
account di questa pagina, di solito uno condiviso per ruolo». Non esistono account personali, uno per persona.

## Genera hash password

L'elenco ripiegabile «Per chi modifica i file a mano: generare l'hash di una password» contiene lo strumento **Genera
hash password**. Si inserisce una password (almeno otto caratteri), si preme **Genera hash** e compare l'«Hash da
incollare» nel campo `passwordHash` del file; **Copia** lo porta negli appunti. La password non viene salvata.
