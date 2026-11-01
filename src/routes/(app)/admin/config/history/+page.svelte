<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- History of the configuration (steps 11.1–11.2): every change made from the administration,
     newest first, with the files it touched; "Ripristina" puts the files back as they were before
     it (a change of its own, checked like any other). -->
<script lang="ts">
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { getConfigHistory, revertConfigHistory } from "#lib/remote/config.remote.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import InUseList from "#lib/components/config/InUseList.svelte";
	import { joinIssues } from "#lib/shared/config-issues.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Table from "#lib/ui/Table.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const history = getConfigHistory();
	const UndoIcon = icons.undo;
	const sections = $derived(data.sections);

	/** `20260925-101500-000` (UTC) → a date and time of the library. */
	function whenOfId(id: string): string {
		const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(id);
		return m ? fmt.dateTime(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) : id;
	}

	function describe(action: string): string {
		if (action.startsWith("revert ")) {
			return i18n.t("config.history.actions.revert", { when: whenOfId(action.slice(7)) });
		}
		if (["config.theme", "config.locale", "config.logo", "config.setup"].includes(action)) {
			return i18n.t(`config.history.actions.${action.slice(7)}`);
		}
		const section = action.startsWith("config.") ? action.slice(7) : "";
		return sections.includes(section)
			? i18n.t("config.history.actions.section", {
					section: i18n.t(`config.sections.${section}.title`),
				})
			: i18n.t("config.history.actions.other", { action });
	}

	let target = $state<string | null>(null);
	let confirming = $state(false);
	let pending = $state(false);
	let problem = $state<string | null>(null);
	let inUse = $state<
		{
			kind: "classification" | "itemType" | "level" | "readingLevel";
			code: string;
			count: number;
		}[]
	>([]);

	async function revert(): Promise<void> {
		if (!target) {
			return;
		}
		pending = true;
		problem = null;
		inUse = [];
		try {
			const result = await revertConfigHistory({ id: target }).updates(history);
			if (result.ok) {
				toaster.success({ title: i18n.t("config.history.reverted") });
			} else if (result.reason === "refused" || result.reason === "notFound") {
				problem = i18n.t(`config.history.${result.reason}`);
			} else if (result.reason === "conflict") {
				problem = i18n.t("config.history.conflict", { keys: result.conflicts.join(", ") });
			} else {
				inUse = result.inUse;
				problem = result.issues.length > 0 ? joinIssues(result.issues) : null;
			}
		} finally {
			pending = false;
			target = null;
		}
	}
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("config.history.title")} icon="config">
		{#snippet views()}
			<AreaTabs area="config" current="history" />
		{/snippet}
	</PageHeader>
	<Hint>{i18n.t("config.history.hint")}</Hint>
	{#if problem}
		<Alert data-testid="history-problem">{problem}</Alert>
	{/if}
	{#if inUse.length > 0}
		<InUseList problems={inUse} />
	{/if}
	<QueryState query={history} isEmpty={(changes) => changes.length === 0}>
		{#snippet empty()}
			<EmptyState title={i18n.t("config.history.empty")} icon="config" />
		{/snippet}
		{#snippet children(changes)}
			<div class="overflow-x-auto">
				<Table data-testid="history-table">
					<thead>
						<tr>
							<th>{i18n.t("config.history.columns.when")}</th>
							<th>{i18n.t("config.history.columns.what")}</th>
							<th>{i18n.t("config.history.columns.files")}</th>
							<th><span class="sr-only">{i18n.t("config.history.revert")}</span></th>
						</tr>
					</thead>
					<tbody>
						{#each changes as change (change.id)}
							<tr class="border-t border-surface-200" data-testid="history-row">
								<td class="p-2 whitespace-nowrap">{fmt.dateTime(change.at)}</td>
								<td class="p-2" data-testid="history-action"
									>{describe(change.action)}</td
								>
								<td class="p-2">
									{#each change.files as f (f.path)}
										<span class="block font-mono text-xs"
											>{f.path}{#if !f.existed}
												<span class="font-sans opacity-70">
													({i18n.t("config.history.newFile")})</span
												>{/if}</span
										>
									{/each}
								</td>
								<td class="p-2 text-right">
									<Button
										size="sm"
										icon={UndoIcon}
										onclick={() => {
											target = change.id;
											confirming = true;
										}}
										disabled={pending}
										data-testid="history-revert"
										>{i18n.t("config.history.revert")}</Button
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			</div>
		{/snippet}
	</QueryState>
	<ConfirmDialog
		bind:open={confirming}
		title={i18n.t("config.history.revertTitle")}
		description={i18n.t("config.history.revertDescription")}
		confirmLabel={i18n.t("config.history.revert")}
		{pending}
		onconfirm={revert}
		oncancel={() => (target = null)}
	/>
</Page>
