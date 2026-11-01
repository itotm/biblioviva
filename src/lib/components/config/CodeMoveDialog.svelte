<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Where the copies or the students of the codes that disappear go (step 11.4): one choice per
     removed code in use, renamed codes pre-filled with their new name. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import Button from "#lib/ui/Button.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { icons } from "#lib/ui/icons.js";

	interface Props {
		open?: boolean;
		/** Removed codes still in use. */
		removed: { code: string; label: string; count: number }[];
		/** The codes they can go to. */
		targets: { code: string; label: string }[];
		/** Pre-filled choices (renames). */
		initial: Readonly<Record<string, string>>;
		/** `copies` or `students`: what the counts are. */
		unit: "copies" | "students";
		pending?: boolean;
		onconfirm: (replacements: Record<string, string>) => void | Promise<void>;
	}

	let {
		open = $bindable(false),
		removed,
		targets,
		initial,
		unit,
		pending = false,
		onconfirm,
	}: Props = $props();
	const i18n = useI18n();
	const SaveIcon = icons.save;
	let choices = $state<Record<string, string>>({});
	$effect(() => {
		if (open) {
			choices = { ...initial };
		}
	});
	const complete = $derived(removed.every((r) => choices[r.code]));
</script>

<Modal
	bind:open
	title={i18n.t("config.blocks.move.title")}
	width="lg"
	animated
	data-testid="code-move-dialog"
>
	<Hint>{i18n.t(`config.blocks.move.hint.${unit}`)}</Hint>
	{#each removed as r (r.code)}
		<Field
			label={i18n.t(`config.blocks.move.row.${unit}`, {
				code: r.code,
				label: r.label,
				count: r.count,
			})}
		>
			<Select bind:value={choices[r.code]} data-testid="move-{r.code}">
				<option value="">{i18n.t("config.blocks.move.choose")}</option>
				{#each targets as t (t.code)}
					<option value={t.code}
						>{t.code === t.label ? t.code : `${t.code} · ${t.label}`}</option
					>
				{/each}
			</Select>
		</Field>
	{/each}
	<Row justify="end" as="footer">
		<Button onclick={() => (open = false)} disabled={pending}
			>{i18n.t("common.actions.cancel")}</Button
		>
		<Button
			variant="primary"
			icon={SaveIcon}
			onclick={() => onconfirm({ ...choices })}
			disabled={!complete || pending}
			data-testid="move-confirm">{i18n.t("common.actions.save")}</Button
		>
	</Row>
</Modal>
