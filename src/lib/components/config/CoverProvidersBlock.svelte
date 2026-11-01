<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The cover providers on the "Copertine" settings page (step 11.8): tried in this order, each
     with its switch; Google Books needs an API key (in the "Dati dei libri" settings). -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { getCoverProviders, saveCoverProviders } from "#lib/remote/integrations.remote.js";
	import DraftActions from "#lib/components/config/DraftActions.svelte";
	import { DraftEditor } from "#lib/components/config/draft-editor.svelte.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { coversOn } from "#lib/ui/features.js";
	import Loading from "#lib/ui/Loading.svelte";

	interface Provider {
		id: "amazon" | "openlibrary" | "googlebooks";
		enabled: boolean;
	}

	interface Props {
		dirty?: boolean;
	}

	let { dirty = $bindable(false) }: Props = $props();
	const i18n = useI18n();
	const data = getCoverProviders();
	const MoveIcon = icons.more;

	let list = $state<Provider[]>([]);
	const editor = new DraftEditor(() => list);

	function load(): void {
		if (!data.current) {
			return;
		}
		list = data.current.providers.map((p) => ({ ...p }));
		editor.mark();
	}
	editor.loadWhenReady(() => data.current !== undefined, load);
	$effect(() => {
		dirty = editor.dirty;
	});

	function move(i: number, by: -1 | 1): void {
		const next = [...list];
		const [p] = next.splice(i, 1);
		if (p) {
			next.splice(i + by, 0, p);
			list = next;
		}
	}

	function save(): Promise<void> {
		return editor.save(
			() => saveCoverProviders({ providers: list }),
			i18n.t("config.blocks.coverProviders.saved"),
		);
	}
</script>

<Card variant="outlined" gap="3" id="cover-providers" data-testid="block-coverProviders">
	<h2 class="title-lg">{i18n.t("config.blocks.coverProviders.title")}</h2>
	<Hint>{i18n.t("config.blocks.coverProviders.hint")}</Hint>
	{#if !coversOn()}
		<Alert tone="info" padded live={false} data-testid="cover-providers-off"
			>{i18n.t("config.blocks.coverProviders.off")}</Alert
		>
	{/if}
	{#if data.current}
		<ol class="space-y-2">
			{#each list as p, i (p.id)}
				<li
					class="flex items-center gap-2 rounded-base border border-surface-200 px-3 py-2"
					data-testid="provider-{p.id}"
				>
					<span class="w-6 text-center font-semibold">{i + 1}</span>
					<Checkbox bind:checked={p.enabled} class="flex-1" data-testid="provider-enabled"
						>{i18n.t(`config.blocks.coverProviders.names.${p.id}`)}</Checkbox
					>
					<IconButton
						icon={MoveIcon}
						label={i18n.t("config.taxonomy.moveUp")}
						size="sm"
						class="[&>svg]:rotate-180"
						disabled={i === 0}
						onclick={() => move(i, -1)}
						data-testid="provider-up"
					/>
					<IconButton
						icon={MoveIcon}
						label={i18n.t("config.taxonomy.moveDown")}
						size="sm"
						disabled={i === list.length - 1}
						onclick={() => move(i, 1)}
						data-testid="provider-down"
					/>
				</li>
			{/each}
		</ol>
		{#if list.some((p) => p.id === "googlebooks" && p.enabled) && !data.current.googleKey}
			<Alert tone="warning" data-testid="google-key-missing"
				>{i18n.t("config.blocks.coverProviders.googleKey")}</Alert
			>
		{/if}
		{#if editor.problem}<Alert>{editor.problem}</Alert>{/if}
		<Row justify="end">
			<DraftActions
				{dirty}
				saving={editor.saving}
				onundo={load}
				onsave={save}
				testid="providers-save"
			/>
		</Row>
	{:else}
		<Loading />
	{/if}
</Card>
