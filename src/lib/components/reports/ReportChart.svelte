<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The chart of a report (step 6.2): Chart.js is loaded only here, on demand, with the bar, line
     and doughnut controllers registered (§2: ApexCharts excluded, lazy chunk). Colours come from
     the active colour set, so a theme change repaints it; the numbers stay in the grid below, so
     colour is never the only cue. -->
<script lang="ts">
	import { onDestroy } from "svelte";

	interface Props {
		type: "bar" | "line" | "doughnut";
		/** One label per point (x columns already joined). */
		labels: string[];
		/** One series per y column (per column value for a pivot table). */
		series: { label: string; data: number[] }[];
		/** Bars stacked (a pivot table: the columns of a row in one bar). */
		stacked?: boolean;
		ariaLabel: string;
	}

	const { type, labels, series, stacked = false, ariaLabel }: Props = $props();
	let canvas = $state<HTMLCanvasElement>();
	let chart: { destroy: () => void } | undefined;

	const PALETTE = ["primary", "secondary", "tertiary", "success", "warning", "error"];

	function colour(name: string, shade: number): string {
		const value = getComputedStyle(document.documentElement)
			.getPropertyValue(`--color-${name}-${shade}`)
			.trim();
		return value || "#3b82f6";
	}

	$effect(() => {
		const target = canvas;
		const config = { type, labels, series, stacked };
		if (!target) {
			return;
		}
		let cancelled = false;
		void (async () => {
			const c = await import("chart.js");
			if (cancelled) {
				return;
			}
			c.Chart.register(
				c.BarController,
				c.LineController,
				c.DoughnutController,
				c.CategoryScale,
				c.LinearScale,
				c.BarElement,
				c.LineElement,
				c.PointElement,
				c.ArcElement,
				c.Tooltip,
				c.Legend,
			);
			chart?.destroy();
			const doughnut = config.type === "doughnut";
			chart = new c.Chart(target, {
				type: config.type,
				data: {
					labels: config.labels,
					datasets: config.series.map((s, i) => {
						const name = PALETTE[i % PALETTE.length] ?? "primary";
						return {
							label: s.label,
							data: s.data,
							backgroundColor: doughnut
								? config.labels.map((_, j) =>
										colour(PALETTE[j % PALETTE.length] ?? "primary", 400),
									)
								: colour(name, 400),
							borderColor: doughnut ? "#fff" : colour(name, 600),
							borderWidth: doughnut ? 2 : 1,
							tension: 0.25,
						};
					}),
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches
						? false
						: undefined,
					plugins: { legend: { display: doughnut || config.series.length > 1 } },
					scales: doughnut
						? {}
						: {
								x: { stacked: config.stacked },
								y: {
									stacked: config.stacked,
									beginAtZero: true,
									ticks: { precision: 0 },
								},
							},
				},
			});
		})();
		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => chart?.destroy());
</script>

<div class="relative h-72 w-full" role="img" aria-label={ariaLabel} data-testid="report-chart">
	<canvas bind:this={canvas}></canvas>
</div>
