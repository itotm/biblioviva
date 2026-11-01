<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Fast add, first stage (step 3.6): scan or type the ISBN/EAN (the camera accepts ISBNs and
     offers any other valid EAN-13), choose the material, or go on without a code. -->
<script lang="ts">
	import type { ScanKind } from "#lib/shared/scan.js";
	import { ean13Valid } from "#lib/shared/isbn.js";
	import { useI18n } from "#lib/i18n/context.js";
	import BarcodeInput from "#lib/components/BarcodeInput.svelte";
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		itemTypes: readonly { code: string; label: string }[];
		/** The item type of the copies to add. */
		material: string;
		/** What the last code turned out to be, when it was not an ISBN. */
		message: string | null;
		onscan: (kind: Exclude<ScanKind, "invalid">, value: string) => void | Promise<void>;
		onsearch: () => void;
		onmanual: () => void;
	}

	let {
		itemTypes,
		material = $bindable(),
		message,
		onscan,
		onsearch,
		onmanual,
	}: Props = $props();
	const i18n = useI18n();
	const SearchIcon = icons.search;
	const EditIcon = icons.edit;
</script>

<Card padding="lg" gap="4" as="section" data-testid="stage-code">
	<h2 class="h4">{i18n.t("catalog.fastAdd.code.heading")}</h2>
	<BarcodeInput
		label={i18n.t("catalog.fastAdd.code.label")}
		placeholder={i18n.t("catalog.fastAdd.code.placeholder")}
		{onscan}
		camera
		cameraAccept={(r) => r.kind === "isbn"}
		cameraRejectedLabel={i18n.t("catalog.fastAdd.code.cameraNotIsbn")}
		cameraOffer={(r) => ean13Valid(r.value)}
		autofocus
		class="max-w-xl"
	/>
	{#if message}
		<p class="text-warning-700" role="alert" data-testid="code-message">
			{message}
		</p>
	{/if}
	<fieldset class="space-y-1">
		<legend class="label-text">{i18n.t("catalog.fastAdd.code.material")}</legend>
		<Row role="radiogroup" data-testid="material">
			{#each itemTypes as t (t.code)}
				<button
					type="button"
					role="radio"
					aria-checked={material === t.code}
					class="btn {material === t.code
						? 'preset-filled-primary-500'
						: 'preset-outlined-surface-500'}"
					onclick={() => (material = t.code)}
					data-testid="material-{t.code}"
				>
					{t.label}
				</button>
			{/each}
		</Row>
	</fieldset>
	<Row align="center" class="border-t border-surface-200 pt-4">
		<Hint as="span">{i18n.t("catalog.fastAdd.code.noCodeHint")}</Hint>
		<Button icon={SearchIcon} onclick={onsearch} data-testid="no-code"
			>{i18n.t("catalog.fastAdd.code.noCode")}</Button
		>
		<Button icon={EditIcon} onclick={onmanual} data-testid="manual-entry"
			>{i18n.t("catalog.fastAdd.code.manual")}</Button
		>
	</Row>
</Card>
