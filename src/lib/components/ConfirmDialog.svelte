<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Confirmation dialog (Skeleton Dialog, alertdialog role) for irreversible or important actions. -->
<script lang="ts">
	import { Dialog, Portal } from "@skeletonlabs/skeleton-svelte";
	import type { Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import DialogFrame from "#lib/ui/DialogFrame.svelte";
	import DialogHeader from "#lib/ui/DialogHeader.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		/** `error` for destructive actions (red button). */
		tone?: "primary" | "error";
		/** Disables the buttons while something else runs (the dialog's own action already does). */
		pending?: boolean;
		/** Disables only the confirm button (e.g. a required reason is still empty). */
		confirmDisabled?: boolean;
		/**
		 * The action. The dialog disables its buttons until it settles, then closes; it stays open
		 * when the action returns (or resolves to) `false`: it failed and said so; or throws.
		 */
		onconfirm: () => unknown;
		oncancel?: () => void;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel,
		cancelLabel,
		tone = "primary",
		pending = false,
		confirmDisabled = false,
		onconfirm,
		oncancel,
		children,
	}: Props = $props();

	const i18n = useI18n();
	const ConfirmIcon = icons.confirm;

	let running = $state(false);
	const busy = $derived(pending || running);

	async function confirm(): Promise<void> {
		running = true;
		try {
			if ((await onconfirm()) !== false) {
				open = false;
			}
		} finally {
			running = false;
		}
	}

	function cancel(): void {
		open = false;
		oncancel?.();
	}
</script>

<Dialog
	{open}
	onOpenChange={(d) => {
		if (!d.open) {
			cancel();
		}
	}}
	role="alertdialog"
>
	<!-- Mounted only while open: several dialogs on one page must not leave hidden buttons around. -->
	{#if open}
		<Portal>
			<DialogFrame animated data-testid="confirm-dialog">
				<DialogHeader title={title ?? i18n.t("common.confirm.title")} />
				{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
				{#if children}{@render children()}{/if}
				<Row justify="end" as="footer">
					<Button onclick={cancel} disabled={busy}
						>{cancelLabel ?? i18n.t("common.actions.cancel")}</Button
					>
					<button
						type="button"
						class="btn {tone === 'error'
							? 'preset-filled-error-500'
							: 'preset-filled-primary-500'}"
						onclick={confirm}
						disabled={busy || confirmDisabled}
						data-testid="confirm-button"
					>
						<ConfirmIcon size={ICON_SIZE.sm} aria-hidden="true" />
						<span>{confirmLabel ?? i18n.t("common.actions.confirm")}</span>
					</button>
				</Row>
			</DialogFrame>
		</Portal>
	{/if}
</Dialog>
