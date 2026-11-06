# Change the classification and the reading levels

This guide explains how to change the genres of fiction, the subjects of non-fiction, their colours and pictograms, and
the reading levels of the books. It is for whoever administers BiblioViva and is an operation done rarely, because the
classification codes are written on the books, in the call numbers and on the spine bands.

- Time: 10 to 30 minutes, depending on the changes.
- Account: `admin`.
- Requirements: the list of genres and subjects to add, rename or remove; the pictogram images (PNG, JPEG or WebP), if
  new ones are wanted.

The *classification* divides the books into *genres* (fiction: novels, adventure, comics…) and *subjects* (non-fiction,
with its *sub-subjects*). Each genre and each subject has a code, a name, a colour and a *pictogram*, that is the image
printed on the spine band. A fiction book can also have a *reading level*, for example the level `4` that is read in the
call number `B 4 DEL`. Reading levels are the library's own scale, independent of the school's classes.

The changes stay in draft until **Save** is pressed; a previous version of the file is kept in the configuration
history.

## Procedure

### Open the classification

1. Log in to BiblioViva with the `admin` account.
1. Press **Administration**, then **Configuration**, then **Classification**. The page has the tabs **Fiction**,
   **Non-fiction**, **Dewey** and **Options**; next to each name is written how many entries the tab contains.

<!-- figure: admin/classification | The Fiction tab of the classification with a genre open on the right -->

### Change a genre or a subject

1. Open the **Fiction** tab (for genres) or the **Non-fiction** tab (for subjects).
1. Press the row to change. On the right the **Genre**, **Subject** or **Sub-subject** panel appears (on the phone a
   window opens). Next to each row is written how many books use it.
1. Change the **Code**, **Name**, **Colour** and **Pictogram** fields. The colour is chosen from the picker or written in
   the **Colour code** field, in the form `#e8231b`.
1. For the pictogram press **Upload an image** (PNG, JPEG or WebP: it is saved as PNG), or **Choose among the images** to
   reuse an image already present. **Remove the image** removes it: on the spine band a circle with the colour and the
   code then appears. A sub-subject without a colour or without an image uses those of its subject.
1. Look at the **Spine band preview** at the bottom of the panel: it shows a sample book as it would be printed, at
   actual size.

> [!NOTE]
> Changing the **Code** of a genre or subject in use also renames the books that use it. On saving, the books move to the
> new code and BiblioViva computes again the call numbers of their copies (for example `B 4 DEL` becomes `A 4 DEL`).

### Add, order and delete

1. To add press **Add a genre** (**Fiction** tab) or **Add a subject** (**Non-fiction** tab). For a sub-subject select the
   subject and press **Add a sub-subject**. Write the code, which cannot also be used by another genre or subject, and
   the name.
1. To change the order in which they appear in the catalogue choices drag the rows, or use **Move up** and **Move down**.
1. To move a sub-subject under another subject change the **Position** field.
1. To delete press **Delete the genre** or **Delete the subject** and confirm with **Delete**. Deleting a subject also
   deletes its sub-subjects.

### Link a Dewey number to a subject

1. Open the **Dewey** tab. Each row links a Dewey prefix (1 to 3 digits) to a subject.
1. To add a row press **Add a mapping**, write the **Dewey prefix** and choose the **Subject**.
1. Write a Dewey number in the **Try a Dewey number** field: the page shows the subject that would be proposed. When a
   non-fiction book arrives with a Dewey number (for example from the SBN catalogue), BiblioViva proposes the subject of
   the longest matching prefix.

### Set the reading levels

1. Open the **Options** tab.
1. Tick **Fiction is divided by reading level** if the library uses levels. Unticking it makes the level fields disappear
   from records, labels, filters and reports.
1. In the **Reading levels** box, in order from the easiest, write for each level the **Level code** (it is the sign
   printed in the call number, for example `4`) and the **Level name**. Use **Add a level** to add one, **Move up** and
   **Move down** to order them, **Remove the level** to delete one.
1. Tick **The reading level is on each copy** only if copies of the same book sit on shelves of different levels;
   otherwise the level is on the book. On saving, the level of each book passes to its copies (or goes back to the
   book, if there are no copies of different levels).

### Choose how the call number is made

BiblioViva computes the call number of every copy from a scheme and never has it typed in full: each copy keeps it and
BiblioViva computes it again after every change that concerns it (the classification, the author, the title, the level
of a copy, the scheme itself). The labels whose call number changed go back among those to print. The scheme is made of
two choices, also in the first-run wizard, in the **School** step.

1. Open the **Options** tab and find the **Call number patterns** group. Under the group's title BiblioViva explains
   that when the scheme changes, on save the call numbers are computed again and the labels that change go back among
   those to print.
1. In the **Call number** menu choose the order of the parts. Under the menu appears "How the call number is made:
   BiblioViva computes it from the classification, the level and the author."
1. In the **End** menu choose how the call number ends. The menu does not appear with the order "Free: typed on each
   copy".
1. Read the examples under the menus, written as "Examples: B 4 DEL · B DEL · 590 ROS": they change with the choices.

The orders offered in the **Call number** menu:

| Entry | Form | Example |
|---|---|---|
| "Genre, then level" (proposed) | genre, level, end | `B 4 DEL` |
| "Level, then genre" | level, genre, end | `4 B DEL` |
| "Genre, without the level" | genre, end | `B DEL` |
| "Free: typed on each copy" | none: BiblioViva does not compute it | |

For a non-fiction book the call number starts with the class, for example `590 ROS`. Without reading levels the menu
offers only "Genre, without the level" and "Free: typed on each copy".

The entries of the **End** menu:

- "Author's initials, computed" (proposed): the first three letters of the surname, which cannot be edited.
- "Author's initials, editable per title": the same, but the cataloguer can change them for each title in the **Call
  number text** field of **Edit record**; left empty, the field uses the proposed initials.
- "None": the call number has no end.

> [!NOTE]
> A book whose author is a special value (`Anonimo`, `AA. VV.`) takes the first three letters of the title, skipping a
> leading article: "Enciclopedia dei ragazzi" becomes `030 ENC`.

> [!NOTE]
> Switching to the order "Free: typed on each copy" makes each copy keep the call number it has, as a text written by
> hand: nothing changes until someone edits it on the copy's page. Under the menus appears "Each copy has its call number
> typed on its page: BiblioViva does not compute it."

### Write a pattern by hand

For a call number different from the ones offered the pattern is written by hand. The order then shows the entry
"Custom", with the sentence "The scheme is written by hand in the patterns below."

1. In the **Call number patterns** group open the **Patterns written by hand** section.
1. Write the pattern for **Fiction**, **Fiction with an associated class** and **Non-fiction**, with the placeholders
   listed above the fields: `{{genre}}`, `{{class}}`, `{{code}}`, `{{author3}}`, `{{title1}}`, `{{text}}` and
   `{{copytext}}`. The placeholder `text` is a text per title (in **Edit record**), `copytext` a text per copy. Under
   each pattern an example appears.
1. If a pattern uses `{{text}}`, **Value proposed for the title's text** appears: choose "Author's initials", "Title's
   initial" or "None".

### Save

1. Press **Save** at the top. The **Save the classification** window opens, showing what changes in the catalogue.
1. If a code used by books was deleted or renamed, the window asks where to move them: for each code choose the new
   value in the **Choose…** menu. The new code goes on the books and at the start of their call numbers.
1. If a reading level that has books was removed, the window asks in the same way which level the books move to, or
   **No level**.
1. If call numbers change, the window counts them: "N copies change call number: their labels go back among those to
   print." This also happens when a genre, a class or a level is renamed or removed, when the level moves between the
   book and the copies, and when the scheme changes.
1. To put back among the labels to print also the spine bands that change only in name, colour or pictogram, tick the
   box that proposes it. Leave it off if the difference on the bands already stuck on does not matter.
1. Press **Save**. The message "Classification saved" appears, with the number of books moved, of call numbers
   rewritten and of spine bands to reprint.

To go back before saving press **Discard changes**. Leaving the page with unsaved changes makes BiblioViva ask for
confirmation.

## Result

The saved classification applies at once in the catalogue, in the cataloguers' choices and on the labels. The books moved
have the new code and the call number computed again; their spine bands, and the labels whose call number changed, go
back among those to print. The save enters the configuration history: see [Undo a configuration change](undo-a-configuration-change.md).

## Possible problems

### The code is already used

"This code is already used by another genre or subject." appears: a code cannot be used twice, not even by a genre and a
subject. Choose another code.

### The colour is not written correctly

"Write the colour as #rrggbb, for example #e8231b." appears: correct the colour code.

### The Save button is off

The fields with an error are marked in red; correct them.

### The catalogue has codes the classification does not contain

"The catalogue has books with codes the classification does not contain" appears: some books have a code that is not in
the classification. Add those codes here or reclassify those books from the catalogue.

### The pattern written by hand is not accepted

"The pattern cannot be empty." or "Unknown placeholders: …" appears: each pattern must be written and may contain only
the placeholders listed above the fields. Correct the pattern.

### After saving many labels are to be printed

The save window counted "N copies change call number: their labels go back among those to print.": with the new scheme,
or with the code or level changed, the call number of those copies differs from the printed one. Print the labels from
the **Books without labels** tile of the **Dashboard**, as described in [Print book
labels](../../manual/guides/print-book-labels.md#print-the-missing-labels).

### The colour or pictogram of a sub-subject does not change

Without a colour or an image of its own the sub-subject uses those of its subject.

### The image is not accepted

"The file is not an image." or "Format not accepted: use PNG, JPEG or WebP." appears: choose an image in one of these
formats. "The image is too large": reduce it and upload it again.

### Some books have copies in different classes

The save window reports books with copies in different classes: before removing the class from the copies, give the same
class to all the copies of each book.

## Related pages

- [Undo a configuration change](undo-a-configuration-change.md)
- [Import the catalogue](import-the-catalogue.md)
- [Classify books](../../manual/guides/classify-books.md)
- [Print book labels](../../manual/guides/print-book-labels.md)
- [Configuration](../screens/configuration.md)
