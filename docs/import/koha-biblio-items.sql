-- BiblioViva — export of the catalogue from Koha (PLAN.md steps 3.9, 9.19; Q31, Q115).
-- One row per copy (items), with the record fields repeated on each row and the record id in
-- `biblio_key`, with the English columns of the catalogue import (Amministrazione → Importazioni
-- → Catalogo), recognised without mapping.
--
-- Run on the Koha database, for example:
--   mysql -u koha -p koha_library --batch --raw < koha-biblio-items.sql > catalog.tsv
-- (`--batch` prints tab-separated rows with a header, which the import reads as they are. Keep the
-- tabs: the physical description always contains `;`, as in `32 p. : ill. ; 24 cm`.)
--
-- Written for the current Koha schema (biblio, biblioitems, items, biblio_metadata). Column names differ between
-- Koha versions: CHECK THEM AGAINST YOUR KOHA VERSION BEFORE RUNNING [VERIFY]. In this library:
--   items.ccode     → classification: a letter is a fiction genre, a number (or MMM) a non-fiction
--                     class (docs/reference/classification/koha-ccode.csv);
--   items.location  → the associated class `1`…`5`, or `S` for non-fiction (the framework calls it
--                     "Classe/Saggistica");
--   items.itype     → the material: adapt the CASE below to your item types and to the codes of
--                     `library.itemTypes` in BiblioViva's configuration.
--   original_title  → UNIMARC 500$a of the record's MARCXML, only for a translation: the original
--                     language (101$c) differs from the language of the text (101$a) (step 9.23).
-- There are no local cover images to export: covers are downloaded again by BiblioViva.

SELECT
	b.biblionumber                                                     AS biblio_key,
	COALESCE(SUBSTRING_INDEX(SUBSTRING_INDEX(bi.isbn, ' | ', 1), ' ', 1), '') AS isbn,
	b.title                                                            AS title,
	COALESCE(b.subtitle, '')                                           AS subtitle,
	CASE
		WHEN ExtractValue(bm.metadata, '//datafield[@tag="101"]/subfield[@code="c"][1]') <> ''
			AND ExtractValue(bm.metadata, '//datafield[@tag="101"]/subfield[@code="c"][1]')
				<> ExtractValue(bm.metadata, '//datafield[@tag="101"]/subfield[@code="a"][1]')
		THEN ExtractValue(bm.metadata, '//datafield[@tag="500"][1]/subfield[@code="a"]')
		ELSE ''
	END                                                                AS original_title,
	COALESCE(b.author, '')                                             AS author,
	COALESCE(bi.publishercode, '')                                     AS publisher,
	COALESCE(bi.place, '')                                             AS publication_place,
	COALESCE(bi.publicationyear, '')                                   AS publication_year,
	CONCAT_WS(' ; ',
		NULLIF(CONCAT_WS(' : ', NULLIF(bi.pages, ''), NULLIF(bi.illus, '')), ''),
		NULLIF(bi.size, ''))                                           AS physical_description,
	COALESCE(b.notes, '')                                              AS notes,
	COALESCE(i.ccode, '')                                              AS classification,
	COALESCE(i.location, '')                                           AS reading_level,
	COALESCE(i.barcode, '')                                            AS barcode,
	COALESCE(i.itemcallnumber, '')                                     AS call_number,
	CASE i.itype
		WHEN 'DVD' THEN 'dvd'
		WHEN 'REF' THEN 'consultazione'
		ELSE 'libro'
	END                                                                AS item_type,
	COALESCE(i.enumchron, '')                                          AS enumeration,
	CASE
		WHEN i.withdrawn > 0 THEN 'withdrawn'
		WHEN i.itemlost > 0 THEN 'lost'
		WHEN i.damaged > 0 THEN 'damaged'
		ELSE 'available'
	END                                                                AS status,
	CASE WHEN i.notforloan <> 0 THEN 'yes' ELSE 'no' END                AS not_for_loan,
	COALESCE(DATE_FORMAT(i.dateaccessioned, '%Y-%m-%d'), '')           AS acquisition_date,
	COALESCE(i.itemnotes, '')                                          AS item_notes
FROM items i
JOIN biblio b ON b.biblionumber = i.biblionumber
JOIN biblioitems bi ON bi.biblionumber = b.biblionumber
LEFT JOIN biblio_metadata bm ON bm.biblionumber = b.biblionumber AND bm.format = 'marcxml'
ORDER BY b.biblionumber, i.itemnumber;
