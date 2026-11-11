# Installazione

Questa sezione guida chi deve installare BiblioViva nella biblioteca della scuola. Ogni percorso è una successione di passi numerati; ogni passo termina con una verifica da fare prima di
proseguire.

BiblioViva gira su un computer dedicato, che resta acceso durante l'apertura della biblioteca, e vi si accede dal
browser di qualunque computer, tablet o telefono della scuola. Un computer spento di notte non è un problema: la copia
di sicurezza che era in scadenza viene fatta all'accensione successiva.

## Il percorso in poche domande

Le domande seguenti compongono il percorso adatto alla biblioteca: si risponde a una domanda alla volta, e quella
successiva si apre quando la precedente ha la sua risposta. Alla fine compaiono che cosa installare, che cosa
funziona, i passi con il tempo indicativo e l'occorrente. Chi preferisce scegliere da sé trova le due scelte e la
tabella dei percorsi più sotto.

<!-- setup-questions -->

## Due scelte da fare

L'installazione dipende da due scelte, indipendenti l'una dall'altra.

1. Il computer su cui gira BiblioViva: un vecchio PC con Linux (di norma già disponibile nella scuola) oppure un
   Raspberry Pi (un piccolo computer da acquistare). Vedere [Scegliere il computer](choose-computer.md).
1. La rete attraverso cui si raggiunge BiblioViva: Tailscale (la via completa, con un account gratuito) oppure la
   rete locale della scuola (la via di base, senza account). Vedere [Scegliere la rete](choose-network.md).

La scelta della rete si può cambiare più avanti, conservando tutti i dati: vedere
[Passare dalla rete locale a Tailscale](lan-to-tailscale.md), pagina che descrive anche la strada inversa.

## Percorsi

Le due scelte danno quattro percorsi. Ciascuno esegue gli stessi otto passi, nello stesso ordine; cambiano solo i
dettagli di alcuni passi.

| Computer | Rete | Percorso | Tempo indicativo |
|---|---|---|---|
| PC con Linux | Tailscale | [PC con Linux e Tailscale](paths/linux-tailscale.md) | circa 2 ore |
| PC con Linux | Rete locale | [PC con Linux e la rete locale](paths/linux-lan.md) | circa 1 ora e mezza |
| Raspberry Pi | Tailscale | [Raspberry Pi con Tailscale](paths/raspberry-tailscale.md) | circa 2 ore |
| Raspberry Pi | Rete locale | [Raspberry Pi con la rete locale](paths/raspberry-lan.md) | circa 1 ora e mezza |

Il tempo comprende il lavoro dell'installatore e le attese (scrittura della scheda microSD, scaricamento di
BiblioViva); non comprende l'acquisto del materiale. [VERIFY: i tempi sono stime; provare un percorso con una
persona che non ha mai installato BiblioViva e annotare i tempi]

## Occorrente in breve

Servono un computer, un lettore di codici a barre USB, una stampante e la carta per le etichette e le tessere; un
telefono è facoltativo. L'elenco completo, con i collegamenti per acquistare o scaricare, è in
[Occorrente](material.md).

## Dopo l'installazione

Queste pagine riguardano la vita di BiblioViva a installazione conclusa.

- [Aggiornare BiblioViva](update.md)
- [Spostare BiblioViva su un altro computer](move.md)
- [Ripartire da una copia di sicurezza](restore.md)
- [Passare dalla rete locale a Tailscale](lan-to-tailscale.md), e viceversa
- [Disinstallare BiblioViva](uninstall.md)

## Possibili problemi

I problemi più comuni (l'indirizzo non si apre, la fotocamera non parte, il lettore scrive caratteri strani, la
stampa è troppo piccola) sono descritti in [Problemi comuni](../help/problems.md). I termini tecnici sono spiegati
nel [Glossario](../help/glossary.md).
