<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- What a backup, a restore, an export or an import covers (step 11.12): one checkbox per part,
     grouped — the library's data, the settings of each section, the rest of the configuration —
     with "Tutti" and "Nessuno" per group; a data part chosen without what it points at gets a
     hint (the restore checks the references for real). -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import {
		ACCOUNTS_PART,
		DATA_NEEDS,
		dataPartsOf,
		type PartId,
	} from "#lib/shared/archive-parts.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		/** The parts that can be chosen (what the folder or the archive holds). */
		parts: readonly PartId[];
		selected: PartId[];
		/** Show the hints about data parts that need others (restores). */
		needs?: boolean;
		/**
		 * An import: ticking the staff accounts asks for a confirmation (their accounts and
		 * passwords replace the current ones) and the tick stays only if confirmed.
		 */
		guardAccounts?: boolean;
		"data-testid"?: string;
	}

	let {
		parts,
		selected = $bindable(),
		needs = false,
		guardAccounts = false,
		...rest
	}: Props = $props();
	const i18n = useI18n();

	const groups = $derived(
		(
			[
				["data", parts.filter((p) => p.startsWith("data:"))],
				["settings", parts.filter((p) => p.startsWith("section:"))],
				["config", parts.filter((p) => p.startsWith("config:"))],
			] as const
		).filter(([, list]) => list.length > 0),
	);

	function partLabel(id: PartId): string {
		const [group, name = ""] = id.split(":");
		return group === "section"
			? i18n.t(`config.sections.${name}.title`)
			: i18n.t(`config.parts.${group}.${name}`);
	}

	// the selection waiting for the confirmation about the accounts
	let askAccounts = $state<PartId[] | null>(null);
	// a refused tick must show unticked again: the boxes are drawn anew
	let redraw = $state(0);

	function choose(next: PartId[]): void {
		if (guardAccounts && next.includes(ACCOUNTS_PART) && !selected.includes(ACCOUNTS_PART)) {
			askAccounts = next;
			redraw += 1;
			return;
		}
		selected = next;
	}

	function toggle(id: PartId, on: boolean): void {
		choose(on ? [...selected.filter((p) => p !== id), id] : selected.filter((p) => p !== id));
	}

	function all(list: readonly PartId[], on: boolean): void {
		choose(
			on
				? [...selected.filter((p) => !list.includes(p)), ...list]
				: selected.filter((p) => !list.includes(p)),
		);
	}

	const missing = $derived(
		needs
			? dataPartsOf(selected).flatMap((part) => {
					const wanted = (DATA_NEEDS[part] ?? []).filter(
						(n) => !selected.includes(`data:${n}`),
					);
					return wanted.length > 0 ? [{ part, wanted }] : [];
				})
			: [],
	);
</script>

<div class="space-y-3" {...rest}>
	{#key redraw}
		{#each groups as [group, list] (group)}
			<fieldset class="space-y-2" data-testid="parts-{group}">
				<legend class="label-text">{i18n.t(`config.parts.groups.${group}`)}</legend>
				<Row gap="1">
					<Button
						size="sm"
						onclick={() => all(list, true)}
						data-testid="parts-{group}-all">{i18n.t("config.parts.all")}</Button
					>
					<Button
						size="sm"
						onclick={() => all(list, false)}
						data-testid="parts-{group}-none">{i18n.t("config.parts.none")}</Button
					>
				</Row>
				<div class="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
					{#each list as id (id)}
						<Checkbox
							checked={selected.includes(id)}
							onchange={(e) => toggle(id, e.currentTarget.checked)}
							data-testid="part-{id}">{partLabel(id)}</Checkbox
						>
					{/each}
				</div>
			</fieldset>
		{/each}
	{/key}
	{#each missing as m (m.part)}
		<Hint tone="error-soft" data-testid="parts-needs"
			>{i18n.t("config.parts.needs", {
				part: partLabel(`data:${m.part}`),
				needs: m.wanted.map((n) => partLabel(`data:${n}`)).join(", "),
			})}</Hint
		>
	{/each}
</div>

<ConfirmDialog
	open={askAccounts !== null}
	title={i18n.t("config.parts.accountsConfirm.title")}
	description={i18n.t("config.parts.accountsConfirm.description")}
	confirmLabel={i18n.t("config.parts.accountsConfirm.confirm")}
	tone="error"
	onconfirm={() => {
		if (askAccounts) {
			selected = askAccounts;
		}
		askAccounts = null;
	}}
	oncancel={() => {
		askAccounts = null;
		redraw += 1;
	}}
/>
