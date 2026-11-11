# Panoramica

BiblioViva è un software libero per gestire una biblioteca scolastica: lo usa il personale della biblioteca dal browser
di qualunque computer, tablet o telefono della scuola. Questa pagina riassume ciò che fa.

## Impostazioni

La maggior parte delle scelte di una biblioteca è un'impostazione di BiblioViva e non una regola fissa del programma.
Alla prima apertura una configurazione guidata propone valori consigliati: la scuola primaria come tipo di scuola, i
codici a barre con una lettera di controllo, prestiti di 15 giorni, un account condiviso per ruolo, il set di colori
Oceano, le foto degli utenti e le copertine attive. Chi amministra la biblioteca può cambiare questi valori in ogni
momento da Amministrazione, senza modificare file.

Si possono impostare, tra l'altro: il tipo di scuola, gli anni e le classi (comprese le pluriclassi); i formati dei
codici a barre delle copie e delle tessere, anche quelli già stampati da altri sistemi; i generi, gli argomenti, i
livelli di lettura e lo schema con cui si compone la segnatura; i materiali (libri, DVD e altri) con le relative regole
di prestito; il calendario della scuola; i ruoli, i permessi e gli account condivisi o personali; i modelli di stampa di
tessere, etichette e fascetta del dorso, che si disegnano con il mouse o si modificano come codice; i fogli di etichette
adesive; i report; il nome, il logo, i colori e la lingua; le foto e le copertine, che si possono disattivare del tutto;
il profilo di prestazioni del computer.

Tutta la configurazione si esporta e si importa come un unico archivio, e ogni modifica fatta da Amministrazione si può
annullare.

## Banco prestiti

Il Banco prestiti si usa con il lettore di codici a barre: si legge la tessera, poi i libri. Permette di prestare,
restituire e rinnovare, di restituire un libro e prestarne subito un altro, e di prestare a chi non ha con sé la tessera
o una copia senza etichetta. Mostra i libri in prestito e stampa i solleciti raggruppati per classe. Raccoglie anche la
lista dei libri desiderati e il calendario con le chiusure, di cui le scadenze tengono conto.

## Catalogo

Il catalogo registra i libri e le loro copie. Per un libro con l'ISBN la scheda viene cercata da sola; per uno senza
ISBN si compila a mano. La copertina si cerca in rete o si carica. I libri si classificano per genere o argomento e si
cercano per titolo, autore, ISBN o codice della copia, o si elencano tutti insieme. Si esporta e si importa anche in
MARC 21 e UNIMARC, per lasciare BiblioViva o arrivarci da un altro programma di biblioteca. Il catalogo permette anche
di togliere le copie smarrite o rovinate e di fare l'inventario, leggendo le copie con il lettore scaffale per
scaffale. L'inventario della scuola è facoltativo: acceso, ogni copia ha anche il numero d'inventario, la provenienza e
il valore, e due report elencano le copie entrate e le copie scaricate in un periodo. Un libro può avere uno o più
formati accessibili (alta leggibilità, in simboli, audiolibro, caratteri grandi, tattile: l'elenco è della scuola): il
catalogo li filtra e un report elenca i libri di ogni formato.

## Utenti, classi e tessere

Gli utenti sono alunni e docenti, iscritti uno alla volta o da un file. Le classi sono gruppi permanenti che passano
all'anno successivo con l'avanzamento di classe. La foto dell'utente si fa con la fotocamera, si carica come file o si
ricava da un'immagine della classe intera. Una tessera smarrita si ristampa. Rimuovere un utente cancella subito e per
sempre i suoi dati personali.

## Stampe

BiblioViva stampa le tessere, le etichette dei libri (fascetta del dorso ed etichetta con il codice a barre), i
solleciti e, se attivate, le ricevute di prestito. Le liste di stampa permettono di preparare le stampe quando conviene
e di sapere che cosa è già stato stampato. La stampa fronte-retro delle tessere si calibra.

## Report

I report rispondono a domande sulla biblioteca: prestiti per mese, libri più prestati, copie mai prestate, utenti per
classe e altre. Ogni report si stampa e si scarica. L'amministratore può creare report propri, oltre a quelli forniti.
La dashboard riassume la biblioteca di oggi in pochi riquadri.

## Importazioni ed esportazioni

Si importano gli alunni, i docenti, il catalogo, i prestiti in corso e le foto degli utenti, per esempio al passaggio da
un altro programma. Ogni file viene controllato per intero prima: con un solo errore non si importa nulla. I dati della
biblioteca si esportano in file da tenere, da reimportare o da portare in un altro programma.

## Copie di sicurezza

BiblioViva fa da solo una copia di sicurezza ogni notte; una copia si può fare e scaricare anche in qualunque momento.
Da una copia si riparte su qualunque computer, anche su uno diverso da quello di origine.

## Lingue e aspetto

Italiano e inglese sono compresi. Una sola lingua vale per tutta l'installazione, e altre lingue si aggiungono con un
pacchetto di traduzioni. Il nome, il logo e il set di colori della biblioteca si scelgono da Amministrazione.

## Lavoro in più persone

Il personale entra con account condivisi o personali, ai quali l'amministratore assegna ruoli e permessi. Ogni account
cambia da sé la propria password. Le segnalazioni permettono di lasciare un avviso ai colleghi. Il registro operazioni
elenca chi ha fatto che cosa, senza dati personali degli utenti.

## Dispositivi e installazione

Il lettore di codici a barre USB è lo strumento normale per leggere tessere, copie e ISBN; il telefono è facoltativo.
BiblioViva gira su un computer con Linux, per esempio un vecchio PC o un Raspberry Pi, e vi si accede dal browser. La
rete è a scelta: la rete locale della scuola oppure Tailscale; la scelta si può cambiare più avanti ([Scegliere la
rete](setup/choose-network.md)).

## Riservatezza dei dati

Gli utenti sono in gran parte minorenni. I dati restano sul computer della scuola, salvo le copie che l'amministratore
sceglie di scaricare o di tenere altrove. Per usare BiblioViva serve un account, e ogni account vede solo ciò che il suo
ruolo consente. Le foto degli utenti si possono disattivare del tutto. La scuola resta titolare del trattamento dei dati
(Regolamento UE 2016/679, GDPR): le ricerche in internet della scheda di un libro e della copertina inviano solo l'ISBN,
il titolo o l'autore del libro, mai dati degli utenti. Che cosa chiedono le norme alla scuola, e i testi pronti per il registro dei
trattamenti e per l'informativa, sono nella sezione [Norme](compliance/data-protection.md).

## Accessibilità

BiblioViva si usa anche con la sola tastiera, con un lettore di schermo o con lo schermo ingrandito. Le scuole sono
tenute ai requisiti della Legge 4/2004 e delle linee guida dell'AgID (WCAG 2.1 di livello AA); il progetto ha come
obiettivo WCAG 2.2 AA, che li comprende. Il banco prestiti si usa interamente con la tastiera e il lettore di codici a
barre, e i suoi messaggi sono letti dai lettori di schermo; la fotocamera non è mai indispensabile. Lo stato, le
verifiche e i limiti ancora aperti sono descritti nella pagina [Accessibilità](compliance/accessibility.md) della
sezione Norme.

## Scelte di progetto

BiblioViva è riservato al personale: non ha un catalogo pubblico né account per gli utenti. Non gestisce multe né
prenotazioni dei libri.
