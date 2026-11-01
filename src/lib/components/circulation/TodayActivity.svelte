<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Prestiti di oggi" (step 4.7): today's checkouts and returns, newest first, the time and the
     book with the patron. Shown on the checkout desk while no patron is selected (`split`: the two
     lists in two boxes side by side), and on the dashboard (one box). -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { getTodayActivity } from "#lib/remote/loans.remote.js";
	import type { TodayActivityRow } from "#lib/server/services/loan-lists.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Card from "#lib/ui/Card.svelte";
	import DividedList from "#lib/ui/DividedList.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";
	import Loading from "#lib/ui/Loading.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	interface Props {
		/** Entries shown per list before "e altri N". */
		limit?: number;
		/** The two lists in two boxes side by side (one under the other on a phone). */
		split?: boolean;
	}

	const { limit = 6, split = false }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const activity = $derived(getTodayActivity());
	const time = (iso: string): string => fmt.date(iso, { hour: "2-digit", minute: "2-digit" });
	const LoanIcon = icons.loan;
	const ReturnIcon = icons.return;
	const TodayIcon = icons.calendar;
</script>

{#snippet list(key: "issued" | "returned", rows: TodayActivityRow[])}
	{@const Icon = key === "issued" ? LoanIcon : ReturnIcon}
	<div class="space-y-1" data-testid="today-{key}">
		<Row
			as={split ? "h2" : "h3"}
			align="center"
			gap="2"
			class={split ? "font-semibold" : "text-sm font-semibold"}
		>
			<Icon size={split ? ICON_SIZE.md : ICON_SIZE.sm} aria-hidden="true" />
			{i18n.t(`circulation.today.${key}`)} ({rows.length})
		</Row>
		{#if rows.length === 0}
			<Hint>{i18n.t("circulation.today.none")}</Hint>
		{:else}
			<DividedList>
				{#each rows.slice(0, limit) as r (r.loanId)}
					<Row as="li" wrap={false} align="center" gap="3" class="py-1.5">
						<span class="w-12 shrink-0 font-mono text-sm">{time(r.at)}</span>
						<TitleHint title={r.title} truncate class="min-w-0">{r.name}</TitleHint>
					</Row>
				{/each}
			</DividedList>
			{#if rows.length > limit}
				<Hint>{i18n.t("circulation.today.more", { count: rows.length - limit })}</Hint>
			{/if}
		{/if}
	</div>
{/snippet}

{#if split}
	<section aria-label={i18n.t("circulation.today.title")} data-testid="today-activity">
		<QueryState query={activity}>
			{#snippet loading()}<Card><Loading size="md" /></Card>{/snippet}
			{#snippet children(a)}
				<div class="grid gap-4 sm:grid-cols-2">
					<Card>{@render list("issued", a.issued)}</Card>
					<Card>{@render list("returned", a.returned)}</Card>
				</div>
			{/snippet}
		</QueryState>
	</section>
{:else}
	<Card gap="3" as="section" data-testid="today-activity">
		<Row as="h2" align="center" gap="2" class="font-semibold">
			<TodayIcon size={ICON_SIZE.md} aria-hidden="true" />
			{i18n.t("circulation.today.title")}
		</Row>
		<QueryState query={activity} size="md">
			{#snippet children(a)}
				{@render list("issued", a.issued)}
				{@render list("returned", a.returned)}
			{/snippet}
		</QueryState>
	</Card>
{/if}
