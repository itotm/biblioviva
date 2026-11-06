# Glossary

This glossary explains in a few words the terms of BiblioViva and of the installation, in alphabetical order. It is for
whoever works at the desk and for whoever installs the program and meets a word they do not know.

## Backup

A copy of the library's data (books, copies, patrons, loans, photos and covers) to use if the original data are lost or
damaged. BiblioViva makes one every night and normally keeps them for 30 days, in the `backups` folder next to the
installation files; they can be seen and downloaded from **Administration** → **Backups**. A copy that stays only on
the BiblioViva computer does not protect against a failure of the computer: it is better to keep a copy on a USB drive
or a network disk. See [Backups](../setup/steps/backups.md).

## Barcode scanner

The USB device that reads the barcodes of cards, copies and books. It plugs into the desk computer and behaves like a
keyboard: it types the code it read in the active field and presses Enter. It is BiblioViva's normal tool; the phone
with its camera is an optional extra. If it types wrong characters in place of the hyphen, see [Scanner that types
strange characters](problems.md#scanner-that-types-strange-characters).

## Call number

The code that says where a book stands on the shelves, for example `B 4 DEL`. BiblioViva computes it from the
classification, the reading level and the first three letters of the author's surname; for a book whose author is
"Anonimo" or "AA. VV." it uses the first three letters of the title. The form depends on the scheme the library has
chosen. It appears on the copy's record and on the spine band. BiblioViva always uses this word, and not "location".
See [Classify books](../manual/guides/classify-books.md).

## Card

The cardboard with the barcode that identifies a patron. At the desk the card is read with the scanner and then the
copies to lend are read. The number of the card can never coincide with the code of a copy. It is printed from the
**Patrons** page; the template is edited from **Administration**.

## Code 128 and Code 39

The two types of barcode that BiblioViva reads. New cards and labels are printed in Code 128; Code 39 is accepted when
reading because older cards and labels used it. The barcode scanner reads both without settings.

## Computer name

The name by which the computer introduces itself on the network. In this guide the BiblioViva computer is called
`biblioviva`: it is chosen when the computer is prepared and it serves to reach it with SSH and, with the local network,
for the address `biblioviva.local`. See [Prepare the computer](../setup/steps/prepare-computer.md).

## Copy

The single book standing on the shelf, with its barcode; a title can have more than one. At the desk a copy is lent and
returned, not the title. The word "specimen" is not used. The barcode of the copy never coincides with the number of a
card.

## DHCP reservation

The request to the router to always give the same numeric address to a certain computer; it is also called "reserved
address" or "address reservation". Without it the address can change at every restart, and the bookmarks that use the
number stop working. It is asked of whoever manages the school's network, giving the computer's name. See [Prepare the
network](../setup/steps/network.md).

## Docker

The program that runs BiblioViva in a closed container, separate from the rest of the computer, with everything it
needs. Thanks to Docker the installation is the same on a PC and on a Raspberry Pi, and the update replaces the
container without touching the data. The installation program puts it on the computer if it is missing. See [Install
BiblioViva](../setup/steps/install.md) and the
[official Docker documentation](https://docs.docker.com/get-started/docker-overview/).

## HTTPS

The secure way of opening a web page: the address begins with `https://` and the browser shows a padlock. Browsers
allow the camera and the installation as an app only on pages with HTTPS. With Tailscale BiblioViva has an HTTPS
address; with the local network the address begins with `http://`, without the padlock, and for this reason the camera
does not work. See [Choose the network](../setup/choose-network.md).

## ISBN

The international number that identifies an edition of a book, usually of 13 digits, printed on the back above the
barcode. In BiblioViva it serves to look up the book's data (title, author, publisher) when cataloguing it. It is read
with the barcode scanner in the search or cataloguing field.

## .local name

The address made with the computer's name followed by `.local`, for example `biblioviva.local`, which works on the
school's network in place of the number. A service of the computer makes it possible (`avahi-daemon`, which the
installation program adds if it is missing) and the device that opens the address must be able to resolve it: some
cannot, and then the numeric address is used. See [Address that does not open](problems.md#address-that-does-not-open).

## Local network

The school's existing network, to which the computers are connected. It is one of the two ways to reach BiblioViva: it
requires no account and works without internet, but only inside the school, without the camera and without
installation as an app. The other way is Tailscale. See [Choose the network](../setup/choose-network.md).

## MagicDNS

The Tailscale function that gives devices a readable name in place of a number, so that BiblioViva opens with
`biblioviva.<tailnet>.ts.net`. It is checked in the "DNS" page of the Tailscale console and must be on. See the
official page [MagicDNS](https://tailscale.com/kb/1081/magicdns).

## Patron

Whoever borrows the books: a student or a teacher. A patron does not enter BiblioViva, which is used only by the
library staff: a patron is a record with the class and the card. Not to be confused with the staff account, nor with the
computer's user, the name by which one signs in to the computer's system.

## Performance profile

The choice that tells BiblioViva how powerful the computer it runs on is, so that it asks for the right amount of memory
and work. There are four profiles: `micro` (minimum computer, 512 MB), `small` (Raspberry Pi 4 with 2 GB and SD card),
`medium` (older PC with a hard disk) and `large` (PC with an SSD). A profile too high for a small computer makes it
slow. The installation program proposes it; it is changed from **Administration** → **Configuration** →
**Performance**, in the **Computer** field. See [Install BiblioViva](../setup/steps/install.md).

## Reading level

A code, of a scale of the library's own, that says at what difficulty level a work of fiction is written, to
recommend it to whoever has a certain reading grade. It sits on the book's record or, if the library chooses so, on each
copy. The scale is edited from **Administration**.

## Sample data

Invented patrons, books, copies and loans that the guided setup loads if **Load sample data** is chosen. They serve to
try BiblioViva before entering the real data. With the sample data all the accounts use the same password, known to
everyone: they must be removed, with **Clear sample data** in **Administration**, before using BiblioViva for real.

## Shared account

A BiblioViva account used by several people instead of one. BiblioViva has five, one per role, created at the first
setup: `admin` (everything), `prestiti` (the circulation desk, shown as "Loan management"), `catalogo` (the catalogue),
`tessere` (patrons and cards) and `report` (the reports). Each account allows only the work of its role. The
passwords are handed over in person; they are changed from **Administration** → **Staff accounts**. See [Connect the
devices](../setup/steps/devices.md).

## Spine band

The adhesive strip stuck on a book's spine that carries the call number, with a pictogram showing the genre or the
subject. It is printed together with the label with the barcode, as a pair per book. See [Print the book
labels](../manual/guides/print-book-labels.md).

## Tailnet

The name of the private network that Tailscale creates for the school, among its devices. It ends with `.ts.net` and is
read in the "DNS" page of the Tailscale console; it appears in BiblioViva's address, `biblioviva.<tailnet>.ts.net`. See
[Prepare the network](../setup/steps/network.md) and the official page
[Tailnet name](https://tailscale.com/kb/1217/tailnet-name).

## Tailscale

The service, free for a use like this, that links the school's devices in a private network across the internet and
gives BiblioViva an address with the padlock. With Tailscale the camera, the installation on the phone and the use from
outside the school work; its application must be installed on every device. It is not mandatory: the local network is
the alternative. See [Choose the network](../setup/choose-network.md) and the official site
[Tailscale](https://tailscale.com/).

## Terminal

The text window in which a command is typed and the computer's answer is read. The installation commands are copied
and pasted into the terminal of the BiblioViva computer; with a Raspberry Pi, which has no keyboard or screen, the
terminal is opened from another computer with SSH, a program that links the two computers across the network. See
[Connect to the computer](../setup/steps/terminal.md).

## Volume

A folder in which BiblioViva keeps its data, outside the container, so that they survive the updates. There are three
volumes: the configuration (`config`, settings and print templates), the data (database, photos, covers) and the
backups (`backups`, the folder next to the installation files, which is copied like any other folder). See
[Backups](../setup/steps/backups.md) and, for the details, the technical page
[Deployment notes (technical)](../../deploy.md#volumes).
