# Uninstall BiblioViva

This page explains how to stop BiblioViva on a computer and, if needed, delete all its data. It is for whoever
administers BiblioViva and must decommission the computer or give up the installation.

- Time: about 10 minutes.
- Requirements: the terminal of the BiblioViva computer (see [Connect to the computer](steps/terminal.md)) and, for the
  backup, the `admin` account.
- With Tailscale: access to Tailscale's admin console.

## Procedure

### Keep a backup

Before deleting anything, keep a copy of the data, even if there is no plan to use it.

1. Save the archive with **Export everything**, as described in the section
   [Save the configuration with everything else](steps/backups.md#save-the-configuration-with-everything-else) of the
   step [Backups](steps/backups.md).
1. Copy the downloaded file `biblioviva-export-YYYYMMDD-HHMM.zip` to a safe place, outside the computer. It contains
   personal data of minors: keep it with care and delete it when it is no longer needed.
1. Copy the computer's `backups` folder too: it contains the nightly backups and the copy of the photos and the covers.

### Stop BiblioViva, without deleting the data

1. Open the terminal of the BiblioViva computer.
1. Go into the BiblioViva folder.

   ```sh
   cd ~/biblioviva
   ```

1. Stop BiblioViva and remove its containers. The data stay on the disk.

   ```sh
   docker compose down
   ```

To restart it, from the same folder: `docker compose up -d`.

### Delete all the data

> [!WARNING]
> The following command deletes the database, the photos and the covers for good. Without a backup the data of the
> patrons, the books and the loans can no longer be recovered. Run it only with the backup already kept.

1. From the `~/biblioviva` folder, delete the Docker data (the database, the photos, the covers and the computer's
   identity in Tailscale).

   ```sh
   docker compose down -v
   ```

1. Leave the folder.

   ```sh
   cd ~
   ```

1. Delete the BiblioViva folder, with the settings and the backups it contains.

   ```sh
   rm -r ~/biblioviva
   ```

### With Tailscale: remove the computer from the network

1. Delete from the Tailscale console the `biblioviva` machine, as described in the section
   [With Tailscale: free the name](move.md#with-tailscale-free-the-name) of
   [Move BiblioViva to another computer](move.md).
1. Open the "Keys" page of the [admin console](https://login.tailscale.com/admin/settings/keys) and revoke the access
   key generated for BiblioViva.

The phones and computers that have the Tailscale application keep it: it is uninstalled from the device, if no longer
needed.

## Result

The following command no longer shows BiblioViva containers and the `~/biblioviva` folder does not exist (if it was
deleted).

```sh
docker ps
```

Docker stays installed on the computer: it need not be removed.

## Possible problems

- "Permission denied" while deleting the folder: some files belong to another user of the computer. Repeat the command
  with `sudo` in front, checking the path with care before pressing Enter.

  ```sh
  sudo rm -r ~/biblioviva
  ```

- "permission denied" about Docker: close the terminal and connect again, or put `sudo` in front of the `docker`
  commands.

## Related pages

- [Backups](steps/backups.md)
- [Move BiblioViva to another computer](move.md)
- [Restart from a backup](restore.md)
