# Install BiblioViva

This step installs BiblioViva on the computer prepared in the previous steps, with a single command to copy into the
terminal. The `setup.sh` program checks the computer, installs Docker if it is missing, asks a few questions, starts
BiblioViva and writes the address to open in the browser. It takes 5 to 15 minutes, mostly waiting for BiblioViva to
download [VERIFY: times to measure on a Raspberry Pi 4 with an SD card].

Docker is the program that runs BiblioViva in a closed container, separate from the rest of the computer (see the
[glossary](../../help/glossary.md#docker)).

## Requirements

- The terminal of the BiblioViva computer, opened in the step [Connect to the computer](terminal.md).
- The computer connected to the internet.
- The password of the computer's user, written down in the step [Prepare the computer](prepare-computer.md): it is
  needed by `sudo`, the command that gives the program administrator rights.

<!-- variant: tailscale -->
**With Tailscale**

- The access key generated in the step [Prepare the network](network.md), which begins with `tskey-auth-`, at hand to
  be pasted.
<!-- /variant -->
<!-- variant: lan -->
**With the local network**

- No other data: the local network requires neither an account nor a key.
<!-- /variant -->

## Procedure

### Start the program

1. Copy the following command.

   ```sh
   curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang en
   ```

1. Paste it into the terminal and press Enter (how to paste a command is explained in
   [Connect to the computer](terminal.md)). The terminal writes the title "BiblioViva installation" and the program
   starts checking the computer.

> [!NOTE]
> The `--lang en` option makes the program write in English; without it the program uses the computer's language.

The program downloads BiblioViva's configuration files from its public repository, and the programs' images, and
writes everything in the user's `biblioviva` folder. The program's text can be read before running it:
[setup.sh](https://github.com/itotm/biblioviva/blob/main/setup.sh).

### Install Docker, when it is missing

On a freshly prepared computer Docker is not there. In that case the program says so and asks a question.

```
Docker is not installed. The program installs it with Docker's official script (https://get.docker.com): it takes a few minutes and the user's password.
Install Docker now? [Y/n]
```

1. Press Enter (or `Y`) to install Docker. Answering `n` stops the program.
1. When `sudo` asks for the password, type the user's password and press Enter. While it is typed nothing appears, not
   even asterisks: this is normal.
1. Wait. The installation of Docker writes many lines and takes a few minutes. At the end the program writes: "Docker
   is installed. To use the docker command without sudo, close the terminal and connect again at the end." The
   installation of BiblioViva goes on without interruption.

> [!NOTE]
> The sentence about closing the terminal refers to the moment the installation is finished: then close the terminal
> and connect again as in the step [Connect to the computer](terminal.md). Until then nothing needs to be done. If
> Docker was already installed, the sentence does not appear.

### Answer the questions

The questions appear in the following order. The program repeats the question when the answer is not valid ("Invalid
answer.").

### How to reach BiblioViva

```
How do the library's computers and phones reach BiblioViva?
  1) With Tailscale: secure address (HTTPS), camera, phones, outside the school too. Needs a free Tailscale account.
  2) Only on the school's local network: no account, but no camera and only inside the school.
Choice [1/2]:
```

<!-- variant: tailscale -->
**With Tailscale**

1. Type `1` and press Enter.
<!-- /variant -->
<!-- variant: lan -->
**With the local network**

1. Type `2` and press Enter.
<!-- /variant -->

The answer must be the one chosen in the step [Prepare the network](network.md). Changing one's mind later is possible,
without losing the data: see [Switch from the local network to Tailscale](../lan-to-tailscale.md).

### What computer it is

```
What kind of computer is this?
  1) micro: a very small computer, with 512 MB of memory
  2) small: a Raspberry Pi 4 with 2 GB and an SD card
  3) medium: an older PC with a hard disk
  4) large: a PC with an SSD
Choice [small, suggested for this computer]:
```

The profile governs how much memory and how much work BiblioViva asks of the computer: one too high for a small
computer makes it slow (see the [glossary](../../help/glossary.md#performance-profile)). The program looks at the
memory and at the type of disk and proposes the suitable profile, written between the square brackets.

1. Press Enter to accept the proposal. The profile can be changed later from BiblioViva.

<!-- variant: tailscale -->
**With Tailscale**

### The Tailscale key

```
Paste the Tailscale auth key (it starts with tskey-auth-):
```

1. Paste the key written down in the step [Prepare the network](network.md) (as for commands: Ctrl+Shift+V in the Linux
   terminal, right-click or Ctrl+Shift+V in the Windows one, Cmd+V in macOS) and press Enter. The key stays visible on
   the screen while it is pasted.
1. If the program answers "The Tailscale key must start with tskey-.", the key is incomplete or is another one: paste
   it again, in full, when the program asks for it.

> [!IMPORTANT]
> The program writes the key in the `.env` file of the `biblioviva` folder, readable only by the computer's user. Do not
> copy or send that file: it contains a secret.
<!-- /variant -->
<!-- variant: lan -->
**With the local network**

With the local network there is no other question: the program goes straight to the installation. If the computer does
not have the service that gives it the name `biblioviva.local` (`avahi-daemon`), the program installs it by itself.
<!-- /variant -->

### Wait for the installation

The program then writes the phases of the work, each preceded by `==`, and between one and the next the lines of the
programs it calls.

<!-- variant: tailscale -->
**With Tailscale**

```
== Preparing the folder /home/<user>/biblioviva

== Downloading BiblioViva (the first time it can take a few minutes)

== Starting BiblioViva

== Waiting for BiblioViva to answer (up to 180 seconds)
```
<!-- /variant -->
<!-- variant: lan -->
**With the local network**

```
== Preparing the folder /home/<user>/biblioviva

== Installing avahi-daemon, which makes the computer reachable as biblioviva.local

== Downloading BiblioViva (the first time it can take a few minutes)

== Starting BiblioViva

== Waiting for BiblioViva to answer (up to 180 seconds)
```

The avahi-daemon line appears only if the service is missing.
<!-- /variant -->

1. Wait. The download is the longest phase, especially on a Raspberry Pi with an SD card. The terminal writes lines
   with percentages and labels ("Pulling", "Download complete"): they are normal.
1. Do not close the terminal and do not switch the computer off until the program has written the address.

### Note the address

At the end the program writes that BiblioViva is ready and the address to open.

<!-- variant: tailscale -->
**With Tailscale**

```
BiblioViva is ready. Open in the browser:

    https://biblioviva.<tailnet>.ts.net

(from a device with Tailscale logged in with the school's account; the first opening can take a few seconds)
```

1. Write down the address the program writes: in place of `<tailnet>` it has the name of the school's network, which
   ends with `.ts.net`. It is needed in the step [First run](first-run.md).
<!-- /variant -->
<!-- variant: lan -->
**With the local network**

```
BiblioViva is ready. Open in the browser:

    http://biblioviva.local:8080
    http://192.168.1.50:8080

(from a computer on the school network; if the name does not work, use the numeric address)
```

1. Write down the two addresses the program writes: the one with the name and the numeric one (the second is absent if
   the program cannot read the computer's address). The numeric address changes from school to school: it is the one
   the router reserved in the step [Prepare the network](network.md). They are needed in the step
   [First run](first-run.md).
<!-- /variant -->

1. If Docker was installed during this run, close the terminal and connect again as in the step
   [Connect to the computer](terminal.md).

## Check before going on

- The program finished with no error messages and the last part it wrote begins with "BiblioViva is ready.".
- Under that sentence an address appears, and it is written down.
- The following command, given in the terminal, lists BiblioViva's containers with the status `Up` (or `running`):

  ```sh
  cd ~/biblioviva && docker compose ps
  ```

  If the command answers "permission denied" about Docker, the terminal has not been reopened since the installation
  of Docker: close it and connect again, or repeat the command with `sudo` in front.

When one of the points is missing, see "Possible problems". Running the command of the first point of the procedure
again does no harm: the program recognises the installation already made and updates it without asking questions (see
[Update BiblioViva](../update.md)).

## Possible problems

The program writes the error message and stops. After removing the cause, repeat the command of the first step of the
procedure.

Other problems: [Common problems](../../help/problems.md#installation-that-stops).

### The program says it runs on Linux only

The message "This program runs on Linux only (Raspberry Pi OS, Debian or Ubuntu)." appears: the command was pasted on
the wrong computer, for example one's own work computer. Paste it into the BiblioViva terminal, opened in the step
[Connect to the computer](terminal.md).

### The system is 32-bit

The message "The system is 32-bit (…): BiblioViva needs a 64-bit system. On a Raspberry Pi, install Raspberry Pi OS
(64-bit)." appears: the microSD card holds a 32-bit system. Write it again with Raspberry Pi OS Lite (64-bit) as in the
step [Prepare the computer](prepare-computer.md); the command cannot work on a 32-bit system.

### The program warns that the system is not among those tested

The message "System …: this program is tested on Raspberry Pi OS, Debian and Ubuntu. Going on…" appears: it is a
warning, not an error. The computer has another Linux distribution (for example Fedora) and the program goes on; if the
installation stops, see the technical page [Deployment notes (technical)](../../../deploy.md).

### The sudo command is not available

The message "The sudo command is not available: run the program as an administrator or install sudo." appears: the
computer does not have `sudo`. Install it following the distribution's instructions, or connect as the `root` user and
repeat the command.

### Docker was not installed

The message "Docker was not installed: the program stops. Install it and run the program again." appears: `n` was
answered to the question, or the installation of Docker failed (for example for lack of internet). Repeat the command
and answer `Y`; if the error stays, install Docker with the [official guide](https://docs.docker.com/engine/install/)
and repeat the command.

### An answer to a question is missing

The message "An answer is missing and there is no terminal to read it from: give …" appears: the program is not in a
window where one can type (for example the command was launched from another program). Open the terminal as in the step
[Connect to the computer](terminal.md) and repeat the command. Alternatively the answers are given with the options
`--network tailscale` or `--network lan`, `--profile micro`, `--profile small`, `--profile medium` or
`--profile large`, `--key <key>` for the Tailscale key and `--yes` to install Docker without questions, for example:

```sh
curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang en --network lan --profile small
```

### The program says the answer is not valid

The message "Invalid answer." appears: the answer is not among those allowed. Type one of the digits listed.

### The program cannot download a file

The message "Cannot download …: check the internet connection." appears: the computer cannot download a BiblioViva
file. Check that the cable or Wi-Fi work (for example with `ping -c 3 raspberrypi.com`), then repeat the command.

### BiblioViva does not answer yet

The message "BiblioViva does not answer yet. See the log with: cd … && docker compose logs" appears: BiblioViva was
started but does not answer after 180 seconds. On a slow computer the start can take longer: wait two minutes and
repeat the command, which resumes from where it got to. If the message repeats, give the command the program suggests
and read the last lines; if Docker has just been installed and the command answers "permission denied", put `sudo` in
front.

```sh
cd ~/biblioviva && docker compose logs
```

<!-- variant: tailscale -->
**With Tailscale**

### The log mentions invalid tags

In the log of "BiblioViva does not answer yet", the words "requested tags … are invalid or not permitted" mean that the
`tagOwners` entry or the Tailscale key are not right: repeat the parts "Computer tag" and "Access key" of the step
[Prepare the network](network.md), then repeat the command.

### The Tailscale key is not valid

The message "The Tailscale key must start with tskey-." appears: the pasted key is not valid. Paste the whole key, which
begins with `tskey-auth-` (see [Prepare the network](network.md)).

### The HTTPS certificates are not on

The message "The node is on the tailnet, but HTTPS certificates are off: turn them on in the DNS page of the Tailscale
admin console, then run the program again." appears: the computer joined the network, but the padlock is missing. In the
"DNS" page of the [admin console](https://login.tailscale.com/admin/dns) turn on "HTTPS Certificates", as described in
the step [Prepare the network](network.md), then repeat the command.
<!-- /variant -->
<!-- variant: lan -->
**With the local network**

### Port 8080 is already in use

Docker writes "port is already allocated" and the program stops: another program occupies port `8080`. Ask whoever
manages the computer to free it, or write another number after `LAN_PORT=` in the file `~/biblioviva/.env` and repeat
the command: the addresses change accordingly.

### The address with the name does not open from the other computers

The address with the name (`biblioviva.local`) does not open from the other computers: use the numeric address the
program wrote. The check from the desk computer is in the step [Connect the devices](devices.md).
<!-- /variant -->

## Related pages

- Previous step: [Prepare the network](network.md)
- Next step: [First run](first-run.md)
- [Update BiblioViva](../update.md)
- [Glossary](../../help/glossary.md)
