// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { groupOverdues, type OverdueSource } from "./overdues.js";
import {
	loadSlipTemplate,
	renderOverdueNotices,
	renderPatronOverdueSlip,
	renderReceipt,
	sampleOverdueGroups,
	slipDocument,
} from "./slips.js";

const config = parseConfig(exampleRaw()).config;
const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-slips-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const source = (
	loanId: number,
	firstName: string,
	lastName: string,
	title: string,
	dueDate: string,
	cls: [number, string] | null,
): OverdueSource => ({
	loanId,
	patronId: loanId,
	firstName,
	lastName,
	patronType: cls ? "student" : "teacher",
	groupId: cls ? cls[0] * 10 + cls[1].charCodeAt(0) - 64 : null,
	groupName: cls?.[1] ?? null,
	levelPosition: cls ? cls[0] - 1 : null,
	classLabel: cls ? `${String(cls[0])} ${cls[1]}` : null,
	title,
	author: "Collodi, Carlo",
	barcode: `2026-000${loanId}`,
	dueDate,
	lastNoticeAt: null,
});

describe("overdue notices", () => {
	it("renders one block per group with the heading and the three columns of the printout", () => {
		const groups = groupOverdues(
			[
				source(1, "Anna", "Bianchi", "Pinocchio", "2026-09-01", [1, "D"]),
				source(2, "Maria", "Colombo", "Guida <didattica>", "2026-08-01", null),
				source(3, "Maria", "Colombo", "Storia", "2026-09-10", null),
			],
			{ today: "2026-09-19", minDays: 5, labels: { teacher: "Docente", noClass: "-" } },
		);
		const job = renderOverdueNotices(config, temp(), groups, { today: "2026-09-19" });
		expect(job.count).toBe(3);
		expect(job.template).toBe("overdue-by-class");
		const html = job.html;
		expect(html).toContain("<h2>1 D - Solleciti biblioteca del 19/09/2026</h2>");
		expect(html).toContain("<h2>Docente - Solleciti biblioteca del 19/09/2026</h2>");
		expect(html.indexOf("1 D - ")).toBeLessThan(html.indexOf("Docente - "));
		expect(html).toContain("<th>Nome</th><th>Titolo</th><th>Giorni ritardo</th>");
		expect(html).toContain("<td>Anna Bianchi</td><td>Pinocchio</td><td>18</td>");
		// escaped, one row per loan
		expect(html).toContain("Guida &lt;didattica&gt;");
		expect(html.match(/<td>Maria Colombo<\/td>/g)).toHaveLength(2);
		// the margin is drawn by the sheet on every page, so a browser printing without margins
		// (the setting the labels need) still leaves the white border around the tables
		expect(html).toContain("@page { size: A4 portrait; margin: 0; }");
		expect(html).toContain(
			".sheet { padding: 15mm; box-decoration-break: clone; -webkit-box-decoration-break: clone; }",
		);
		expect(html).not.toContain('page-break"');
		expect(
			renderOverdueNotices(config, temp(), groups, { today: "2026-09-19", pageBreak: true })
				.html,
		).toContain('class="block tpl-slips-overdue-by-class page-break"');
	});

	it("the sample groups render without real data", () => {
		const job = renderOverdueNotices(config, temp(), sampleOverdueGroups("Docente"), {
			today: "2026-09-19",
		});
		expect(job.count).toBe(5);
		expect(job.html).toContain("4 D - Solleciti biblioteca del 19/09/2026");
	});
});

describe("patron slip and receipt", () => {
	const patron = {
		firstName: "Anna",
		lastName: "Bianchi",
		patronType: "student",
		classLabel: "1 D",
	};

	it("lists one patron's overdue loans", () => {
		const [group] = groupOverdues(
			[source(1, "Anna", "Bianchi", "Pinocchio", "2026-09-01", [1, "D"])],
			{ today: "2026-09-19", minDays: 0, labels: { teacher: "Docente", noClass: "-" } },
		);
		const job = renderPatronOverdueSlip(config, temp(), patron, group?.rows ?? [], {
			today: "2026-09-19",
		});
		expect(job.html).toContain(
			"<h2>Anna Bianchi (1 D) - Libri da restituire alla biblioteca</h2>",
		);
		expect(job.html).toContain(
			"<td>Pinocchio</td><td>2026-0001</td><td>01/09/2026</td><td>18</td>",
		);
	});

	it("prints the receipt of a checkout on A5", () => {
		const job = renderReceipt(
			config,
			temp(),
			{
				patron: { ...patron, patronType: "teacher" },
				rows: [
					{
						title: "Pinocchio",
						author: "Collodi, Carlo",
						barcode: "2026-00018",
						dueDate: "2026-10-12",
					},
				],
			},
			{ today: "2026-09-25" },
		);
		expect(job.html).toContain("Prestito del 25/09/2026 a <strong>Anna Bianchi</strong></p>");
		expect(job.html).toContain('<span class="author">Collodi</span>');
		expect(job.html).toContain("<td>12/10/2026</td>");
		expect(job.html).toContain("@page { size: A5 portrait; margin: 0; }");
		expect(job.html).toContain(".sheet { padding: 12mm;");
		expect(job.html).toContain("width: 148mm");
	});
	it("prints the fixed words in the installation's language (9.41)", () => {
		const en = JSON.parse(readFileSync("src/lib/i18n/en/printing.json", "utf8")) as {
			words: Record<string, string>;
		};
		const english = (key: string, params: Record<string, string>): string =>
			(en.words[key] ?? key).replace("{{date}}", params.date ?? "");
		const rows = [
			{
				title: "Pinocchio",
				author: "Collodi, Carlo",
				barcode: "2026-00018",
				dueDate: "2026-10-12",
			},
		];
		const receipt = renderReceipt(
			config,
			temp(),
			{ patron: { ...patron, patronType: "teacher" }, rows },
			{ today: "2026-09-25", words: english },
		).html;
		expect(receipt).toContain("Loan of 25/09/2026 to <strong>Anna Bianchi</strong>");
		expect(receipt).toContain("<th>Title</th><th>Code</th><th>Return by</th>");
		expect(receipt).toContain("Enjoy your reading!");
		const groups = groupOverdues(
			[source(1, "Anna", "Bianchi", "Pinocchio", "2026-09-01", [1, "D"])],
			{
				today: "2026-09-19",
				minDays: 0,
				labels: { teacher: "Teacher", noClass: "No class" },
			},
		);
		const notices = renderOverdueNotices(config, temp(), groups, {
			today: "2026-09-19",
			words: english,
		}).html;
		expect(notices).toContain("1 D - Library reminders of 19/09/2026");
		expect(notices).toContain("<th>Name</th><th>Title</th><th>Days overdue</th>");
		const slip = renderPatronOverdueSlip(config, temp(), patron, groups[0]?.rows ?? [], {
			today: "2026-09-19",
			words: english,
		}).html;
		expect(slip).toContain("Books to return to the library");
		for (const html of [receipt, notices, slip]) {
			expect(html).not.toMatch(/Titolo|Codice|Prestito del|Solleciti|Giorni|Buona lettura/);
		}
	});
});

describe("slip templates", () => {
	it("a CONFIG_DIR folder replaces a built-in; unknown fields and a wrong kind are refused", () => {
		const configDir = temp();
		const dir = join(configDir, "slips", "templates", "overdue-patron");
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "template.json"),
			JSON.stringify({
				name: "overdue-patron",
				kind: "overdue-patron",
				page: "A5 landscape",
			}),
		);
		writeFileSync(join(dir, "slip.html"), "<p>{{patron.full_name}} {{patron.card_number}}</p>");
		expect(loadSlipTemplate("overdue-patron", configDir, "overdue-patron").meta.page).toBe(
			"A5 landscape",
		);
		expect(() =>
			renderPatronOverdueSlip(
				config,
				configDir,
				{
					firstName: "A",
					lastName: "B",
					patronType: "teacher",
					classLabel: null,
				},
				[],
				{ today: "2026-09-19" },
			),
		).toThrow(/unknown field \{\{patron.card_number\}\}/);
		expect(() => loadSlipTemplate("overdue-patron", configDir, "receipt")).toThrow(
			/expected "receipt"/,
		);
		expect(() => loadSlipTemplate("nope", configDir, "receipt")).toThrow(/not found/);
		const landscape = slipDocument(
			"x",
			{ name: "x", description: "", kind: "receipt", page: "A5 landscape", marginMm: 10 },
			[],
			{ lang: "it" },
		);
		expect(landscape).toContain("width: 210mm");
	});
});
