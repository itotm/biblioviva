# Installation

This section guides whoever installs BiblioViva in the school library. Every path is a sequence of numbered steps; every step ends with a check to make before going on.

BiblioViva runs on a dedicated computer that stays on during the library's opening hours, and it is reached from the
browser of any computer, tablet or phone of the school. A computer switched off at night is not a problem: the backup
that was due is made the next time it is switched on.

## Two choices to make

The installation depends on two choices, independent of each other.

1. The computer BiblioViva runs on: an old PC with Linux (usually already available at the school) or a Raspberry Pi
   (a small computer to buy). See [Choose the computer](choose-computer.md).
1. The network through which BiblioViva is reached: Tailscale (the full way, with a free account) or the school's
   local network (the basic way, no account). See [Choose the network](choose-network.md).

The choice of network can be changed later, keeping all the data: see
[Switch from the local network to Tailscale](lan-to-tailscale.md), a page that also describes the reverse way.

## Paths

The two choices give four paths. Each carries out the same eight steps, in the same order; only the details of some
steps change.

| Computer | Network | Path | Approximate time |
|---|---|---|---|
| PC with Linux | Tailscale | [PC with Linux and Tailscale](paths/linux-tailscale.md) | about 2 hours |
| PC with Linux | Local network | [PC with Linux and the local network](paths/linux-lan.md) | about 1 hour and a half |
| Raspberry Pi | Tailscale | [Raspberry Pi with Tailscale](paths/raspberry-tailscale.md) | about 2 hours |
| Raspberry Pi | Local network | [Raspberry Pi with the local network](paths/raspberry-lan.md) | about 1 hour and a half |

The time includes the installer's work and the waiting (writing the microSD card, downloading BiblioViva); it does not
include buying the equipment. [VERIFY: the times are estimates; try one path with a person who has never installed
BiblioViva and note the times]

## Requirements in brief

A computer, a USB barcode scanner, a printer and paper for the labels and the cards are needed; a phone is optional.
The complete list, with links to buy or download, is in [Requirements](material.md).

## After the installation

These pages deal with BiblioViva's life once the installation is done.

- [Update BiblioViva](update.md)
- [Move BiblioViva to another computer](move.md)
- [Restart from a backup](restore.md)
- [Switch from the local network to Tailscale](lan-to-tailscale.md), and the other way round
- [Uninstall BiblioViva](uninstall.md)

## Possible problems

The most common problems (the address does not open, the camera does not start, the scanner types strange
characters, the print is too small) are described in [Common problems](../help/problems.md). The technical terms
are explained in the [Glossary](../help/glossary.md).
