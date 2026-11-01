<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Colour + icon + text, never colour alone (§3.18). -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons } from "./icons.js";
	import { TONE_CLASS, type StatusDef } from "./status.js";

	interface Props {
		status: StatusDef;
		/** Extra detail after the label, e.g. "3 giorni". */
		detail?: string;
		size?: "sm" | "md";
		class?: string;
	}

	const { status, detail, size = "md", class: className = "" }: Props = $props();
	const i18n = useI18n();
	const Icon = $derived(icons[status.icon]);
</script>

<span
	class="badge {TONE_CLASS[status.tone]} inline-flex items-center gap-1 {size === 'sm'
		? 'text-xs'
		: ''} {className}"
	data-testid="status-badge"
	data-status={status.key}
>
	<Icon size={size === "sm" ? ICON_SIZE.sm : ICON_SIZE.md} aria-hidden="true" />
	<span>{i18n.t(`common.statuses.${status.key}`)}{detail ? ` · ${detail}` : ""}</span>
</span>
