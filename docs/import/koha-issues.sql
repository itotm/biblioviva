-- BiblioViva — export of the loans running in Koha on the day of the switch (PLAN.md steps 3.9,
-- 9.19). Produces the CSV of the open loans import (Amministrazione → Importazioni → Prestiti in
-- corso) with the English columns `card_number;barcode;issued_on;due_on`. Import students,
-- teachers and catalogue first.
--
-- Run on the Koha database, for example:
--   mysql -u koha -p koha_library --batch --raw < koha-issues.sql | sed 's/\t/;/g' > loans.csv
--
-- Written for the current Koha schema (issues, borrowers, items): CHECK THE COLUMN NAMES AGAINST
-- YOUR KOHA VERSION BEFORE RUNNING [VERIFY].

SELECT
	br.cardnumber                                  AS card_number,
	it.barcode                                     AS barcode,
	DATE_FORMAT(iss.issuedate, '%Y-%m-%d')         AS issued_on,
	DATE_FORMAT(iss.date_due, '%Y-%m-%d')          AS due_on
FROM issues iss
JOIN borrowers br ON br.borrowernumber = iss.borrowernumber
JOIN items it ON it.itemnumber = iss.itemnumber
ORDER BY br.surname, br.firstname, iss.issuedate;
