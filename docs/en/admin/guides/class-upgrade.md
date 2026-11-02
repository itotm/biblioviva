# Upgrade the classes

This guide explains how to move all the students up to the next year at the end of the school year: each class moves up
with its students (`3 B` becomes `4 B`) and whoever finishes the last year leaves the school. It is for whoever
administers BiblioViva and is done once a year, when the administrator decides: BiblioViva never runs it by itself.

- Time: 20 to 40 minutes, plus the time to import the new students.
- Account: `admin`.
- Requirements: no books on loan to the students of the last year (or the decision to keep them at school), the list of
  the new students of the first-year classes.

> [!WARNING]
> The personal data of the students who leave the school (first name, last name, contacts, registration number, card
> number, photo) are erased at once and for good; only the class and the statistics remain. The operation cannot be
> undone, except by restoring the backup made at the first step.

What the upgrade does, in short:

- each class moves up to the next year and keeps its students; a mixed-year class (a class that hosts several years)
  moves each student up in their own year;
- the students of the last year leave the school and are removed;
- classes left without students are archived;
- the teachers and their groups do not change;
- loans already made keep the class of the day of the loan, so the statistics of past years stay correct;
- the class pictures uploaded for the photo census are deleted.

## Procedure

### Before starting

1. Open **Loans**, then **Returns**, and register the return of the books of the students of the last year. A lost book
   is marked as lost. Whoever still has books on loan blocks the upgrade, unless they are kept at school
   (**Leavers** step).

### Run the upgrade

1. Log in to BiblioViva with the `admin` account.
1. Press **Administration**, then **Class upgrade**. The page shows the steps **Backup**, **Classes**, **Leavers**,
   **Confirm** and **Completed**.

### The Backup step

1. Press **Create the backup**. The message "Backup created: …" appears with the name of the file.
1. Press **Next**. The button becomes active only after the backup.

### The Classes step

<!-- figure: admin/rollover-classes | The Classes step of the upgrade, with one class open -->

1. Read the list: each row shows the move, for example "3 B → 4 B", and the number of students. A **Closes** mark
   indicates a class that is left without students and is archived.
1. To see the students of a class press its row.
1. For a student who repeats the year, tick **Repeats**. The student stays in their year and in the class that will
   host them, normally the one with the same name.
1. For a student who changes section, choose the new class in the **Class** menu.
1. Where the path splits into several possible years, choose the year in the **The year after** menu.
1. If the page says "… students wait for their class to be picked", choose **Pick the class…** for each one: the
   **Next** button stays off until they are all settled.
1. Press **Next**.

### The Leavers step

1. Read the list of the students of the last year, each with the **Leaves** tick.
1. Untick whoever stays at school, for example whoever repeats the last year.
1. If a student has books on loan, the row shows "… books on loan" and a warning appears above. Press **Go to
   Returns**, register the return (or mark the book as lost) and come back to the step; or untick the student.
1. Press **Next**. The button becomes active when nobody who leaves has books on loan.

### The Confirm step

1. Read the summary: how many students move up a year, how many repeat, how many change class, how many classes close,
   how many leave the school and are erased.
1. If the last upgrade was less than six months ago, tick the box "The last upgrade ran on …, less than six months ago.
   I confirm I want to run it again.".
1. Press **Upgrade classes**.

### The Completed step

1. Read the numbers: the students promoted and those who repeat, the classes moved up and archived, the students
   removed.

### After the upgrade

1. To create the first-year classes press **Administration**, then **Configuration**, then **Classes**, then **New
   classes**: see [Set up the classes](set-up-classes.md).
1. To load the new students press **Import the new students** in the **Completed** step, or **Administration**,
   **Imports**, **Students**: see [Import the students](import-students.md). With a file that contains all the school's
   students choose **Synchronise students**; with a file of only the new students choose **Add and update**.
1. Print the cards of the new students with **Print the cards of the new patrons** and take the photos with **Photo
   census**.

## Result

The students are in the classes of the new year, the graduates have been removed and the empty classes are archived.
The operation appears in the **Audit log**.

## Possible problems

### Some leaving students still have books on loan

"Some leaving students still have books on loan." appears: register the return of the books, mark them as lost, or
untick **Leaves** for that student.

### The backup was not found or is too old

"The backup was not found or is too old: take it again from the first step." appears: the backup is valid for two hours.
Go back to the **Backup** step, press **Create the backup** and repeat the steps.

### Some students have no class yet

"Some students have no class yet: pick it in the Classes step." appears: go back to the **Classes** step and choose the
class for each one.

### Confirmation is needed because the last upgrade is recent

"Confirmation needed: the last upgrade is recent." appears: tick the confirmation box in the **Confirm** step.

### Something went wrong after the upgrade

Restore the backup made at the first step from **Administration**, **Backups**: see
[Make and download a backup](make-a-backup.md). Everything done after the backup is lost.

## Related pages

- [Set up the classes](set-up-classes.md)
- [Import the students](import-students.md)
- [Make and download a backup](make-a-backup.md)
- [Print the cards of a class](../../manual/guides/print-class-cards.md)
- [Class upgrade](../screens/rollover.md)
