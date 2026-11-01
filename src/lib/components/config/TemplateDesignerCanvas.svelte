<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The designer's canvas (steps 11.10, 11.16): the face as printing renders it (a preview frame
     without scripts, read by the page to measure where each element is drawn) with the boxes of
     the elements over it and the grid they snap to; a box is chosen with a click, moved by
     dragging it or with the arrow keys (one step of the grid, Shift: about 5 mm), resized from its corner
     handle, removed with Canc. Elements that the files
     do not place are drawn where the preview shows them, with a dotted outline. -->
<script lang="ts">
	import Overlay from "#lib/ui/Overlay.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import type { DesignElement } from "#lib/shared/template-design.js";
	import { fontOf, hexColor } from "#lib/shared/template-style.js";
	import { gridLines, type Measure, type TemplateDesigner } from "./template-designer.svelte.js";

	interface Props {
		designer: TemplateDesigner;
		/** The preview document of the face (cards) or of the whole unit (labels). */
		html: string;
		/** Pixels per millimetre of the preview. */
		scale: number;
		/** Height of the preview document in mm (the whole unit for labels). */
		documentHeightMm: number;
		describe: (e: DesignElement) => string;
	}

	const { designer, html, scale, documentHeightMm, describe }: Props = $props();
	const i18n = useI18n();
	const size = $derived(designer.size);
	let frame = $state<HTMLIFrameElement | null>(null);
	const GRID_LINE = "color-mix(in oklab, var(--color-primary-500) 22%, transparent)";
	/** The margin inside a card's edge kept free of what must not be cut (9.27). */
	const SAFE_MM = 2;
	/** The lines drawn: every step of the grid, or every few steps when they would be too dense. */
	const columns = $derived(gridLines(size.widthMm, designer.grid, scale));
	const rows = $derived(gridLines(size.heightMm, designer.grid, scale));
	let loads = $state(0);

	function rgbHex(value: string): string | null {
		const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
		return m
			? `#${[m[1], m[2], m[3]].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`
			: hexColor(value);
	}

	function looks(cs: CSSStyleDeclaration): Measure["style"] {
		const align = cs.textAlign;
		return {
			fontSizePt: Math.round(Number.parseFloat(cs.fontSize) * 0.75 * 10) / 10,
			bold: Number(cs.fontWeight) >= 600,
			italic: cs.fontStyle === "italic" || cs.fontStyle.startsWith("oblique"),
			uppercase: cs.textTransform === "uppercase",
			align:
				align === "center"
					? "center"
					: align === "right" || align === "end"
						? "right"
						: "left",
			font: fontOf(cs.fontFamily),
			color: rgbHex(cs.color),
		};
	}

	/** Where the preview draws each element of the face shown, in mm from the face's corner. */
	function measure(): void {
		const doc = frame?.contentDocument;
		if (!doc) {
			return;
		}
		const origin =
			designer.kind === "cards"
				? doc.querySelector(".face")
				: doc.querySelector(`.cell[data-cell="${size.cell + 1}"]`);
		if (!origin) {
			return;
		}
		const o = origin.getBoundingClientRect();
		const k = o.width / size.widthMm;
		if (!(k > 0)) {
			return;
		}
		const out: Record<string, Measure> = {};
		for (const el of origin.querySelectorAll<HTMLElement>("[data-bv]")) {
			const r = el.getBoundingClientRect();
			const id = el.dataset.bv ?? "";
			out[id] = {
				x: (r.left - o.left) / k,
				y: (r.top - o.top) / k,
				w: r.width / k,
				h: r.height / k,
				style: looks(getComputedStyle(el)),
			};
		}
		designer.measured = out;
	}

	$effect(() => {
		// again when the document loads and when another face of it is shown
		if (loads >= 0 && designer.face >= 0) {
			measure();
		}
	});

	let drag: {
		id: string;
		mode: "move" | "resize";
		startX: number;
		startY: number;
		x: number;
		y: number;
		w: number;
		h: number;
	} | null = null;

	function down(e: PointerEvent, el: DesignElement, mode: "move" | "resize"): void {
		e.preventDefault();
		e.stopPropagation();
		designer.selectedId = el.id;
		const b = designer.box(el);
		if (!b) {
			return;
		}
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { id: el.id, mode, startX: e.clientX, startY: e.clientY, ...b };
	}

	function move(e: PointerEvent): void {
		if (!drag) {
			return;
		}
		const dx = (e.clientX - drag.startX) / scale;
		const dy = (e.clientY - drag.startY) / scale;
		if (drag.mode === "move") {
			designer.moveTo(drag.id, drag.x + dx, drag.y + dy);
		} else {
			designer.resizeTo(drag.id, drag.w + dx, drag.h + dy);
		}
	}

	function up(): void {
		drag = null;
	}

	function key(e: KeyboardEvent, el: DesignElement): void {
		const step = e.shiftKey ? 5 : designer.step;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step],
		};
		const m = moves[e.key];
		if (m) {
			e.preventDefault();
			designer.moveBy(el.id, m[0], m[1]);
		} else if (e.key === "Delete") {
			e.preventDefault();
			designer.remove(el.id);
		}
	}
</script>

<!-- a region reachable with the keyboard: it scrolls at high zoom -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="max-w-full overflow-auto rounded-base bg-surface-200 p-3"
	role="region"
	aria-label={i18n.t("config.designer.design")}
	tabindex="0"
	data-testid="designer-canvas"
>
	<div
		class="relative mx-auto overflow-hidden bg-white shadow-[var(--bv-shadow-card)]"
		style="width:{size.widthMm * scale}px;height:{size.heightMm * scale}px"
		role="presentation"
		onpointerdown={() => (designer.selectedId = null)}
	>
		<iframe
			bind:this={frame}
			title={i18n.t("config.designer.preview")}
			srcdoc={html}
			sandbox="allow-same-origin"
			class="pointer-events-none absolute left-0 border-0"
			style="top:{-size.offsetMm * scale}px;width:{size.widthMm *
				scale}px;height:{documentHeightMm * scale}px"
			onload={() => loads++}
		></iframe>
		{#if designer.grid > 0}
			<Overlay data-testid="designer-grid">
				<svg class="size-full" shape-rendering="crispEdges" aria-hidden="true">
					{#each columns as x (x)}
						<line x1={x} x2={x} y1="0" y2="100%" stroke={GRID_LINE} data-axis="x" />
					{/each}
					{#each rows as y (y)}
						<line x1="0" x2="100%" y1={y} y2={y} stroke={GRID_LINE} data-axis="y" />
					{/each}
				</svg>
			</Overlay>
		{/if}
		{#if designer.kind === "cards"}
			<!-- the safe area (9.27): what lies closer to the edge may be cut on a sheet printed
			     on both sides, where the back can move by a millimetre -->
			<div
				class="pointer-events-none absolute border border-dashed border-warning-500"
				style="inset:{SAFE_MM * scale}px"
				title={i18n.t("config.designer.safeArea")}
				data-testid="designer-safe-area"
			></div>
		{/if}
		{#each designer.elements as el (el.id)}
			{@const b = designer.box(el)}
			{@const chosen = el.id === designer.selectedId}
			{#if b}
				<div
					role="button"
					tabindex="0"
					aria-label={describe(el)}
					aria-pressed={chosen}
					class="absolute cursor-move touch-none outline-offset-0 {chosen
						? 'z-10 outline-2 outline-primary-500'
						: el.placed
							? 'outline-1 outline-primary-400/70 outline-dashed hover:outline-2 hover:outline-primary-500'
							: 'outline-1 outline-warning-500/80 outline-dotted hover:outline-2 hover:outline-primary-500'}"
					style="left:{b.x * scale}px;top:{b.y * scale}px;width:{Math.max(
						b.w * scale,
						4,
					)}px;height:{Math.max(b.h * scale, 4)}px"
					onpointerdown={(e) => down(e, el, "move")}
					onpointermove={move}
					onpointerup={up}
					onpointercancel={up}
					onkeydown={(e) => key(e, el)}
					onfocus={() => (designer.selectedId = el.id)}
					data-testid="designer-element"
					data-id={el.id}
					data-placed={el.placed}
				>
					{#if chosen}
						<span
							class="absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-sm bg-primary-500 hover:bg-primary-700"
							role="presentation"
							onpointerdown={(e) => down(e, el, "resize")}
							onpointermove={move}
							onpointerup={up}
							onpointercancel={up}
							data-testid="designer-resize"
						></span>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
</div>
