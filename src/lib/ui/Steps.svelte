<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Step indicator of the wizards (owner review): one segmented bar, rounded only at
     the ends; the current step is filled, the completed ones show a check, the rest stay quiet. -->
<script lang="ts">
	import { ICON_SIZE, icons } from "./icons.js";

	interface Props {
		steps: { key: string; label: string }[];
		/** Index of the current step. */
		current: number;
		label: string;
		testid?: string;
	}

	const { steps, current, label, testid = "steps" }: Props = $props();
	const CheckIcon = icons.confirm;
</script>

<!-- On phones only the current step keeps its label, so the bar never overflows. -->
<div class="max-w-full">
	<ol
		class="inline-flex overflow-hidden rounded-full border border-surface-200 bg-surface-100 text-sm font-semibold whitespace-nowrap"
		aria-label={label}
		data-testid={testid}
	>
		{#each steps as step, i (step.key)}
			<li
				class="flex items-center gap-1 border-r border-surface-200 px-3 py-1.5 last:border-r-0 {i ===
				current
					? 'bg-primary-500 text-primary-contrast-500'
					: i < current
						? 'bg-success-100 text-success-900'
						: 'text-surface-700'}"
				aria-current={i === current ? "step" : undefined}
				data-testid="{testid}-{step.key}"
			>
				{#if i < current}
					<CheckIcon size={ICON_SIZE.sm} aria-hidden="true" />
				{:else}
					<span>{i + 1}.</span>
				{/if}
				<span class={i === current ? "" : "sr-only sm:not-sr-only"}>{step.label}</span>
			</li>
		{/each}
	</ol>
</div>
