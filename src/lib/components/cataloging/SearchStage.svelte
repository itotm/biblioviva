<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Fast add without a code (step 3.6): search the providers by title and author, or type the
     record by hand. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		title: string;
		author: string;
		error: string | null;
		onsearch: () => void;
		onmanual: () => void;
		onback: () => void;
	}

	let {
		title = $bindable(),
		author = $bindable(),
		error,
		onsearch,
		onmanual,
		onback,
	}: Props = $props();
	const i18n = useI18n();
	const SearchIcon = icons.search;
	const EditIcon = icons.edit;
	const BackIcon = icons.back;
</script>

<Card padding="lg" gap="4" as="section" data-testid="stage-search">
	<h2 class="h4">{i18n.t("catalog.fastAdd.search.heading")}</h2>
	<Grid
		as="form"
		onsubmit={(e) => {
			e.preventDefault();
			onsearch();
		}}
	>
		<Field label={i18n.t("catalog.fastAdd.search.title")}
			><Input bind:value={title} autofocus data-testid="search-title" /></Field
		>
		<Field label={i18n.t("catalog.fastAdd.search.author")}
			><Input bind:value={author} data-testid="search-author" /></Field
		>
		{#if error}
			<p class="text-error-700 md:col-span-2" role="alert">{error}</p>
		{/if}
		<Row class="md:col-span-2">
			<Button variant="primary" icon={SearchIcon} type="submit" data-testid="search-submit"
				>{i18n.t("catalog.fastAdd.search.submit")}</Button
			>
			<Button icon={EditIcon} onclick={onmanual}
				>{i18n.t("catalog.fastAdd.code.manual")}</Button
			>
			<Button icon={BackIcon} onclick={onback}>{i18n.t("common.actions.back")}</Button>
		</Row>
	</Grid>
</Card>
