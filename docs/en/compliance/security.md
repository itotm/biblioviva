# IT security

This page covers the rules on IT security that apply to schools as public administrations and says which part of them
concerns BiblioViva. It is written for the head teacher, the DSGA, the DPO and the officer for digital transition (RTD).

## What the rule asks

- Minimum ICT security measures for public administrations (AgID Circular of 18 April 2017, no. 2/2017; AgID is the
  Agency for Digital Italy). Each administration adopts them and applies them to its own IT systems: they concern, among
  other things, the inventory of devices and programs, configurations, users with administrator privileges, backups and
  data protection. The head of the structure in charge of organisation, innovation and technology fills in and signs the
  implementation form attached to the circular. The measures concern the school's systems as a whole: a single software
  contributes to those that touch it, and does not certify compliance with them.
- GDPR, article 32. The controller, that is, the school, adopts technical and organisational measures appropriate to the
  risk, including confidentiality, the ability to restore data after an incident and the periodic testing of the
  measures. The library's patrons are mostly minors. See [Personal data protection](data-protection.md).
- ACN regulation on cloud services for public administration (ACN is the Agenzia per la cybersicurezza nazionale, the
  National Cybersecurity Agency). Administrations use cloud services qualified by the ACN, with levels that depend on
  the classification of the data and of the services. The qualified services are in the ACN's public catalogue.

## What BiblioViva does

What follows is checked in the code and in the technical documentation ([Security](../../security.md) and
[Deployment](../../deploy.md), in English).

### Access and permissions

- An account is needed to use BiblioViva. All pages, except the login page, require being logged in; so do the photos
  and the covers.
- The staff accounts are defined in the configuration; as a rule there is one per role (administration, loans,
  catalogue, cards, reports), shared by several people. Personal accounts, one per person, can also be created, from
  **Administration** → **Staff accounts**. See [Manage the staff accounts](../admin/guides/manage-accounts.md).
- Passwords are not stored: the configuration holds only a value computed from the password with the argon2id algorithm
  (a hash, from which the password cannot be recovered). The minimum length of a password is eight characters. A
  personal account can be created with the requirement to choose its own password at the first login.
- Each account can do only what the permissions of its roles allow. The permissions are checked by the server on every
  request, not just hidden in the interface. Backups, accounts, the audit log and the settings are reserved to the
  administration permission, which as a rule only the `admin` account has. The last account with the administration
  permission cannot be removed or reduced.
- After five failed login attempts in fifteen minutes, for the same user name or from the same network address, further
  attempts are refused. The two numbers are settings.
- The session is identified by a random code, stored in the database only as a hash, and lasts for the number of days
  set (14 as a rule), renewing itself with use. A deactivated account or a changed password closes the sessions of that
  account.
- The **Audit log** lists who did what: logins, changes, imports, backups. It contains no personal data of the patrons.
  The rows are deleted after the months set in **Months of the audit log** (24 as a rule). With shared accounts the log
  shows the name of the account and not that of the person; to know who did what, personal accounts are needed. See
  [Audit log](../admin/screens/audit.md).

### Network and connection

- With Tailscale the BiblioViva computer can be reached only by the devices of the school's private network, not from
  the internet; the connection uses HTTPS with a valid certificate. The traffic between the devices is encrypted by
  Tailscale.
- With the local network BiblioViva can be reached by the devices connected to the school's network, with the HTTP
  protocol: the connection is not encrypted and passwords travel in clear on that network. The camera and use from
  outside the school are not available. This way suits a network the school trusts. See [Choose the
  network](../setup/choose-network.md).
- In the Docker installation BiblioViva runs in a container with an unprivileged user, with the file system read-only
  except for the three data folders. The pages send the browser the usual security headers; uploaded files (photos,
  covers, archives, CSV files) are checked and the images are re-encoded, to remove hidden data as well, such as the
  location.
- The internet searches of a book's record and cover send only the ISBN, the title or the author, never data of the
  patrons.

### Backups

- BiblioViva makes a copy of the database by itself every night (at 3:00 as a rule), also copies the photos and the
  covers and keeps the copies of 30 days as a rule. If the computer was off at that hour, the copy is made at the next
  start. A copy can be made at any time with **Back up now** and is downloaded from **Administration** → **Backups**.
- Restoring starts from a copy in the list or from an uploaded archive. Before restoring, BiblioViva checks everything
  and shows what would change; it restores only the parts chosen.
- An external copy is optional and is switched on in the installation: on another disk, on a USB stick, on a network
  disk or on a storage service the school already has an account with. The **Backups** page shows the outcome of the
  last external copy and flags a copy older than two days.
- The backups are not encrypted. They contain the data of students and teachers.

### Updates

- BiblioViva does not update itself: the configuration provided contains no automatic update service. Updating is an
  operation for whoever administers the computer, who downloads the new version and restarts BiblioViva; a backup is
  made first. See [Update BiblioViva](../setup/update.md).
- The libraries that BiblioViva uses are pinned to exact versions; the list is in the [About](../manual/screens/about.md)
  page.
- The computer's operating system and the rest of the installed software are not updated by BiblioViva.

### Cloud

BiblioViva is installed on a school computer and keeps its data there: it is not a cloud service bought by the school,
and the ACN qualification does not concern it. Whoever offered it to schools as a hosted service should check the ACN
rules for cloud service providers. Two choices of the school can, however, involve a third-party service:

- Tailscale, if chosen, is a service of a US company, which processes the data of the Tailscale account and the
  connection data of the devices; the content of the traffic is encrypted from one device to the other. The rule does
  not expressly say whether the cloud service rules apply to this use: the evaluation is the school's, with its DPO and
  its officer for digital transition. With the local network this service is not there.
- An external copy on an online storage service is a cloud service of the school, and the ACN rules apply to that
  service, not to BiblioViva.

## What the school does

- Choose where the BiblioViva computer is kept: in a room not accessible to anyone who is not staff.
- Decide who knows the password of the `admin` account, change it when whoever knew it leaves the post, and give
  colleagues accounts with only the permissions they need. Create a personal account for each person who must be
  recognisable in the log.
- Update the computer's operating system and, when a new version comes out, BiblioViva.
- Choose where to keep the backups and who can take them: they are not encrypted, so a USB stick or a disk with the
  copies must be kept like an archive of personal data. For a destination outside the school, the school's own data
  protection rules apply.
- Try restoring a copy once, to know that it works and how long it takes. See [Restart from a
  backup](../setup/restore.md).
- Choose the way to connect: Tailscale or the local network. With the local network, use it only on a network that is
  trusted.
- Keep the processing documents in order (record of processing activities, information notice, security measures
  adopted): see [Personal data protection](data-protection.md).
- Fill in the implementation form of the AgID minimum measures for the school's own systems: BiblioViva is only one of
  them.

## References

- [Minimum ICT security measures for public administrations](https://www.agid.gov.it/it/sicurezza/misure-minime-sicurezza-ict),
  AgID Circular of 18 April 2017, no. 2/2017, on the AgID site (in Italian).
- [Regulation (EU) 2016/679 (GDPR)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679), on EUR-Lex,
  article 32.
- [Cloud per la pubblica amministrazione](https://www.acn.gov.it/portale/cloud), on the ACN site (in Italian), with the
  [regulation](https://www.acn.gov.it/portale/cloud/regolamento-cloud-per-la-pa) and the catalogue of qualified
  services.
- [Security](../../security.md): BiblioViva's technical page on security, in English.
- [Deployment](../../deploy.md): the technical page on installation, backups and updates, in English.
