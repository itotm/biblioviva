<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The patron at the desk (step 4.3): photo, name, class, loans against the limit, every open
     loan with its due date (overdue in red, colour + icon + text) and the circulation note. -->
<script lang="ts">
	import DividedList from "#lib/ui/DividedList.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import type { DeskPatron } from "#lib/server/services/circulation.js";
	import { LOAN_STATUS } from "#lib/ui/status.js";
	import StatusBadge from "#lib/ui/StatusBadge.svelte";
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import { photosOn } from "#lib/ui/features.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";
	import ClassBadge from "#lib/components/ClassBadge.svelte";

	interface Props {
		patron: DeskPatron;
		/** Renewal of one loan and of all of them (step 4.5). */
		onrenew?: (loanId: number) => void;
		onrenewall?: () => void;
	}

	const { patron, onrenew, onrenewall }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const RenewIcon = icons.renew;
	const full = $derived(patron.loans.length >= patron.maxLoans);
</script>

<Card gap="3" as="section" data-testid="desk-patron">
	<Row wrap={false} align="start" gap="3">
		{#if photosOn()}
			<img
				src="/media/patrons/{patron.id}/thumb"
				alt=""
				class="h-24 w-18 shrink-0 rounded-container object-cover ring-1 ring-surface-200"
			/>
		{/if}
		<div class="min-w-0 space-y-1">
			<p class="text-sm opacity-80">{patron.firstName}</p>
			<p class="text-xl leading-tight font-bold" data-testid="desk-patron-name">
				{patron.lastName}
			</p>
			<Row gap="2" align="center">
				<ClassBadge
					label={patron.classLabel}
					fallback={i18n.t("circulation.checkout.teacher")}
				/>
				<span
					class="badge {full ? 'preset-filled-warning-500' : 'preset-tonal'}"
					data-testid="desk-patron-count"
					>{i18n.t("circulation.checkout.loans", {
						n: patron.loans.length,
						max: patron.maxLoans,
					})}</span
				>
			</Row>
		</div>
	</Row>
	{#if patron.circulationNote}
		<Alert tone="warning" padded live={false} data-testid="desk-patron-note">
			<strong>{i18n.t("circulation.checkout.note")}:</strong>
			{patron.circulationNote}
		</Alert>
	{/if}
	{#if patron.loans.length === 0}
		<Hint>{i18n.t("circulation.checkout.noLoans")}</Hint>
	{:else}
		<DividedList data-testid="desk-patron-loans">
			{#each patron.loans as l (l.loanId)}
				<Row as="li" align="center" justify="between" class="py-2">
					<TitleHint title={l.title} truncate mono class="min-w-0">{l.barcode}</TitleHint>
					<Row gap="1" align="center">
						<StatusBadge
							size="sm"
							status={l.overdue ? LOAN_STATUS.overdue : LOAN_STATUS.open}
							detail={fmt.day(l.dueDate, "medium")}
						/>
						{#if onrenew}
							<Button
								icon={RenewIcon}
								size="sm"
								aria-label={i18n.t("circulation.renewals.renewOne", {
									title: l.title,
								})}
								onclick={() => onrenew(l.loanId)}
								data-testid="desk-renew"
								>{i18n.t("circulation.actions.renew")}</Button
							>
						{/if}
					</Row>
				</Row>
			{/each}
		</DividedList>
		{#if onrenewall && patron.loans.length > 1}
			<Button size="sm" icon={RenewIcon} onclick={onrenewall} data-testid="desk-renew-all"
				>{i18n.t("circulation.renewals.renewAll")}</Button
			>
		{/if}
	{/if}
</Card>
