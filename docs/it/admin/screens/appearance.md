# Aspetto e lingua

La pagina **Aspetto e lingua** cambia ciò che il personale vede della biblioteca: il nome, il logo, la lingua, i colori
e le sezioni della dashboard. È riservata all'account `admin` e si apre dalla scheda **Aspetto e lingua** della
[Configurazione](configuration.md). Ogni modifica viene registrata nella [Cronologia](config-history.md) e si può
annullare. La procedura è nella guida [Impostare la biblioteca](../guides/set-up-the-library.md).

<!-- figure: admin/appearance | La pagina Aspetto e lingua con le sei schede -->

1. **Nome della biblioteca**.
2. **Logo della biblioteca**.
3. **Lingua dell'applicazione**.
4. **Stile delle aree**.
5. **Set di colori**.
6. **Dashboard**.

## Nome della biblioteca

Il campo **Nome** contiene il nome che compare in alto a sinistra, sulla dashboard, sulle stampe e nell'app installata sul
telefono. Il nome è obbligatorio («Il nome della biblioteca è obbligatorio»). **Salva il nome** lo registra; resta spento
finché il nome non cambia.

## Logo della biblioteca

Il logo compare in alto a sinistra in ogni pagina, accanto al nome. Formati ammessi: PNG, JPEG o WebP, meglio con lo
sfondo trasparente. La scheda mostra il logo in uso; senza logo compare «Nessun logo: si vede un'icona generica.»

- **Carica il logo** sceglie un file (con un logo già presente il pulsante si chiama **Cambia il logo**).
- **Rimuovi il logo** lo toglie.

Un file vuoto, troppo grande (c'è un limite in MB, scritto nel messaggio), che non è un'immagine o in un formato non
accettato viene rifiutato con un messaggio sotto il pulsante.

## Lingua dell'applicazione

Una sola lingua per installazione: vale per tutto il personale. Il menu **Lingua** elenca le lingue di BiblioViva e i
pacchetti di lingua installati (vedere [Interfaccia](configuration.md#interfaccia) e la guida
[Aggiungere una lingua](../guides/add-a-language.md)). **Cambia lingua** applica la scelta e ricarica la pagina.

Sotto il menu, **Aggiungere una lingua** installa una lingua nuova senza uscire dalla pagina:

- l'elenco **Lingue disponibili su GitHub** mostra le lingue pubblicate con la versione installata di BiblioViva che non
  sono ancora installate; **Installa** scarica il pacchetto, lo controlla e lo installa, e la lingua risulta subito
  scelta nel menu **Lingua**;
- **Carica un pacchetto (zip)** installa uno zip scaricato a mano o preparato da sé (per un computer senza internet);
- il collegamento **Pagina della release su GitHub, per scaricare gli zip** apre la pagina da cui scaricare i pacchetti.

Se l'elenco non è raggiungibile (manca internet) compare un avviso e il caricamento dello zip funziona lo stesso.

## Stile delle aree

La fascia in alto prende il colore dell'area in cui si lavora (Prestiti, Catalogo, Utenti…), nei toni del set di colori
scelto. Icona e nome dell'area restano sempre visibili. Quattro scelte, ciascuna con un'anteprima:

- **Fascia tinta (consigliata)**;
- **Fascia piena**;
- **Solo accenti**;
- **Nessun colore**.

La scelta si applica subito, al clic sull'anteprima, e compare «Stile delle aree salvato».

## Set di colori

Quindici set di colori (Oceano, Bosco, Uva, Tramonto, Ciliegia, Laguna, Argento, Grafite, Albicocca, Indaco, Menta,
Rosa, Sahara, Inverno, Oliva): cambiano solo i colori, mai la forma. Il set in uso è indicato da «Set attuale». **Salva
i colori** applica il set scelto; senza modifiche compare «Nessuna modifica da salvare.»

## Dashboard

Le sezioni della pagina iniziale, per tutta la biblioteca. Le azioni rapide, quando sono attive, stanno sempre in cima.
Ogni sezione si accende o si spegne con la sua casella:

- Azioni rapide;
- La biblioteca oggi (riquadri con i numeri);
- Inventario in corso;
- Invito ad aggiungere l'app alla schermata Home (telefoni);
- In scadenza questa settimana;
- Prossime date del calendario;
- Prestiti di oggi.

Dentro ogni sezione ciascun account vede solo ciò che può fare. **Salva la dashboard** registra la scelta.
