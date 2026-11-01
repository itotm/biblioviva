<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The colour sets as selectable swatches (wizard step 2 and /admin/appearance). -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { THEMES, type ThemeName } from "#lib/shared/theme-palette.js";
	import Grid from "#lib/ui/Grid.svelte";
	import Row from "#lib/ui/Row.svelte";
	import SelectCard from "#lib/ui/SelectCard.svelte";

	interface Props {
		value: ThemeName;
		onchange: (theme: ThemeName) => void;
		label: string;
	}

	const { value, onchange, label }: Props = $props();
	const i18n = useI18n();
</script>

<Grid from="sm" lg3 gap="3" role="radiogroup" aria-label={label}>
	{#each THEMES as t (t)}
		<SelectCard
			selected={value === t}
			role="radio"
			row
			padding="3"
			onclick={() => onchange(t)}
			data-testid="theme-{t}"
		>
			<Row wrap={false} gap="1" as="span" data-theme={t}>
				<span class="size-7 rounded-full bg-primary-500"></span>
				<span class="size-7 rounded-full bg-secondary-500"></span>
				<span class="size-7 rounded-full bg-tertiary-500"></span>
			</Row>
			<span class="font-semibold">{i18n.t(`setup.theme.names.${t}`)}</span>
		</SelectCard>
	{/each}
</Grid>
