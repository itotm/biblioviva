-- BiblioViva — the patron photos kept by Koha (PLAN.md step 3.9b, Q80).
-- Lists every patron with a photo: borrower number, card number and image type. The shell loop
-- below writes one file per patron named after the card number, the shape expected by
-- Administration → "Foto degli utenti da Koha" and by `bun run patrons:import-photos <folder>`.
--
--   mkdir foto
--   mysql -u koha -p koha_library -N -B < koha-patron-images.sql |
--   while read -r number card type; do
--     ext=jpg; [ "$type" = "image/png" ] && ext=png; [ "$type" = "image/gif" ] && ext=gif
--     mysql -u koha -p koha_library -N -B --raw \
--       -e "SELECT imagefile FROM patronimage WHERE borrowernumber = $number" > "foto/$card.$ext"
--   done
--
-- (Put the password in ~/.my.cnf so the loop does not ask it for every patron. `--raw` writes the
-- image bytes as they are; the newline mysql adds at the end is ignored by image readers.)
-- Then either zip the folder and upload it, or copy the files into DATA_DIR/imports/photos/.
--
-- Written for the current Koha schema (`patronimage`: borrowernumber, mimetype, imagefile). The
-- school runs two Koha versions: CHECK THE TABLE AGAINST THE VERSION BEING MIGRATED [VERIFY].

SELECT
	p.borrowernumber,
	b.cardnumber,
	p.mimetype
FROM patronimage p
JOIN borrowers b ON b.borrowernumber = p.borrowernumber
WHERE b.cardnumber IS NOT NULL AND b.cardnumber <> ''
ORDER BY b.cardnumber;
