// SPDX-License-Identifier: GPL-3.0-or-later
// The words of the installation questions (PLAN.md step 8.7), Italian first and English as its mirror,
// with the same keys: `q.<question>.*` the question, `o.<question>.<option>` the option's label,
// `n.*` / `w.*` the note and the warning under a chosen option; the rest is the panel of the path.
// The register follows docs/writing-guide.md: impersonal, Italian instructions in the infinitive.

export type SetupLang = "it" | "en";

const it: Record<string, string> = {
	// ------------------------------------------------ questions
	"q.pc.title": "Da quanti computer si userà BiblioViva?",
	"q.pc.help":
		"Contano i computer da cui si lavora: il banco prestiti, la sala docenti, la segreteria.",
	"o.pc.uno": "Uno solo, il computer del banco prestiti",
	"o.pc.piu": "Più di uno",

	"q.tel.title": "Si useranno anche telefoni o tablet?",
	"q.tel.help":
		"Al banco basta il lettore di codici a barre USB. Il telefono serve, se si vuole, per leggere i codici con la fotocamera fra gli scaffali e per fotografare utenti e copertine.",
	"o.tel.no": "No, basta il lettore di codici a barre USB",
	"o.tel.si": "Sì, anche telefoni o tablet",

	"q.host.title": "Su quale computer gira BiblioViva?",
	"q.host.help":
		"Il computer su cui gira BiblioViva deve essere acceso quando qualcuno lavora. Gli altri dispositivi lo aprono dal browser.",
	"q.host.auto":
		"Con un solo computer e nessun telefono, BiblioViva si installa sul computer del banco e si apre come un programma.",
	"o.host.banco": "Sul computer del banco prestiti",
	"o.host.rpi": "Su un Raspberry Pi, da acquistare",
	"o.host.oldpc": "Su un vecchio PC dedicato a BiblioViva",
	"n.host.banco.others":
		"Gli altri dispositivi trovano BiblioViva solo quando il computer del banco è acceso.",
	"n.host.rpi":
		"Un piccolo computer che resta acceso, silenzioso e che consuma poco. Si prepara con un altro computer e una scheda microSD.",
	"n.host.oldpc":
		"Un PC a 64 bit con almeno 2 GB di memoria, che resta acceso durante l'apertura della biblioteca.",

	"q.os.title": "Quale sistema ha quel computer?",
	"q.os.help": "Il sistema decide che cosa si scarica.",
	"q.os.auto":
		"Sul Raspberry Pi si scrive Raspberry Pi OS sulla scheda microSD, con il programma Raspberry Pi Imager.",
	"o.os.rpios": "Raspberry Pi OS (64 bit)",
	"o.os.win": "Windows 10 o 11",
	"o.os.linux": "Linux (Ubuntu, Debian, Fedora, Mint…)",
	"o.os.linux.oldpc": "Linux già installato (Debian o Ubuntu)",
	"o.os.none": "Nessuno, o da reinstallare: si installa Debian",
	"o.os.mac": "macOS: non supportato",
	"n.os.none": "Servono una chiavetta USB da 8 GB e un altro computer per prepararla.",

	"q.net.title": "Come raggiungono BiblioViva gli altri dispositivi?",
	"q.net.help":
		"Nessuna delle due strade è sbagliata, e la scelta si può cambiare più avanti conservando i dati.",
	"o.net.ts": "Con Tailscale, un account gratuito",
	"o.net.lan": "Con la rete locale della scuola",
	"n.net.ts":
		"Collegamento sicuro (HTTPS): la fotocamera funziona su ogni dispositivo, il telefono installa BiblioViva come app, si lavora anche da casa. Su ogni dispositivo si installa l'app di Tailscale.",
	"n.net.lan":
		"Nessun account e nessuna app: basta il browser. Il collegamento non è cifrato e la fotocamera non funziona sugli altri dispositivi.",
	"w.net.lan.phone":
		"Con la rete locale il telefono apre BiblioViva ma non può usare la fotocamera: il browser la nega sulle pagine senza HTTPS.",

	"q.ip.title": "Si può riservare al computer un indirizzo fisso sul router?",
	"q.ip.help": "Lo fa chi gestisce la rete della scuola: il tecnico o il fornitore della rete.",
	"o.ip.si": "Sì",
	"o.ip.no": "No, oppure non c'è nessuno a cui chiederlo",
	"o.ip.nd": "Non so",
	"n.ip.si": "Il passo «Preparare la rete» contiene il messaggio da mandare al tecnico.",
	"w.ip.no":
		"Si usa il nome biblioviva.local, che funziona su molti dispositivi ma non su tutti. Se l'indirizzo del computer cambia, gli altri dispositivi non trovano più BiblioViva: in quel caso conviene Tailscale.",
	"n.ip.nd":
		"Si comincia con biblioviva.local; il passo «Preparare la rete» spiega come accorgersi se serve l'indirizzo fisso.",

	"q.tsacc.title": "Quale account Tailscale?",
	"q.tsacc.help":
		"Gli account di Tailscale servono solo alla rete. In BiblioViva si accede sempre con gli account dei ruoli.",
	"o.tsacc.school": "Un account della scuola, usato su ogni dispositivo",
	"o.tsacc.personal": "Account personali invitati",
	"n.tsacc.school": "Il modo più semplice; rientra nel piano gratuito.",
	"n.tsacc.personal":
		"Si sa chi si collega e si può togliere l'accesso a una persona sola; l'amministrazione è più laboriosa.",

	"q.method.title": "Come si installa?",
	"q.method.help":
		"Le due strade danno lo stesso BiblioViva. È già scelta quella consigliata: chi non sa scegliere la lascia.",
	"o.method.docker": "Docker",
	"o.method.deb": "Pacchetto Debian",
	"n.method.docker":
		"BiblioViva gira in un contenitore. Il file di Docker Compose, con il contenitore di Tailscale, è pronto da copiare; setup.sh installa Docker e prepara tutto. Permette la copia fuori sede automatica delle copie di sicurezza.",
	"n.method.deb":
		"Si installa con gli strumenti del sistema e parte da solo a ogni accensione; è più leggero di Docker.",

	"q.disk.title": "Che disco ha il computer?",
	"q.disk.help":
		"Serve a scegliere il profilo di prestazioni. Si può cambiare più avanti in Amministrazione.",
	"o.disk.ssd": "Un disco SSD",
	"o.disk.hdd": "Un disco tradizionale",
	"o.disk.nd": "Non so",

	"q.photo.title": "Le tessere avranno la foto dell'utente?",
	"q.photo.help":
		"Le foto si possono attivare o togliere anche più avanti; i modelli di tessera senza foto sono già pronti.",
	"o.photo.si": "Sì, con la foto",
	"o.photo.no": "No, tessere senza foto",
	"n.photo.si.webcam": "Le foto si scattano con la webcam, oppure si caricano da file.",
	"n.photo.si.phone":
		"Le foto si scattano con la webcam o con il telefono, oppure si caricano da file.",
	"n.photo.si.files":
		"Con la rete locale la fotocamera non è disponibile: le foto si caricano da file (anche le foto di classe).",
	"n.photo.no": "Le tessere si stampano con i modelli senza foto.",

	"q.backup.title": "Dove si tengono le copie di sicurezza?",
	"q.backup.help":
		"BiblioViva fa le copie da solo. Tenerle fuori dal disco del computer le salva da un guasto.",
	"o.backup.local": "Nella cartella backups del computer",
	"o.backup.cloud": "Anche in un servizio cloud (copia fuori sede automatica)",
	"o.backup.usb": "Su una chiavetta USB o un disco esterno lasciato collegato",
	"o.backup.share": "In una cartella di rete della scuola",
	"o.backup.disk2": "Su un secondo disco del computer",
	"o.backup.later": "Da decidere dopo",
	"w.backup.local":
		"Una copia sullo stesso computer non protegge da un guasto del disco: conviene anche la copia fuori sede.",
	"n.backup.cloud":
		"Si configura nella pagina Backup con un servizio di archiviazione della scuola.",
	"w.backup.later":
		"Finché la cartella non è scelta, Amministrazione mostra il riquadro «Backup da configurare».",

	"q.data.title": "Con quali dati si comincia?",
	"q.data.help": "Si sceglie nella prima schermata della configurazione iniziale.",
	"o.data.empty": "Da zero, con il catalogo vuoto",
	"o.data.demo": "Con dati di esempio, per provare",
	"o.data.restore": "Da una copia di sicurezza di BiblioViva",
	"o.data.import": "Da un altro programma (Koha, un foglio ODS o CSV)",
	"n.data.demo": "Si tolgono con un clic quando si comincia davvero; le classi restano.",
	"n.data.restore":
		"«Ripristina da un backup» nella prima schermata della configurazione iniziale.",
	"n.data.import":
		"Libri e utenti si importano dopo la configurazione; ogni file è controllato per intero prima di importarlo.",

	// ------------------------------------------------ the form
	"ui.choose": "Scegliere…",
	"ui.waiting": "Prima rispondere alla domanda precedente",
	"ui.recommended": "(consigliato)",
	"ui.expert": "per esperti",
	"ui.auto": "deciso da solo",
	"ui.restart": "Ricominciare",
	"ui.progress": "Domande con risposta: {done} di {total}",

	// ------------------------------------------------ the path
	"r.title": "Il percorso",
	"r.empty": "Il percorso compare qui man mano che si risponde alle domande.",
	"r.complete": "Il percorso è completo.",
	"r.incomplete": "Percorso in costruzione: mancano alcune risposte.",
	"r.package": "Da installare",
	"r.network": "Rete",
	"r.address": "Indirizzo",
	"r.profile": "Profilo",
	"r.time": "Tempo",
	"r.estimate": "stima",
	"r.works": "Che cosa funziona",
	"r.steps": "I passi",
	"r.material": "Occorrente",
	"r.open": "Aprire la guida di questo percorso",
	"r.notYet": "La guida di questo percorso è in preparazione.",
	"r.print": "Stampare",
	"r.copy": "Copiare",
	"r.copied": "Copiato",
	"r.minutes": "{n} min",
	"r.about": "circa {t}",
	"r.timeMin": "{m} minuti",
	"r.timeHour": "1 ora",
	"r.timeHours": "{h} ore",
	"r.timeAnd": "{a} e {b}",
	"r.quarter": "un quarto",
	"r.half": "mezza",
	"r.threeQuarters": "tre quarti",

	"where.banco.win": "Il computer del banco con Windows",
	"where.banco.linux": "Il computer del banco con Linux",
	"where.banco": "Il computer del banco",
	"where.rpi": "Un Raspberry Pi",
	"where.oldpc.win": "Un PC dedicato con Windows",
	"where.oldpc": "Un PC dedicato con Linux",
	"via.none": "{w}, da solo",
	"via.tailscale": "{w} con Tailscale",
	"via.lan": "{w} con la rete locale",

	"pkg.win": "Installatore per Windows",
	"pkg.appimage": "AppImage per Linux",
	"pkg.deb": "Pacchetto Debian (.deb)",
	"pkg.docker": "Docker",
	"net.none": "nessuna: solo questo computer",
	"net.tailscale": "Tailscale",
	"net.lan": "rete locale della scuola",

	"cap.deskCamera": "Webcam al banco (foto, copertine)",
	"cap.phoneCamera": "Telefono con la fotocamera",
	"cap.fromHome": "Lavorare da casa",
	"cap.deskOff": "Con il computer del banco spento",
	"cap.deskOff.appimage": "Prima che qualcuno apra la sessione",
	"cap.scanner": "Lettore USB, stampe, report",
	"st.works": "funziona",
	"st.files": "no, si caricano file",
	"st.noCamera": "senza fotocamera",
	"st.possible": "possibile",
	"st.no": "no",
	"st.deskOff": "BiblioViva non risponde",
	"st.noSession": "BiblioViva non risponde",
	"st.answers": "risponde",

	"step.prepare.rpi": "Preparare il Raspberry Pi (Raspberry Pi Imager)",
	"step.prepare.debian": "Installare Debian sul PC",
	"step.prepare.win": "Scaricare l'installatore di BiblioViva",
	"step.prepare.appimage": "Scaricare l'AppImage e permetterle di avviarsi",
	"step.prepare.pc": "Preparare il computer",
	"step.terminal": "Collegarsi al computer",
	"step.network.tailscale": "Preparare la rete: Tailscale",
	"step.network.lan": "Preparare la rete: l'indirizzo del computer",
	"step.install.win": "Installare BiblioViva (l'installatore)",
	"step.install.appimage": "Avviare BiblioViva",
	"step.install.deb": "Installare il pacchetto",
	"step.install.docker": "Installare BiblioViva con Docker",
	"step.firstRun": "Primo avvio",
	"step.firstRun.restore": "Primo avvio, ripristinando la copia di sicurezza",
	"step.firstRun.demo": "Primo avvio, con i dati di esempio",
	"step.devices": "Collegare i dispositivi",
	"step.devices.phones": "Collegare i dispositivi e i telefoni",
	"step.scannerPrinter": "Provare il lettore e la stampante",
	"step.backups": "Scegliere dove vanno le copie di sicurezza",
	"step.backups.offsite": "Copie di sicurezza e copia fuori sede",
	"step.import": "Importare libri e utenti",

	"material.rpi":
		"Un Raspberry Pi 4 o 5 con almeno 2 GB, l'alimentatore ufficiale, una scheda microSD da 32 GB, un involucro con dissipatore",
	"material.rpiImager":
		"Un altro computer con un lettore di schede microSD, per Raspberry Pi Imager",
	"material.oldpc": "Il PC dedicato: 64 bit, almeno 2 GB di memoria",
	"material.debianUsb":
		"Una chiavetta USB da 8 GB e un altro computer, per l'installatore di Debian",
	"material.deskWin": "Il computer del banco con Windows 10 (1809 o successivo) o 11, a 64 bit",
	"material.deskLinux": "Il computer del banco con Linux a 64 bit",
	"material.cable":
		"Un cavo di rete tra il computer di BiblioViva e il router (meglio del Wi-Fi)",
	"material.tailscale":
		"Una connessione a internet e un indirizzo di posta della biblioteca per l'account Tailscale",
	"material.fixedAddress": "La riserva di un indirizzo fisso, chiesta al tecnico della rete",
	"material.scanner":
		"Un lettore di codici a barre USB (Code 128 e Code 39, Invio dopo il codice)",
	"material.printer":
		"Una stampante A4 collegata al computer del banco; fogli di etichette 70 × 48 mm e fogli per le tessere",
	"material.phones": "Telefoni o tablet, con il browser aggiornato",
	"material.phonesTailscale": "Telefoni o tablet, con il browser aggiornato e l'app di Tailscale",
	"material.webcam": "Una webcam al banco, se il computer non ne ha una (facoltativa)",
	"material.usbDrive": "Una chiavetta USB o un disco esterno da lasciare collegato",

	// ------------------------------------------------ how to install
	"i.answers": "Le risposte da dare all'installatore",
	"i.answers.network": "Rete",
	"i.answers.profile": "Profilo",
	"i.answers.port": "Porta",
	"i.deb": "I comandi del passo «Installare il pacchetto»",
	"i.docker": "Il comando del passo «Installare BiblioViva»",
	"i.docker.lead":
		"Il comando scarica setup.sh, che installa Docker se manca, scrive i file qui sotto nella cartella biblioviva e avvia BiblioViva.",
	"i.manual": "A mano: i file da copiare",
	"i.manual.lead":
		"Per chi conosce Docker: gli stessi file che scrive setup.sh, già adattati alle risposte date. Si mettono nella cartella biblioviva dell'utente, poi si eseguono i comandi in fondo.",
	"i.env.key": "la chiave di accesso di Tailscale (inizia con tskey-auth-)",
	"i.commands": "I comandi",
};

const en: Record<string, string> = {
	"q.pc.title": "How many computers will use BiblioViva?",
	"q.pc.help":
		"Count the computers people work from: the circulation desk, the staff room, the office.",
	"o.pc.uno": "Only one, the circulation desk computer",
	"o.pc.piu": "More than one",

	"q.tel.title": "Will phones or tablets be used too?",
	"q.tel.help":
		"At the desk the USB barcode scanner is enough. A phone is an optional extra: it reads codes with its camera among the shelves and takes pictures of patrons and covers.",
	"o.tel.no": "No, the USB barcode scanner is enough",
	"o.tel.si": "Yes, phones or tablets too",

	"q.host.title": "Which computer does BiblioViva run on?",
	"q.host.help":
		"The computer BiblioViva runs on must be on while someone works. The other devices open it in the browser.",
	"q.host.auto":
		"With one computer and no phone, BiblioViva is installed on the desk computer and opens like a program.",
	"o.host.banco": "On the circulation desk computer",
	"o.host.rpi": "On a Raspberry Pi, to buy",
	"o.host.oldpc": "On an old PC given over to BiblioViva",
	"n.host.banco.others": "The other devices reach BiblioViva only while the desk computer is on.",
	"n.host.rpi":
		"A small computer that stays on, quiet and low on power. It is prepared with another computer and a microSD card.",
	"n.host.oldpc":
		"A 64-bit PC with at least 2 GB of memory, which stays on while the library is open.",

	"q.os.title": "Which system does that computer have?",
	"q.os.help": "The system decides what to download.",
	"q.os.auto":
		"On the Raspberry Pi, Raspberry Pi OS is written on the microSD card with the program Raspberry Pi Imager.",
	"o.os.rpios": "Raspberry Pi OS (64-bit)",
	"o.os.win": "Windows 10 or 11",
	"o.os.linux": "Linux (Ubuntu, Debian, Fedora, Mint…)",
	"o.os.linux.oldpc": "Linux already installed (Debian or Ubuntu)",
	"o.os.none": "None, or to reinstall: Debian is installed",
	"o.os.mac": "macOS: not supported",
	"n.os.none": "An 8 GB USB stick and another computer to prepare it are needed.",

	"q.net.title": "How do the other devices reach BiblioViva?",
	"q.net.help": "Neither way is wrong, and the choice can be changed later, keeping the data.",
	"o.net.ts": "With Tailscale, a free account",
	"o.net.lan": "With the school's local network",
	"n.net.ts":
		"A secure connection (HTTPS): the camera works on every device, the phone installs BiblioViva as an app, work from home is possible. The Tailscale app is installed on every device.",
	"n.net.lan":
		"No account and no app: the browser is enough. The connection is not encrypted and the camera does not work on the other devices.",
	"w.net.lan.phone":
		"On the local network the phone opens BiblioViva but cannot use its camera: the browser refuses it on pages without HTTPS.",

	"q.ip.title": "Can the computer get a fixed address on the router?",
	"q.ip.help":
		"Whoever runs the school's network does it: the technician or the network's provider.",
	"o.ip.si": "Yes",
	"o.ip.no": "No, or there is nobody to ask",
	"o.ip.nd": "I don't know",
	"n.ip.si": "The step “Prepare the network” has the message to send to the technician.",
	"w.ip.no":
		"The name biblioviva.local is used: it works on many devices, not on all. If the computer's address changes, the other devices no longer find BiblioViva: then Tailscale is the better way.",
	"n.ip.nd":
		"Start with biblioviva.local; the step “Prepare the network” explains how to tell whether a fixed address is needed.",

	"q.tsacc.title": "Which Tailscale account?",
	"q.tsacc.help":
		"Tailscale accounts are for the network only. In BiblioViva people always sign in with the accounts of the roles.",
	"o.tsacc.school": "One school account, used on every device",
	"o.tsacc.personal": "Personal accounts, invited",
	"n.tsacc.school": "The simplest way; it fits the free plan.",
	"n.tsacc.personal":
		"It shows who connects and lets one person's access be removed; administration takes more work.",

	"q.method.title": "How is it installed?",
	"q.method.help":
		"Both ways give the same BiblioViva. The advised one is already chosen: when in doubt, leave it.",
	"o.method.docker": "Docker",
	"o.method.deb": "Debian package",
	"n.method.docker":
		"BiblioViva runs in a container. The Docker Compose file, with the Tailscale container, is ready to copy; setup.sh installs Docker and prepares everything. It allows the automatic off-site copy of the backups.",
	"n.method.deb":
		"It is installed with the system's own tools and starts by itself at every boot; it is lighter than Docker.",

	"q.disk.title": "What disk does the computer have?",
	"q.disk.help": "It chooses the performance profile. It can be changed later in Administration.",
	"o.disk.ssd": "An SSD",
	"o.disk.hdd": "A hard disk",
	"o.disk.nd": "I don't know",

	"q.photo.title": "Will the cards carry the patron's photo?",
	"q.photo.help":
		"Photos can be switched on or off later too; the card templates without the photo are ready.",
	"o.photo.si": "Yes, with the photo",
	"o.photo.no": "No, cards without the photo",
	"n.photo.si.webcam": "Photos are taken with the webcam, or uploaded from a file.",
	"n.photo.si.phone": "Photos are taken with the webcam or the phone, or uploaded from a file.",
	"n.photo.si.files":
		"On the local network the camera is not available: photos are uploaded from files (class pictures too).",
	"n.photo.no": "Cards are printed with the templates without the photo.",

	"q.backup.title": "Where do the backups go?",
	"q.backup.help":
		"BiblioViva makes the backups by itself. Keeping them off the computer's disk saves them from a failure.",
	"o.backup.local": "In the computer's backups folder",
	"o.backup.cloud": "In a cloud service too (automatic off-site copy)",
	"o.backup.usb": "On a USB stick or an external disk left plugged in",
	"o.backup.share": "In a network folder of the school",
	"o.backup.disk2": "On a second disk of the computer",
	"o.backup.later": "To decide later",
	"w.backup.local":
		"A copy on the same computer does not survive a disk failure: the off-site copy is worth having.",
	"n.backup.cloud": "It is set up on the Backup page with a storage service of the school.",
	"w.backup.later":
		"Until the folder is chosen, Administration shows the box “Backups to set up”.",

	"q.data.title": "Which data does the library start with?",
	"q.data.help": "It is chosen on the first screen of the first-run setup.",
	"o.data.empty": "From scratch, with an empty catalogue",
	"o.data.demo": "With sample data, to try it out",
	"o.data.restore": "From a BiblioViva backup",
	"o.data.import": "From another program (Koha, an ODS or CSV sheet)",
	"n.data.demo": "They are removed with one click when the real work starts; the classes stay.",
	"n.data.restore": "“Restore from a backup” on the first screen of the first-run setup.",
	"n.data.import":
		"Books and patrons are imported after the setup; each file is checked whole before it is imported.",

	"ui.choose": "Choose…",
	"ui.waiting": "Answer the previous question first",
	"ui.recommended": "(advised)",
	"ui.expert": "for experts",
	"ui.auto": "decided by itself",
	"ui.restart": "Start again",
	"ui.progress": "Questions answered: {done} of {total}",

	"r.title": "The path",
	"r.empty": "The path appears here as the questions are answered.",
	"r.complete": "The path is complete.",
	"r.incomplete": "Path in progress: some answers are missing.",
	"r.package": "To install",
	"r.network": "Network",
	"r.address": "Address",
	"r.profile": "Profile",
	"r.time": "Time",
	"r.estimate": "estimate",
	"r.works": "What works",
	"r.steps": "The steps",
	"r.material": "What is needed",
	"r.open": "Open the guide of this path",
	"r.notYet": "The guide of this path is being written.",
	"r.print": "Print",
	"r.copy": "Copy",
	"r.copied": "Copied",
	"r.minutes": "{n} min",
	"r.about": "about {t}",
	"r.timeMin": "{m} minutes",
	"r.timeHour": "1 hour",
	"r.timeHours": "{h} hours",
	"r.timeAnd": "{a} and {b}",
	"r.quarter": "a quarter",
	"r.half": "a half",
	"r.threeQuarters": "three quarters",

	"where.banco.win": "The desk computer with Windows",
	"where.banco.linux": "The desk computer with Linux",
	"where.banco": "The desk computer",
	"where.rpi": "A Raspberry Pi",
	"where.oldpc.win": "A dedicated PC with Windows",
	"where.oldpc": "A dedicated PC with Linux",
	"via.none": "{w}, on its own",
	"via.tailscale": "{w} with Tailscale",
	"via.lan": "{w} on the local network",

	"pkg.win": "Windows installer",
	"pkg.appimage": "AppImage for Linux",
	"pkg.deb": "Debian package (.deb)",
	"pkg.docker": "Docker",
	"net.none": "none: this computer only",
	"net.tailscale": "Tailscale",
	"net.lan": "the school's local network",

	"cap.deskCamera": "Webcam at the desk (photos, covers)",
	"cap.phoneCamera": "Phone with its camera",
	"cap.fromHome": "Working from home",
	"cap.deskOff": "With the desk computer off",
	"cap.deskOff.appimage": "Before someone signs in to the computer",
	"cap.scanner": "USB scanner, printing, reports",
	"st.works": "works",
	"st.files": "no, files are uploaded",
	"st.noCamera": "without camera",
	"st.possible": "possible",
	"st.no": "no",
	"st.deskOff": "BiblioViva does not answer",
	"st.noSession": "BiblioViva does not answer",
	"st.answers": "answers",

	"step.prepare.rpi": "Prepare the Raspberry Pi (Raspberry Pi Imager)",
	"step.prepare.debian": "Install Debian on the PC",
	"step.prepare.win": "Download the BiblioViva installer",
	"step.prepare.appimage": "Download the AppImage and allow it to run",
	"step.prepare.pc": "Prepare the computer",
	"step.terminal": "Connect to the computer",
	"step.network.tailscale": "Prepare the network: Tailscale",
	"step.network.lan": "Prepare the network: the computer's address",
	"step.install.win": "Install BiblioViva (the installer)",
	"step.install.appimage": "Start BiblioViva",
	"step.install.deb": "Install the package",
	"step.install.docker": "Install BiblioViva with Docker",
	"step.firstRun": "First run",
	"step.firstRun.restore": "First run, restoring the backup",
	"step.firstRun.demo": "First run, with the sample data",
	"step.devices": "Connect the devices",
	"step.devices.phones": "Connect the devices and the phones",
	"step.scannerPrinter": "Try the scanner and the printer",
	"step.backups": "Choose where the backups go",
	"step.backups.offsite": "Backups and the off-site copy",
	"step.import": "Import books and patrons",

	"material.rpi":
		"A Raspberry Pi 4 or 5 with at least 2 GB, the official power supply, a 32 GB microSD card, a case with a heat sink",
	"material.rpiImager": "Another computer with a microSD card reader, for Raspberry Pi Imager",
	"material.oldpc": "The dedicated PC: 64-bit, at least 2 GB of memory",
	"material.debianUsb": "An 8 GB USB stick and another computer, for the Debian installer",
	"material.deskWin": "The desk computer with Windows 10 (1809 or later) or 11, 64-bit",
	"material.deskLinux": "The desk computer with 64-bit Linux",
	"material.cable":
		"A network cable between the BiblioViva computer and the router (better than Wi-Fi)",
	"material.tailscale":
		"An internet connection and an e-mail address of the library for the Tailscale account",
	"material.fixedAddress": "A fixed address reserved by the network's technician",
	"material.scanner": "A USB barcode scanner (Code 128 and Code 39, Enter after the code)",
	"material.printer":
		"An A4 printer connected to the desk computer; 70 × 48 mm label sheets and card sheets",
	"material.phones": "Phones or tablets with an up-to-date browser",
	"material.phonesTailscale":
		"Phones or tablets with an up-to-date browser and the Tailscale app",
	"material.webcam": "A webcam at the desk, if the computer has none (optional)",
	"material.usbDrive": "A USB stick or an external disk to leave plugged in",

	"i.answers": "The answers to give the installer",
	"i.answers.network": "Network",
	"i.answers.profile": "Profile",
	"i.answers.port": "Port",
	"i.deb": "The commands of the step “Install the package”",
	"i.docker": "The command of the step “Install BiblioViva”",
	"i.docker.lead":
		"The command downloads setup.sh, which installs Docker when it is missing, writes the files below in the folder biblioviva and starts BiblioViva.",
	"i.manual": "By hand: the files to copy",
	"i.manual.lead":
		"For those who know Docker: the same files setup.sh writes, already fitted to the answers. They go in the user's folder biblioviva; then run the commands at the end.",
	"i.env.key": "the Tailscale auth key (it starts with tskey-auth-)",
	"i.commands": "The commands",
};

export const TEXTS: Record<SetupLang, Record<string, string>> = { it, en };
