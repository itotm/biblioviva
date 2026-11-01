<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The patron page's open loans (steps 2.1, 4.5, 4.8): reminder print, renewals with the desk's
     messages and the override, a loan marked lost, and the copies still lost. -->
<script lang="ts">
	import DeskMessages from "#lib/components/circulation/DeskMessages.svelte";
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import type { getPatronDetail } from "#lib/remote/patrons.remote.js";
	import { markLost } from "#lib/remote/circulation.remote.js";
	import { useFormat } from "#lib/ui/format.js";
	import { icons } from "#lib/ui/icons.js";
	import { ITEM_STATUS } from "#lib/ui/status.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Button from "#lib/ui/Button.svelte";
	import DividedList from "#lib/ui/DividedList.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import StatusBadge from "#lib/ui/StatusBadge.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";
	import ConfirmDialog from "../ConfirmDialog.svelte";
	import OverrideDialog from "../circulation/OverrideDialog.svelte";
	import type { DeskMessageData } from "../circulation/desk-message.js";
	import { Renewals } from "../circulation/renewals.svelte.js";

	type Patron = Awaited<ReturnType<typeof getPatronDetail>>;

	interface Props {
		patron: Patron;
		/** The account renews and marks lost (`loans`). */
		canRenew: boolean;
		/** The account may force a refused renewal (`admin`). */
		canOverride: boolean;
		/** After a change: the loans again, and the history when a loan ended. */
		onchanged: (history: boolean) => Promise<void>;
	}

	const { patron: p, canRenew, canOverride, onchanged }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const PrintIcon = icons.print;
	const RenewIcon = icons.renew;
	const LostIcon = icons.lost;

	let renewMessages = $state<DeskMessageData[]>([]);
	let lostLoan = $state<{ loanId: number; title: string } | null>(null);
	let lostReason = $state("");

	const renewals = new Renewals({
		t: (key, params) => i18n.t(key, params),
		formatDate: (iso) => fmt.day(iso, "medium"),
		canOverride: () => canOverride,
		show: (...messages) => {
			renewMessages = messages;
		},
		patronId: () => null,
		after: () => void onchanged(false),
	});

	async function confirmLost(): Promise<void> {
		if (!lostLoan) {
			return;
		}
		const r = await markLost({ loanId: lostLoan.loanId, reason: lostReason });
		lostLoan = null;
		toaster.success({ title: i18n.t("patrons.detail.markedLost", { title: r.title }) });
		await onchanged(true);
	}
</script>

<div class="space-y-3">
	{#if renewMessages.length > 0}
		<DeskMessages messages={renewMessages} />
	{/if}
	{#if p.openLoans.length === 0}
		<p class="opacity-70">{i18n.t("patrons.detail.noLoans")}</p>
	{:else}
		{#if canRenew && p.openLoans.some((l) => l.overdue)}
			<Button
				size="sm"
				icon={PrintIcon}
				href={resolve(`print/overdues?patron=${p.id}`)}
				target="_blank"
				rel="noopener"
				data-testid="print-reminder">{i18n.t("circulation.actions.printReminder")}</Button
			>
		{/if}
		{#if canRenew && p.openLoans.length > 1}
			<Button
				size="sm"
				icon={RenewIcon}
				onclick={() => renewals.all(p.id)}
				data-testid="renew-all">{i18n.t("circulation.renewals.renewAll")}</Button
			>
		{/if}
		<DividedList data-testid="open-loans">
			{#each p.openLoans as l (l.loanId)}
				<Row align="center" gap="3" as="li" class="py-2">
					<TitleHint title={l.title} class="grow"
						>{l.author} ·
						<span class="font-mono">{l.barcode}</span></TitleHint
					>
					<span class="text-sm {l.overdue ? 'font-semibold text-error-700' : ''}">
						{i18n.t("patrons.detail.loanColumns.due")}: {fmt.day(
							l.dueDate,
							"medium",
						)}{l.overdue ? ` · ${i18n.t("patrons.detail.overdue")}` : ""}
					</span>
					{#if canRenew}
						<IconButton
							icon={RenewIcon}
							size="sm"
							label={i18n.t("circulation.renewals.renewOne", {
								title: l.title,
							})}
							onclick={() => renewals.one(l.loanId)}
							data-testid="renew-loan"
						/>
						<IconButton
							icon={LostIcon}
							size="sm"
							variant="error"
							label={i18n.t("patrons.detail.markLost", {
								title: l.title,
							})}
							onclick={() => {
								lostReason = "";
								lostLoan = { loanId: l.loanId, title: l.title };
							}}
							data-testid="mark-lost"
						/>
					{/if}
				</Row>
			{/each}
		</DividedList>
	{/if}
	{#if p.lostItems.length > 0}
		<section class="space-y-2" data-testid="lost-items">
			<h3 class="font-semibold">{i18n.t("patrons.detail.lostTitle")}</h3>
			<Hint>{i18n.t("patrons.detail.lostHint")}</Hint>
			<DividedList>
				{#each p.lostItems as li (li.loanId)}
					<Row as="li" align="center" justify="between" class="py-2">
						<TitleHint title={li.title} mono class="min-w-0">{li.barcode}</TitleHint>
						<StatusBadge
							size="sm"
							status={ITEM_STATUS.lost}
							detail={fmt.date(li.lostAt, "medium")}
						/>
					</Row>
				{/each}
			</DividedList>
		</section>
	{/if}
</div>

<OverrideDialog
	open={renewals.pending !== null}
	title={i18n.t("circulation.renewals.overrideTitle")}
	confirmLabel={i18n.t("circulation.renewals.overrideConfirm")}
	onconfirm={(reason) => renewals.force(reason)}
	oncancel={() => (renewals.pending = null)}
/>
<ConfirmDialog
	open={lostLoan !== null}
	title={i18n.t("patrons.detail.markLostTitle", { title: lostLoan?.title ?? "" })}
	description={i18n.t("patrons.detail.markLostDescription")}
	tone="error"
	confirmLabel={i18n.t("patrons.detail.markLostConfirm")}
	onconfirm={confirmLost}
	oncancel={() => (lostLoan = null)}
>
	<Field label={i18n.t("patrons.detail.markLostReason")}>
		<Input bind:value={lostReason} maxlength={200} data-testid="lost-reason" />
	</Field>
</ConfirmDialog>
