<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	A class picture with its photo frames (PLAN.md step 13.3): numbered outlines over the picture,
	in the picture's own pixels (an SVG with its size as viewBox, scaled with the image). In
	`edit` mode a tap selects a frame and its corners can be dragged (released: `onmove`): on a
	photo each corner on its own, following the perspective; on a scan the frame stays a rectangle,
	a corner resizes it (the opposite one fixed) and the handle above it turns it. The handles are
	rings over the picture, the frame's line hidden inside them, with a wider touch area than they
	show. In `draw` mode a drag draws a new upright frame (`onadd`). Frames already saved, and the
	frames of removed patrons (erased: painted over in the picture, Q106), cannot change.
-->
<script lang="ts" module>
	/**
	 * How wide the picture is shown: never taller than the screen, so the whole picture stays in
	 * view while correcting, below the page's buttons of the frames. The page lines its buttons up
	 * with the picture's edges through it.
	 */
	export function pictureMaxWidth(width: number, height: number): string {
		return `min(100%, calc((100dvh - 15.5rem) * ${width / height}))`;
	}
</script>

<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import {
		resizeCorner,
		rotateTowards,
		rotationHandle,
		type SheetKind,
	} from "#lib/shared/sheet-frames.js";
	import { rectQuad, type Point, type Quad } from "#lib/shared/geometry.js";

	interface SheetFrame {
		id: number;
		position: number;
		corners: Quad;
		state: "pending" | "ignored" | "saved" | "erased";
		patronId: number | null;
	}

	interface Props {
		src: string;
		width: number;
		height: number;
		frames: readonly SheetFrame[];
		/** A photo (corners free) or a scan (turned rectangles). */
		kind?: SheetKind;
		mode?: "view" | "edit" | "draw";
		selected?: number | null;
		alt: string;
		onselect?: (id: number | null) => void;
		onmove?: (id: number, corners: Quad) => void;
		onadd?: (corners: Quad) => void;
	}

	let {
		src,
		width,
		height,
		frames,
		kind = "photo",
		mode = "view",
		selected = $bindable(null),
		alt,
		onselect,
		onmove,
		onadd,
	}: Props = $props();

	const i18n = useI18n();
	const uid = $props.id();
	/** The handle that turns a scan's frame, after the four corners. */
	const ROTATE = 4;

	let svg = $state<SVGSVGElement>();
	// the corners being dragged, before they are sent; `from` as they were when the drag began
	let dragging = $state<{ id: number; index: number; from: Quad; corners: Quad } | null>(null);
	let drawing = $state<{ from: Point; to: Point } | null>(null);

	// sizes in picture pixels that look the same at any picture size
	const unit = $derived(Math.max(width, height) / 100);
	const handleRadius = $derived(unit * 1.1);
	const handleStroke = $derived(unit * 0.4);

	function toPicture(e: PointerEvent): Point {
		const rect = svg?.getBoundingClientRect();
		if (!rect || rect.width === 0) {
			return { x: 0, y: 0 };
		}
		return {
			x: Math.max(0, Math.min(width, ((e.clientX - rect.left) / rect.width) * width)),
			y: Math.max(0, Math.min(height, ((e.clientY - rect.top) / rect.height) * height)),
		};
	}

	const cornersOf = (f: SheetFrame): Quad =>
		dragging?.id === f.id ? dragging.corners : f.corners;
	const points = (q: Quad): string => q.map((p) => `${p.x},${p.y}`).join(" ");
	/**
	 * Where a frame's number sits: on its first corner; while it is being corrected, just outside
	 * that corner, so the handle there and the face stay in view.
	 */
	function labelOf(q: Quad, editing: boolean): Point {
		if (!editing) {
			return q[0];
		}
		const centre = {
			x: q.reduce((s, p) => s + p.x, 0) / 4,
			y: q.reduce((s, p) => s + p.y, 0) / 4,
		};
		const away = { x: q[0].x - centre.x, y: q[0].y - centre.y };
		const length = Math.hypot(away.x, away.y) || 1;
		return {
			x: q[0].x + (away.x / length) * unit * 4,
			y: q[0].y + (away.y / length) * unit * 4,
		};
	}
	/** The corners and, on a scan, the turning handle of the selected frame. */
	const handlesOf = (q: Quad): Point[] =>
		kind === "scan" ? [...q, rotationHandle(q, unit * 5)] : [...q];

	function pick(f: SheetFrame): void {
		if (mode !== "edit" || f.state === "saved" || f.state === "erased") {
			return;
		}
		selected = f.id;
		onselect?.(f.id);
	}

	function startHandle(f: SheetFrame, index: number, e: PointerEvent): void {
		e.stopPropagation();
		const from = [...f.corners] as Quad;
		dragging = { id: f.id, index, from, corners: from };
		svg?.setPointerCapture(e.pointerId);
	}

	function onDown(e: PointerEvent): void {
		if (mode !== "draw") {
			return;
		}
		const p = toPicture(e);
		drawing = { from: p, to: p };
		svg?.setPointerCapture(e.pointerId);
	}

	function onMove(e: PointerEvent): void {
		if (dragging) {
			const p = toPicture(e);
			let next: Quad;
			if (dragging.index === ROTATE) {
				next = rotateTowards(dragging.from, p);
			} else if (kind === "scan") {
				next = resizeCorner(dragging.from, dragging.index, p);
			} else {
				next = [...dragging.from] as Quad;
				next[dragging.index] = p;
			}
			dragging = { ...dragging, corners: next };
		} else if (drawing) {
			drawing = { ...drawing, to: toPicture(e) };
		}
	}

	function onUp(): void {
		if (dragging) {
			const { id, from, corners } = dragging;
			dragging = null;
			if (corners.some((p, i) => p.x !== from[i]?.x || p.y !== from[i]?.y)) {
				onmove?.(id, corners);
			}
		} else if (drawing) {
			const { from, to } = drawing;
			drawing = null;
			// a tap is not a frame: at least 2 % of the picture each way
			if (Math.abs(to.x - from.x) > 2 * unit && Math.abs(to.y - from.y) > 2 * unit) {
				onadd?.(rectQuad(from, to));
			}
		}
	}

	function stroke(f: SheetFrame): string {
		if (f.id === selected && mode === "edit") {
			return "var(--color-warning-500)";
		}
		return f.state === "saved"
			? "var(--color-success-500)"
			: f.state === "ignored" || f.state === "erased"
				? "var(--color-surface-400)"
				: f.patronId !== null
					? "var(--color-primary-500)"
					: "var(--color-secondary-500)";
	}
</script>

<div
	class="relative mx-auto w-full select-none"
	style:max-width={pictureMaxWidth(width, height)}
	data-testid="sheet-picture"
	data-kind={kind}
>
	<img {src} {alt} {width} {height} class="block h-auto w-full rounded-base" draggable="false" />
	<svg
		bind:this={svg}
		class="overlay-fill {mode === 'draw'
			? 'cursor-crosshair touch-none'
			: mode === 'edit'
				? 'touch-none'
				: 'pointer-events-none'}"
		viewBox="0 0 {width} {height}"
		role="application"
		aria-label={alt}
		onpointerdown={onDown}
		onpointermove={onMove}
		onpointerup={onUp}
		onpointercancel={onUp}
		data-testid="sheet-overlay"
	>
		{#each frames as f (f.id)}
			{@const q = cornersOf(f)}
			{@const editing = mode === "edit" && f.id === selected}
			{@const handles = editing ? handlesOf(q) : []}
			{@const label = labelOf(q, editing)}
			{#if editing}
				<!-- the frame's line stops at the handles: inside a ring only the picture shows -->
				<mask id="{uid}-handles" maskUnits="userSpaceOnUse" x="0" y="0" {width} {height}>
					<rect {width} {height} fill="white" />
					{#each handles as p, i (i)}
						<circle
							cx={p.x}
							cy={p.y}
							r={handleRadius + handleStroke / 2}
							fill="black"
						/>
					{/each}
				</mask>
			{/if}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<polygon
				points={points(q)}
				fill={editing ? "rgba(250, 200, 0, 0.15)" : "transparent"}
				stroke={stroke(f)}
				stroke-width={unit * 0.6}
				stroke-dasharray={f.state === "ignored" || f.state === "erased"
					? `${unit} ${unit}`
					: undefined}
				mask={editing ? `url(#${uid}-handles)` : undefined}
				class={mode === "edit" && f.state !== "saved" && f.state !== "erased"
					? "cursor-pointer"
					: ""}
				onclick={() => pick(f)}
				data-testid="sheet-frame-{f.position}"
			/>
			{#if editing && kind === "scan"}
				{@const top = { x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[1].y) / 2 }}
				{@const knob = handles[ROTATE] ?? top}
				<line
					x1={top.x}
					y1={top.y}
					x2={knob.x}
					y2={knob.y}
					stroke="var(--color-warning-600)"
					stroke-width={handleStroke}
					mask="url(#{uid}-handles)"
					class="pointer-events-none"
				/>
			{/if}
			<circle
				cx={label.x}
				cy={label.y}
				r={unit * 2.2}
				fill={stroke(f)}
				class="pointer-events-none"
			/>
			<text
				x={label.x}
				y={label.y}
				font-size={unit * 2.6}
				font-weight="700"
				text-anchor="middle"
				dominant-baseline="central"
				fill="white"
				class="pointer-events-none">{f.position}</text
			>
			{#each handles as p, i (i)}
				<circle
					cx={p.x}
					cy={p.y}
					r={handleRadius}
					fill="none"
					stroke="var(--color-warning-600)"
					stroke-width={handleStroke}
					class="pointer-events-none"
				/>
				<!-- the touch area, wider than the ring and invisible -->
				<circle
					cx={p.x}
					cy={p.y}
					r={unit * 2.5}
					fill="transparent"
					class={i === ROTATE ? "cursor-alias" : "cursor-grab"}
					role="slider"
					aria-label={i === ROTATE
						? i18n.t("patrons.census.sheet.rotateFrame")
						: String(i + 1)}
					aria-valuenow={Math.round(p.x)}
					tabindex="-1"
					onpointerdown={(e) => startHandle(f, i, e)}
					data-testid={i === ROTATE ? "sheet-rotate" : `sheet-corner-${i}`}
				/>
			{/each}
		{/each}
		{#if drawing}
			<polygon
				points={points(rectQuad(drawing.from, drawing.to))}
				fill="rgba(0, 120, 255, 0.15)"
				stroke="var(--color-primary-500)"
				stroke-width={unit * 0.6}
				stroke-dasharray="{unit} {unit}"
			/>
		{/if}
	</svg>
</div>
