# Connect the devices

This step, to be done after the first run in the browser (step 5), connects to BiblioViva the circulation desk computer
and, if needed, the other computers, tablets and phones, and gives the staff the accounts to sign in. The circulation
desk computer takes about 10 minutes; every other device about 5 minutes.

## Requirements

<!-- variant: tailscale -->
**With Tailscale**

- The school's Tailscale account, the one opened at step 3 (the address it signs in with and, if needed, the person who
  knows it).
- The name of the school's network ending in `.ts.net`, noted down at step 3.
- The passwords of the BiblioViva accounts, noted down at the end of step 5.
<!-- /variant -->
<!-- variant: lan -->
**On the local network**

- The address reserved for the BiblioViva computer, noted down at step 3 (for example `192.168.1.50`), or the one printed
  by `setup.sh` at step 4.
- The passwords of the BiblioViva accounts, noted down at the end of step 5.
- Every computer connected to the school network, with a browser.
<!-- /variant -->

## Procedure

<!-- variant: tailscale -->
**With Tailscale**

### Install Tailscale

On every device that must use BiblioViva the Tailscale application must be installed, signed in to the school's
account. The computer used for the first run (step 5) already has it: for that one, go on to the next section.

1. Open the download page for the device's system:
   [Windows](https://tailscale.com/download/windows), [macOS](https://tailscale.com/download/mac),
   [Linux](https://tailscale.com/download/linux), [Android](https://tailscale.com/download/android),
   [iPhone and iPad](https://tailscale.com/download/ios). For a Chromebook see the page
   [Download](https://tailscale.com/download). [VERIFY: the Tailscale page for ChromeOS]
1. Install the application following the instructions on the page.
1. Open the application and sign in with the school's Tailscale account, the same as at step 3.
   [VERIFY: the text of the application's sign-in button, different on Windows, macOS and Linux]

### The desk computer

1. If Tailscale is not already installed on this computer, install it as described above.
1. Open in the browser the address `https://biblioviva.<tailnet>.ts.net`, replacing `<tailnet>` with the name noted
   down at step 3 (the name can also be read on the "DNS" page of the
   [Tailscale console](https://login.tailscale.com/admin/dns)). The **Log in** page of BiblioViva opens, with the
   browser's padlock.

   <!-- figure: login/login | The BiblioViva login page -->

1. Add the address to the browser's bookmarks.

### Other computers, tablets and phones

For every other device that must use BiblioViva:

1. Install Tailscale as described above.
1. Open in the browser the address `https://biblioviva.<tailnet>.ts.net`.
1. Add the address to the bookmarks.

### Install BiblioViva as an app on the phone (optional)

A phone with Tailscale can have BiblioViva as an application with its own icon. It is not needed to work at the
circulation desk, where the USB barcode scanner is the normal tool.

1. Open the address `https://biblioviva.<tailnet>.ts.net` in the phone's browser and sign in.
1. In the **Dashboard** press **Install** in the **Add to the Home screen** panel. If the panel does not appear, open the
   browser's menu and choose "Install app" or "Add to Home screen", depending on the browser.
   [VERIFY: the name of the menu entry in the Android and iPhone browser]
1. Confirm the proposed name. The BiblioViva icon appears among the phone's applications.

<!-- screenshot: phone/install-app | The phone browser's menu with the entry to install BiblioViva -->
<!-- /variant -->
<!-- variant: lan -->
**On the local network**

### The desk computer

1. Open in the browser the address `http://biblioviva.local:8080`. The **Log in** page of BiblioViva opens.

   <!-- figure: login/login | The BiblioViva login page -->

1. If it does not open, open instead `http://<address>:8080`, replacing `<address>` with the one noted down at step 3
   (for example `http://192.168.1.50:8080`).
1. Add the address that works to the browser's bookmarks.

### Other computers

1. Open the address that worked on the desk computer from every other computer connected to the school network. A
   computer outside the school network cannot reach it.
1. Add the address to the bookmarks.

> [!NOTE]
> On the local network the browser does not allow the camera nor the installation of BiblioViva as an application on the
> phone: the reason is the address without a padlock. It is possible to switch to Tailscale later; see
> [Choose the network](../choose-network.md).
<!-- /variant -->

### The staff accounts

The devices of both ways use the same accounts: one per role, shared, each with only the work of its role. The accounts
and the passwords are those chosen or generated at step 5; the table is in the section
[Passwords](first-run.md#passwords) of that step.

1. Give each colleague in person the password of the account of their role, by voice or on a sheet of paper. Do not send it by email
   or in a chat.
1. Sign in with the account of the role: on the **Log in** page write the **Username** and the **Password**, then press
   **Log in**.

To change a password later, see the possible problems of the step [First run](first-run.md).

## Check before going on

<!-- variant: tailscale -->
**With Tailscale**

- On the desk computer the address `https://biblioviva.<tailnet>.ts.net` opens the **Log in** page with the padlock.
- With the username `admin` and its password one signs in and the start page of BiblioViva opens.
- Every other device has the Tailscale application signed in and opens the same address.

If the address does not open, see the possible problems below and
[Common problems](../../help/problems.md#address-that-does-not-open).
<!-- /variant -->
<!-- variant: lan -->
**On the local network**

- On the desk computer `http://biblioviva.local:8080` or `http://<address>:8080` opens the **Log in** page.
- With the username `admin` and its password one signs in and the start page of BiblioViva opens.
- From the other computers of the network the same address opens.

If the address does not open, see the possible problems below and
[Common problems](../../help/problems.md#address-that-does-not-open).
<!-- /variant -->

## Possible problems

<!-- variant: tailscale -->
**With Tailscale**

### The browser does not find BiblioViva's address

The browser does not find `biblioviva.<tailnet>.ts.net`: the Tailscale application is not active on the device, or it is
connected to another account, or MagicDNS is off on the "DNS" page of the console (step 3).

### The padlock is missing or the certificate is not valid

The padlock is missing or the browser reports an invalid certificate: the HTTPS certificates are not on in the "DNS"
page of the console (step 3).
<!-- /variant -->
<!-- variant: lan -->
**On the local network**

### biblioviva.local does not open on a computer

Use the address with the number. If it is no longer the one noted down (the address was not reserved, see step 3), read
it on the BiblioViva computer with the following command, which prints the computer's addresses; the first is the same
that the installation program writes at the end of step 4.

```sh
hostname -I
```

### The address with the number does not open from the other computers

Port `8080` may be blocked in the network; ask whoever manages it (step 3).
<!-- /variant -->

## Related pages

- Previous step: [First run](first-run.md)
- Next step: [Test the scanner and the printer](scanner-printer.md)
- [Common problems](../../help/problems.md)
