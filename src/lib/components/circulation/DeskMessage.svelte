<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- One circulation desk message (Appendix I): colour + icon + text, and the actions as buttons.
     Errors are announced as alerts, the rest as status; there are never sounds (Q40). -->
<script lang="ts">
	import { ICON_SIZE, icons, type IconComponent } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Row from "#lib/ui/Row.svelte";
	import type { DeskMessageData, DeskTone } from "./desk-message.js";

	interface Props {
		message: DeskMessageData;
	}

	const { message }: Props = $props();
	const LOOK: Record<DeskTone, { icon: IconComponent; classes: string }> = {
		error: { icon: icons.lost, classes: "border-error-500 bg-error-50 text-error-950" },
		warning: {
			icon: icons.damaged,
			classes: "border-warning-500 bg-warning-50 text-warning-950",
		},
		info: { icon: icons.info, classes: "border-primary-500 bg-primary-50 text-primary-950" },
		success: {
			icon: icons.available,
			classes: "border-success-500 bg-success-50 text-success-950",
		},
	};
	const look = $derived(LOOK[message.tone]);
	const Icon = $derived(look.icon);
</script>

<div
	class="flex items-start gap-3 rounded-container border-2 p-4 {look.classes}"
	role={message.tone === "error" ? "alert" : "status"}
	data-testid="desk-message"
	data-code={message.code}
>
	<Icon class="mt-0.5 shrink-0" size={ICON_SIZE.lg} aria-hidden="true" />
	<div class="grow space-y-3">
		<p class="text-base font-semibold" data-testid="desk-message-text">{message.text}</p>
		{#if message.actions?.length}
			<Row>
				{#each message.actions as a (a.label)}
					<Button
						size="sm"
						variant={a.variant ?? "tonal"}
						href={a.href}
						target={a.newTab ? "_blank" : undefined}
						rel={a.newTab ? "noopener" : undefined}
						onclick={a.onclick}
						data-testid={a.testid}>{a.label}</Button
					>
				{/each}
			</Row>
		{/if}
	</div>
</div>
