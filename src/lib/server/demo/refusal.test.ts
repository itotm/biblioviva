// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { demoRefusalResponse, refusalHtml } from "./refusal.js";

const page = { lang: "it", title: "Non disponibile nella demo", back: "Torna a BiblioViva" };
const html = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8";

describe("the answers of the public demo to what it refuses", () => {
	it("gives a remote function SvelteKit's error shape, marked demo", async () => {
		const answer = demoRefusalResponse(403, { remote: true, accept: html }, "Spento", page);
		expect(answer.status).toBe(403);
		expect(answer.headers.has("Retry-After")).toBe(false);
		expect(await answer.json()).toEqual({
			type: "error",
			error: { message: "Spento", demo: true },
		});
	});

	it("gives a page opened on its own the app's page of a refusal, without a status number", async () => {
		const answer = demoRefusalResponse(429, { remote: false, accept: html }, "Troppe", page);
		expect(answer.status).toBe(429);
		expect(answer.headers.get("Retry-After")).toBe("60");
		expect(answer.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(answer.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
		const body = await answer.text();
		expect(body).toContain("<h1>Non disponibile nella demo</h1>");
		expect(body).toContain('<a href="/">Torna a BiblioViva</a>');
		expect(body).not.toMatch(/\b(403|429|500)\b/);
	});

	it("gives anything else the plain text", async () => {
		const answer = demoRefusalResponse(403, { remote: false, accept: "*/*" }, "Spento", page);
		expect(answer.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
		expect(await answer.text()).toBe("Spento");
	});

	it("escapes what it writes in the page", () => {
		const body = refusalHtml('<b>"x"</b> & y', { ...page, lang: 'it"' });
		expect(body).toContain("&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; y");
		expect(body).toContain('lang="it&quot;"');
	});
});
