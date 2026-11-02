# Connect to the computer

This step explains how to open the terminal of the BiblioViva computer, the window in which the commands of the
following steps are typed. It takes about 10 minutes. A terminal is a text window in which a command is written and
the computer's answer is read.

## Requirements

<!-- variant: linux -->
**With a Linux PC**

- The user name and the password written down in the step [Prepare the computer](prepare-computer.md).
- The PC itself, with keyboard and screen connected; or another computer on the same network, if the SSH server is
  installed.
<!-- /variant -->
<!-- variant: raspberry -->
**With the Raspberry Pi**

- Another computer (Windows, macOS or Linux) connected to the same network as the Raspberry Pi.
- The user name and the password written down in the step [Prepare the computer](prepare-computer.md).
<!-- /variant -->

## Procedure

<!-- variant: linux -->
**With a Linux PC**

1. On the BiblioViva PC, log in with the user name and the password written down. With a version with a graphical
   environment, then open "Terminal" from the applications menu (usually also with Ctrl+Alt+T). With a server version
   the login already shows the terminal.
1. To connect from another computer instead (Windows, macOS or Linux): open the terminal (in Windows from the Start
   menu by typing "PowerShell"; in macOS "Terminal" from the Utilities folder; in Linux "Terminal" from the
   applications menu).
1. Type the following command, replacing `<user>` with the user name written down, and press Enter.

   ```sh
   ssh <user>@biblioviva.local
   ```

1. At the first connection answer `yes` to the question about the key fingerprint and press Enter. The question
   appears only the first time.
1. Type the password and press Enter. While the password is typed nothing appears: this is normal.
1. If the name `biblioviva.local` does not answer, look for the PC's address in the router's list of devices (for
   example `192.168.1.50`) and use it in place of the name.

   ```sh
   ssh <user>@<address>
   ```

   The name `biblioviva.local` works from another computer only if the PC announces it on the network: with the local
   network it does so after the step [Install BiblioViva](install.md), which adds the necessary service when it is
   missing.
<!-- /variant -->
<!-- variant: raspberry -->
**With the Raspberry Pi**

The Raspberry Pi has no keyboard or screen: it is controlled from another computer with SSH, a program that connects
the two computers through the network. SSH is already present in Windows 10 and 11, in macOS and in Linux
([official guide](https://www.raspberrypi.com/documentation/computers/remote-access.html#ssh)).

1. On the other computer, open the terminal.
   - In Windows: open the Start menu, type "PowerShell" and open the program (in Windows 11 "Terminal" will also do).
   - In macOS: open "Terminal" from the Utilities folder of Applications.
   - In Linux: open "Terminal" from the applications menu (usually also with Ctrl+Alt+T).
1. Type the following command, replacing `<user>` with the user name written down, and press Enter.

   ```sh
   ssh <user>@biblioviva.local
   ```

1. At the first connection the terminal shows a question about the fingerprint of the computer's key. Answer `yes`
   and press Enter. The question appears only the first time.

   ```
   The authenticity of host 'biblioviva.local (192.168.1.50)' can't be established.
   ED25519 key fingerprint is SHA256:...
   Are you sure you want to continue connecting (yes/no/[fingerprint])?
   ```

1. Type the password written down and press Enter. While the password is typed nothing appears, not even asterisks:
   this is normal.
1. If the name `biblioviva.local` does not answer, look for the Raspberry Pi's address in the router's list of devices
   (for example `192.168.1.50`) and use it in place of the name.

   ```sh
   ssh <user>@<address>
   ```
<!-- /variant -->

### Copy and paste a command

The following steps give commands to copy. To run one:

1. Select the command on the page and copy it (Ctrl+C; in macOS Cmd+C).
1. Switch to the terminal window and paste it.
   - In the Linux terminal: Ctrl+Shift+V.
   - In the Windows Terminal: right-click in the window, or Ctrl+Shift+V.
   - In the macOS Terminal: Cmd+V.
1. Press Enter to run the command.

## Check before going on

The terminal shows a line that ends with the prompt symbol (`$`) and begins with the user name, the at sign and the
computer's name:

```
<user>@biblioviva:~ $
```

The terminal is ready: the commands of the following steps are pasted here. When the line does not appear, see
"Possible problems".

## Possible problems

Other problems: [Common problems](../../help/problems.md#ssh-connection-that-fails).

### The connection is refused

"Connection refused" appears: the PC or the Raspberry Pi is not ready yet, or SSH is not active. Wait a few minutes and
try again. If the message stays, for the PC install the SSH server (`sudo apt install -y openssh-server`); for the
Raspberry Pi repeat the writing of the card turning on SSH.

### The password is refused

"Permission denied, please try again" (wrong password) appears: type the password again with care, paying attention to
the keyboard layout (capitals, symbols). After three failed attempts the program stops: repeat the command.

### The computer's name is not found

"Could not resolve hostname biblioviva.local" (name not found) appears: the computer does not answer to the name. Check
that it is on and connected to the same network, then use the address the router shows.

### The connection times out

"Connection timed out" appears: the address is not the computer's or the computer cannot be reached. Check the address
in the router's list.

### REMOTE HOST IDENTIFICATION HAS CHANGED appears

The message is "REMOTE HOST IDENTIFICATION HAS CHANGED": the Raspberry Pi's card was rewritten and the name is already
known with another key. Delete the old key with the following command and repeat the connection.

```sh
ssh-keygen -R biblioviva.local
```

## Related pages

- Previous step: [Prepare the computer](prepare-computer.md)
- Next step: [Prepare the network](network.md)
- [Glossary](../../help/glossary.md#terminal)
