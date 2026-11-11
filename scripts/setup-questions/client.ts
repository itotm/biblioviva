// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-non-null-assertion -- the elements the script itself has just written, and the keys of its own lookups */
// The installation questions in the page (PLAN.md step 8.7): bundled by `bun run site:build` into
// `/assets/setup-questions.js` and run on the first page of Installazione. The page carries the data it
// needs in `#setup-questions-data` (the language, the path pages that exist, the compose files); without
// JavaScript the box stays empty and the table of the paths below it is the way in.
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
	steps,
	visible,
	type Answers,
	type Option,
	type Question,
} from "./logic.ts";
import { TEXTS, type SetupLang } from "./texts.ts";

interface PageData {
	lang: SetupLang;
	/** The path pages of the site: slug → its address and the address of each step by its file name. */
	paths: Record<string, { url: string; steps: Record<string, string> }>;
	files: { compose: string; composeLan: string; serve: string };
}

const root = document.getElementById("setup-questions");
const dataEl = document.getElementById("setup-questions-data");
if (root && dataEl) {
	start(root, JSON.parse(dataEl.textContent ?? "{}") as PageData);
}

function start(root: HTMLElement, data: PageData): void {
	const T = TEXTS[data.lang];
	const t = (key: string, vars: Record<string, string | number> = {}): string =>
		(T[key] ?? key).replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ""));
	const esc = (s: string): string =>
		s.replace(
			/[&<>"]/g,
			(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
		);
	const icon = (name: string): string =>
		`<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;

	let answers: Answers = decode(location.hash);

	root.innerHTML = `<div class="sq-progress" aria-hidden="true"><div></div></div><p class="sq-count" aria-live="polite"></p><div class="sq-list"></div><button type="button" class="btn btn-ghost sq-reset">${icon("rotate-ccw")} ${esc(t("ui.restart"))}</button><section class="sq-result" aria-live="polite" aria-label="${esc(t("r.title"))}"></section>`;
	const list = root.querySelector<HTMLElement>(".sq-list")!;
	const result = root.querySelector<HTMLElement>(".sq-result")!;
	const bar = root.querySelector<HTMLElement>(".sq-progress > div")!;
	const count = root.querySelector<HTMLElement>(".sq-count")!;

	root.querySelector(".sq-reset")!.addEventListener("click", () => {
		answers = normalise({});
		save();
		render();
		list.querySelector<HTMLSelectElement>("select:not(:disabled)")?.focus();
	});
	root.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-copy]");
		if (!btn) {
			return;
		}
		const pre = document.getElementById(btn.dataset.copy!);
		if (pre) {
			void navigator.clipboard.writeText(pre.textContent ?? "").then(() => {
				btn.lastChild!.textContent = ` ${t("r.copied")}`;
				setTimeout(() => (btn.lastChild!.textContent = ` ${t("r.copy")}`), 1500);
			});
		}
	});

	function save(): void {
		const hash = encode(answers);
		history.replaceState(null, "", hash ? `#${hash}` : location.pathname);
	}

	function optionLabel(q: Question, o: Option): string {
		const label = t(`o.${q.id}.${o.label ?? o.v}`);
		return o.recommended ? `${label} ${t("ui.recommended")}` : label;
	}

	function renderQuestions(): void {
		const shown = visible(answers);
		let activeSeen = false;
		let done = 0;
		list.innerHTML = "";
		shown.forEach((q, i) => {
			const auto = q.auto?.(answers) ?? null;
			const value = answers[q.id];
			const state = auto ? "auto" : value ? "done" : activeSeen ? "waiting" : "active";
			if (state === "active") {
				activeSeen = true;
			}
			if (value) {
				done += 1;
			}
			const options = q.options(answers);
			const chosen = options.find((o) => o.v === value);
			const box = document.createElement("div");
			box.className = `sq-q sq-${state}`;
			const num =
				state === "done" ? icon("check") : state === "auto" ? icon("lock") : String(i + 1);
			const placeholder = value
				? ""
				: `<option value="">${esc(t(state === "waiting" ? "ui.waiting" : "ui.choose"))}</option>`;
			box.innerHTML = `<div class="sq-num">${num}</div><div class="sq-body">
				<label class="sq-title" for="sq-${q.id}">${esc(t(`q.${q.id}.title`))}${q.expert ? ` <span class="sq-chip sq-expert">${esc(t("ui.expert"))}</span>` : ""}${state === "auto" ? ` <span class="sq-chip">${esc(t("ui.auto"))}</span>` : ""}</label>
				<p class="sq-help" id="sq-${q.id}-help">${esc(t(`q.${q.id}.help`))}</p>
				<select id="sq-${q.id}" aria-describedby="sq-${q.id}-help"${state === "waiting" || state === "auto" ? " disabled" : ""}>${placeholder}${options
					.map(
						(o) =>
							`<option value="${o.v}"${o.v === value ? " selected" : ""}${o.disabled ? " disabled" : ""}>${esc(optionLabel(q, o))}</option>`,
					)
					.join("")}</select>
				${state === "auto" ? `<p class="sq-note sq-lock">${icon("lock")}<span>${esc(t(`q.${q.id}.auto`))}</span></p>` : ""}
				${chosen?.note ? `<p class="sq-note sq-info">${icon("info")}<span>${esc(t(`n.${q.id}.${chosen.note}`))}</span></p>` : ""}
				${chosen?.warn ? `<p class="sq-note sq-warn">${icon("triangle-alert")}<span>${esc(t(`w.${q.id}.${chosen.warn}`))}</span></p>` : ""}
			</div>`;
			box.querySelector("select")!.addEventListener("change", (e) => {
				const v = (e.target as HTMLSelectElement).value;
				answers = normalise({ ...answers, [q.id]: v || undefined });
				save();
				render();
				const next = list.querySelector<HTMLSelectElement>(".sq-active select");
				if (next) {
					next.focus({ preventScroll: true });
					next.closest(".sq-q")!.scrollIntoView({ behavior: "smooth", block: "nearest" });
				}
			});
			list.appendChild(box);
		});
		const total = shown.length;
		bar.style.width = `${complete(answers) ? 100 : Math.round((done / (total + 2)) * 100)}%`;
		count.textContent = t("ui.progress", { done, total });
	}

	function duration(minutes: number): string {
		if (minutes < 60) {
			return t("r.about", { t: t("r.timeMin", { m: minutes }) });
		}
		const h = Math.floor(minutes / 60);
		const rest = minutes % 60;
		const hours = h === 1 ? t("r.timeHour") : t("r.timeHours", { h });
		const part =
			rest >= 45
				? "r.threeQuarters"
				: rest >= 25
					? "r.half"
					: rest >= 15
						? "r.quarter"
						: null;
		return t("r.about", { t: part ? t("r.timeAnd", { a: hours, b: t(part) }) : hours });
	}

	function title(): string | null {
		const a = answers;
		const n = network(a);
		let where: string | null = null;
		if (a.host === "rpi") {
			where = t("where.rpi");
		} else if (a.host === "oldpc" && a.os) {
			where = t(a.os === "win" ? "where.oldpc.win" : "where.oldpc");
		} else if (a.host === "banco") {
			where = t(
				a.os === "win"
					? "where.banco.win"
					: a.os === "linux"
						? "where.banco.linux"
						: "where.banco",
			);
		}
		if (!where) {
			return null;
		}
		return n ? t(`via.${n}`, { w: where }) : where;
	}

	function pre(id: string, label: string, text: string): string {
		return `<div class="sq-file"><div class="sq-file-head"><code>${esc(label)}</code><button type="button" class="sq-copy" data-copy="${id}">${icon("copy")}<span> ${esc(t("r.copy"))}</span></button></div><pre id="${id}"><code>${esc(text)}</code></pre></div>`;
	}

	function howToInstall(): string {
		const a = answers;
		const p = pkg(a);
		const prof = profile(a);
		const n = network(a);
		if (!p || !prof || !n) {
			return "";
		}
		const way = n === "tailscale" ? "tailscale" : "lan";
		if (p === "docker") {
			const env = [
				`BIBLIOVIVA_NETWORK=${way}`,
				way === "tailscale" ? `TS_AUTHKEY=        # ${t("i.env.key")}` : "TS_AUTHKEY=",
				"LAN_PORT=8080",
				`MEM_LIMIT=${memLimit(prof)}`,
				"BIBLIOVIVA_IMAGE=ghcr.io/itotm/biblioviva:latest",
				"LOG_LEVEL=info",
			].join("\n");
			const commands = [
				`mkdir -p ~/biblioviva/config ~/biblioviva/backups${way === "tailscale" ? " ~/biblioviva/tailscale" : ""}`,
				"cd ~/biblioviva",
				"chmod 600 .env",
				"sudo chown -R 1000:1000 config backups",
				a.backup === "cloud"
					? "docker compose --profile offsite up -d"
					: "docker compose up -d",
			].join("\n");
			const files = [
				pre(
					"sq-f-compose",
					"compose.yml",
					way === "tailscale" ? data.files.compose : data.files.composeLan,
				),
				way === "tailscale"
					? pre("sq-f-serve", "tailscale/serve.json", data.files.serve)
					: "",
				pre("sq-f-env", ".env", env),
				pre("sq-f-perf", "config/performance.json", `{ "profile": "${prof}" }`),
				pre("sq-f-cmd", t("i.commands"), commands),
			].join("");
			return `<div class="sq-sec"><h3>${esc(t("i.docker"))}</h3><p class="sq-small">${esc(t("i.docker.lead"))}</p>${pre("sq-f-setup", "bash", `curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash -s -- --lang ${data.lang} --network ${way} --profile ${prof}`)}<details class="sq-manual"><summary>${icon("file-code")} ${esc(t("i.manual"))}</summary><p class="sq-small">${esc(t("i.manual.lead"))}</p>${files}</details></div>`;
		}
		if (p === "deb") {
			const arch = a.host === "rpi" ? "arm64" : "amd64";
			return `<div class="sq-sec"><h3>${esc(t("i.deb"))}</h3>${pre("sq-f-deb", "bash", `sudo apt install ./biblioviva_0.9.0_${arch}.deb\nsudo biblioviva setup --network ${way} --profile ${prof}`)}</div>`;
		}
		const netName = t(`net.${n}`);
		return `<div class="sq-sec"><h3>${esc(t("i.answers"))}</h3><ul class="sq-list-plain"><li>${esc(t("i.answers.network"))}: <b>${esc(netName)}</b></li><li>${esc(t("i.answers.profile"))}: <b>${prof}</b></li><li>${esc(t("i.answers.port"))}: <b>8080</b></li></ul></div>`;
	}

	function renderResult(): void {
		const a = answers;
		const head = title();
		if (!head) {
			result.innerHTML = `<p class="sq-r-title">${esc(t("r.title"))}</p><p class="sq-small">${esc(t("r.empty"))}</p>`;
			return;
		}
		const p = pkg(a);
		const n = network(a);
		const prof = profile(a);
		const addr = address(a);
		const slug = pathSlug(a);
		const path = slug ? data.paths[slug] : undefined;
		const st = steps(a);
		const total = st.reduce((s, x) => s + x.minutes, 0);
		const done = complete(a);
		const caps = capabilities(a)
			.map((c) => {
				const label =
					c.key === "deskOff" && p === "appimage"
						? "cap.deskOff.appimage"
						: `cap.${c.key}`;
				const ico = c.state === "ok" ? "check" : c.state === "no" ? "x" : "triangle-alert";
				return `<li class="sq-cap sq-${c.state}"><span>${esc(t(label))}</span><b>${icon(ico)} ${esc(t(`st.${c.text}`))}</b></li>`;
			})
			.join("");
		const stepItems = st
			.map((s) => {
				const url = path?.steps[s.step];
				const text = esc(t(`step.${s.title}`));
				return `<li>${url ? `<a href="${url}">${text}</a>` : text} <small>${esc(t("r.minutes", { n: s.minutes }))}</small></li>`;
			})
			.join("");
		const fact = (k: string, v: string | null): string =>
			`<dt>${esc(t(k))}</dt><dd>${v ?? "—"}</dd>`;
		result.innerHTML = `<p class="sq-r-title">${esc(head)}</p>
			<p class="sq-small">${esc(t(done ? "r.complete" : "r.incomplete"))}</p>
			<dl class="sq-facts">
				${fact("r.package", p ? esc(t(`pkg.${p}`)) : null)}
				${fact("r.network", n ? esc(t(`net.${n}`)) : null)}
				${fact("r.address", addr ? `<code>${esc(addr)}</code>` : null)}
				${fact("r.profile", prof)}
				${st.length ? fact("r.time", `${esc(duration(total))} <span class="sq-chip">${esc(t("r.estimate"))}</span>`) : ""}
			</dl>
			${caps ? `<div class="sq-sec"><h3>${esc(t("r.works"))}</h3><ul class="sq-caps">${caps}</ul></div>` : ""}
			${stepItems ? `<div class="sq-sec"><h3>${esc(t("r.steps"))}</h3><ol class="sq-steps">${stepItems}</ol></div>` : ""}
			${howToInstall()}
			${
				p
					? `<div class="sq-sec"><h3>${esc(t("r.material"))}</h3><ul class="sq-list-plain">${material(
							a,
						)
							.map((m) => `<li>${esc(t(`material.${m}`))}</li>`)
							.join("")}</ul></div>`
					: ""
			}
			<div class="sq-actions">
				${path ? `<a class="btn btn-primary${done ? "" : " sq-off"}" href="${path.url}"${done ? "" : ' aria-disabled="true" tabindex="-1"'}>${icon("route")} ${esc(t("r.open"))}</a>` : slug && done ? `<p class="sq-note sq-info">${icon("info")}<span>${esc(t("r.notYet"))}</span></p>` : ""}
				<button type="button" class="btn btn-ghost sq-print">${icon("printer")} ${esc(t("r.print"))}</button>
			</div>`;
		result.querySelector(".sq-print")!.addEventListener("click", () => window.print());
	}

	function render(): void {
		renderQuestions();
		renderResult();
	}

	answers = normalise(answers);
	render();
}
