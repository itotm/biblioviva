# Classi

La pagina **Classi** elenca le classi della scuola, ciascuna con i suoi anni e il numero di utenti, e i gruppi dei
docenti. Le classi sono gruppi stabili: l'[avanzamento di classe](rollover.md) li sposta di anno (la `3 B` diventa la
`4 B`). La pagina è riservata all'account `admin` e si apre dalla scheda **Classi** della
[Configurazione](configuration.md); chi gestisce gli utenti si limita a scegliere una classe tra quelle esistenti. La
procedura è nella guida [Impostare le classi](../guides/set-up-classes.md).

<!-- figure: admin/classes | La pagina Classi con le classi di un ordine di scuola e il gruppo dei docenti -->

1. I pulsanti **Nuovo gruppo docenti** e **Nuove classi**.
2. Il collegamento **Scuola**, per cambiare anni e ordini di scuola.
3. Una tabella per ordine di scuola, con le colonne **Classe**, **Anni** e **Utenti**.
4. I comandi di una riga: **Modifica** e **Archivia**.
5. Il gruppo dei docenti.
6. L'elenco ripiegabile delle classi archiviate.

## Nuove classi

Il pulsante **Nuove classi** apre la finestra omonima, che crea più classi in una volta. Si scelgono gli **Anni** (uno o
più) e si scrivono i **Nomi delle classi**, separati da virgole; `A-D` vale A, B, C, D e un nome può contenere spazi. La
casella «Una pluriclasse con tutti gli anni scelti» crea una sola classe che ospita tutti gli anni scelti, indicata
nell'elenco dall'etichetta **Pluriclasse**. In basso la finestra mostra l'anteprima delle classi che verranno create («…
classi da creare»); finché non c'è almeno un anno e un nome compare «Scegliere almeno un anno e scrivere i nomi.». Il
pulsante **Salva** crea le classi.

## Nuovo gruppo docenti

Il pulsante **Nuovo gruppo docenti** apre la finestra omonima: un gruppo di docenti non ha anni, solo un **Nome** e le
**Note**. Il gruppo compare nel riquadro **Docenti**.

## Il collegamento Scuola

Sotto il titolo la frase «Gli anni e gli ordini di scuola si cambiano nelle impostazioni» rimanda con il collegamento
**Scuola** alla sezione Scuola della [Configurazione](configuration.md#scuola).

## Le tabelle delle classi

Le classi attive sono raggruppate per ordine di scuola, con il nome dell'ordine come titolo; una pluriclasse compare
sotto l'ordine del suo primo anno. Per ogni classe la tabella mostra il nome (con le eventuali note), gli **Anni** che
ospita e il numero di **Utenti**. Senza classi la pagina dice «Nessuna classe» e ricorda che le classi si creano con
**Nuove classi**.

- **Modifica** apre la finestra «Modifica» della classe: nome, anni, ordine di scuola (**Ordine di scuola**, con la voce
  **Tutti**) e **Note**. Non si può togliere un anno in cui ci sono ancora studenti della classe.
- **Archivia** toglie la classe dall'elenco. Il comando è spento, con il suggerimento «Ha ancora degli utenti: non si può
  archiviare», finché la classe ha utenti.

## Classi archiviate

L'elenco ripiegabile «Classi archiviate» contiene le classi archiviate, in una tabella uguale alle altre. **Ripristina**
riporta una classe tra quelle attive.

## Messaggi

La pagina può rifiutare un'operazione con questi messaggi.

- «Il nome è obbligatorio.» e «Il nome è troppo lungo (al massimo 40 caratteri).»
- «Scegliere almeno un anno.» e «Un anno scelto non esiste più.»
- «Un gruppo di docenti non ha anni.»
- «Esiste già una classe con questo nome per lo stesso anno.»
- «Degli studenti della classe sono in un anno che verrebbe tolto.»
- «La classe ha ancora degli utenti.» e «La classe non esiste più.»
