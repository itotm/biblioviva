// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run pictograms:generate` (step 11.14) — writes the shipped pictograms of the classification
// (`config/classification/images/<code>.svg`) from Lucide icons and points `classification.json` at
// them. Run it again after changing a colour or an icon in `#lib/shared/pictograms.ts`; a library
// replaces any of them from the classification editor.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PICTOGRAM_ICONS, pictogramSvg, type IconNode } from "#lib/shared/pictograms.js";

const ICONS = "node_modules/@lucide/svelte/dist/icons";
const CONFIG = "config";
const OUT = join(CONFIG, "classification", "images");

/** The icon data of a Lucide icon, following the aliases (`laugh` → `face-grinning`). */
function iconNode(name: string): IconNode {
	let file = `${name}.svelte`;
	try {
		readFileSync(join(ICONS, file));
	} catch {
		const alias = /from "\.\/([\w-]+\.svelte)"/.exec(
			readFileSync(join(ICONS, `${name}.js`), "utf8"),
		);
		if (!alias?.[1]) {
			throw new Error(`no Lucide icon ${name}`);
		}
		file = alias[1];
	}
	const source = readFileSync(join(ICONS, file), "utf8");
	const data = /const iconData = (\{.*\});/.exec(source)?.[1];
	if (!data) {
		throw new Error(`cannot read the icon data of ${file}`);
	}
	return (JSON.parse(data) as { node: IconNode }).node;
}

interface Node {
	code: string;
	label: string;
	color?: string;
	image?: string;
}

const path = join(CONFIG, "classification.json");
const taxonomy = JSON.parse(readFileSync(path, "utf8")) as { genres: Node[]; nonfiction: Node[] };
mkdirSync(OUT, { recursive: true });
let written = 0;
for (const node of [...taxonomy.genres, ...taxonomy.nonfiction]) {
	const icon = PICTOGRAM_ICONS[node.code];
	if (!icon) {
		console.warn(`${node.code}: no icon in PICTOGRAM_ICONS, left as it is`);
		continue;
	}
	const name = `${node.code}.svg`;
	writeFileSync(
		join(OUT, name),
		pictogramSvg(iconNode(icon), node.color ?? "#9ca3af", node.label),
	);
	node.image = name;
	written++;
}
writeFileSync(path, `${JSON.stringify(taxonomy, null, "\t")}\n`);
console.log(`${String(written)} pictograms written to ${OUT}`);
