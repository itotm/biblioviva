# Requirements

This page lists everything needed to install BiblioViva and to use it at the loans desk, with links to the official
pages where to buy or download. It is addressed to whoever prepares the purchase of the
equipment.

## The computer

The type of computer is chosen first: see [Choose the computer](choose-computer.md). The rest of the list depends on
the choice.

### With an old PC

- A 64-bit PC with at least 2 GB of memory and Linux installed or to be installed (Debian or Ubuntu).
- Another computer and a USB stick of 8 GB or more to write the Linux installer, if the PC does not already have
  Debian or Ubuntu.

### With a Raspberry Pi

- A [Raspberry Pi 4 or 5](https://www.raspberrypi.com/products/) with at least 2 GB of memory.
- A power supply suited to the model, preferably the official Raspberry Pi one: a power supply that is too weak causes
  shutdowns and freezes.
- A 32 GB microSD card of a known brand: the system and BiblioViva's data are written on the card.
- A case with a heat sink or fan, recommended for a computer that is always on.
- Another computer, with a microSD card reader (also with a USB adapter), to prepare the card with the
  [Raspberry Pi Imager](https://www.raspberrypi.com/software/) program.

## The network

- A network cable between the BiblioViva computer and the router, preferable to Wi-Fi: the connection is more stable
  and the computer's address easier to keep fixed. Wi-Fi works, if the cable is not possible.
- With the local network: the possibility of asking the person who manages the school's network for an address
  reservation on the router.
- With Tailscale: an internet connection and an email address for the account. See
  [Choose the network](choose-network.md).

## The barcode scanner

The USB barcode scanner is the normal working tool at the loans desk: it reads cards, books and ISBNs.

- A USB scanner that types like a keyboard (also called "HID" mode): connected to the computer, it types the code it
  has read at the point where the cursor is, followed by the Enter key. Almost all commonly used USB scanners do so
  with no configuration.
- The scanner must read Code 128 codes (the format BiblioViva prints) and Code 39 (the format of many cards and labels
  from other systems), both enabled. The scanner must be able to add Enter after the code.
- A wired scanner is simpler than a wireless one, which needs charging and pairing.

The step [Test the scanner and the printer](steps/scanner-printer.md) says how to check the reading and the keyboard
layout.

## The printer and the paper

- A laser or inkjet printer for A4 sheets, connected to the computer from which printing is done (the desk computer),
  not to the BiblioViva one.
- Sheets of adhesive labels for the books. BiblioViva normally prints a pair of labels for each book: the spine band
  and the barcode label, on an A4 sheet of 18 labels of 70 × 48 mm (3 columns by 6 rows), which gives 9 books per
  sheet. Sheets of 70 × 24 mm (3 × 12), 63.5 × 33.9 mm (3 × 8) and 38.1 × 21.2 mm (5 × 13) are also supported. The size
  of the sheets owned is set in BiblioViva from the administration.
- Sheets for the cards: A4 sheets from which the cards are cut. BiblioViva prints four cards per sheet, each with
  front and back side by side, to be folded along the short edge. The size of a card is that of credit cards
  (85.6 × 54 mm). Plain or thicker paper, and any lamination, are choices of the school [VERIFY: recommended weight for
  the card sheets, to ask the owner].
- Scissors or a paper cutter and, if wanted, a laminator.

The step [Test the scanner and the printer](steps/scanner-printer.md) says how to print at the correct scale.

## The phone

A phone or a tablet is optional. It is needed only by whoever chooses Tailscale and wants to read a code with the
camera, photograph patrons or covers, or install BiblioViva as an app. The USB barcode scanner remains the normal
tool.

## Related pages

- [Choose the computer](choose-computer.md)
- [Choose the network](choose-network.md)
- [Installation](README.md)
