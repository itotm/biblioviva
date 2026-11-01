<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The Dewey map of the classification editor (step 11.1): Dewey prefix → local class, used to
     suggest the class of a new non-fiction record from its Dewey number (the longest matching
     prefix wins). A row points at the class itself, so renaming the class keeps the row; the
     tester shows which class a Dewey number would get with the draft. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { classOf, suggestClassFromDewey } from "#lib/shared/classification.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Table from "#lib/ui/Table.svelte";
	import { icons } from "#lib/ui/icons.js";
	import type { TaxonomyEditor } from "./taxonomy-editor.svelte.js";

	interface Props {
		editor: TaxonomyEditor;
	}

	const { editor }: Props = $props();
	const i18n = useI18n();
	const AddIcon = icons.add;
	const RemoveIcon = icons.delete;

	let probe = $state("");
	const scheme = $derived(editor.draft);
	const suggested = $derived.by(() => {
		const code = probe.trim() ? suggestClassFromDewey(scheme, probe) : null;
		return code ? classOf(scheme, code) : null;
	});
</script>

<Card gap="4" data-testid="dewey-editor">
	<Hint>{i18n.t("config.taxonomy.dewey.hint")}</Hint>
	<Row align="end" gap="3">
		<Field label={i18n.t("config.taxonomy.dewey.probe")}>
			<Input
				mono
				class="w-40"
				bind:value={probe}
				placeholder="599.7"
				data-testid="dewey-probe"
			/>
		</Field>
		{#if probe.trim()}
			<p class="pb-2 font-semibold" data-testid="dewey-probe-result">
				{suggested
					? `${suggested.code} · ${suggested.label}`
					: i18n.t("config.taxonomy.dewey.noMatch")}
			</p>
		{/if}
	</Row>
	{#if editor.deweyMap.length === 0}
		<EmptyState title={i18n.t("config.taxonomy.dewey.empty")} icon="classification" />
	{:else}
		<div class="overflow-x-auto">
			<Table data-testid="dewey-rows">
				<thead>
					<tr>
						<th>{i18n.t("config.taxonomy.dewey.prefix")}</th>
						<th>{i18n.t("config.taxonomy.dewey.class")}</th>
						<th><span class="sr-only">{i18n.t("common.actions.delete")}</span></th>
					</tr>
				</thead>
				<tbody>
					{#each editor.deweyMap as row, i (row.key)}
						{@const problems = editor.deweyIssues[i] ?? []}
						<tr data-testid="dewey-row">
							<td class="align-top">
								<Input
									mono
									class="w-24"
									bind:value={row.prefix}
									maxlength={3}
									inputmode="numeric"
									aria-label={i18n.t("config.taxonomy.dewey.prefix")}
									aria-invalid={problems.length > 0 ? "true" : undefined}
									data-testid="dewey-prefix"
								/>
								{#each problems as p (p)}
									<Hint tone="error"
										>{i18n.t(`config.taxonomy.dewey.problems.${p}`)}</Hint
									>
								{/each}
							</td>
							<td class="align-top">
								<Select
									bind:value={row.target}
									aria-label={i18n.t("config.taxonomy.dewey.class")}
									data-testid="dewey-class"
								>
									{#if row.target === "" || !editor.find(row.target)}
										<option value="">—</option>
									{/if}
									{#each editor.nonfiction as n (n.key)}
										<option value={n.key}>{n.code} · {n.label}</option>
										{#each n.children as c (c.key)}
											<option value={c.key}>— {c.code} · {c.label}</option>
										{/each}
									{/each}
								</Select>
							</td>
							<td class="w-12 align-top">
								<IconButton
									icon={RemoveIcon}
									label={i18n.t("common.actions.delete")}
									variant="error"
									size="sm"
									onclick={() => editor.removeDewey(row.key)}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		</div>
	{/if}
	<Button icon={AddIcon} onclick={() => editor.addDewey()} data-testid="dewey-add"
		>{i18n.t("config.taxonomy.dewey.add")}</Button
	>
</Card>
