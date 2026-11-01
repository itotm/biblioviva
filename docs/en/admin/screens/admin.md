# Administration

The **Administration** page gathers the library's configuration and the jobs on the data: accounts, the audit log,
backups, imports, the class upgrade and exports. It is reserved for the `admin` account. It opens from the sidebar (on
the phone from the **More** item) and from the **Dashboard**; the other pages of this section have a **Back** button at
the top, which leads back here.

<!-- figure: admin/home | The Administration page with the seven tabs -->

1. Page title.
2. The tabs of the seven areas, each with a title and a line of explanation.
3. The **Clear sample data** button, present only in an installation that holds sample data.

## Configuration

Opens the [Configuration](configuration.md): the classification and the settings of the library. From the Configuration
also **Appearance and language**, the **Classes**, the print templates and the reports library are reached. For the order
in which to make the first settings see [Administrator first steps](../first-steps.md).

## Audit log

Opens the [Audit log](audit.md): who did what, among logins, changes and imports.

## Staff accounts

Opens the [Staff accounts](users.md): the shared accounts, the roles and the permissions. Guides:
[Manage the staff accounts](../guides/manage-accounts.md) and
[Change a password](../guides/change-a-password.md).

## Backups

Opens the [Backups](backups.md): the safety copies of the database and files, their creation, download and
restore. Guide: [Make and download a backup](../guides/make-a-backup.md).

## Imports

Opens the [Imports](imports.md): catalogue, students, teachers, open loans and patron photos. The tab is also visible to
the accounts that can import the catalogue or the patrons without being administrators (see the imports page).

## Class upgrade

Opens the [Class upgrade](rollover.md), the guided end-of-year procedure. Guide:
[Upgrade the classes](../guides/class-upgrade.md).

## Exports

Opens the [Exports](exports.md): patrons, catalogue, loans and all the data as CSV or JSON files.

## Clear sample data

The **Clear sample data** button appears at the top right only when the installation contains sample data (not in the
public demo). Before acting it asks for confirmation with the question "Clear the sample data?": the database and the
photos are deleted and recreated empty (the classes and the teachers group stay), and all operators are signed out. Guide:
[Remove the sample data](../guides/remove-demo-data.md).
