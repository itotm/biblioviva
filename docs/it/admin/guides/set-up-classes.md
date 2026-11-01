# Impostare le classi

Questa guida spiega come creare le classi della scuola e i gruppi dei docenti, e come correggerli. Serve a chi
amministra BiblioViva: soltanto l'account `admin` può farlo; chi lavora con gli utenti si limita a scegliere una classe
già esistente.

- Tempo: circa 10 minuti.
- Account: `admin`.
- Occorrente: l'elenco delle classi della scuola (anni e sezioni).

Una *classe* di BiblioViva è un gruppo permanente di studenti, per esempio `3 B`. Alla fine dell'anno la classe passa
all'anno successivo insieme ai suoi studenti (`3 B` diventa `4 B`): vedere [Avanzare di classe](class-upgrade.md). Una
*pluriclasse* è una classe che ospita più anni insieme. I docenti non stanno in una classe ma in un gruppo
docenti, che l'avanzamento di classe non tocca mai.

## Procedura

### Aprire la pagina delle classi

1. Accedere a BiblioViva con l'account `admin`.
1. Premere **Amministrazione**, poi **Configurazione**.
1. Nel gruppo «Aspetto, classi e modelli» premere **Classi**. La pagina elenca le classi divise per ordine di scuola,
   con gli anni di ciascuna e il numero di utenti, e sotto i gruppi dei docenti.

<!-- figure: admin/classes | La pagina Classi con le classi di una scuola primaria e il gruppo Docenti -->

### Creare più classi insieme

1. Premere **Nuove classi**. Si apre la finestra **Nuove classi**.
1. Nel campo **Anni** selezionare le caselle degli anni a cui si vogliono aggiungere le classi (nel modello della scuola
   primaria sono «Prima primaria», «Seconda primaria» e così via).
1. Nel campo **Nomi delle classi** scrivere i nomi separati da virgole. Un intervallo si scrive con il trattino: `A-D`
   vale `A, B, C, D`. Un nome può contenere spazi.
1. Controllare l'elenco sotto il campo, che comincia con una frase come «8 classi da creare:». Ogni classe è scritta
   come comparirà in BiblioViva (`1 A`, `1 B`, …).
1. Premere **Salva**. BiblioViva crea una classe per ogni anno e per ogni nome e mostra il messaggio «8 classi create».

### Creare una pluriclasse

1. Premere **Nuove classi**.
1. Selezionare almeno due anni. Compare la casella **Una pluriclasse con tutti gli anni scelti**.
1. Spuntare la casella e scrivere il nome della classe nel campo **Nomi delle classi**.
1. Premere **Salva**. Nell'elenco la classe porta il segno **Pluriclasse** e nella colonna **Anni** elenca gli anni
   ospitati.

### Creare un gruppo docenti

1. Premere **Nuovo gruppo docenti**.
1. Nel campo **Nome** scrivere il nome del gruppo, per esempio `Docenti primaria`. Un gruppo `Docenti` esiste già dal
   primo avvio.
1. Se la scuola ha più ordini, scegliere nel campo **Ordine di scuola** quello a cui appartiene il gruppo; altrimenti
   lasciare **Tutti**.
1. Premere **Salva**. Il messaggio è «Gruppo docenti creato».

### Correggere o archiviare una classe

1. Nella riga della classe premere **Modifica**.
1. Cambiare il nome, gli anni (per una pluriclasse) o le note, poi premere **Salva**. Il messaggio è «Classe salvata».
1. Per togliere una classe che non serve più, premere **Archivia** nella sua riga. L'archiviazione è possibile solo per
   una classe senza utenti.
1. Per riavere una classe archiviata, aprire l'elenco «Classi archiviate» in fondo alla pagina e premere
   **Ripristina** nella sua riga.

## Risultato

Le classi create compaiono nell'elenco, accanto al numero di utenti (all'inizio zero). Da quel momento si possono
scegliere nella scheda di un utente e sono valide nelle colonne `class` o `level` e `section` dei file degli studenti
(vedere [Importare gli alunni](import-students.md)). Un gruppo docenti nuovo si sceglie nella scheda di un docente o
nella colonna `group` del file dei docenti.

## Possibili problemi

- Compare «Esiste già una classe con questo nome per lo stesso anno.»: esiste una classe con lo stesso anno e lo stesso
  nome, anche archiviata: aprire l'elenco «Classi archiviate» e ripristinarla, oppure scegliere un altro nome.
- Il pulsante **Archivia** è spento: la classe ha ancora degli utenti. Spostarli in un'altra classe dalla scheda di
  ciascuno, oppure attendere l'avanzamento di fine anno: le classi che restano vuote vengono archiviate da sole.
- Compare «Degli studenti della classe sono in un anno che verrebbe tolto.»: si è tolto da una pluriclasse un anno in
  cui ci sono ancora studenti. Rimettere la spunta all'anno.
- L'anno che serve non compare tra le caselle: gli anni della scuola non si cambiano da questa pagina, ma dal
  collegamento **Scuola** in cima alla pagina, nel riquadro **Ordini di scuola e anni**. Il modo in cui si
  scrive la classe (`3 B` o `3B`) si cambia nella stessa sezione, nel campo **Come si scrive la classe**.

## Pagine correlate

- [Importare gli alunni](import-students.md)
- [Avanzare di classe](class-upgrade.md)
- [Iscrivere un alunno](../../manual/guides/enrol-a-student.md)
- [Classi](../screens/classes.md)
