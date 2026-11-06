# Common problems

This page collects the most frequent problems of BiblioViva, each with its cause and the steps to solve it. It is for
whoever uses the circulation desk and for whoever installed BiblioViva; the commands are given in the terminal of the
BiblioViva computer, opened as described in [Connect to the computer](../setup/steps/terminal.md). If the problem
is not here, see [Ask for help](ask-for-help.md).

## Address that does not open

The browser does not show BiblioViva's **Log in** page: it says that the site cannot be reached, that the name does not
exist, or it keeps waiting.

Cause: the BiblioViva computer is off or BiblioViva is not started; or the device is not on the same network as the
computer (with Tailscale, it does not have Tailscale on and connected to the school's account); or the address has
changed.

1. Check that the BiblioViva computer is on and connected to the network.
1. From the terminal of the BiblioViva computer, check that the containers are started.

   ```sh
   cd ~/biblioviva && docker compose ps
   ```

1. If the containers are not started (state `Up` or `running`), start them.

   ```sh
   cd ~/biblioviva && docker compose up -d
   ```

1. Wait a couple of minutes and try opening the address again. If step 2 answers "permission denied", close the
   terminal and connect again, or put `sudo` in front of the command.

With Tailscale, the following steps concern the device from which the address does not open.

1. Open the Tailscale application on the device and check that it is on and that the sign-in is with the school's
   account, the same as on the BiblioViva computer.
1. Check that the address is the right one: `https://biblioviva.<tailnet>.ts.net`, with the name of the school's
   network in place of `<tailnet>` (see [Tailnet](glossary.md#tailnet)).
1. If the browser does not find the name, open the "DNS" page of the
   [Tailscale console](https://login.tailscale.com/admin/dns) and check that "MagicDNS" is on (see
   [MagicDNS](glossary.md#magicdns)).
1. If the problem stays, read the log of the Tailscale connection on the BiblioViva computer.

   ```sh
   cd ~/biblioviva && docker compose logs tailscale
   ```

With the local network, the following steps concern the address.

1. Try the numeric address in place of the name: `http://<address>:8080`, for example `http://192.168.1.50:8080`.
   If the name `biblioviva.local` does not open and the numeric one does, the device does not recognise the name (see
   [.local name](glossary.md#local-name)).
1. If the numeric address is no longer the one written down, read the current addresses on the BiblioViva computer.

   ```sh
   hostname -I
   ```

1. If the address changes at every restart, ask whoever manages the network to reserve it for the computer (see
   [DHCP reservation](glossary.md#dhcp-reservation)).
1. If not even the numeric address opens from the other computers, ask whoever manages the network that port `8080` is
   not blocked between the devices.

Pages that explain more: [Connect the devices](../setup/steps/devices.md) and
[Prepare the network](../setup/steps/network.md).

## Missing padlock

With Tailscale the address opens, but the browser does not show the padlock or reports an invalid certificate.

Cause: the HTTPS certificates are not turned on in the Tailscale console (see [HTTPS](glossary.md#https)).

1. Open the "DNS" page of the [Tailscale console](https://login.tailscale.com/admin/dns).
1. Turn on "HTTPS Certificates", as described in [Prepare the network](../setup/steps/network.md).
1. Restart Tailscale on the BiblioViva computer.

   ```sh
   cd ~/biblioviva && docker compose restart tailscale
   ```

1. Wait a few seconds and open the address again: the first opening after turning it on can take longer.

## Camera that does not start

When the camera button is pressed (reading a code with the phone, photos of patrons, covers), the page says that the
camera works only over a secure connection, or the browser does not turn it on.

Cause: browsers allow the camera only on secure pages, those with the padlock (HTTPS). With the local network, and with
a numeric address even with Tailscale, the page is not secure. The camera is optional: at the desk the work is done with
the USB barcode scanner.

1. Check the address in the browser bar: it must begin with `https://` and have the padlock.
1. With Tailscale, open the address with the name `https://biblioviva.<tailnet>.ts.net`, never with a number.
1. With the local network the camera does not work: use the barcode scanner, or upload a file in place of the photo. To
   have the camera, switch to Tailscale ([Switch from the local network to
   Tailscale](../setup/lan-to-tailscale.md)).
1. If the address is right and the camera does not start, check the browser's permission for this site (the icon next
   to the address) and allow the use of the camera.
1. Close the other applications that use the camera and try again.

## Scanner that types strange characters

When reading a code with the barcode scanner, an apostrophe `'` or another character appears in place of the hyphen, or
the codes are not accepted.

Cause: the scanner and the computer use two different keyboard layouts, and the hyphen character is translated wrongly.
BiblioViva accepts the codes read with either layout anyway, but it is better for them to be the same (see
[Barcode scanner](glossary.md#barcode-scanner)).

1. Open **Administration** → **Configuration** → **Barcodes**.
1. Choose in **Computer keyboard** the layout of the keyboard of the computer the scanner is plugged into. In Italy it
   is "Italian".
1. Press **Save**.
1. Read a code with a hyphen again and check that it appears the same as the printed one.
1. If the character is still wrong, set the scanner to the computer's keyboard with the instructions in its manual:
   normally a few programming barcodes are read.

If instead the scanner types the code but the desk does not accept it, the scanner must send the Enter key after each
code: the scanner's manual explains how to turn it on. Page that explains more:
[Test the scanner and the printer](../setup/steps/scanner-printer.md).

## Print too small or misaligned

Cards or labels come out smaller than expected, shifted from the edges, cut off, or with the date and the page address
at the top and bottom.

Cause: the browser's print window has shrunk or enlarged the page, has added margins or headers, or the sheet of labels
has different measures from those set. BiblioViva's measures are in millimetres and are valid only with the page at
100 %.

1. Open the browser's print window with Ctrl+P.
1. Set the scale to 100 %. The browser calls it "Actual size" or "100"; do not choose "Fit to page" or "Fit to
   printable area".
1. Set the margins to "None".
1. Turn off "Headers and footers".
1. Choose an A4 sheet and print again.
1. Measure with a ruler the "10 cm ruler" mark of the test page: it must measure 100 mm.
1. If the ruler is right but the labels do not match the sheet, print the calibration page and compare it with a real
   sheet, as described in [Test the scanner and the
   printer](../setup/steps/scanner-printer.md#set-the-print-window).
1. If the measures of the sheet of labels are not those of BiblioViva, add the sheet as described in
   [Add a label sheet](../admin/guides/add-a-label-stock.md).
1. If the cards printed front and back do not match, calibrate the print as described in
   [Calibrate duplex printing](../admin/guides/calibrate-duplex.md).

## Forgotten administrator password

Nobody remembers the password of the `admin` account, the only one that can change the passwords of the other accounts.
If another administrator account remembers its own, use that one (**Administration** → **Staff accounts**, then
**New password** on the account's row).

Cause: passwords cannot be read or recovered, because BiblioViva keeps only their encrypted form. Whoever has access to
the terminal of the BiblioViva computer can however replace it in the settings file with a temporary password, to be
changed right afterwards.

1. Open the settings file with the terminal editor.

   ```sh
   nano ~/biblioviva/config/config.json
   ```

1. Find the part that begins with `"username": "admin"`.
1. In the `"passwordHash"` line of that account, replace the whole line with a `"password"` line followed by a
   temporary password of at least 8 characters, for example `"password": "<temporary password>",`, keeping the quotation
   marks and the final comma as in the nearby lines.
1. Save with Ctrl+O and Enter, then exit with Ctrl+X.
1. Make BiblioViva read the settings again.

   ```sh
   cd ~/biblioviva && docker compose kill -s HUP app
   ```

1. Open BiblioViva in the browser and sign in with the user name `admin` and the temporary password.
1. Open **Administration** → **Staff accounts**.
1. Press **New password** on the row of `admin` and write the final password.

> [!WARNING]
> Until the temporary password is changed, the settings file contains it in clear text. Change it right away at step 8,
> and do not leave the file open to whoever must not see it.

> [!NOTE]
> If the command of the first step answers "Permission denied", put `sudo` in front. If the `nano` editor is missing,
> install it with `sudo apt install -y nano`.

Technical page: [Deployment notes (technical)](../../deploy.md#installing-updating-logs-step-85).
[VERIFY: the way to change the administrator's password without editing the file, if there is one]

## Change password page that does not let you go on

On signing in, BiblioViva opens only the **Change password** page with the message "The password of this account was
given by the administrator: choose your own before going on." Any other page leads back there.

Cause: the account was created, or its password changed, with the **To change at the first login** box ticked. Until
the person chooses their own password, BiblioViva opens no other page.

1. Type in the **Current password** field the password received from the administrator.
1. Type the chosen password in the **New password (at least 8 characters)** field.
1. Type the same password again in the **Repeat the new password** field.
1. Press **Save the password**. The message "Password changed" appears and BiblioViva opens.

To leave without changing the password, press **Log out**. If the password received is not accepted ("The current
password is not right."), ask the administrator for a new one, as described in
[Change a password](../admin/guides/change-a-password.md).

## SSH connection that fails

From one's own computer it is not possible to connect to BiblioViva's PC or Raspberry Pi with the terminal (SSH, see
[Terminal](glossary.md#terminal)): an error message appears.

Cause: it depends on the message. The most common are these.

1. "Connection refused": the computer is not ready yet, or SSH is not on. Wait a few minutes and try again. If the
   message stays, for the PC install the SSH server; for the Raspberry Pi write the card again with SSH on.

   ```sh
   sudo apt install -y openssh-server
   ```

1. "Permission denied, please try again": the password is wrong. Type it carefully, mindful of the keyboard layout.
1. "Could not resolve hostname biblioviva.local": the name is not recognised. Check that the computer is on and on the
   same network, then use the address that the router shows.
1. "Connection timed out": the address is not the computer's, or the computer cannot be reached. Check the address in
   the router's list.
1. "REMOTE HOST IDENTIFICATION HAS CHANGED": the Raspberry Pi's card was rewritten and the name is already known with
   another key. Delete the old key and connect again.

   ```sh
   ssh-keygen -R biblioviva.local
   ```

Page that explains more: [Connect to the computer](../setup/steps/terminal.md#possible-problems).

## Installation that stops

The `setup.sh` program writes an error message and stops before writing "BiblioViva is ready.".

Cause: the message indicates it. After removing it, repeat the installation command, which resumes from where it got to
and does no harm.

```sh
curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash
```

1. Read the last message of the program and look it up below.
1. "This program runs on Linux only": the command was pasted on the wrong computer. Paste it into the terminal of the
   BiblioViva computer.
1. "The system is 32-bit": the card holds a 32-bit system. Write it again with Raspberry Pi OS Lite (64-bit).
1. "The sudo command is not available": install `sudo` or connect as an administrator.
1. "Docker was not installed": `n` was answered to the question, or the installation failed. Repeat the command and
   answer `Y`; if the error stays, install Docker with the [official guide](https://docs.docker.com/engine/install/)
   (see [Docker](glossary.md#docker)).
1. "Cannot download …": the computer has no internet. Check the cable or the Wi-Fi and repeat the command.
1. "BiblioViva does not answer yet": on a slow computer the start takes longer. Wait two minutes and repeat the
   command; if the message stays, read the log.

   ```sh
   cd ~/biblioviva && docker compose logs
   ```

1. With Tailscale, "requested tags … are invalid or not permitted" in the log: the `tag:biblioviva` tag or the key are
   not right. Repeat the parts "Computer tag" and "Access key" of [Prepare the
   network](../setup/steps/network.md).
1. With Tailscale, "The Tailscale key must start with tskey-" or the HTTPS certificates off: paste the whole key, or
   turn on "HTTPS Certificates" in the "DNS" page of the console, then repeat the command.
1. With the local network, "port is already allocated": another program occupies port `8080`. Free it, or write another
   number after `LAN_PORT=` in the file `~/biblioviva/.env` and repeat the command.

All the messages, with their causes, are in [Install BiblioViva](../setup/steps/install.md#possible-problems).

## Backup not made

In the **Backups** page the list shows no recent backups, or pressing **Back up now** gives an error.

Cause: the computer was off at the time of the backup (see [Computer left off](#computer-left-off)), or BiblioViva
cannot write in the backups folder, for example because the external disk is not connected or has no space.

1. Sign in as `admin` and open **Administration** → **Backups**.
1. Press **Back up now**. Wait for the message "Backup created".
1. If an error appears, check the free space on the computer's disk.

   ```sh
   df -h ~/biblioviva
   ```

1. Read the backup lines in the log.

   ```sh
   cd ~/biblioviva && docker compose logs app | grep backup
   ```

1. If the log says that the `/backups` folder is not writable, give the folder back to BiblioViva's user.

   ```sh
   sudo chown -R 1000:1000 ~/biblioviva/backups
   ```

1. If the backups go to an external disk, check that it is connected.
1. Restart BiblioViva and press **Back up now** again.

   ```sh
   cd ~/biblioviva && docker compose restart app
   ```

Page that explains more: [Backups](../setup/steps/backups.md); for the time settings, the guide
[Make and download a backup](../admin/guides/make-a-backup.md).

## Computer left off

The BiblioViva computer was turned off, or the power failed, and in the morning BiblioViva does not open or the night's
backup is missing.

Cause: BiblioViva starts again by itself when the computer is turned on, but it takes a few minutes. The backup is
scheduled at night (normally at 3:00); if the computer is off at that time, BiblioViva makes it one minute after the
next start, only one even after several days off.

1. Turn on the computer and wait two or three minutes.
1. Open BiblioViva's address in the browser. If it does not open, follow
   [Address that does not open](#address-that-does-not-open).
1. After signing in as `admin`, open **Administration** → **Backups** and check the list: the backup made at start-up
   carries the label **Made up at start**.
1. If the backup is missing, press **Back up now**.

To turn the computer off safely, give the following command in the terminal, instead of pulling the plug.

```sh
sudo shutdown -h now
```

If the computer is often left off at night, the backup time can be moved inside opening hours, from **Administration** →
**Configuration** → **Backup**, in the **Backup time** field.

## Phone that does not install the app

The box to add BiblioViva to the Home screen does not appear on the phone, or the installation fails.

Cause: installing as an app is optional and possible only with Tailscale, that is with the secure address (HTTPS). The
box appears only on the phone, only in the **Dashboard**, and only when the browser offers the installation; after
**Not now** it no longer appears in that browser.

1. Check that the phone has Tailscale on and that it opens the address `https://biblioviva.<tailnet>.ts.net` with the
   padlock. With the local network the installation is not possible ([Choose the
   network](../setup/choose-network.md)).
1. Open the **Dashboard** in the phone's browser and look for the **Add to the Home screen** box.
1. Press **Install** in the box.
1. If the box is not there, open the browser's menu and choose "Install app" or "Add to Home screen". With Firefox the
   menu is ⋮ and the entry is "Install" or "Add to Home screen".
   [VERIFY: the name of the menu entry in Chrome for Android and Safari for iPhone]
1. If the entry is not in the menu either, update the browser and open the page again.

It is not needed at the desk: the USB barcode scanner is the normal tool. Page that explains more: [Connect the
devices](../setup/steps/devices.md).

## BiblioViva that keeps restarting

The page opens for a moment and then does not answer, or `docker compose ps` shows that the `app` container keeps
restarting.

Cause: BiblioViva cannot write in a data folder, or the settings file is not valid. The log says which of the two and
gives the command that solves it.

1. Read the last lines of the log.

   ```sh
   cd ~/biblioviva && docker compose logs app
   ```

1. If the log speaks of a folder that cannot be written, give the command that the log suggests.
1. If the log speaks of an invalid settings file, correct the line indicated (the file and the key are named) or
   restore a copy of the configuration (see [Restart from a backup](../setup/restore.md)).
1. Restart BiblioViva.

   ```sh
   cd ~/biblioviva && docker compose up -d
   ```

Technical page: [Deployment notes (technical)](../../deploy.md#permissions).

## Related pages

- [Ask for help](ask-for-help.md)
- [Glossary](glossary.md)
- [Installation](../setup/README.md)
