<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Overdue notices (step 4.6, Appendix H): the overdue loans grouped by class and section, teachers
     last, each group with its count and rows; the minimum delay and the page break per class are
     chosen here (defaults from `circulation.overdueNotice`), every group can be left out of the
     print. "Stampa solleciti" opens the printable notices, "Segna solleciti stampati" records the
     date on the loans shown. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { patronFullName } from "#lib/shared/patron-name.js";
	import { getOverdues, markNotices } from "#lib/remote/loans.remote.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import DividedList from "#lib/ui/DividedList.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import { LOAN_STATUS } from "#lib/ui/status.js";
	import StatusBadge from "#lib/ui/StatusBadge.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const PrintIcon = icons.print;
	const DoneIcon = icons.confirm;

	// svelte-ignore state_referenced_locally
	let minDays = $state(data.minDays);
	// svelte-ignore state_referenced_locally
	let pageBreak = $state(data.pageBreak);
	let excluded = $state<string[]>([]);
	let confirmMark = $state(false);

	const days = $derived(Number.isInteger(minDays) && minDays >= 0 ? Math.min(minDays, 365) : 0);
	const result = $derived(getOverdues({ minDays: days }));
	const groups = $derived(result.current?.groups ?? []);
	const chosen = $derived(groups.filter((g) => !excluded.includes(g.key)));
	const chosenLoans = $derived(chosen.flatMap((g) => g.rows.map((r) => r.loanId)));
	const printHref = $derived(
		resolve(
			`print/overdues?minDays=${days}&pageBreak=${pageBreak ? "1" : "0"}${
				excluded.length > 0
					? `&groups=${encodeURIComponent(chosen.map((g) => g.key).join(","))}`
					: ""
			}`,
		),
	);

	function toggle(key: string, on: boolean): void {
		excluded = on ? excluded.filter((k) => k !== key) : [...excluded, key];
	}

	async function mark(): Promise<void> {
		const r = await markNotices({ loanIds: chosenLoans });
		toaster.success({ title: i18n.t("circulation.overdues.marked", { count: r.marked }) });
		await result.refresh();
	}
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("circulation.overdues.title")} icon="overdue">
		{#snippet views()}
			<AreaTabs area="circulation" current="overdues" />
		{/snippet}
	</PageHeader>

	<Card gap="3" as="section">
		<Row align="end" gap="4">
			<Field label={i18n.t("circulation.overdues.minDays")} class="max-w-48">
				<Input
					type="number"
					min={0}
					max={365}
					bind:value={minDays}
					data-testid="min-days"
				/>
			</Field>
			<Checkbox bind:checked={pageBreak} data-testid="page-break"
				>{i18n.t("circulation.overdues.pageBreak")}</Checkbox
			>
		</Row>
		<Hint>{i18n.t("circulation.overdues.minDaysHint")}</Hint>
		<Row>
			<Button
				variant="primary"
				icon={PrintIcon}
				href={chosen.length > 0 ? printHref : undefined}
				disabled={chosen.length === 0}
				target="_blank"
				rel="noopener"
				data-testid="print-notices">{i18n.t("circulation.overdues.print")}</Button
			>
			<Button
				icon={DoneIcon}
				onclick={() => (confirmMark = true)}
				disabled={chosenLoans.length === 0}
				data-testid="mark-notices">{i18n.t("circulation.overdues.markPrinted")}</Button
			>
		</Row>
	</Card>

	<QueryState query={result} isEmpty={(r) => r.groups.length === 0}>
		{#snippet empty()}
			<EmptyState title={i18n.t("circulation.overdues.empty")} icon="available" />
		{/snippet}
		<p
			class="text-sm font-semibold opacity-70"
			data-testid="overdues-summary"
			aria-live="polite"
		>
			{i18n.t("circulation.overdues.summary", {
				rows: groups.reduce((n, g) => n + g.rows.length, 0),
				groups: groups.length,
			})}
		</p>
		<div class="grid gap-4 md:grid-cols-2">
			{#each groups as g (g.key)}
				<Card gap="3" as="section" data-testid="overdue-group" data-group={g.key}>
					<Row justify="between" align="center">
						<h2 class="text-lg font-bold">{g.label}</h2>
						<Badge tone="error" filled
							>{i18n.t("circulation.overdues.groupCount", {
								count: g.rows.length,
							})}</Badge
						>
					</Row>
					<Checkbox
						checked={!excluded.includes(g.key)}
						onchange={(e) => toggle(g.key, e.currentTarget.checked)}
						data-testid="group-{g.key}"
						>{i18n.t("circulation.overdues.selected")}</Checkbox
					>
					<DividedList>
						{#each g.rows as r (r.loanId)}
							<Row as="li" justify="between" align="center" class="py-2">
								<TitleHint title={patronFullName(r)} class="min-w-0"
									>{r.title}{r.lastNoticeAt
										? ` · ${i18n.t("circulation.overdues.lastNotice", {
												date: fmt.dateTime(r.lastNoticeAt),
											})}`
										: ""}</TitleHint
								>
								<StatusBadge
									size="sm"
									status={LOAN_STATUS.overdue}
									detail={i18n.t("circulation.overdues.days", {
										days: r.daysOverdue,
									})}
									class="shrink-0"
								/>
							</Row>
						{/each}
					</DividedList>
				</Card>
			{/each}
		</div>
	</QueryState>

	<ConfirmDialog
		bind:open={confirmMark}
		title={i18n.t("circulation.overdues.markTitle", { count: chosenLoans.length })}
		description={i18n.t("circulation.overdues.markDescription")}
		confirmLabel={i18n.t("circulation.overdues.markPrinted")}
		onconfirm={mark}
	/>
</Page>
