// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { heavyResponse, isHeavyRequest, releasedWhenRead } from "./heavy.js";
import { createLimiter, heavyWork } from "./limit.js";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 1));

/** A body of `chunks` chunks, each after a tick; `fail` makes the last one an error. */
function slowBody(chunks: number, fail = false): ReadableStream<Uint8Array> {
	let sent = 0;
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			await tick();
			if (sent === chunks) {
				if (fail) {
					controller.error(new Error("disk gone"));
				} else {
					controller.close();
				}
				return;
			}
			sent++;
			controller.enqueue(new Uint8Array(1024).fill(sent));
		},
	});
}

describe("heavy requests (step 9.32)", () => {
	it("are the print sheets and the exports, not the pages that offer them", () => {
		for (const path of [
			"/print/cards",
			"/print/labels/pair",
			"/print/overdues",
			"/print/receipt",
			"/print/reports/loans-by-class",
			"/export/patrons",
			"/admin/exports/catalog",
			"/admin/exports/patron/7",
			"/admin/backups/export",
			"/admin/config/export",
		]) {
			expect(isHeavyRequest(path), path).toBe(true);
		}
		for (const path of [
			"/admin/exports",
			"/admin/exports/__data.json",
			"/admin/backups",
			"/admin/backups/download/biblioviva-20260920-1205.zip",
			"/loans/checkout",
			"/patrons/7",
		]) {
			expect(isHeavyRequest(path), path).toBe(false);
		}
	});

	it("run one at a time on the smallest hosts, in the order they came", async () => {
		// the test configuration is `small`: one heavy job at once
		expect(heavyWork.active).toBe(0);
		const order: string[] = [];
		let peak = 0;
		const sheet = (n: number): Promise<Response> =>
			heavyResponse("GET", async () => {
				peak = Math.max(peak, heavyWork.active);
				order.push(`start ${String(n)}`);
				await tick();
				return new Response(slowBody(3));
			});
		const pending = [sheet(1), sheet(2), sheet(3)];
		await pending[0];
		// the first sheet holds its slot while its body is being sent: the others wait
		await tick();
		expect(order).toEqual(["start 1"]);
		expect(heavyWork.waiting).toBe(2);
		for (const [i, response] of pending.entries()) {
			const r = await response;
			expect(order).toHaveLength(i + 1);
			expect((await r.arrayBuffer()).byteLength).toBe(3 * 1024);
		}
		expect(order).toEqual(["start 1", "start 2", "start 3"]);
		expect(peak).toBe(1);
		expect(heavyWork.active).toBe(0);
	});

	it("give the slot back on an error, a failed body, a HEAD and an empty answer", async () => {
		const limiter = createLimiter(() => 1);
		await expect(
			heavyResponse("GET", () => Promise.reject(new Error("template broken")), limiter),
		).rejects.toThrow("template broken");
		expect(limiter.active).toBe(0);

		const failing = await heavyResponse(
			"GET",
			() => Promise.resolve(new Response(slowBody(2, true))),
			limiter,
		);
		expect(limiter.active).toBe(1);
		await expect(failing.arrayBuffer()).rejects.toThrow();
		expect(limiter.active).toBe(0);

		const head = await heavyResponse(
			"HEAD",
			() => Promise.resolve(new Response(slowBody(2))),
			limiter,
		);
		expect(head.body).not.toBeNull();
		expect(limiter.active).toBe(0);

		await heavyResponse(
			"GET",
			() => Promise.resolve(new Response(null, { status: 303 })),
			limiter,
		);
		expect(limiter.active).toBe(0);
	});

	it("keep the status and the headers of the answer", async () => {
		const limiter = createLimiter(() => 1);
		const response = await heavyResponse(
			"GET",
			() =>
				Promise.resolve(
					new Response("<p>sheet</p>", {
						status: 201,
						headers: { "Content-Type": "text/html", "X-Cards-Count": "4" },
					}),
				),
			limiter,
		);
		expect(response.status).toBe(201);
		expect(response.headers.get("X-Cards-Count")).toBe("4");
		expect(await response.text()).toBe("<p>sheet</p>");
		expect(limiter.active).toBe(0);
	});

	it("give the slot back when the browser goes away in the middle of a download", async () => {
		const limiter = createLimiter(() => 1);
		let cancelled = false;
		const endless = new ReadableStream<BufferSource>({
			async pull(controller) {
				await tick();
				controller.enqueue(new Uint8Array(64 * 1024));
			},
			cancel() {
				cancelled = true;
			},
		});
		const server = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			fetch: (request) =>
				heavyResponse(
					request.method,
					// as the server hook does: compressed after the slot was taken
					() => new Response(endless.pipeThrough(new CompressionStream("gzip"))),
					limiter,
				),
		});
		try {
			const abort = new AbortController();
			const response = await fetch(server.url, { signal: abort.signal });
			const reader = response.body?.getReader();
			await reader?.read();
			expect(limiter.active).toBe(1);
			abort.abort();
			for (let i = 0; i < 200 && limiter.active > 0; i++) {
				await tick();
			}
			expect(limiter.active).toBe(0);
			expect(cancelled).toBe(true);
		} finally {
			await server.stop(true);
		}
	});

	it("give the slot back once, whatever ends the body", async () => {
		let released = 0;
		const body = releasedWhenRead(slowBody(1), () => released++);
		const reader = body.getReader();
		await reader.read();
		await reader.cancel();
		expect(released).toBe(1);
		// the limiter's own release does nothing the second time
		const limiter = createLimiter(() => 1);
		const release = await limiter.acquire();
		release();
		release();
		expect(limiter.active).toBe(0);
	});
});
