# Scegliere il computer

BiblioViva ha bisogno di un computer che resti acceso durante l'apertura della biblioteca. Questa pagina aiuta chi
installa a scegliere il tipo di computer e a capire quale profilo di prestazioni gli corrisponde.

## Due tipi di computer

BiblioViva funziona su un computer con un sistema Linux a 64 bit. Questa guida descrive due casi.

### Vecchio PC con Linux

È la prima soluzione da considerare: un vecchio PC della scuola, non più adatto al lavoro quotidiano, è spesso
sufficiente e non richiede acquisti. Consuma più corrente e fa più rumore di un Raspberry Pi.

- Processore a 64 bit (vedere più sotto come verificarlo) e almeno 2 GB di memoria.
- Sistema operativo: Debian o Ubuntu, installato sul PC. Altre distribuzioni, come Fedora, sono possibili per chi
  conosce Linux: vedere la pagina tecnica [Deployment notes (technical)](../../deploy.md) (in inglese).
- Il nome del computer, in questa guida, è `biblioviva`: con la rete locale è il nome con cui si raggiunge il computer
  (`biblioviva.local`). La guida indica a quale passo impostarlo.

### Un PC con Windows

Questa guida non descrive l'installazione su un PC con Windows. Chi dispone soltanto di un computer con Windows può
installare Linux al suo posto, se il PC è dedicato a BiblioViva, oppure usare un Raspberry Pi (descritto più sotto).

### Raspberry Pi

Un [Raspberry Pi](https://www.raspberrypi.com/products/) è un piccolo computer, grande come un portafoglio, che non
fa rumore e consuma poca corrente. È un'alternativa al vecchio PC, da acquistare apposta.

- Modello: Raspberry Pi 4 o Raspberry Pi 5, con almeno 2 GB di memoria.
- Scheda microSD da 32 GB, su cui si scrive il sistema operativo.
- Sistema operativo: Raspberry Pi OS Lite a 64 bit, scritto sulla scheda con il programma
  [Raspberry Pi Imager](https://www.raspberrypi.com/software/).

L'elenco completo di ciò che serve è in [Occorrente](material.md).

## Computer dedicato o computer del banco

BiblioViva può girare su un computer dedicato, che nessuno usa per altro, oppure sullo stesso computer che si usa al
banco prestiti. Il computer dedicato è la scelta consigliata.

| | Computer dedicato | Computer del banco |
|---|---|---|
| Vantaggi | Resta acceso e non viene spento per errore; non rallenta il lavoro al banco | Nessun computer in più da procurarsi |
| Svantaggi | Un dispositivo in più da procurarsi e collegare alla rete | Deve restare acceso per tutto l'orario; uno spegnimento o un riavvio interrompono BiblioViva per tutti; richiede Linux su quel computer |

Con un computer dedicato, il computer del banco è un qualunque computer con un browser, come ogni altro dispositivo
della scuola.

## Profili di prestazioni

BiblioViva adatta il proprio uso della memoria e del disco al computer su cui gira. L'adattamento è un profilo, che
l'installazione propone da sola in base al computer e che si può cambiare in seguito dall'amministrazione. I profili
sono quattro.

| Profilo | Computer a cui corrisponde |
|---|---|
| `micro` | Un computer minimo: un processore lento e 512 MB di memoria. Questa guida non lo descrive. |
| `small` | Un Raspberry Pi 4 con 2 GB di memoria e una scheda microSD. È il profilo predefinito, adatto a ogni computer. |
| `medium` | Un vecchio PC con un disco rigido tradizionale (a piatti). |
| `large` | Un PC con molta memoria e un disco SSD. |

Un profilo più modesto è sempre sicuro: BiblioViva funziona, un poco più lentamente nelle operazioni pesanti, come la
stampa di molti fogli o la copia di sicurezza. Un profilo troppo ambizioso per il computer può invece rallentarlo. Nel
dubbio, scegliere `small`. Il caso previsto è una biblioteca fino a 10 000 libri e 1 000 utenti.

I valori di ciascun profilo sono nella pagina tecnica [Performance](../../performance.md) e nella
[Configuration reference](../../config-reference.md), entrambe in inglese.

## Verificare che un vecchio PC sia a 64 bit

Un vecchio PC funziona solo se il suo processore è a 64 bit. Quasi tutti i PC non troppo vecchi lo sono; la verifica
toglie ogni dubbio.

- Se il PC ha ancora Windows: aprire le impostazioni di sistema, alla voce delle informazioni sul computer, e
  leggere il «Tipo di sistema». Deve indicare un processore «basato su x64» [VERIFY: voce di menu e testo in
  italiano di Windows 10 e 11]. Il sistema operativo può essere a 32 bit anche su un processore a 64 bit: conta il
  processore, perché Linux lo sostituisce.
- Se il PC ha già Linux o si avvia da una chiavetta con Linux: aprire il terminale e digitare il comando seguente.

  ```sh
  uname -m
  ```

  La risposta `x86_64` indica un processore a 64 bit; `i686` o `i386` indicano un processore a 32 bit, non adatto.

Il passo [Preparare il computer](steps/prepare-computer.md) indica come installare il sistema operativo.

## Pagine correlate

- [Scegliere la rete](choose-network.md)
- [Occorrente](material.md)
- [Installazione](README.md)
