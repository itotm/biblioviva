// SPDX-License-Identifier: GPL-3.0-or-later
// The installation questions (PLAN.md step 8.7): which question comes, what each answer leads to.
import { describe, expect, it } from "vitest";
import {
	address,
	capabilities,
	complete,
	decode,
	encode,
	material,
	memLimit,
	network,
	normalise,
	pathSlug,
	pkg,
	profile,
	QUESTION_IDS,
	QUESTIONS,
	steps,
	visible,
	type Answers,
} from "./logic.ts";
import { TEXTS } from "./texts.ts";

/** Answers given one after the other, as the page does. */
function answer(...pairs: [string, string][]): Answers {
	let a: Answers = normalise({});
	for (const [k, v] of pairs) {
		a = normalise({ ...a, [k]: v });
	}
	return a;
}

const ids = (a: Answers): string[] => visible(a).map((q) => q.id);

describe("the order of the questions", () => {
	it("starts with the computers and the phones", () => {
		expect(ids(normalise({}))).toEqual(["pc", "tel"]);
	});

	it("puts BiblioViva on the desk computer when it is the only device", () => {
		const a = answer(["pc", "uno"], ["tel", "no"]);
		expect(a.host).toBe("banco");
		expect(ids(a)).toEqual(["pc", "tel", "host", "os"]);
	});

	it("asks no network question for a single computer", () => {
		const a = answer(["pc", "uno"], ["tel", "no"], ["os", "win"]);
		expect(ids(a)).toEqual(["pc", "tel", "host", "os", "disk"]);
		expect(network(a)).toBe("none");
		expect(pkg(a)).toBe("win");
		expect(address(a)).toBe("http://localhost:8080");
	});

	it("fixes the system of a Raspberry Pi and skips the disk", () => {
		const a = answer(
			["pc", "piu"],
			["tel", "no"],
			["host", "rpi"],
			["net", "lan"],
			["ip", "si"],
		);
		expect(a.os).toBe("rpios");
		expect(ids(a)).toEqual(["pc", "tel", "host", "os", "net", "ip", "method", "photo"]);
		expect(profile(a)).toBe("small");
	});

	it("asks for the Tailscale account or the fixed address after the network", () => {
		const ts = answer(
			["pc", "piu"],
			["tel", "si"],
			["host", "banco"],
			["os", "win"],
			["net", "ts"],
		);
		expect(ids(ts)).toContain("tsacc");
		expect(ids(ts)).not.toContain("ip");
		const lan = normalise({ ...ts, net: "lan" });
		expect(ids(lan)).toContain("ip");
		expect(ids(lan)).not.toContain("tsacc");
		expect(lan.tsacc).toBeUndefined();
	});

	it("never offers macOS", () => {
		const a = normalise({ pc: "uno", tel: "no", os: "mac" });
		expect(a.os).toBeUndefined();
		const os = QUESTIONS.find((q) => q.id === "os")!.options(a);
		expect(os.find((o) => o.v === "mac")?.disabled).toBe(true);
	});
});

describe("the method of a dedicated Linux computer", () => {
	const base: [string, string][] = [
		["pc", "piu"],
		["tel", "no"],
		["host", "oldpc"],
		["os", "none"],
	];

	it("advises Docker with Tailscale", () => {
		const a = answer(...base, ["net", "ts"], ["tsacc", "school"]);
		expect(a.method).toBe("docker");
		expect(pkg(a)).toBe("docker");
		expect(pathSlug(a)).toBe("linux-tailscale");
	});

	it("advises the Debian package on the local network, Docker still possible", () => {
		const a = answer(...base, ["net", "lan"], ["ip", "nd"]);
		expect(a.method).toBe("deb");
		expect(pathSlug(a)).toBe("deb-lan");
		const docker = normalise({ ...a, method: "docker" });
		expect(pkg(docker)).toBe("docker");
		expect(pathSlug(docker)).toBe("linux-lan");
	});

	it("keeps the method chosen by hand while it is still offered", () => {
		const a = answer(
			...base,
			["net", "lan"],
			["ip", "si"],
			["method", "docker"],
			["disk", "hdd"],
		);
		expect(normalise(a).method).toBe("docker");
		expect(profile(a)).toBe("medium");
	});

	it("names the Raspberry Pi paths of Docker", () => {
		const a = answer(
			["pc", "piu"],
			["tel", "si"],
			["host", "rpi"],
			["net", "ts"],
			["tsacc", "school"],
		);
		expect(pathSlug(a)).toBe("raspberry-tailscale");
	});
});

describe("the path", () => {
	const full = answer(
		["pc", "piu"],
		["tel", "si"],
		["host", "rpi"],
		["net", "lan"],
		["ip", "no"],
		["photo", "si"],
		["backup", "usb"],
		["data", "import"],
	);

	it("is complete once every question in sight has its answer", () => {
		expect(complete(full)).toBe(true);
		expect(complete(normalise({ ...full, data: undefined }))).toBe(false);
	});

	it("says what works and what does not", () => {
		const caps = Object.fromEntries(capabilities(full).map((c) => [c.key, c.state]));
		expect(caps).toEqual({
			deskCamera: "no",
			phoneCamera: "warn",
			fromHome: "no",
			deskOff: "ok",
			scanner: "ok",
		});
		const desk = answer(["pc", "uno"], ["tel", "no"], ["os", "linux"], ["disk", "ssd"]);
		expect(capabilities(desk).map((c) => c.key)).toEqual(["deskCamera", "scanner"]);
		expect(profile(desk)).toBe("large");
		const served = answer(["pc", "piu"], ["tel", "no"], ["host", "banco"], ["os", "win"]);
		const withNet = answer(...Object.entries(served), ["net", "ts"], ["tsacc", "school"]);
		expect(capabilities(withNet).find((c) => c.key === "deskOff")).toEqual({
			key: "deskOff",
			state: "warn",
			text: "deskOff",
		});
	});

	it("lists the steps in the order of the path pages", () => {
		expect(steps(full).map((s) => s.step)).toEqual([
			"prepare-computer",
			"terminal",
			"network",
			"install",
			"first-run",
			"devices",
			"scanner-printer",
			"backups",
			"import",
		]);
		expect(steps(full).reduce((t, s) => t + s.minutes, 0)).toBe(
			30 + 10 + 15 + 10 + 10 + 25 + 15 + 10 + 30,
		);
		const single = answer(["pc", "uno"], ["tel", "no"], ["os", "win"]);
		expect(steps(single).map((s) => s.step)).toEqual([
			"prepare-computer",
			"install",
			"first-run",
			"scanner-printer",
			"backups",
		]);
	});

	it("lists what is needed", () => {
		expect(material(full)).toEqual([
			"rpi",
			"rpiImager",
			"cable",
			"scanner",
			"printer",
			"phones",
			"usbDrive",
		]);
	});

	it("offers the off-site copy with Docker and a folder with the packages", () => {
		const docker = answer(
			["pc", "piu"],
			["tel", "no"],
			["host", "rpi"],
			["net", "ts"],
			["tsacc", "school"],
			["photo", "no"],
		);
		const backup = QUESTIONS.find((q) => q.id === "backup")!;
		expect(backup.options(docker).map((o) => o.v)).toEqual(["local", "cloud"]);
		expect(backup.options(full).map((o) => o.v)).toEqual(["usb", "share", "later"]);
		const cloud = normalise({ ...docker, backup: "cloud" });
		expect(steps(cloud).find((s) => s.step === "backups")?.title).toBe("backups.offsite");
	});

	it("sizes the container after the profile", () => {
		expect([memLimit("small"), memLimit("medium"), memLimit("large")]).toEqual([
			"512m",
			"1g",
			"2g",
		]);
	});
});

describe("the address of the page", () => {
	it("carries the answers and gives them back", () => {
		const a = answer(
			["pc", "piu"],
			["tel", "si"],
			["host", "rpi"],
			["net", "ts"],
			["tsacc", "school"],
		);
		const hash = encode(a);
		expect(hash).not.toContain("os=");
		expect(decode(`#${hash}`)).toEqual(a);
	});

	it("ignores what it does not know", () => {
		expect(decode("#pc=uno&evil=1&tel=%E0%A4%A&host=")).toEqual({ pc: "uno" });
	});
});

describe("the words", () => {
	it("are the same keys in both languages", () => {
		expect(Object.keys(TEXTS.en).sort()).toEqual(Object.keys(TEXTS.it).sort());
	});

	it("exist for every question and option", () => {
		const keys = new Set(Object.keys(TEXTS.it));
		const missing: string[] = [];
		const states: Answers[] = [
			{},
			{ pc: "uno", tel: "no" },
			{ pc: "piu", tel: "si", host: "banco" },
			{ pc: "piu", tel: "si", host: "oldpc" },
			{ pc: "piu", tel: "si", host: "rpi", net: "ts" },
			{
				pc: "piu",
				tel: "si",
				host: "rpi",
				net: "lan",
				ip: "si",
				method: "docker",
				photo: "si",
			},
			{ pc: "piu", tel: "si", host: "rpi", net: "lan", ip: "si", method: "deb", photo: "si" },
			{
				pc: "piu",
				tel: "si",
				host: "banco",
				os: "win",
				net: "ts",
				tsacc: "school",
				disk: "ssd",
			},
			{ pc: "uno", tel: "no", os: "linux", disk: "nd" },
		];
		for (const s of states) {
			for (const q of QUESTIONS) {
				for (const k of [`q.${q.id}.title`, `q.${q.id}.help`]) {
					if (!keys.has(k)) {
						missing.push(k);
					}
				}
				if (q.auto && !keys.has(`q.${q.id}.auto`)) {
					missing.push(`q.${q.id}.auto`);
				}
				for (const o of q.options(s)) {
					for (const k of [
						`o.${q.id}.${o.label ?? o.v}`,
						...(o.note ? [`n.${q.id}.${o.note}`] : []),
						...(o.warn ? [`w.${q.id}.${o.warn}`] : []),
					]) {
						if (!keys.has(k)) {
							missing.push(k);
						}
					}
				}
			}
			const a = normalise(s);
			for (const st of steps(a)) {
				if (!keys.has(`step.${st.title}`)) {
					missing.push(`step.${st.title}`);
				}
			}
			for (const m of material(a)) {
				if (!keys.has(`material.${m}`)) {
					missing.push(`material.${m}`);
				}
			}
			for (const c of capabilities(a)) {
				for (const k of [`cap.${c.key}`, `st.${c.text}`]) {
					if (!keys.has(k)) {
						missing.push(k);
					}
				}
			}
		}
		expect([...new Set(missing)]).toEqual([]);
		expect(QUESTION_IDS).toHaveLength(QUESTIONS.length);
	});
});
