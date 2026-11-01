-- BiblioViva — export of the current students from Koha (PLAN.md steps 2.6, 9.19; Q31, Q115).
-- Produces the CSV of the student import (Amministrazione → Importazioni → Studenti) with the
-- English columns `first_name;last_name;level;section;card_number;email`, so existing cards stay
-- valid after the migration. The teachers have their own query, `koha-teachers.sql`.
--
-- Run on the Koha database, for example:
--   mysql -u koha -p koha_library --batch --raw < koha-students.sql | sed 's/\t/;/g' > students.csv
-- (`--batch` prints tab-separated rows with a header; the sed turns them into `;`).
--
-- Check the column names against your Koha version before running (borrowers.categorycode values
-- and the class/section attribute differ between installations). [VERIFY]
-- In this library the class and section live in `borrowers.sort1` (class year) and
-- `borrowers.sort2` (section); adapt the two expressions below if yours uses patron attributes
-- (`borrower_attributes` with `code = 'CLASSE'`) instead.

SELECT
	b.firstname                   AS first_name,
	b.surname                     AS last_name,
	b.sort1                       AS level,
	UPPER(b.sort2)                AS section,
	b.cardnumber                  AS card_number,
	COALESCE(b.email, '')         AS email
FROM borrowers b
WHERE b.categorycode IN ('ST', 'STUD', 'S')   -- students only
  AND (b.dateexpiry IS NULL OR b.dateexpiry >= CURDATE())
ORDER BY b.sort1, b.sort2, b.surname, b.firstname;
