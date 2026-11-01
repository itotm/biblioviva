# Reference: the library's current overdue notices ("solleciti")

The built-in slip `overdue-by-class` (PLAN.md §3.12, step 4.6, Appendix H) reproduces the overdue notice the library
prints today. The sample examined is not stored (it lists pupils' names); this description replaces it.

## Layout

A plain A4 page with one block per group, blocks following each other with generous spacing (about 15 mm), no page
break between them, no logo, no footer.

Each block:

1. Heading, bold, about 13 pt: `<group> - Solleciti biblioteca del <dd/MM/yyyy>` (for example
   `1 D - Solleciti biblioteca del 19/09/2026`, `Docente - Solleciti biblioteca del 19/09/2026`).
2. A full-width table with black borders on every cell, header row in bold, columns **Nome | Titolo | Giorni ritardo**.
3. One row per overdue loan: a teacher with two overdue books appears in two rows.

Groups seen in the sample, in this order: `1 D`, `2 D`, `4 D`, `5 B`, `Docente`. Groups without overdue loans are
omitted. Column widths in the sample vary from block to block because the tables were auto-sized; BiblioViva uses a
fixed narrow last column and lets the name and title columns share the rest.

## Data

| Column | Source |
|---|---|
| Nome | patron's first name and surname |
| Titolo | title of the book on loan |
| Giorni ritardo | calendar days between the due date and the print date (164, 203, 120, 137, 184, 123 in the sample) |

The date in the heading is the print date. The delays in the sample (up to 203 days) show that notices are printed
rarely and cover the whole backlog, so the print route must not limit the number of groups or rows.
