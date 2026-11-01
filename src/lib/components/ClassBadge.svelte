<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The class of a patron ("3 B", or the teachers group's name, Phase 12), or a fallback. -->
<script lang="ts">
	interface Props {
		/** The class label built by the server (`3 B`). */
		label?: string | null;
		/** Label shown when there is no class (e.g. "Docente"). */
		fallback?: string;
		class?: string;
	}

	const { label = null, fallback = "", class: className = "" }: Props = $props();
	const shown = $derived(label || fallback);
</script>

{#if shown}
	<span class="badge preset-tonal-primary font-semibold {className}" data-testid="class-badge"
		>{shown}</span
	>
{/if}
