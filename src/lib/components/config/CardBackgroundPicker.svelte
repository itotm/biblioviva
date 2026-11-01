<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The backgrounds shipped for the cards (step 11.17), in a dialog: the ones of the face's
     orientation, each with its bleed cut away as on the printed card; a click picks one. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { getCardBackgrounds } from "#lib/remote/print-config.remote.js";
	import { bleedPictureStyle } from "#lib/shared/card-backgrounds.js";
	import Button from "#lib/ui/Button.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		open?: boolean;
		/** The face's size: only the backgrounds of its orientation are offered. */
		widthMm: number;
		heightMm: number;
		pending?: boolean;
		onpick: (name: string) => void | Promise<void>;
	}

	let { open = $bindable(false), widthMm, heightMm, pending = false, onpick }: Props = $props();
	const i18n = useI18n();
	const list = getCardBackgrounds();
	const orientation = $derived(heightMm > widthMm ? "portrait" : "landscape");
	const shown = $derived((list.current ?? []).filter((b) => b.orientation === orientation));
	// the picture shown as the card: the bleed outside the frame
	const imgStyle = $derived(bleedPictureStyle(widthMm, heightMm));
</script>

<Modal
	bind:open
	title={i18n.t("config.designer.backgroundsTitle")}
	width="xl"
	scroll
	data-testid="background-picker"
>
	<Hint>{i18n.t("config.designer.backgroundsHint")}</Hint>
	<div
		class="grid gap-3 {orientation === 'portrait'
			? 'grid-cols-3 sm:grid-cols-5'
			: 'grid-cols-2 sm:grid-cols-4'}"
	>
		{#each shown as b (b.name)}
			<button
				type="button"
				class="rounded-base p-1 ring-primary-500 hover:bg-primary-50 hover:ring-2 disabled:opacity-50"
				disabled={pending}
				onclick={() => onpick(b.name)}
				aria-label={i18n.t("config.designer.backgroundAlt", {
					name: b.name.toUpperCase(),
				})}
				data-testid="background-{b.name}"
			>
				<span
					class="relative block overflow-hidden rounded-base bg-surface-200 shadow-[var(--bv-shadow-card)]"
					style="aspect-ratio: {widthMm} / {heightMm}"
				>
					<img
						src="/media/card-backgrounds/{b.name}"
						alt=""
						loading="lazy"
						class="absolute max-w-none"
						style={imgStyle}
					/>
				</span>
			</button>
		{/each}
	</div>
	<Row justify="end" as="footer">
		<Button onclick={() => (open = false)}>{i18n.t("common.actions.cancel")}</Button>
	</Row>
</Modal>
