<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Friendly empty state with an icon, a message and the next action (§3.18). -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { icons, type IconName } from "./icons.js";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		title: string;
		description?: string;
		icon?: IconName;
		action?: Snippet;
	}

	const { title, description, icon = "empty", action }: Props = $props();
	const Icon = $derived(icons[icon]);
</script>

<Row column align="center" gap="3" class="py-12 text-center" data-testid="empty-state">
	<span class="rounded-full bg-primary-50 p-5 text-primary-500">
		<Icon size={44} aria-hidden="true" />
	</span>
	<p class="text-lg font-semibold">{title}</p>
	{#if description}<p class="max-w-md opacity-70">{description}</p>{/if}
	{#if action}<div class="mt-2">{@render action()}</div>{/if}
</Row>
