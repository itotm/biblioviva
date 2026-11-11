// SPDX-License-Identifier: GPL-3.0-or-later
// The installation questions of the documentation (PLAN.md step 8.7): the first page of Installazione asks
// them one after the other and composes the reader's path. This module is the logic only (which question
// comes, which options it offers, what the answers lead to), shared by the page's script and its tests;
// the words are in `texts.ts`, the drawing of the flow in `docs/install-choices.md`.

export const QUESTION_IDS = [
	"pc",
	"tel",
	"host",
	"os",
	"net",
	"ip",
	"tsacc",
	"method",
	"disk",
	"photo",
	"backup",
	"data",
] as const;
export type QuestionId = (typeof QUESTION_IDS)[number];
export type Answers = Partial<Record<QuestionId, string>>;

export interface Option {
	v: string;
	/** The key of the label when it is not the value itself. */
	label?: string;
	/** Shown but not choosable (macOS). */
	disabled?: boolean;
	/** Marked as the advised choice. */
	recommended?: boolean;
	/** The key of a note shown under the select once the option is chosen. */
	note?: string;
	/** The key of a warning shown under the select once the option is chosen. */
	warn?: string;
}

export interface Question {
	id: QuestionId;
	/** A question for those who know; the advised option is chosen in advance. */
	expert?: boolean;
	show: (a: Answers) => boolean;
	/** The only possible answer, decided by the earlier ones (the select is locked). */
	auto?: (a: Answers) => string | null;
	/** The answer chosen in advance when the question appears (the reader may change it). */
	preset?: (a: Answers) => string | null;
	options: (a: Answers) => Option[];
}

export type Package = "win" | "appimage" | "deb" | "docker";
export type Network = "none" | "tailscale" | "lan";
export type Profile = "small" | "medium" | "large";

// ---------------------------------------------------------------- derived facts

/** Other devices than the computer BiblioViva runs on: more computers, or a phone. */
export function others(a: Answers): boolean {
	return a.pc === "piu" || a.tel === "si";
}

/** The package to install, once the answers decide it. */
export function pkg(a: Answers): Package | null {
	if (a.host === "banco") {
		return a.os === "win" ? "win" : a.os === "linux" ? "appimage" : null;
	}
	if (a.host === "oldpc" && a.os === "win") {
		return "win";
	}
	if (a.host === "rpi" || (a.host === "oldpc" && (a.os === "linux" || a.os === "none"))) {
		return a.method === "deb" || a.method === "docker" ? a.method : null;
	}
	return null;
}

/** Whether the computer and its system are known (the questions after them can come). */
function systemKnown(a: Answers): boolean {
	return !!a.host && !!a.os && a.os !== "mac";
}

export function network(a: Answers): Network | null {
	if (!a.pc || !a.tel) {
		return null;
	}
	if (!others(a)) {
		return "none";
	}
	return a.net === "ts" ? "tailscale" : a.net === "lan" ? "lan" : null;
}

export function profile(a: Answers): Profile | null {
	if (a.host === "rpi") {
		return "small";
	}
	return a.disk === "ssd" ? "large" : a.disk === "hdd" || a.disk === "nd" ? "medium" : null;
}

/** The camera of the desk computer: on `localhost` (BiblioViva on the desk itself) or over HTTPS. */
export function deskCamera(a: Answers): boolean {
	return a.host === "banco" || a.net === "ts";
}

/** The address to open, `null` until known. `<tailnet>` is the reader's own name of the tailnet. */
export function address(a: Answers): string | null {
	const n = network(a);
	if (!pkg(a) || !n) {
		return null;
	}
	if (n === "none") {
		return "http://localhost:8080";
	}
	return n === "tailscale"
		? "https://biblioviva.<tailnet>.ts.net"
		: "http://biblioviva.local:8080";
}

/** The slug of the installation path (`docs/<lang>/setup/paths/<slug>.md`) the answers lead to. */
export function pathSlug(a: Answers): string | null {
	const p = pkg(a);
	const n = network(a);
	if (!p || !n) {
		return null;
	}
	const way = n === "tailscale" ? "tailscale" : "lan";
	switch (p) {
		case "win":
			return `windows-${way}`;
		case "appimage":
			return `appimage-${way}`;
		case "deb":
			return `deb-${way}`;
		case "docker":
			return `${a.host === "rpi" ? "raspberry" : "linux"}-${way}`;
	}
}

export type Capability = "deskCamera" | "phoneCamera" | "fromHome" | "deskOff" | "scanner";
export type CapState = "ok" | "no" | "warn";

/** What works with the answers given: colour, icon and text in the page. */
export function capabilities(a: Answers): { key: Capability; state: CapState; text: string }[] {
	const p = pkg(a);
	const n = network(a);
	if (!p || !n) {
		return [];
	}
	const out: { key: Capability; state: CapState; text: string }[] = [];
	out.push(
		deskCamera(a)
			? { key: "deskCamera", state: "ok", text: "works" }
			: { key: "deskCamera", state: "no", text: "files" },
	);
	if (a.tel === "si") {
		out.push(
			n === "tailscale"
				? { key: "phoneCamera", state: "ok", text: "works" }
				: { key: "phoneCamera", state: "warn", text: "noCamera" },
		);
	}
	if (n !== "none") {
		out.push(
			n === "tailscale"
				? { key: "fromHome", state: "ok", text: "possible" }
				: { key: "fromHome", state: "no", text: "no" },
		);
		if (a.host === "banco") {
			out.push({
				key: "deskOff",
				state: "warn",
				text: p === "win" ? "deskOff" : "noSession",
			});
		} else {
			out.push({ key: "deskOff", state: "ok", text: "answers" });
		}
	}
	out.push({ key: "scanner", state: "ok", text: "works" });
	return out;
}

export type StepKey =
	| "prepare-computer"
	| "terminal"
	| "network"
	| "install"
	| "first-run"
	| "devices"
	| "scanner-printer"
	| "backups"
	| "import";

/** The steps of the path, in the order of the path pages, each with its estimated minutes and the
 * key of its title (`step.<key>`, or a more precise variant). */
export function steps(a: Answers): { step: StepKey; title: string; minutes: number }[] {
	const p = pkg(a);
	const n = network(a);
	if (!p || !n) {
		return [];
	}
	const out: { step: StepKey; title: string; minutes: number }[] = [];
	if (a.host === "rpi") {
		out.push({ step: "prepare-computer", title: "prepare.rpi", minutes: 30 });
	} else if (a.os === "none") {
		out.push({ step: "prepare-computer", title: "prepare.debian", minutes: 40 });
	} else if (p === "win") {
		out.push({ step: "prepare-computer", title: "prepare.win", minutes: 5 });
	} else if (p === "appimage") {
		out.push({ step: "prepare-computer", title: "prepare.appimage", minutes: 5 });
	} else {
		out.push({ step: "prepare-computer", title: "prepare.pc", minutes: 10 });
	}
	if (p === "deb" || p === "docker") {
		out.push({ step: "terminal", title: "terminal", minutes: 10 });
	}
	if (n !== "none") {
		out.push(
			n === "tailscale"
				? { step: "network", title: "network.tailscale", minutes: 20 }
				: { step: "network", title: "network.lan", minutes: 15 },
		);
	}
	out.push({ step: "install", title: `install.${p}`, minutes: p === "docker" ? 20 : 10 });
	out.push(
		a.data === "restore"
			? { step: "first-run", title: "firstRun.restore", minutes: 20 }
			: a.data === "demo"
				? { step: "first-run", title: "firstRun.demo", minutes: 10 }
				: { step: "first-run", title: "firstRun", minutes: 10 },
	);
	if (n !== "none") {
		out.push(
			a.tel === "si"
				? { step: "devices", title: "devices.phones", minutes: 25 }
				: { step: "devices", title: "devices", minutes: 15 },
		);
	}
	out.push({ step: "scanner-printer", title: "scannerPrinter", minutes: 15 });
	out.push(
		a.backup === "cloud"
			? { step: "backups", title: "backups.offsite", minutes: 20 }
			: { step: "backups", title: "backups", minutes: 10 },
	);
	if (a.data === "import") {
		out.push({ step: "import", title: "import", minutes: 30 });
	}
	return out;
}

/** What to have at hand, as keys of `material.*`. */
export function material(a: Answers): string[] {
	const out: string[] = [];
	if (a.host === "rpi") {
		out.push("rpi", "rpiImager");
	} else if (a.host === "oldpc") {
		out.push("oldpc");
		if (a.os === "none") {
			out.push("debianUsb");
		}
	} else if (a.host === "banco") {
		out.push(a.os === "win" ? "deskWin" : "deskLinux");
	}
	if (others(a) && a.host !== "banco") {
		out.push("cable");
	}
	if (a.net === "ts") {
		out.push("tailscale");
	}
	if (a.net === "lan" && a.ip === "si") {
		out.push("fixedAddress");
	}
	out.push("scanner", "printer");
	if (a.tel === "si") {
		out.push(a.net === "ts" ? "phonesTailscale" : "phones");
	}
	if (a.photo === "si" && deskCamera(a)) {
		out.push("webcam");
	}
	if (a.backup === "usb") {
		out.push("usbDrive");
	}
	return out;
}

/** The memory limit of the container for a profile (as `setup.sh` writes it in `.env`). */
export function memLimit(p: Profile): string {
	return p === "small" ? "512m" : p === "medium" ? "1g" : "2g";
}

// ---------------------------------------------------------------- the questions

const isDedicatedLinux = (a: Answers): boolean =>
	a.host === "rpi" || (a.host === "oldpc" && (a.os === "linux" || a.os === "none"));

export const QUESTIONS: Question[] = [
	{
		id: "pc",
		show: () => true,
		options: () => [{ v: "uno" }, { v: "piu" }],
	},
	{
		id: "tel",
		show: () => true,
		options: () => [{ v: "no" }, { v: "si" }],
	},
	{
		id: "host",
		show: (a) => !!a.pc && !!a.tel,
		auto: (a) => (a.pc === "uno" && a.tel === "no" ? "banco" : null),
		options: (a) => [
			{
				v: "banco",
				recommended: a.pc === "uno",
				note: others(a) ? "banco.others" : undefined,
			},
			{ v: "rpi", recommended: a.pc === "piu", note: "rpi" },
			{ v: "oldpc", note: "oldpc" },
		],
	},
	{
		id: "os",
		show: (a) => !!a.host,
		auto: (a) => (a.host === "rpi" ? "rpios" : null),
		options: (a) =>
			a.host === "rpi"
				? [{ v: "rpios" }]
				: [
						{ v: "win" },
						{ v: "linux", label: a.host === "oldpc" ? "linux.oldpc" : "linux" },
						...(a.host === "oldpc"
							? [{ v: "none", note: "none" } satisfies Option]
							: []),
						{ v: "mac", disabled: true },
					],
	},
	{
		id: "net",
		show: (a) => systemKnown(a) && others(a),
		options: (a) => [
			{ v: "ts", recommended: a.tel === "si", note: "ts" },
			{ v: "lan", note: "lan", warn: a.tel === "si" ? "lan.phone" : undefined },
		],
	},
	{
		id: "ip",
		show: (a) => a.net === "lan",
		options: () => [
			{ v: "si", note: "si" },
			{ v: "no", warn: "no" },
			{ v: "nd", note: "nd" },
		],
	},
	{
		id: "tsacc",
		show: (a) => a.net === "ts",
		options: () => [
			{ v: "school", recommended: true, note: "school" },
			{ v: "personal", note: "personal" },
		],
	},
	{
		id: "method",
		expert: true,
		// After the network: with Tailscale Docker is advised (the compose file with the Tailscale
		// container is ready to copy), on the local network the Debian package is enough.
		show: (a) =>
			isDedicatedLinux(a) && (a.net === "lan" ? !!a.ip : a.net === "ts" ? !!a.tsacc : false),
		preset: (a) => (a.net === "ts" ? "docker" : "deb"),
		options: (a) => [
			{ v: "docker", recommended: a.net === "ts", note: "docker" },
			{ v: "deb", recommended: a.net === "lan", note: "deb" },
		],
	},
	{
		id: "disk",
		show: (a) => !!pkg(a) && a.host !== "rpi" && networkDone(a),
		options: () => [{ v: "ssd" }, { v: "hdd" }, { v: "nd" }],
	},
	{
		id: "photo",
		show: (a) => !!pkg(a) && networkDone(a) && (a.host === "rpi" || !!a.disk),
		options: (a) => [
			{
				v: "si",
				note: deskCamera(a)
					? a.tel === "si" && a.net === "ts"
						? "si.phone"
						: "si.webcam"
					: "si.files",
			},
			{ v: "no", note: "no" },
		],
	},
	{
		id: "backup",
		show: (a) => !!a.photo,
		options: (a) =>
			pkg(a) === "docker"
				? [
						{ v: "local", warn: "local" },
						{ v: "cloud", recommended: true, note: "cloud" },
					]
				: [
						{ v: "usb" },
						{ v: "share" },
						...(a.host !== "rpi" ? [{ v: "disk2" }] : []),
						{ v: "later", warn: "later" },
					],
	},
	{
		id: "data",
		show: (a) => !!a.backup,
		options: () => [
			{ v: "empty" },
			{ v: "demo", note: "demo" },
			{ v: "restore", note: "restore" },
			{ v: "import", note: "import" },
		],
	},
];

/** The network questions are answered (or not needed). */
function networkDone(a: Answers): boolean {
	if (!others(a)) {
		return true;
	}
	return (a.net === "lan" && !!a.ip) || (a.net === "ts" && !!a.tsacc);
}

export function question(id: QuestionId): Question {
	const q = QUESTIONS.find((x) => x.id === id);
	if (!q) {
		throw new Error(`no question ${id}`);
	}
	return q;
}

// ---------------------------------------------------------------- answers

/** The answers made consistent: hidden questions dropped, locked ones filled, choices no longer
 * offered dropped, presets applied to questions that just appeared. Earlier answers that still hold
 * are kept when an earlier one changes. */
export function normalise(input: Answers): Answers {
	const a: Answers = {};
	for (const id of QUESTION_IDS) {
		if (typeof input[id] === "string" && input[id] !== "") {
			a[id] = input[id];
		}
	}
	for (const q of QUESTIONS) {
		if (!q.show(a)) {
			a[q.id] = undefined;
			continue;
		}
		const auto = q.auto?.(a) ?? null;
		if (auto) {
			a[q.id] = auto;
			continue;
		}
		const valid = q
			.options(a)
			.filter((o) => !o.disabled)
			.map((o) => o.v);
		const current = a[q.id];
		if (current !== undefined && !valid.includes(current)) {
			a[q.id] = undefined;
		}
		if (a[q.id] === undefined) {
			const preset = q.preset?.(a) ?? null;
			if (preset && valid.includes(preset)) {
				a[q.id] = preset;
			}
		}
	}
	return Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined));
}

/** The questions in sight, in order. */
export function visible(a: Answers): Question[] {
	return QUESTIONS.filter((q) => q.show(a));
}

/** Every question in sight has its answer. */
export function complete(a: Answers): boolean {
	const shown = visible(a);
	return shown.length > 0 && shown.every((q) => a[q.id] !== undefined) && !!a.data;
}

/** The answers as the fragment of the page's address (so a path can be sent to someone). */
export function encode(a: Answers): string {
	return QUESTION_IDS.filter((id) => a[id] !== undefined && !question(id).auto?.(a))
		.map((id) => `${id}=${encodeURIComponent(a[id] ?? "")}`)
		.join("&");
}

export function decode(hash: string): Answers {
	const a: Answers = {};
	for (const part of hash.replace(/^#/, "").split("&")) {
		const [k, v] = part.split("=");
		if (k && v && (QUESTION_IDS as readonly string[]).includes(k)) {
			try {
				a[k as QuestionId] = decodeURIComponent(v);
			} catch {
				// a broken fragment is ignored
			}
		}
	}
	return normalise(a);
}
