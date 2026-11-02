# Prepare the computer

This step prepares the computer BiblioViva will run on: a PC with Linux, or a Raspberry Pi with its microSD card. It
takes about 20 minutes for a PC that already has Debian or Ubuntu (if the system has to be installed, the time depends
on the PC) and about 30 minutes with the Raspberry Pi. It is the first of the steps of every installation path.

## Requirements

<!-- variant: linux -->
**With a Linux PC**

- A 64-bit PC, switched on and connected to the school's router with a network cable.
- If the PC does not have Linux: a USB stick for the installation, prepared following the distribution's official
  guide, and another computer to prepare it.
- A keyboard and a screen for the PC, at least during the installation.
- A sheet of paper and a pen: the user name and the password chosen in this step are needed in the following steps.
<!-- /variant -->
<!-- variant: raspberry -->
**With the Raspberry Pi**

- A Raspberry Pi 4 or 5 with at least 2 GB of memory, with its power supply.
- A 32 GB microSD card.
- Another computer (Windows, macOS or Linux) with a microSD card reader, connected to the internet.
- A network cable between the Raspberry Pi and the school's router. A Wi-Fi connection is possible, but the cable is
  more reliable.
- A sheet of paper and a pen: the user name and the password chosen in this step are needed in the following steps.
<!-- /variant -->

## Procedure

<!-- variant: linux -->
**With a Linux PC**

Debian or 64-bit Ubuntu will do; the "server" or minimal edition is enough, because BiblioViva does not use the
graphical environment. For Fedora and the other distributions see the technical page
[Deployment notes (technical)](../../../deploy.md).

> [!NOTE]
> With the local network, the installation program of the step [Install BiblioViva](install.md) adds by itself the
> service that makes the computer reachable with the name `biblioviva.local`. Until then the name `biblioviva.local`
> may not work from another computer: the step [Connect to the computer](terminal.md) says what to do.

### PC with Debian or Ubuntu already installed

1. Open the PC's terminal and check that the system is 64-bit.

   ```sh
   uname -m
   ```

   The result must be `x86_64` or `aarch64`.

   ```
   x86_64
   ```

1. Update the system.

   ```sh
   sudo apt update && sudo apt full-upgrade -y
   ```

1. Give the computer the name `biblioviva`.

   ```sh
   sudo hostnamectl set-hostname biblioviva
   ```

1. If the PC will be used from another computer, install the SSH server.

   ```sh
   sudo apt install -y openssh-server
   ```

### PC without Linux

1. Follow the official installation guide: [Debian](https://www.debian.org/releases/stable/installmanual) or
   [Ubuntu Server](https://ubuntu.com/tutorials/install-ubuntu-server).
1. When the installation program asks for the computer's name, write `biblioviva`.
1. Create a user and a password. Write both on a sheet of paper.

   > [!IMPORTANT]
   > The user name and the password are needed at every following step. Keep the sheet in a safe place.

1. When the program offers to install the SSH server (in Ubuntu "OpenSSH server", in Debian "SSH server"), accept if
   the PC will be used from another computer.
1. When the installation is finished, restart the PC.
1. Leave the PC connected to the network with the cable.
<!-- /variant -->
<!-- variant: raspberry -->
**With the Raspberry Pi**

The microSD card is written with Raspberry Pi Imager, the official Raspberry Pi program, on another computer. The
personal settings (computer name, user, network, access from another computer) are given to the program before
writing: the card starts already configured. The program changes its look from one version to the next; the
[official guide](https://www.raspberrypi.com/documentation/computers/getting-started.html) describes its screens.

1. On the other computer, download and install Raspberry Pi Imager from the
   [official download page](https://www.raspberrypi.com/software/).
1. Insert the microSD card in the other computer's reader.

   > [!WARNING]
   > Writing erases the whole content of the card.

1. Start Raspberry Pi Imager.
1. On the device screen, choose the model of the Raspberry Pi (4 or 5) and go on with "Next".
1. On the operating system screen, open the entry "Raspberry Pi OS (other)" and choose "Raspberry Pi OS Lite
   (64-bit)". The Lite system has no graphical environment: BiblioViva does not need one. [VERIFY: names of the
   entries in Imager's list of systems in the current version]
1. On the storage screen, choose the microSD card. Check that the capacity shown is that of the card and that the
   computer's disk is not chosen.
1. On the customisation screen, open the "Hostname" tab and set the computer's name: `biblioviva`.
1. In the "Localisation" tab choose the city (for Italy, Rome): Imager derives the time zone and the keyboard layout
   from it.
1. In the "User" tab set a user name (for example `biblioviva`; lowercase letters, digits, hyphens) and a password.
   Write both on a sheet of paper.

   > [!IMPORTANT]
   > The user name and the password are needed at every following step and cannot be recovered from BiblioViva. Keep
   > the sheet in a safe place.

1. In the "Wi-Fi" tab, if the Raspberry Pi is connected with the network cable, leave the settings empty. If instead
   it uses Wi-Fi, enter the network name and its password.
1. In the "Remote Access" tab turn on "Enable SSH" and choose password authentication.

   <!-- screenshot: imager/customisation | The customisation tabs of Raspberry Pi Imager filled in -->

1. Confirm and start the writing. Wait for the end of the writing and of the verification; the program says when the
   card can be removed.
1. Remove the card from the other computer and insert it in the Raspberry Pi.
1. Connect the network cable to the Raspberry Pi and to the router.
1. Connect the power supply. The Raspberry Pi starts by itself: the first start takes a few minutes, because the
   system prepares itself. Wait at least five minutes before going on.
<!-- /variant -->

## Check before going on

<!-- variant: linux -->
**With a Linux PC**

- The PC is on, connected with the network cable and shows the login prompt with its own name:

  ```
  biblioviva login:
  ```

- The PC appears in the router's list of devices with the name `biblioviva`; the name of the router's page depends on
  the model.
<!-- /variant -->
<!-- variant: raspberry -->
**With the Raspberry Pi**

- The Raspberry Pi is on and its green light blinks or comes on intermittently (this is normal).
- The Raspberry Pi appears in the router's list of devices with the name `biblioviva`. The router's page usually opens
  at the address shown on the router's label; the list is generally called "connected devices" or "clients", but the
  name depends on the router.

When the name does not appear, the next step, [Connect to the computer](terminal.md), also serves as a test: if the
connection succeeds, the Raspberry Pi is on the network.
<!-- /variant -->

## Possible problems

<!-- variant: linux -->
**With a Linux PC**

### The PC does not appear in the router's list

Check the network cable and that the system has started up to the login prompt.

### The PC's user name or password is forgotten

Repeat the installation of the system.
<!-- /variant -->
<!-- variant: raspberry -->
**With the Raspberry Pi**

### The Raspberry Pi does not turn on

No light: check the power supply. A phone charger often is not enough: use a power supply suited to the model.

### The Raspberry Pi does not appear in the router's list

After ten minutes the Raspberry Pi does not appear in the router's list: check the network cable (the lights of the
socket come on), then repeat the writing of the card, checking the settings.

### The Raspberry Pi's user name or password is forgotten

Repeat the writing of the card with Raspberry Pi Imager.
<!-- /variant -->

## Related pages

- [Choose the computer](../choose-computer.md)
- [Requirements](../material.md)
- Next step: [Connect to the computer](terminal.md)
- [Glossary](../../help/glossary.md#computer-name)
