// SPDX-License-Identifier: GPL-3.0-or-later
// A stand-in for yaz-client used by the driver tests (never talks to the network). It reads the
// command file like the real client and reacts to the search term: an ISBN of the fixtures returns
// the recorded records, `9780000000002` no hits, `SLOW` never answers, `DOWN` fails to connect.
import { copyFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const cmdFile = args[args.indexOf("-f") + 1] ?? "query.cmd";
const outFile = args[args.indexOf("-m") + 1] ?? "records.mrc";
const cmd = readFileSync(cmdFile, "utf8");
const find = /find (.*)/.exec(cmd)?.[1] ?? "";
const fixtures = join(import.meta.dir, "..", "fixtures", "marc");

console.log("Connecting...OK.");
if (find.includes("DOWN")) {
	console.log("Connecting...error");
	process.exit(1);
}
if (find.includes("SLOW")) {
	await Bun.sleep(10_000);
}
if (find.includes("WAIT")) {
	await Bun.sleep(400);
}
if (find.includes("9788804668237")) {
	console.log("Number of hits: 3, setno 1");
	copyFileSync(join(fixtures, "1984-isbn13.mrc"), outFile);
} else if (find.includes("harry")) {
	console.log("Number of hits: 1254, setno 1");
	copyFileSync(join(fixtures, "harry-potter-multivolume.mrc"), outFile);
} else if (find.includes("GARBAGE")) {
	console.log("Sent searchRequest.");
} else {
	console.log("Number of hits: 0, setno 1");
}
