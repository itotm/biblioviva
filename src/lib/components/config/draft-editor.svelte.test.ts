// SPDX-License-Identifier: GPL-3.0-or-later
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";
import { toaster } from "#lib/ui/toaster.js";
import { DraftEditor } from "./draft-editor.svelte.js";

describe("DraftEditor", () => {
	it("is dirty only after a load, when the draft differs from what was marked", () => {
		const state = $state({ list: [1, 2] });
		const editor = new DraftEditor(() => state.list);
		expect(editor.dirty).toBe(false);
		state.list.push(3);
		expect(editor.dirty).toBe(false);
		editor.mark();
		expect(editor.dirty).toBe(false);
		state.list.pop();
		expect(editor.dirty).toBe(true);
		state.list.push(3);
		expect(editor.dirty).toBe(false);
	});

	it("marks the draft saved and runs `after` when the save succeeds", async () => {
		const state = $state({ value: "a" });
		const editor = new DraftEditor(() => state.value);
		editor.mark();
		state.value = "b";
		const after = vi.fn();
		let resolve: ((r: { ok: true }) => void) | undefined;
		const running = editor.save(
			() =>
				new Promise<{ ok: true }>((r) => {
					resolve = r;
				}),
			"saved",
			after,
		);
		expect(editor.saving).toBe(true);
		resolve?.({ ok: true });
		await running;
		expect(editor.saving).toBe(false);
		expect(editor.dirty).toBe(false);
		expect(editor.problem).toBeNull();
		expect(after).toHaveBeenCalledOnce();
	});

	it("keeps the problems of a refused save, joined, and stays dirty", async () => {
		const state = $state({ value: "a" });
		const editor = new DraftEditor(() => state.value);
		editor.mark();
		state.value = "b";
		const after = vi.fn();
		await editor.save(
			() =>
				Promise.resolve({ ok: false, issues: [{ path: "x.y", message: "bad" }, "other"] }),
			"saved",
			after,
		);
		expect(editor.problem).toBe("x.y: bad; other");
		expect(editor.failure).toEqual({ issues: ["x.y: bad", "other"], inUse: [] });
		expect(editor.dirty).toBe(true);
		expect(editor.saving).toBe(false);
		expect(after).not.toHaveBeenCalled();
		await editor.save(() => Promise.resolve({ ok: true }), "saved");
		expect(editor.problem).toBeNull();
		expect(editor.failure).toBeNull();
	});

	it("keeps the whole refusal: what is in use and the extras of the flow", async () => {
		interface Refusal {
			ok: false;
			issues: { path: string; message: string }[];
			inUse: { kind: "itemType"; code: string; count: number }[];
			plan: { removed: string[] } | null;
		}
		const state = $state({ value: "a" });
		const editor = new DraftEditor<string, Refusal>(() => state.value);
		editor.mark();
		state.value = "b";
		const refusal: Refusal = {
			ok: false,
			issues: [],
			inUse: [{ kind: "itemType", code: "dvd", count: 2 }],
			plan: { removed: ["dvd"] },
		};
		await editor.save(() => Promise.resolve(refusal), "saved");
		expect(editor.failure).toEqual({
			issues: [],
			inUse: [{ kind: "itemType", code: "dvd", count: 2 }],
			plan: { removed: ["dvd"] },
		});
		// nothing to write as a line: the block shows what is in use, or the plan
		expect(editor.problem).toBeNull();
		editor.fail({ ...refusal, issues: [{ path: "p", message: "m" }], inUse: [], plan: null });
		expect(editor.failure).toEqual({ issues: ["p: m"], inUse: [], plan: null });
		expect(editor.problem).toBe("p: m");
	});

	it("makes the toast from the answer when asked to", async () => {
		const success = vi.spyOn(toaster, "success").mockImplementation(() => undefined);
		const state = $state({ value: "a" });
		const editor = new DraftEditor(() => state.value);
		editor.mark();
		state.value = "b";
		const after = vi.fn();
		await editor.save(
			() => Promise.resolve({ ok: true as const, moved: 3 }),
			(r) => ({ title: "saved", description: `moved ${String(r.moved)}` }),
			after,
		);
		expect(success).toHaveBeenCalledWith({ title: "saved", description: "moved 3" });
		expect(after).toHaveBeenCalledWith({ ok: true, moved: 3 });
		success.mockRestore();
	});

	it("loads once when the data arrives", () => {
		const state = $state<{ data: number[] | undefined; list: number[] }>({
			data: undefined,
			list: [],
		});
		const editor = new DraftEditor(() => state.list);
		const load = vi.fn(() => {
			state.list = [...(state.data ?? [])];
			editor.mark();
		});
		const stop = $effect.root(() => {
			editor.loadWhenReady(() => state.data !== undefined, load);
		});
		flushSync();
		expect(load).not.toHaveBeenCalled();
		state.data = [1];
		flushSync();
		expect(load).toHaveBeenCalledOnce();
		expect(state.list).toEqual([1]);
		state.list.push(2);
		expect(editor.dirty).toBe(true);
		state.data = [5];
		flushSync();
		expect(load).toHaveBeenCalledOnce();
		stop();
	});
});
