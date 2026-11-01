<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- An administrator forces a checkout or a renewal (Appendix I, step 4.5): the reason is required
     (at least three characters) and stays in the loan's log. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Input from "#lib/ui/Input.svelte";

	interface Props {
		open: boolean;
		title: string;
		confirmLabel: string;
		onconfirm: (reason: string) => void | Promise<void>;
		oncancel: () => void;
	}

	const { open, title, confirmLabel, onconfirm, oncancel }: Props = $props();
	const i18n = useI18n();
	let reason = $state("");

	async function confirm(): Promise<void> {
		const r = reason.trim();
		reason = "";
		await onconfirm(r);
	}
</script>

<ConfirmDialog
	{open}
	{title}
	tone="error"
	{confirmLabel}
	confirmDisabled={reason.trim().length < 3}
	onconfirm={confirm}
	oncancel={() => {
		reason = "";
		oncancel();
	}}
>
	<Field
		label={i18n.t("circulation.checkout.override.reason")}
		hint={i18n.t("circulation.checkout.override.hint")}
	>
		<Input bind:value={reason} maxlength={200} data-testid="override-reason" />
	</Field>
</ConfirmDialog>
