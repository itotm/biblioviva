# Impostare la biblioteca

Questa guida spiega come dare a BiblioViva il nome, il logo, i colori e la lingua della biblioteca. Serve a chi
amministra BiblioViva, di norma subito dopo il [primo avvio](../../setup/steps/first-run.md), dove nome, colori e
lingua sono già stati scelti una prima volta.

- Tempo: circa 10 minuti.
- Account: `admin`, l'unico che vede **Amministrazione**.
- Occorrente: il logo della biblioteca, se c'è, in un file PNG, JPEG o WebP. Meglio un PNG con lo sfondo trasparente.

## Procedura

### Aprire la pagina

1. Accedere a BiblioViva come `admin`.
1. Aprire **Amministrazione**.
1. Aprire **Configurazione**.
1. Aprire **Aspetto e lingua**. La pagina mostra, uno sotto l'altro, il nome, il logo, la lingua, lo stile delle aree, i
   colori e la dashboard.

<!-- figure: admin/appearance | La pagina Aspetto e lingua con il nome, il logo, la lingua e i set di colori -->

### Cambiare il nome

1. Scrivere nel campo **Nome** il nome della biblioteca. Compare in alto a sinistra, sulla dashboard, sulle stampe e
   nell'applicazione installata sul telefono. Il campo è obbligatorio.
1. Premere **Salva il nome**. Compare il messaggio «Nome della biblioteca salvato».

### Mettere il logo

1. Nel riquadro **Logo della biblioteca** premere **Carica il logo**.
1. Scegliere il file dell'immagine. Il logo compare subito in alto a sinistra in ogni pagina, accanto al nome della
   biblioteca.
1. Per sostituirlo, premere **Cambia il logo** e scegliere un altro file.
1. Per toglierlo, premere **Rimuovi il logo**. Al suo posto torna un'icona generica.

Il logo è salvato nella configurazione: fa parte dell'[esportazione della configurazione](export-the-configuration.md).
Il nome e il logo di BiblioViva compaiono soltanto sulla dashboard.

### Scegliere i colori

1. Nel riquadro **Set di colori** scegliere un set. L'anteprima si vede subito sulla pagina e la scritta «Set attuale»
   sopra i set indica quello in uso.
1. Premere **Salva i colori**. Compare il messaggio «Colori salvati».

I colori cambiano soltanto l'aspetto, non la forma delle pagine, e restano leggibili anche in bianco e nero. Lo stile
della fascia in alto si sceglie nel riquadro **Stile delle aree**: la scelta vale subito.

### Cambiare la lingua

BiblioViva usa una sola lingua per tutta l'installazione: la scelta vale per tutto il personale.

1. Nel riquadro **Lingua dell'applicazione** scegliere la lingua nell'elenco **Lingua**.
1. Premere **Cambia lingua**. La pagina si ricarica nella nuova lingua.

Per una lingua che non è nell'elenco vedere [Aggiungere una lingua](add-a-language.md).

## Risultato

- Il nome e il logo compaiono in alto a sinistra in ogni pagina.
- I colori scelti valgono per tutti gli account.
- La lingua scelta vale per tutto il personale.

## Possibili problemi

- Il pulsante **Salva il nome** resta spento: il nome è vuoto oppure uguale a quello già salvato. Il messaggio «Il nome
  della biblioteca è obbligatorio.» compare quando il campo è vuoto.
- Il logo viene rifiutato con «Formato non accettato: sono ammessi PNG, JPEG e WebP.»: convertire l'immagine in uno di
  questi formati.
- Il logo viene rifiutato con «Il file è troppo grande»: ridurre le dimensioni dell'immagine con un programma di
  fotoritocco e riprovare.
- Altre impostazioni della biblioteca, come l'email di contatto, il fuso orario e l'inizio dell'anno scolastico, sono
  nella sezione **Biblioteca e scuola** della [configurazione](../screens/configuration.md).

## Pagine correlate

- [Aspetto e lingua](../screens/appearance.md)
- [Aggiungere una lingua](add-a-language.md)
- [Primi passi dell'amministratore](../first-steps.md)
