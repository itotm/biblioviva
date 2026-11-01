# Template di stampa

La pagina **Template di stampa** raccoglie i modelli con cui BiblioViva stampa le tessere, le etichette dei libri, le
ricevute e i solleciti. È riservata all'account `admin` e si apre dalla scheda **Template di stampa** della
[Configurazione](configuration.md). Ha due schede in alto: **Template**, per gestire le cartelle dei modelli, e
**Anteprime**, per vedere come escono. In ciascuna i modelli sono divisi in tre gruppi: **Tessere**, **Etichette** e
**Solleciti**. Le procedure sono nelle guide [Modificare il modello delle tessere](../guides/edit-the-card-template.md)
e [Modificare le etichette e la fascetta del dorso](../guides/edit-label-templates.md); la struttura tecnica dei modelli
è nel [riferimento dei template](../../../templates-authoring.md).

<!-- figure: admin/templates | La scheda Template con i modelli delle tessere -->

1. Le schede **Template** e **Anteprime**.
2. I gruppi **Tessere**, **Etichette** e **Solleciti**.
3. Il riquadro di un modello, con la provenienza e i comandi.
4. Gli elenchi ripiegabili delle immagini e dei file del modello.

## Scheda Template

Ogni modello è una cartella e ha un riquadro con il nome, una descrizione e queste indicazioni:

- la provenienza: **Fornito con BiblioViva**, **Personalizzato** (una copia che prende il posto dell'originale) oppure
  **Aggiunto**;
- per le etichette, il tipo di etichetta;
- **Con errori**, se il modello non si può usare, e il motivo scritto sotto;
- «Usato da» e le impostazioni che lo usano (per esempio il modello predefinito delle tessere), oppure «Non usato da
  nessuna impostazione».

I comandi dipendono dalla provenienza.

- **Personalizza**, per un modello fornito con BiblioViva: crea una copia con lo stesso nome che prende il posto
  dell'originale; l'originale resta disponibile per tornare indietro.
- **Duplica**: crea una copia con un altro nome, modificabile. Il nome usa lettere minuscole, cifre, trattini e trattini
  bassi.
- **Modifica**: apre l'[editor del modello](#editor-del-template). Solo per le copie della scuola.
- **Rinomina**: cambia il nome della cartella; le impostazioni che usano il modello seguono il nuovo nome. Non per le
  copie che sostituiscono un modello fornito.
- **Elimina**: cancella la cartella e i suoi file. Per un modello personalizzato il pulsante si chiama **Torna
  all'originale** e rimette in uso il modello fornito. Il pulsante è spento finché il modello è usato da un'impostazione:
  prima si sceglie un altro modello.

Ogni operazione chiede conferma in una finestra e compare nella [Cronologia](config-history.md), da cui si può
annullare. I modelli forniti con BiblioViva non si modificano direttamente.

### Immagini e caratteri

L'elenco ripiegabile «Immagini e caratteri» mostra i file di immagine e di carattere del modello, con la dimensione e i
file in cui sono usati («non usato» se nessuno li usa). **Carica un file** ne aggiunge uno (PNG, JPEG, WebP, GIF, SVG o
caratteri WOFF2, WOFF, TTF; il limite in MB è scritto accanto); il cestino toglie un file che non è usato. Un modello
fornito con BiblioViva non ha il caricamento: va prima personalizzato.

### File del modello

L'elenco ripiegabile «File del template» nomina i file HTML e CSS del modello. Il loro contenuto si modifica con l'editor.

## Scheda Anteprime

La scheda **Anteprime** mostra come escono i modelli. Il pulsante **Ricarica template** rilegge le cartelle dal disco,
utile dopo averle cambiate a mano. Ogni modello ha le etichette «Valido» o «Errore», «Predefinito» per quello in uso,
«Fornito con l'app» o «Nella configurazione» come provenienza e la cartella.

### Tessere

Per ogni modello la scheda indica i tipi di utente per cui è scelto («Per: …») e mostra l'**Anteprima** del **Fronte** e
del **Retro**. I controlli sono:

- **Utente da mostrare**: un **Utente di esempio** oppure un **Utente reale**, da cercare per cognome o nome;
- **Zoom**;
- **Foglio intero**: una pagina A4 con l'utente di esempio, come verrà stampata;
- **Stampa pagina di prova**: la «Pagina di prova tessere», con un righello di 10 cm che dopo la stampa deve misurare
  100 mm (stampa al 100 %, senza «adatta alla pagina»).

Sotto, il riquadro «Come creare un template» riassume i passi: duplicare, modificare, controllare l'anteprima,
sceglierlo nelle impostazioni Tessere o Etichette. Un modello non utilizzabile mostra l'avviso «Il template non può
essere usato finché non viene corretto».

### Etichette

Per ogni modello di etichette la scheda mostra l'anteprima, i fogli adesivi previsti, la misura dell'unità e la
variante, e il **Foglio di esempio**. Il riquadro «Pagina di calibrazione etichette» fa scegliere il **Supporto
adesivo** e **Stampa pagina di calibrazione**: si stampa su carta comune e si sovrappone a un foglio di etichette per
controllare i margini. Guida: [Aggiungere un foglio di etichette](../guides/add-a-label-stock.md).

### Solleciti

Elenca i modelli di sollecito con la provenienza e, se ci sono, gli errori. Senza modelli compare «Nessun template di
sollecito».

## Editor del template

**Modifica** apre l'editor, intitolato «Modifica» seguito dal nome del modello. Disegno e codice agiscono sugli stessi
file: ogni modifica fatta in una vista compare anche nell'altra.

- **Disegno**: il modello come riquadri da spostare e ridimensionare. Si scelgono la **Griglia** (da «Nessuna (libera)»
  a 10 mm), l'**Ingrandimento**, la faccia (**Fronte** o **Retro**) e si aggiungono elementi con **Aggiungi**: Campo,
  Testo, Codice a barre, Foto, Pittogramma, Immagine, Riquadro. Il pannello laterale regola posizione, dimensione,
  carattere, colori e bordo dell'elemento scelto; per una tessera permette anche di scegliere lo sfondo (**Scegli uno
  sfondo**, **Carica un'immagine**) e il formato della tessera.
- **Codice**: i file HTML e CSS del modello.
- **Anteprima**: il risultato.

**Salva** registra il modello («Template salvato»). Se il modello non si può stampare, l'editor elenca i problemi sotto
«Il template non si può stampare così».
