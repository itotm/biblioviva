<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The warning of an early renewal (Appendix I, `renewal_early`), in the middle of the page like
     the loan-limit dialog: less than half of the loan period has passed, the operator chooses
     "Rinnova comunque" or "Annulla". The focus starts on "Annulla", so a stray Enter, such as the
     one a scanner sends after a code, cancels instead of renewing. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Row from "#lib/ui/Row.svelte";
	import DeskMessage from "./DeskMessage.svelte";
	import { DESK_TONE } from "./desk-message.js";
	import type { EarlyRenewalAsk } from "./renewals.svelte.js";

	interface Props {
		ask: EarlyRenewalAsk;
	}

	const { ask }: Props = $props();
	const i18n = useI18n();
	const RenewIcon = icons.renew;
	const current = $derived(ask.current);
</script>

<Modal
	open={current !== null}
	title={i18n.t("circulation.renewals.early.title")}
	onclose={() => ask.cancel()}
	data-testid="early-renewal-dialog"
>
	{#if current?.kind === "one"}
		<DeskMessage message={current.message} />
	{:else if current}
		<div class="space-y-3" data-testid="early-renewal-list">
			<DeskMessage
				message={{
					code: "renewal_early",
					tone: DESK_TONE.renewal_early,
					text: current.intro,
				}}
			/>
			<ul class="list-disc space-y-1 ps-6">
				{#each current.lines as line, i (i)}
					<li data-testid="early-renewal-line">{line}</li>
				{/each}
			</ul>
			<p class="opacity-80">{current.outro}</p>
		</div>
	{/if}
	<Row justify="end">
		<Button autofocus onclick={() => ask.cancel()} data-testid="early-renewal-cancel">
			{i18n.t("common.actions.cancel")}
		</Button>
		<Button
			variant="primary"
			icon={RenewIcon}
			onclick={() => void ask.confirm()}
			data-testid="early-renewal-confirm"
		>
			{i18n.t("circulation.renewals.early.confirm")}
		</Button>
	</Row>
</Modal>
