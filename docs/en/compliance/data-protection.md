# Personal data protection

This page covers Regulation (EU) 2016/679 (GDPR) and the Italian Personal Data Protection Code (D.Lgs. 196/2003), for
the processing of the library patrons' data with BiblioViva. It is written for the head teacher, the DSGA and the DPO,
and it contains two ready texts to copy: one for the record of processing activities and one for the information
notice.

## What the rule asks

The school is the controller of the personal data of its students and teachers (GDPR, art. 4 and 24), represented by
the head teacher. Running the school library is one of the school's tasks: the legal basis of the processing is the task
carried out in the public interest (art. 6, paragraph 1, point e), and not the consent of the families. The rule does
not say expressly whether the patron's photo falls within the same task: the school evaluates it with the DPO, and
BiblioViva makes it possible not to use photos.

Among other things, the school must:

- keep the record of processing activities, listing the library in it too (art. 30);
- give the information notice to the data subjects, that is, to the families and the staff (art. 13): usually this is
  the school's general notice, which names the library;
- process only the data that are necessary and only for the time that is necessary (data minimisation and storage
  limitation, art. 5);
- choose tools that protect data by design and by default (art. 25);
- adopt security measures appropriate to the risk (art. 32);
- answer the requests of the data subjects, in particular of access (art. 15) and of erasure (art. 17);
- appoint a DPO, and evaluate with them whether a data protection impact assessment is needed (art. 35), which is
  required when a processing may present a high risk for individuals. Whether this is the case for a school library,
  which processes the data of minors, is for the school and its DPO to evaluate.

When an outside company processes data on the school's behalf, it is a processor and the school appoints it with a
written act (art. 28).

The Italian data protection authority (Garante per la protezione dei dati personali) has published for schools the
guide «La scuola a prova di privacy» («The school, privacy-proof»), which recalls the same principles: only the
indispensable data, care with images of minors, no publication of personal data.

## What BiblioViva does

### Data kept

A patron's record (a student or a teacher) contains:

- first name and last name;
- the type (student or teacher), the class and the year, or the teachers' group;
- the card number;
- the registration number, if the school imports it from its own list;
- the email address that the school assigns to the patron, if filled in;
- the photo, if photos are switched on;
- the internal notes and the note for the circulation desk, if anyone writes them;
- the date of the last card print and the dates when the record was created and modified.

There is no date of birth, tax code, home address or phone number. Each loan records the patron, the copy, the dates
and, as a snapshot of the day of the loan, the patron type, the class and the school year. A wish may carry the name of
whoever expressed it; removing the patron deletes the name and the wish stays.

The patrons' photos and the books' covers can each be switched off on their own; switching them off does not delete the
files already saved. The guide [Switch off photos or covers](../admin/guides/switch-off-photos-or-covers.md) describes
the procedure. For the photo census, pictures of a whole class can be uploaded: they stay until the classes are
upgraded (see "How long").

The staff accounts are personal data of the people who work in the library: user name, display name, password hash,
roles and date of the last login. As a rule the accounts are shared, one per role; whoever wants to know who did what
creates one account per person ([Manage the staff accounts](../admin/guides/manage-accounts.md)).

BiblioViva has no public catalogue and no accounts for students or families: no library patron ever enters the
software.

### Where they are

The data are on the school's computer where BiblioViva is installed: the database, the photos and the backups are
folders of that computer. BiblioViva does not use a cloud service and does not send the patrons' data to the project or
to anyone else. The software contains no analytics or usage reporting, and the pages that the browser loads do not call
external services: the fonts, the icons and the images are served by the school's computer.

When the school installs BiblioViva by itself, on its own computer, no company processes the data on its behalf, and so
there is no processor to appoint under art. 28. An appointment would be needed if the school entrusted the installation
and the management of the data to a supplier, or if someone offered BiblioViva as a hosted service on their own
computers: in that case whoever hosts it would become a processor.

### How long

- As long as the patron is at the school. A patron's data and loans stay in the archive until the school removes the
  patron; BiblioViva does not delete data on expiry. The storage period is therefore the patron's stay at the school,
  and the school decides when it ends.
- Removal deletes at once. Removing a patron deletes first name and last name, email, registration number, notes, card
  number and photo, at once and without any possibility of recovery. In the class pictures of the census the patron's
  box is covered and the patron's file is deleted. The procedure is in the guide [Remove a
  patron](../manual/guides/remove-a-patron.md).
- The class upgrade removes whoever leaves the school. The students of the last year are removed in the same way, and
  the class pictures uploaded for the census are deleted. The upgrade is run by the administrator, never by BiblioViva
  on its own ([Upgrade the classes](../admin/guides/class-upgrade.md)).
- What stays after the removal. The class, the year, the patron type and the loans with the class of the day of the loan
  stay, so that they serve the statistics. The loans of the same removed patron stay linked to each other by an
  internal number, without a name. BiblioViva calls this operation "anonymization"; whether the remaining data are
  anonymous in the sense of the GDPR, that is, no longer traceable to a person, is for the school to evaluate with the
  DPO, taking into account, for example, how small the class is.
- Backups keep the data for the days chosen. A copy of the database made before the removal still contains the person's
  data, until the backup is deleted. BiblioViva deletes the backups older than 30 days (setting **Days kept**), always
  keeping the most recent one. The photos copied into the backups folder are aligned with the archive at every nightly
  backup. The files that the administrator has downloaded or copied elsewhere, and the external copy if switched on,
  stay until the school deletes them. If the school restores a backup, the patrons removed after that backup reappear
  with their data and must be removed again.
- Free-text notes are not searched. Removing a patron does not search for the patron's name in the notes between
  colleagues or in the notes typed by hand: for this reason a patron's data must not be written in the notes, and the
  archived notes are deleted.
- Audit log. Its rows older than 24 months are deleted (setting **Months of the audit log**).

### Who sees them

An account of the staff is needed to enter. Each account has one or more roles, and each role is a set of permissions
(loans, patrons, catalogue, reports, imports, anonymization, administration): an account does only what its permissions
allow. Photos and covers open only with an account. Removing a patron requires the anonymization permission; exporting
a person's data, downloading the backups and managing the accounts are for the administrator. Whoever lends the books
sees the name and the class of whoever takes them, because the loan needs it.

Passwords are kept as hashes and not in clear, and failed login attempts are limited. The security measures are
described in the page [Security](security.md).

### What leaves the school

- Book searches. To fill in a book's record BiblioViva queries the OPAC SBN catalogue (a service of the Italian national
  library service), with the ISBN or with the title and the author that the operator has typed. For the covers it looks
  for the image by ISBN at Amazon and Open Library, which are on by default; Google Books is available but off. No
  names, photos or card numbers of the patrons are sent to these services; their operators see the network address the
  request comes from, that is, the school's. Switching off the covers ([Switch off photos or
  covers](../admin/guides/switch-off-photos-or-covers.md)) stops the image search.
- Tailscale, if chosen. With Tailscale the school's devices communicate in a private network and the traffic is
  encrypted end to end: Tailscale does not see its content, so it does not see the patrons' data. It does know,
  however, the account the school has registered with and the data of the connected devices (for example names and
  addresses), and it is a US company: how it treats them is written in the [Tailscale privacy
  policy](https://tailscale.com/privacy-policy), which the school and the DPO read in order to decide. The local
  network passes through no external service and has no such point. The choice is described in [Choose the
  network](../setup/choose-network.md).
- External copy of the backups. It is an optional function, off by default: an administrator switches it on and chooses
  the destination, which can be a second disk, a school server or a storage service the school already has an account
  with. When it is on, the whole backups folder, with the patrons' data and the photos, is copied every hour to that
  destination. The destination, if it is outside the school, is a choice of the school, with its own data protection
  rules ([Backups](../setup/steps/backups.md)).
- Downloaded files. The exports and the backups that the administrator downloads stay where the administrator saves
  them.

### Logs

BiblioViva writes its technical logs to the standard output, with no log files of its own, and no names, photos or card
numbers appear in them. The **Audit log** lists who did what: it contains the account name, the type of operation, what
was touched and its internal number; the fields that carry names, emails, notes, photos or card numbers are discarded
before the row is written. The rows can be consulted from [Audit log](../admin/screens/audit.md).

## What the school does

- Enter the library in the record of processing activities, with the text of the next section completed.
- Name the library in the information notice to families and staff, with the paragraph below.
- Decide with the DPO the open questions: the legal basis for the photos, the need for an impact assessment, the
  judgement on the data left after the removal, the choice of Tailscale or the local network.
- Choose who has which account, and how many: one account per role or one account per person ([Manage the staff
  accounts](../admin/guides/manage-accounts.md)). Change the passwords when the staff changes.
- Keep the backups safe. The backups are not encrypted: a lost USB stick with a backup contains the patrons' data.
  Keep the sticks and the disks in a locked place, delete the backups that are not needed, and encrypt the medium or
  choose a destination that does so if the DPO considers it necessary ([Make and download a
  backup](../admin/guides/make-a-backup.md)).
- Decide how long to keep the backups with the setting **Days kept**, knowing that a removed person stays in the
  earlier backups until they are deleted ([Configuration](../admin/screens/configuration.md#backup)).
- Answer the access requests. From the patron record the command **Export the person's data** downloads that person's
  record, loans and their events. The photo is not in the file, and neither are the notes typed by hand: if they are
  needed, they are searched for separately ([Exports](../admin/screens/exports.md), [Patron
  record](../manual/screens/patron-record.md)).
- Answer the erasure requests. Remove the patron ([Remove a patron](../manual/guides/remove-a-patron.md)). A patron
  with loans in progress is removed after the return or after the loss is reported. The retention time of the backups
  must be told to the requester.
- Instruct the staff not to write patrons' data in the notes and in free-text fields.
- Upgrade the classes every year, so that whoever leaves the school is removed: BiblioViva does not do it on its own.

## Text for the record of processing activities

The following text is copied into the school's record of processing activities and completed. It follows the fields of
art. 30, paragraph 1, of the GDPR. The parts in square brackets are to be filled in or chosen.

> Processing: management of the school library (patron records, catalogue, loans and returns), with the BiblioViva
> software.
>
> - Controller: [name of the school], represented by the head teacher [name]; contact: [mail or PEC address]. Data
>   protection officer: [name and contact].
> - Purposes: management of the loan of books and of the other materials of the school library; printing of cards and
>   overdue reminders; statistics on the use of the library. Legal basis: task carried out in the public interest by
>   the school (art. 6, paragraph 1, point e, GDPR). [Legal basis chosen for the patron's photo, or: photos are not
>   used.]
> - Categories of data subjects: students; teachers; staff who use the library with an account of their own.
> - Categories of data: first name and last name, patron type, class and year, card number, registration number, email
>   address assigned by the school, photo [if switched on], internal notes; loan history with the class of the day of
>   the loan. For the staff: user name, display name, roles, date of the last login, audit log. No special categories
>   of data and no data relating to criminal convictions are processed.
> - Recipients: the authorized school staff, with accounts that limit access to the data necessary for their role. No
>   external recipient. [Any suppliers who manage the computer or the backups, to be appointed processors under
>   art. 28.]
> - Transfers to third countries: no patron data is transferred. [If the school uses Tailscale: the connection between
>   the devices goes through a private network provided by Tailscale Inc.; the traffic is encrypted end to end and the
>   provider processes the data of the school's account and of the connected devices; basis for the transfer: [to be
>   checked with the DPO]. If the school uses the local network: no external service takes part in the connection.]
>   [If the external copy is on: destination, operator and location.] The search for the books' data and covers sends
>   to external services only the ISBN, the title or the author of the book.
> - Storage periods: the patron's data and loans stay for as long as the patron is at the school. At removal (also with
>   the end-of-year class upgrade) first name, last name, email, registration number, notes, card number and photo are
>   deleted at once; what stays, without identifying data, is the patron type, the class and the loans for the
>   statistics. Backups are kept for [30] days. The audit log is kept for [24] months.
> - Security measures: access reserved to staff with personal or per-role accounts, protected by a password kept as a
>   hash; separate permissions for loans, patrons, catalogue, reports and administration; data kept on the school's
>   computer [located in: place]; nightly backup [kept in: place and custody arrangements]; audit log; software updates
>   [at the interval: ...]. The backups are not encrypted by the software: [measure adopted by the school].

## Text for the information notice

The following paragraph is added to the information notice that the school gives to families and staff (art. 13 GDPR),
and completed.

> School library. To allow the loan of the books and of the other materials of the school library, the school records
> in a library management software the first name and last name, the class and the card number of students and
> teachers[, the email address assigned by the school][, the registration number][, the photo for the card] and the
> loan history. The processing falls within the school's task carried out in the public interest (art. 6, paragraph 1,
> point e, GDPR). The data are accessible only to authorized staff, stay on the school's computer and are not
> communicated to other parties[, except: ...]. When the student or the teacher leaves the school, first name, last name
> and the other identifying data are deleted; what stays, without identifying data, is the class and the loans for the
> statistics. Backups are kept for [30] days. To exercise the rights provided by articles 15 to 22 of the GDPR (access,
> rectification, erasure and others), contact [school contact] or the data protection officer, [name and contact].

## References

- [Regulation (EU) 2016/679 (GDPR)](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=en), on EUR-Lex
- [D.Lgs. 30 June 2003, no. 196](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2003-06-30;196),
  Personal Data Protection Code, on Normattiva (in Italian)
- [Scuola](https://www.garanteprivacy.it/temi/scuola), the page of the Garante per la protezione dei dati personali on
  schools, with the guide «La scuola a prova di privacy» (in Italian)
- [Tailscale privacy policy](https://tailscale.com/privacy-policy)

## Related pages

- [Security](security.md)
- [BiblioViva features](../features.md)
- [Make and download a backup](../admin/guides/make-a-backup.md)
- [Choose the network](../setup/choose-network.md)
