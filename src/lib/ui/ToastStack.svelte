<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The toasts of one store (step 3.8b): coloured by type with the status icon, a thick accent on
     the leading edge, a bold title and the description in full contrast. The root layout renders
     one stack per placement (desktop bottom right, phone top centre, see toaster.ts). -->
<script lang="ts">
	import { Toast } from "@skeletonlabs/skeleton-svelte";
	import { ICON_SIZE, icons, type IconComponent } from "./icons.js";
	import type { desktopToaster } from "./toaster.js";

	interface Props {
		toaster: typeof desktopToaster;
		closeLabel: string;
		class?: string;
	}

	const { toaster, closeLabel, class: className = "" }: Props = $props();

	type Kind = "success" | "info" | "warning" | "error";
	const LOOK: Record<Kind, { icon: IconComponent; classes: string }> = {
		success: {
			icon: icons.available,
			classes:
				"border-success-500 bg-success-100 text-success-950 [&_svg.lead]:text-success-600",
		},
		info: {
			icon: icons.info,
			classes:
				"border-primary-500 bg-primary-100 text-primary-950 [&_svg.lead]:text-primary-600",
		},
		warning: {
			icon: icons.damaged,
			classes:
				"border-warning-500 bg-warning-100 text-warning-950 [&_svg.lead]:text-warning-700",
		},
		error: {
			icon: icons.lost,
			classes: "border-error-500 bg-error-100 text-error-950 [&_svg.lead]:text-error-600",
		},
	};
	const lookOf = (type: string | undefined): (typeof LOOK)[Kind] =>
		LOOK[(type ?? "info") in LOOK ? ((type ?? "info") as Kind) : "info"];
	const CloseIcon = icons.close;
</script>

<Toast.Group {toaster} class={className}>
	{#snippet children(toast)}
		{@const look = lookOf(toast.type)}
		{@const Icon = look.icon}
		<Toast
			{toast}
			class="bv-toast flex w-[min(26rem,calc(100vw-1.5rem))] items-start gap-3 rounded-container border-2 p-4 shadow-xl {look.classes}"
			data-type={toast.type}
		>
			<Icon class="lead mt-0.5 shrink-0" size={ICON_SIZE.lg} aria-hidden="true" />
			<Toast.Message class="grow">
				<Toast.Title class="text-base leading-snug font-bold">{toast.title}</Toast.Title>
				{#if toast.description}
					<Toast.Description class="mt-0.5 text-sm">{toast.description}</Toast.Description
					>
				{/if}
			</Toast.Message>
			<Toast.CloseTrigger
				class="-mt-1 -mr-1 btn-icon btn-icon-sm hover:bg-surface-950/10"
				aria-label={closeLabel}
			>
				<CloseIcon size={ICON_SIZE.sm} aria-hidden="true" />
			</Toast.CloseTrigger>
		</Toast>
	{/snippet}
</Toast.Group>
