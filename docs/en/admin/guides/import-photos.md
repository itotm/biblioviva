# Import the patron photos

This guide explains how to load the photos of many patrons in one go, one file per patron, for example those extracted
from another program. It is for whoever administers BiblioViva.

- Time: 10 to 30 minutes, depending on the number of photos.
- Account: `admin`. No other account can import photos.
- Requirements: one photo per patron, in a file named after the card number; the patrons already imported.

The administrator can switch off patron photos: with photos switched off the **Patron photos** page does not exist (see
[Switch off photos or covers](switch-off-photos-or-covers.md)). For the photos of a single class there are more
convenient ways: see [Take patron photos](../../manual/guides/take-patron-photos.md) and
[Take photos from a class picture](../../manual/guides/photos-from-class-picture.md).

## Procedure

### Prepare the photos

1. Name each photo after the patron's card number, followed by the extension: for example `0000001240.jpg` for a card of
   an old format, `U012345.jpg` for a card of the current format. JPEG, PNG, WebP, GIF, BMP, HEIC and AVIF files are
   accepted.
1. Put all the files in a ZIP archive. Folders inside the archive do not matter: only the name of each file counts.

> [!NOTE]
> BiblioViva resizes each photo to the set size and removes the image's hidden data (location, date, name of the
> device). The browser accepts archives up to about 32 MB: for a larger quantity split the photos into several
> archives, or use the computer folder described further on.

### Upload the archive

1. Press **Administration**, then **Imports**, then **Patron photos**. The **Import the patron photos** page opens.
1. In the **From a ZIP archive** box, in the **ZIP archive with the photos** field, choose the archive.
1. If the archive's photo must replace that of patrons who already have one, tick **Replace the photos already
   present**. Without the tick the photos already present stay as they are.
1. Press **Import the photos**.

### Check the result

1. Read the **Result** box. It reports how many photos were imported, replaced, left as they were because already
   present, how many files match no patron and how many are not readable images.
1. If there are files without a patron, press **Download the list of files without a patron**: the file
   `foto-senza-utente.csv` lists the names to check.

### Use the computer folder (optional)

When the photos are many and the archive would be too large, the files can be copied into a folder on the BiblioViva
computer. This step needs the help of whoever manages the computer.

1. Ask whoever manages the computer to copy the files into the folder indicated by the page, in the **From the server
   folder** box (it is the `imports/photos` folder of BiblioViva's data; the volumes are described in the
   [technical guide](../../../deploy.md))
   [VERIFY: the exact command to copy the files into the data volume, not described in deploy.md].
1. Refresh the page: the box says how many files there are.
1. If needed, tick **Replace the photos already present**.
1. Press **Import from the folder**.

## Result

The patrons whose card numbers match the file names have the photo. The photo is seen in the patron's record and on the
card. The message "Photos imported" confirms the import from the folder.

## Possible problems

- Many files have no patron: the file name does not match the card number: check the downloaded list and rename the
  files. The patrons must already have been imported.
- "The file is not a valid ZIP archive." appears: the chosen file is not a ZIP. Create the archive again.
- "The archive contains no files." appears: the archive is empty. Check that the files were compressed and not an empty
  folder.
- Some photos are not readable: the **Result** lists the files that are not valid images: replace them and import them
  again.
- A photo does not change: the patron already had a photo and **Replace the photos already present** was not ticked.
- For those coming from Koha: photos are extracted with a ready-made query, which writes one file per patron with the
  card number as its name: see [the technical instructions](../../../import/README.md).

## Related pages

- [Import the students](import-students.md)
- [Switch off photos or covers](switch-off-photos-or-covers.md)
- [Take the patrons' photos](../../manual/guides/take-patron-photos.md)
- [Imports](../screens/imports.md)
