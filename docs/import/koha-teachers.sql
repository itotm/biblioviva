-- BiblioViva — export of the current teachers from Koha (PLAN.md steps 2.6, 9.19; Q31, Q115).
-- Produces the CSV of the teacher import (Amministrazione → Importazioni → Docenti) with the
-- English columns `first_name;last_name;card_number;email`; the teachers join the default teachers
-- group of BiblioViva.
--
-- Run on the Koha database, for example:
--   mysql -u koha -p koha_library --batch --raw < koha-teachers.sql | sed 's/\t/;/g' > teachers.csv
--
-- Check the categorycode values against your Koha installation before running. [VERIFY]

SELECT
	b.firstname                   AS first_name,
	b.surname                     AS last_name,
	b.cardnumber                  AS card_number,
	COALESCE(b.email, '')         AS email
FROM borrowers b
WHERE b.categorycode IN ('T', 'DOC', 'PT')   -- teachers only
  AND (b.dateexpiry IS NULL OR b.dateexpiry >= CURDATE())
ORDER BY b.surname, b.firstname;
