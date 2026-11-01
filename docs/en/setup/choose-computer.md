# Choose the computer

BiblioViva needs a computer that stays on during the library's opening hours. This page helps whoever installs to
choose the type of computer and to understand which performance profile corresponds to it.

## Two types of computer

BiblioViva runs on a computer with a 64-bit Linux system. This guide describes two cases.

### Old PC with Linux

This is the first solution to consider: an old PC of the school, no longer suited to daily work, is often enough and
requires no purchases. It uses more power and makes more noise than a Raspberry Pi.

- A 64-bit processor (see below how to check it) and at least 2 GB of memory.
- Operating system: Debian or Ubuntu, installed on the PC. Other distributions, such as Fedora, are possible for
  whoever knows Linux: see the technical page [Deployment notes (technical)](../../deploy.md).
- The computer's name, in this guide, is `biblioviva`: with the local network it is the name by which the computer is
  reached (`biblioviva.local`). The guide says at which step to set it.

### A PC with Windows

This guide does not describe the installation on a PC with Windows. Whoever has only a computer with Windows can
install Linux in its place, if the PC is dedicated to BiblioViva, or use a Raspberry Pi (described below).

### Raspberry Pi

A [Raspberry Pi](https://www.raspberrypi.com/products/) is a small computer, the size of a wallet, that makes no noise
and uses little power. It is an alternative to the old PC, to be bought on purpose.

- Model: Raspberry Pi 4 or Raspberry Pi 5, with at least 2 GB of memory.
- A 32 GB microSD card, on which the operating system is written.
- Operating system: Raspberry Pi OS Lite 64-bit, written on the card with the
  [Raspberry Pi Imager](https://www.raspberrypi.com/software/) program.

The complete list of what is needed is in [Requirements](material.md).

## Dedicated computer or desk computer

BiblioViva can run on a dedicated computer, which nobody uses for anything else, or on the same computer used at the
loans desk. The dedicated computer is the recommended choice.

| | Dedicated computer | Desk computer |
|---|---|---|
| Advantages | It stays on and is not switched off by mistake; it does not slow down the work at the desk | No extra computer to obtain |
| Disadvantages | One more device to obtain and connect to the network | It must stay on for the whole opening time; a shutdown or a restart interrupts BiblioViva for everyone; it requires Linux on that computer |

With a dedicated computer, the desk computer is any computer with a browser, like every other device of the school.

## Performance profiles

BiblioViva adapts its use of memory and disk to the computer it runs on. The adaptation is a profile, which the
installation proposes by itself according to the computer and which can be changed later from the administration.
There are four profiles.

| Profile | Computer it corresponds to |
|---|---|
| `micro` | A minimal computer: a slow processor and 512 MB of memory. This guide does not describe it. |
| `small` | A Raspberry Pi 4 with 2 GB of memory and a microSD card. It is the default profile, suited to every computer. |
| `medium` | An old PC with a traditional (platter) hard disk. |
| `large` | A PC with a lot of memory and an SSD disk. |

A more modest profile is always safe: BiblioViva works, a little more slowly in heavy operations, such as printing
many sheets or the backup. A profile too ambitious for the computer can instead slow it down. When in doubt, choose
`small`. The expected case is a library of up to 10 000 books and 1 000 patrons.

The values of each profile are in the technical page [Performance](../../performance.md) and in the
[Configuration reference](../../config-reference.md), both in English.

## Check that an old PC is 64-bit

An old PC works only if its processor is 64-bit. Almost all PCs that are not too old are; the check removes every
doubt.

- If the PC still has Windows: open the system settings, at the entry with the information about the computer, and
  read the "System type". It must say an "x64-based processor" [VERIFY: menu entry and text in English of Windows 10
  and 11]. The operating system can be 32-bit even on a 64-bit processor: the processor counts, because Linux replaces
  the system.
- If the PC already has Linux or starts from a USB stick with Linux: open the terminal and type the following command.

  ```sh
  uname -m
  ```

  The answer `x86_64` means a 64-bit processor; `i686` or `i386` mean a 32-bit processor, not suitable.

The step [Prepare the computer](steps/prepare-computer.md) says how to install the operating system.

## Related pages

- [Choose the network](choose-network.md)
- [Requirements](material.md)
- [Installation](README.md)
