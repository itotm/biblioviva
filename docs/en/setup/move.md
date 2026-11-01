# Move BiblioViva to another computer

This page explains how to take BiblioViva, with all its data, from one computer to another: to replace an old computer
with a newer PC or with a Raspberry Pi, for example. It is for whoever administers BiblioViva.

- Time: about an hour and a half, almost as much as a full installation.
- Requirements: the `admin` account, another medium (USB drive or a second computer) to keep the backup file on, and the
  material to prepare the other computer.
- The old computer is needed until the backup; then it stays idle and is no longer used for the work at the desk.

## Procedure

### Make the full backup

1. Save the archive with **Export everything**, as described in the section
   [Save the configuration with everything else](steps/backups.md#save-the-configuration-with-everything-else) of the
   step [Backups](steps/backups.md). The file contains the database, the photos, the covers and the whole configuration,
   including the card and label templates.
1. Copy the file to a USB drive or to another computer, and check that the copy opens. The file may weigh a few hundred
   megabytes.

> [!IMPORTANT]
> The nightly backup of the `backups` folder does not contain the configuration (staff accounts, settings, templates):
> to move BiblioViva **Export everything** is needed.

### Stop the old computer

From this moment the work at the desk must not continue on the old computer: the loans recorded after the backup would
not pass to the other computer.

1. On the old computer, open the terminal as at the step [Connect to the computer](steps/terminal.md).
1. Stop BiblioViva (the data stay on the disk).

   ```sh
   cd ~/biblioviva && docker compose down
   ```

### With Tailscale: free the name

BiblioViva with Tailscale takes the name `biblioviva` in the school's network. If the old computer is still enrolled,
the other gets a name with a number (`biblioviva-1`) and the address changes. Tailscale describes the rule in the page
[Machine names](https://tailscale.com/kb/1098/machine-names).

1. Open the "Machines" page of Tailscale's [admin console](https://login.tailscale.com/admin/machines).
1. Find the `biblioviva` row, open the row's menu and choose to delete the machine ("Delete" entry)
   [VERIFY: name of the menu and of the entry in the console, visible only when signed in].

On the local network there is nothing else to free: just remember that the other computer will have another address,
unless whoever manages the network reserves the old one's address for it.

### Prepare the other computer

1. Carry out steps 1-4 of the chosen path, in the same order, with the same way of connecting (Tailscale or local
   network) as the old computer. The paths are in the page [Installation](README.md).
1. At the step [First run](steps/first-run.md) open the guided procedure and stop at its first screen, without
   answering the questions: the restore in the next section replaces its choices.

With Tailscale the key from the step [Prepare the network](steps/network.md) can be reused if it is still valid, because
it was generated as reusable; otherwise a new one is generated.

### From the first run

1. On the first screen of the guided procedure, under the choice of language, press **Restore from a backup**.
1. Press **Choose the archive** and choose the file `biblioviva-export-YYYYMMDD-HHMM.zip`. BiblioViva checks it and
   shows what it contains.
1. Press **Restore**, wait for "Restore completed" and press **Go to the login**. The detail is in the section
   [From the first run](restore.md#from-the-first-run) of [Restart from a backup](restore.md).
1. Log in with the `admin` account of the old computer.
1. Open **Administration**, **Configuration**, **Performance** and check the **Computer** field: the backup brings that
   of the old computer; choose one suited to the other computer.

From this moment the staff accounts and their passwords are those of the old computer.

### Check and switch off the old computer

1. On the other computer, check a known patron, book and loan, and read a card with the scanner.
1. Check the desk devices: with Tailscale the address is the same as before (`https://biblioviva.<tailnet>.ts.net`);
   on the local network, communicate the address if it changed (see [Connect the devices](steps/devices.md)).
1. Keep the old computer switched off but intact for a few weeks, then wipe it as in
   [Uninstall BiblioViva](uninstall.md): it contains the patrons' data.

## Result

The other computer serves BiblioViva at the same address (with Tailscale) or at an address communicated to the devices
(on the local network), with the same data, the same photos and the same settings as the old one.

## Possible problems

- With Tailscale the computer is called `biblioviva-1` and the address is different: the old node was not deleted.
  Delete it from the console; the other computer's name can be corrected from the same "Machines" page
  [VERIFY: whether the name can be corrected from the console].
- "The backup is from another version of BiblioViva…": the two computers have different versions. See
  [Restart from a backup](restore.md).
- The guided procedure does not complete or BiblioViva does not open: see [Install BiblioViva](steps/install.md).

## Related pages

- [Backups](steps/backups.md)
- [Restart from a backup](restore.md)
- [Uninstall BiblioViva](uninstall.md)
- [Installation](README.md)
