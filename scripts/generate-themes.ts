// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run themes:generate` — writes src/lib/themes/<name>.css for every palette and the data of
// the area colours reference page (docs/design/area-colors.html).
import { readFileSync, writeFileSync } from "node:fs";
import { buildThemeCss, THEMES } from "#lib/shared/theme-palette.js";
import { AREA_COLORS_PAGE, renderAreaColorsPage } from "./area-colors-page.js";

for (const name of THEMES) {
	const path = `src/lib/themes/${name}.css`;
	writeFileSync(path, buildThemeCss(name));
	console.log(`wrote ${path}`);
}

writeFileSync(AREA_COLORS_PAGE, renderAreaColorsPage(readFileSync(AREA_COLORS_PAGE, "utf8")));
console.log(`wrote ${AREA_COLORS_PAGE}`);
