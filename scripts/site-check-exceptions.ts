// SPDX-License-Identifier: GPL-3.0-or-later
// Bold texts of the documentation that `bun run site:check` lets pass although they are not a label of the
// interface (PLAN.md §3.23). The rule is in `docs/writing-guide.md`: the names of buttons, tabs, pages and
// fields are bold and must be a text of that language's dictionaries (`src/lib/i18n/<lang>/*.json`), the
// names of the built-in reports and of their columns (`config/reports/`, the report builder's catalogue)
// included; a label of another program goes in quotation marks and emphasis in italics. A text that is
// none of these gets a line here with the reason, or is rewritten; keep the list short.
//
// Matching is by `normalizeLabel` (one line, plain quotes, no final colon, dot or ellipsis; case counts).
// Not listed, and never needed: the label that opens a variant block of an installation step
// (`**Con Tailscale**` on the line after `<!-- variant: tailscale -->`).
import type { BoldException } from "./site-check-lib.ts";

export const BOLD_EXCEPTIONS: readonly BoldException[] = [];
