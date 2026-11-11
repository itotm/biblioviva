<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Stocktaking (step 9.8): the campaign in progress with its progress by shelf; the scan panel —
     the scanner field has the focus, or the camera stays open scan after scan on a phone — with the
     shelf being worked on and the last five results (seen, already seen, misplaced, found again,
     on loan, unknown: colour, icon and text); the copies still missing with their filters and the
     export; "Chiudi inventario" with the count first, then the summary. With no campaign: "Nuova
     campagna" and the closed ones, a recent one can be reopened. -->
<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import { tick } from "svelte";
	import CameraStage from "#lib/components/CameraStage.svelte";
	import BarcodeInput from "#lib/components/BarcodeInput.svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import {
		closeInventoryNow,
		getInventory,
		getMissingItems,
		reopenInventoryNow,
		scanForInventory,
		startInventory,
	} from "#lib/remote/inventory.remote.js";
	import type { ScanResult } from "#lib/shared/scan.js";
	import { unlockScanSound } from "#lib/scanner/sound.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import DividedList from "#lib/ui/DividedList.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import { inventoryLook, TONE_CLASS } from "#lib/ui/status.js";
	import { toaster } from "#lib/ui/toaster.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const fmt = useFormat();
	const inventory = getInventory();
	const AddIcon = icons.add;
	const CameraIcon = icons.camera;
	const CloseIcon = icons.confirm;
	const ExportIcon = icons.export;
	const ReopenIcon = icons.undo;

	type Outcome = Awaited<ReturnType<typeof scanForInventory>> & { ok: true };
	interface Result {
		key: number;
		outcome: Outcome["outcome"];
	}

	let name = $state("");
	// today in the library's zone, in the locale's numeric form (`25/10/2026`)
	const NUMERIC_DATE = { year: "numeric", month: "numeric", day: "numeric" } as const;
	const defaultName = $derived(
		`${i18n.t("catalog.inventory.defaultName")} ${fmt.date(new Date(), NUMERIC_DATE)}`,
	);
	let shelf = $state("");
	let results = $state<Result[]>([]);
	let camera = $state(false);
	let scanner = $state<{ focus: () => void }>();
	let busy = $state(false);
	let closeOpen = $state(false);
	let summary = $state<
		(Awaited<ReturnType<typeof closeInventoryNow>> & { ok: true })["summary"] | null
	>(null);
	let missingShelf = $state<string | null>(null);
	let missingType = $state<string | null>(null);
	let nextKey = 0;

	const current = $derived(inventory.current?.current ?? null);
	const progress = $derived(inventory.current?.progress ?? null);
	const missing = $derived(
		current
			? getMissingItems({
					inventoryId: current.id,
					shelf: missingShelf,
					itemType: missingType,
				})
			: null,
	);
	const percent = (seen: number, expected: number): number =>
		expected === 0 ? 100 : Math.round((seen / expected) * 100);

	async function start(): Promise<void> {
		const r = await startInventory({ name: name.trim() || defaultName });
		if (!r.ok) {
			toaster.error({ title: i18n.t(`catalog.inventory.errors.${r.code}`) });
		}
	}

	let refresh: ReturnType<typeof setTimeout> | undefined;
	async function scan(code: string): Promise<void> {
		if (!current) {
			return;
		}
		busy = true;
		try {
			const r = await scanForInventory({
				inventoryId: current.id,
				code,
				shelf: shelf.trim() || null,
			});
			if (r.ok) {
				results = [{ key: nextKey++, outcome: r.outcome }, ...results].slice(0, 5);
				// the progress follows a moment after the last scan (scan after scan it would be heavy)
				clearTimeout(refresh);
				refresh = setTimeout(() => {
					void inventory.refresh();
					void missing?.refresh();
				}, 800);
			} else {
				toaster.error({ title: i18n.t(`catalog.inventory.errors.${r.code}`) });
			}
		} finally {
			busy = false;
			await tick();
			if (!camera) {
				scanner?.focus();
			}
		}
	}

	// the camera sees everything on the desk: only what can be a copy's code counts
	function onCamera(result: ScanResult): void {
		if (result.kind !== "isbn" && result.kind !== "card") {
			void scan(result.value);
		}
	}

	async function close(): Promise<void> {
		if (!current) {
			return;
		}
		const r = await closeInventoryNow({ inventoryId: current.id });
		if (r.ok) {
			summary = r.summary;
			results = [];
		} else {
			toaster.error({ title: i18n.t(`catalog.inventory.errors.${r.code}`) });
		}
	}

	async function reopen(id: number): Promise<void> {
		const r = await reopenInventoryNow({ inventoryId: id });
		if (!r.ok) {
			toaster.error({ title: i18n.t(`catalog.inventory.errors.${r.code}`) });
		}
	}

	const describe = (o: Result["outcome"]): string =>
		o.kind === "unknown"
			? i18n.t("catalog.inventory.outcomes.unknown", { code: o.code })
			: i18n.t(`catalog.inventory.outcomes.${o.kind}`, {
					title: o.title,
					barcode: o.barcode,
					when: o.firstAt ? fmt.dateTime(o.firstAt) : "",
				});
	const exportHref = (format: "csv" | "ods"): ResolvedPathname => {
		const params: Record<string, string> = { inventory: String(current?.id ?? 0), format };
		if (missingShelf !== null) {
			params.shelf = missingShelf;
		}
		if (missingType) {
			params.itemType = missingType;
		}
		return resolve(`export/inventory-missing?${new URLSearchParams(params).toString()}`);
	};
</script>

{#snippet bar(seen: number, expected: number, label: string, testid: string)}
	<div class="space-y-1" data-testid={testid}>
		<Row justify="between" align="center" class="text-sm">
			<span class="font-semibold">{label}</span>
			<span
				>{i18n.t("catalog.inventory.progress", {
					seen,
					expected,
					percent: percent(seen, expected),
				})}</span
			>
		</Row>
		<div
			class="h-3 overflow-hidden rounded-full bg-surface-200"
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={expected}
			aria-valuenow={seen}
		>
			<div
				class="h-full rounded-full bg-primary-500"
				style="width:{percent(seen, expected)}%"
			></div>
		</div>
	</div>
{/snippet}

{#snippet lastResults()}
	{#if results.length > 0}
		<ul class="space-y-2" aria-live="polite" data-testid="inventory-results">
			{#each results as r (r.key)}
				{@const look = inventoryLook(r.outcome.kind)}
				{@const Icon = icons[look.icon]}
				<li
					class="flex items-center gap-2 rounded-base p-2 {TONE_CLASS[look.tone]}"
					data-testid="inventory-result"
					data-kind={r.outcome.kind}
				>
					<Icon size={ICON_SIZE.md} aria-hidden="true" />
					<span>{describe(r.outcome)}</span>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<Page width="2xl">
	<PageHeader title={i18n.t("catalog.inventory.title")} icon="inventory">
		{#snippet views()}
			<AreaTabs area="catalog" current="inventory" />
		{/snippet}
	</PageHeader>

	{#if summary}
		<Alert tone="success" as="div" padded data-testid="inventory-summary">
			<p class="font-semibold">{i18n.t("catalog.inventory.closedTitle")}</p>
			<p>{i18n.t("catalog.inventory.summary", summary)}</p>
		</Alert>
	{/if}

	<QueryState query={inventory}>
		{#snippet children(inv)}
			{#if current && progress}
				<Card gap="3" as="section" data-testid="inventory-current">
					<Row justify="between" align="center">
						<div>
							<h2 class="title-lg">{current.name}</h2>
							<Hint as="span"
								>{i18n.t("catalog.inventory.started", {
									when: fmt.dateTime(current.startedAt),
								})}</Hint
							>
						</div>
						<Button
							variant="error-outlined"
							icon={CloseIcon}
							onclick={() => (closeOpen = true)}
							data-testid="inventory-close"
							>{i18n.t("catalog.inventory.close")}</Button
						>
					</Row>
					{@render bar(
						progress.seen,
						progress.expected,
						i18n.t("catalog.inventory.overall"),
						"inventory-overall",
					)}
					<Hint tone="faint">
						{i18n.t("catalog.inventory.counts", {
							scanned: progress.scanned,
							misplaced: progress.misplaced,
							found: progress.found,
						})}
					</Hint>
					<details data-testid="inventory-shelves">
						<summary class="cursor-pointer text-sm font-semibold hover:underline"
							>{i18n.t("catalog.inventory.byShelf")}</summary
						>
						<div class="mt-2 space-y-2">
							{#each progress.shelves as s (s.shelf)}
								{@render bar(
									s.seen,
									s.expected,
									s.shelf || i18n.t("catalog.inventory.noShelf"),
									`shelf-${s.shelf}`,
								)}
							{/each}
						</div>
					</details>
				</Card>

				<Card gap="3" as="section" data-testid="inventory-scan">
					<h2 class="title-lg">{i18n.t("catalog.inventory.scanTitle")}</h2>
					<Field
						label={i18n.t("catalog.inventory.shelf")}
						hint={i18n.t("catalog.inventory.shelfHint")}
					>
						<Input
							list="inventory-shelves"
							bind:value={shelf}
							maxlength={40}
							data-testid="inventory-shelf"
						/>
					</Field>
					<datalist id="inventory-shelves">
						{#each inv.shelves as s (s)}<option value={s}></option>{/each}
					</datalist>
					{#if camera}
						<CameraStage
							data-testid="inventory-camera-stage"
							onclose={() => (camera = false)}
						>
							<Row wrap={false} align="center" justify="between">
								<h2 class="title-lg">
									{shelf.trim()
										? i18n.t("catalog.inventory.cameraShelf", {
												shelf: shelf.trim(),
											})
										: i18n.t("catalog.inventory.scanTitle")}
								</h2>
								<Button
									size="sm"
									onclick={() => (camera = false)}
									data-testid="inventory-camera-done"
									>{i18n.t("catalog.inventory.cameraDone")}</Button
								>
							</Row>
							{#await import("#lib/components/ScannerOverlay.svelte") then { default: ScannerOverlay }}
								<ScannerOverlay
									onscan={onCamera}
									onclose={() => (camera = false)}
								/>
							{/await}
							{@render lastResults()}
						</CameraStage>
					{:else}
						<BarcodeInput
							bind:this={scanner}
							label={i18n.t("catalog.inventory.scanLabel")}
							onscan={(_, value) => scan(value)}
							oninvalid={(r) => void scan(r.value)}
							clearAfterScan
							autofocus
							disabled={busy}
						/>
						<Button
							icon={CameraIcon}
							onclick={() => {
								unlockScanSound(page.data.cameraSound ?? "off");
								camera = true;
							}}
							data-testid="inventory-camera"
							>{i18n.t("catalog.inventory.camera")}</Button
						>
					{/if}
					{#if !camera}
						{@render lastResults()}
					{/if}
				</Card>

				<Card gap="3" as="section" data-testid="inventory-missing">
					<Row justify="between" align="center">
						<h2 class="title-lg">
							{i18n.t("catalog.inventory.missing", {
								count: missing?.current?.total ?? 0,
							})}
						</h2>
						<Row gap="2">
							<Button
								size="sm"
								icon={ExportIcon}
								href={exportHref("csv")}
								data-testid="missing-export">CSV</Button
							>
							<Button size="sm" icon={ExportIcon} href={exportHref("ods")}>ODS</Button
							>
						</Row>
					</Row>
					<Row gap="3">
						<Field label={i18n.t("catalog.inventory.shelf")}>
							<Select
								value={missingShelf ?? "*"}
								onchange={(e) =>
									(missingShelf =
										e.currentTarget.value === "*"
											? null
											: e.currentTarget.value)}
								data-testid="missing-shelf"
							>
								<option value="*">{i18n.t("catalog.inventory.allShelves")}</option>
								{#each progress.shelves as s (s.shelf)}
									<option value={s.shelf}
										>{s.shelf || i18n.t("catalog.inventory.noShelf")}</option
									>
								{/each}
							</Select>
						</Field>
						<Field label={i18n.t("catalog.item.itemType")}>
							<Select
								value={missingType ?? ""}
								onchange={(e) => (missingType = e.currentTarget.value || null)}
								data-testid="missing-type"
							>
								<option value="">{i18n.t("catalog.inventory.allTypes")}</option>
								{#each inv.itemTypes as t (t.code)}
									<option value={t.code}>{t.label}</option>
								{/each}
							</Select>
						</Field>
					</Row>
					{#if missing?.current}
						{#if missing.current.items.length === 0}
							<Hint tone="faint">{i18n.t("catalog.inventory.noneMissing")}</Hint>
						{:else}
							<DividedList data-testid="missing-list">
								{#each missing.current.items as m (m.itemId)}
									<li class="flex flex-wrap items-baseline gap-x-3 py-2">
										<span class="font-mono text-sm">{m.callNumber}</span>
										<a
											class="font-semibold hover:underline"
											href={resolve(`catalog/${m.biblioId}`)}>{m.title}</a
										>
										<Hint as="span" mono>{m.barcode}</Hint>
										{#if m.inventoryNumber}
											<!-- the school inventory's number (9.64) -->
											<Hint as="span" mono
												>{i18n.t("catalog.inventory.inventoryNumber", {
													number: m.inventoryNumber,
												})}</Hint
											>
										{/if}
									</li>
								{/each}
							</DividedList>
							{#if missing.current.total > missing.current.items.length}
								<Hint tone="faint"
									>{i18n.t("catalog.inventory.more", {
										count: missing.current.total - missing.current.items.length,
									})}</Hint
								>
							{/if}
						{/if}
					{/if}
				</Card>
			{:else}
				<EmptyState
					title={i18n.t("catalog.inventory.emptyTitle")}
					description={i18n.t("catalog.inventory.emptyHint")}
					icon="inventory"
				>
					{#snippet action()}
						<form
							class="flex flex-wrap items-end justify-center gap-2"
							onsubmit={(e) => {
								e.preventDefault();
								void start();
							}}
						>
							<Field label={i18n.t("catalog.inventory.name")}>
								<Input
									bind:value={name}
									placeholder={defaultName}
									maxlength={120}
									data-testid="inventory-name"
								/>
							</Field>
							<Button
								variant="primary"
								type="submit"
								icon={AddIcon}
								data-testid="inventory-start"
								>{i18n.t("catalog.inventory.start")}</Button
							>
						</form>
					{/snippet}
				</EmptyState>
			{/if}
		{/snippet}
	</QueryState>

	{#if inventory.current && inventory.current.history.length > 0}
		<Card gap="2" as="section" data-testid="inventory-history">
			<h2 class="title-lg">{i18n.t("catalog.inventory.history")}</h2>
			<DividedList>
				{#each inventory.current.history as h (h.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 py-2">
						<span>
							<span class="font-semibold">{h.name}</span>
							{#if h.summary}
								<Hint as="span" class="block"
									>{i18n.t("catalog.inventory.summary", h.summary)}</Hint
								>
							{/if}
						</span>
						{#if h.canReopen}
							<Button
								size="sm"
								icon={ReopenIcon}
								onclick={() => reopen(h.id)}
								data-testid="inventory-reopen"
								>{i18n.t("catalog.inventory.reopen")}</Button
							>
						{/if}
					</li>
				{/each}
			</DividedList>
		</Card>
	{/if}
</Page>

<ConfirmDialog
	bind:open={closeOpen}
	title={i18n.t("catalog.inventory.closeTitle")}
	description={i18n.t("catalog.inventory.closeHint", {
		count: progress ? progress.expected - progress.seen : 0,
	})}
	tone="error"
	confirmLabel={i18n.t("catalog.inventory.close")}
	onconfirm={close}
/>
