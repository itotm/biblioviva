# Switch from the local network to Tailscale

This page explains how to change the way the devices reach BiblioViva, from the school's local network to Tailscale, to
get the camera, the installation on the phone and use from outside the school. At the end the reverse path is described.
The data stay: patrons, books, loans, photos and settings are not touched.

- Time: about 30 minutes, plus the time to put Tailscale on the devices.
- Requirements: the terminal of the BiblioViva computer (see [Connect to the computer](steps/terminal.md)), a school
  Tailscale account and the `admin` account of BiblioViva for the backup.
- BiblioViva stays down for a few minutes during the switch: do it when nobody is working at the desk.

## Procedure

### Make a backup

1. Make a backup with **Back up now**, as described in the section
   [Make a backup now](steps/backups.md#make-a-backup-now) of the step [Backups](steps/backups.md).

### Prepare Tailscale

1. Carry out the "With Tailscale" part of the step [Prepare the network](steps/network.md): the school's account, the
   HTTPS certificates, the computer's tag and the access key. At the end the key, which starts with `tskey-auth-`, and
   the name of the school's network, which ends in `.ts.net`, are needed.

### Change the way of connecting

1. Open the terminal of the BiblioViva computer.
1. Copy the following command, paste it and press Enter. The `--network tailscale` option tells the installation program
   to change the way of connecting of an installation that already exists; `--lang en` makes it write in English.

   ```sh
   curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang en --network tailscale
   ```

1. The program recognises the installation and writes that the data stay.

   ```
   BiblioViva is already installed in /home/<user>/biblioviva (lan): updating.
   Changing the way of connecting: from lan to tailscale. The data stay.
   ```

1. When the program asks for the key, paste it and press Enter. It is the only question: the kind of computer and the
   rest stay as they were.

   ```
   Paste the Tailscale auth key (it starts with tskey-auth-):
   ```

1. Wait for "BiblioViva is ready." and note down the address `https://biblioviva.<tailnet>.ts.net` that the program
   writes. The first opening can take a few seconds.

### Put Tailscale on the devices

1. Install Tailscale and sign in with the school's account on every device that uses BiblioViva, as described in the
   section [Install Tailscale](steps/devices.md#install-tailscale) of the step
   [Connect the devices](steps/devices.md).
1. Replace in the bookmarks and the shortcuts the address `http://…:8080` with the one the program wrote: the old one no
   longer works.
1. Sign in to BiblioViva again with one's own account, because the address is another.

## The reverse: from Tailscale to the local network

1. Prepare the local network: the address reserved for the computer, as in the step
   [Prepare the network](steps/network.md), local network variant.
1. In the terminal of the BiblioViva computer, run the following command. The program asks nothing.

   ```sh
   curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang en --network lan
   ```

1. Note down the addresses `http://biblioviva.local:8080` and `http://<address>:8080` that the program writes.
1. Delete from the Tailscale console the `biblioviva` machine, which stays in the list but offline, as described in the
   section [With Tailscale: free the name](move.md#with-tailscale-free-the-name) of
   [Move BiblioViva to another computer](move.md).

On the local network the camera, the installation as an application and access from outside the school no longer work;
the USB barcode scanner and the rest of BiblioViva keep working. The comparison is in
[Choose the network](choose-network.md).

## Result

BiblioViva answers at the Tailscale address, with the same data as before. With Tailscale the camera starts where it is
needed (patron photos, covers).

## Possible problems

- The program does not write "Changing the way of connecting…" but asks the questions of the initial installation: the
  `biblioviva` folder is not that of the user connected with. Use the same user as the installation.
- "The node is on the tailnet, but HTTPS certificates are off…": turn on "HTTPS Certificates" on the "DNS" page of the
  Tailscale console and run the command again (see [Install
  BiblioViva](steps/install.md#possible-problems)).
- The command does not accept the options: the text `bash -s --` before the options serves to pass them to the program;
  copy the command in full.

## Related pages

- [Choose the network](choose-network.md)
- [Prepare the network](steps/network.md)
- [Connect the devices](steps/devices.md)
- [Install BiblioViva](steps/install.md)
