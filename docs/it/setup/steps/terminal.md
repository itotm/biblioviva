# Collegarsi al computer

Questo passo spiega come aprire il terminale del computer di BiblioViva, la finestra in cui si digitano i comandi
dei passi successivi. Richiede circa 10 minuti. Un terminale è una finestra di testo in cui si scrive un comando e si
legge la risposta del computer.

## Occorrente

<!-- variant: linux -->
**Con un PC Linux**

- Il nome utente e la password annotati nel passo [Preparare il computer](prepare-computer.md).
- Il PC stesso, con tastiera e schermo collegati; oppure un altro computer sulla stessa rete, se è installato il
  server SSH.
<!-- /variant -->
<!-- variant: raspberry -->
**Con il Raspberry Pi**

- Un altro computer (Windows, macOS o Linux) collegato alla stessa rete del Raspberry Pi.
- Il nome utente e la password annotati nel passo [Preparare il computer](prepare-computer.md).
<!-- /variant -->

## Procedura

<!-- variant: linux -->
**Con un PC Linux**

1. Sul PC di BiblioViva, accedere con il nome utente e la password annotati. Con una versione con ambiente grafico,
   aprire poi "Terminale" dal menu delle applicazioni (di solito anche con Ctrl+Alt+T). Con una versione server
   l'accesso mostra già il terminale.
1. Per collegarsi da un altro computer invece (Windows, macOS o Linux): aprire il terminale (in Windows dal menu Start
   scrivendo "PowerShell"; in macOS "Terminale" dalla cartella Utility; in Linux "Terminale" dal menu delle
   applicazioni).
1. Digitare il comando seguente, sostituendo `<utente>` con il nome utente annotato, e premere Invio.

   ```sh
   ssh <utente>@biblioviva.local
   ```

1. Alla prima connessione rispondere `yes` alla domanda sull'impronta della chiave e premere Invio. La domanda
   compare solo la prima volta.
1. Digitare la password e premere Invio. Mentre si digita la password non compare nulla: è normale.
1. Se il nome `biblioviva.local` non risponde, cercare l'indirizzo del PC nell'elenco dei dispositivi del router
   (per esempio `192.168.1.50`) e usarlo al posto del nome.

   ```sh
   ssh <utente>@<indirizzo>
   ```

   Il nome `biblioviva.local` funziona da un altro computer solo se il PC lo annuncia in rete: con la rete locale lo
   fa dopo il passo [Installare BiblioViva](install.md), che aggiunge il servizio necessario quando manca.
<!-- /variant -->
<!-- variant: raspberry -->
**Con il Raspberry Pi**

Il Raspberry Pi non ha tastiera né schermo: lo si comanda da un altro computer con SSH, un programma che collega i
due computer attraverso la rete. SSH è già presente in Windows 10 e 11, in macOS e in Linux
([guida ufficiale](https://www.raspberrypi.com/documentation/computers/remote-access.html#ssh)).

1. Sull'altro computer, aprire il terminale.
   - In Windows: aprire il menu Start, scrivere "PowerShell" e aprire il programma (in Windows 11 va bene anche
     "Terminale").
   - In macOS: aprire "Terminale" dalla cartella Utility di Applicazioni.
   - In Linux: aprire "Terminale" dal menu delle applicazioni (di solito anche con Ctrl+Alt+T).
1. Digitare il comando seguente, sostituendo `<utente>` con il nome utente annotato, e premere Invio.

   ```sh
   ssh <utente>@biblioviva.local
   ```

1. Alla prima connessione il terminale mostra una domanda sull'impronta della chiave del computer. Rispondere `yes` e
   premere Invio. La domanda compare solo la prima volta.

   ```
   The authenticity of host 'biblioviva.local (192.168.1.50)' can't be established.
   ED25519 key fingerprint is SHA256:...
   Are you sure you want to continue connecting (yes/no/[fingerprint])?
   ```

1. Digitare la password annotata e premere Invio. Mentre si digita la password non compare nulla, nemmeno
   asterischi: è normale.
1. Se il nome `biblioviva.local` non risponde, cercare l'indirizzo del Raspberry Pi nell'elenco dei dispositivi del
   router (per esempio `192.168.1.50`) e usarlo al posto del nome.

   ```sh
   ssh <utente>@<indirizzo>
   ```
<!-- /variant -->

### Copiare e incollare un comando

I passi successivi indicano comandi da copiare. Per eseguirne uno:

1. Selezionare il comando nella pagina e copiarlo (Ctrl+C; in macOS Cmd+C).
1. Passare alla finestra del terminale e incollarlo.
   - Nel terminale di Linux: Ctrl+Shift+V.
   - Nel Terminale di Windows: clic con il tasto destro del mouse nella finestra, oppure Ctrl+Shift+V.
   - Nel Terminale di macOS: Cmd+V.
1. Premere Invio per eseguire il comando.

## Verifica prima di proseguire

Il terminale mostra una riga che termina con il simbolo del prompt (`$`) e che comincia con il nome utente, la
chiocciola e il nome del computer:

```
<utente>@biblioviva:~ $
```

Il terminale è pronto: i comandi dei passi successivi si incollano qui. Quando la riga non compare, si veda
"Possibili problemi".

## Possibili problemi

- "Connection refused" (connessione rifiutata): il PC o il Raspberry Pi non è ancora pronto, oppure SSH non è
  attivo. Attendere alcuni minuti e riprovare. Se il messaggio resta, per il PC installare il server SSH
  (`sudo apt install -y openssh-server`); per il Raspberry Pi ripetere la scrittura della scheda attivando SSH.
- "Permission denied, please try again" (password sbagliata): digitare di nuovo la password con attenzione, badando
  alla disposizione della tastiera (maiuscole, simboli). Dopo tre tentativi falliti il programma si ferma: ripetere
  il comando.
- "Could not resolve hostname biblioviva.local" (nome non trovato): il computer non risponde al nome. Controllare
  che sia acceso e collegato alla stessa rete, poi usare l'indirizzo che mostra il router.
- "Connection timed out": l'indirizzo non è quello del computer o il computer non è raggiungibile. Controllare
  l'indirizzo nell'elenco del router.
- "REMOTE HOST IDENTIFICATION HAS CHANGED": la scheda del Raspberry Pi è stata riscritta e il nome è già noto con
  un'altra chiave. Eliminare la vecchia chiave con il comando seguente e ripetere il collegamento.

  ```sh
  ssh-keygen -R biblioviva.local
  ```

Altri problemi: [Problemi comuni](../../help/problems.md#collegamento-ssh-che-non-riesce).

## Pagine correlate

- Passo precedente: [Preparare il computer](prepare-computer.md)
- Passo successivo: [Preparare la rete](network.md)
- [Glossario](../../help/glossary.md#terminale)
