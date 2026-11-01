<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	Photo census (step 2.4): pick a class (or the teachers) or a patron list — only those where a
	photo is missing (Q108) —, then photograph patrons one after another; after each save the flow
	moves to the next patron without a photo. The quick search (step 5.2) jumps straight to one
	person, in their class. One-handed on a phone: the capture stage is full-screen below `md`, the
	camera stays on between shots. A class or list can also take its photos from a picture with
	many faces (Phase 13, `ClassSheets`).
-->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import IconTile from "#lib/ui/IconTile.svelte";
	import CameraStage from "#lib/components/CameraStage.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getCensusGroups,
		getCensusList,
		quickAddPatron,
		quickFindPatrons,
	} from "#lib/remote/patrons.remote.js";
	import PatronPicker from "#lib/components/patrons/PatronPicker.svelte";
	import ClassSheets from "#lib/components/patrons/ClassSheets.svelte";
	import PatronPhotoPanel from "#lib/components/patrons/PatronPhotoPanel.svelte";
	import { stageSections } from "#lib/ui/stage-sections.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Select from "#lib/ui/Select.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const groupsQuery = getCensusGroups();
	const ListIcon = icons.lists;
	const CameraIcon = icons.camera;
	const CheckIcon = icons.available;
	const AddIcon = icons.add;

	// the class is in the address (`?group=12`, `?group=none` for the patrons without one): the
	// back button, the browser's Back and a reload keep it (9.13, round 16; Phase 12)
	type GroupKey = number | null;
	const groupKey = $derived(parseGroup(page.url.searchParams.get("group")));
	// or a patron print list (`?list=4`, Q108)
	const listKey = $derived.by(() => {
		const value = page.url.searchParams.get("list");
		return value !== null && /^\d{1,9}$/.test(value) ? Number(value) : undefined;
	});
	const listTile = $derived(
		listKey === undefined
			? null
			: (groupsQuery.current?.lists.find((l) => l.listId === listKey) ?? null),
	);
	const chosen = $derived(groupKey !== undefined || listKey !== undefined);
	function parseGroup(value: string | null): GroupKey | undefined {
		if (value === "none") {
			return null;
		}
		return value !== null && /^\d{1,9}$/.test(value) ? Number(value) : undefined;
	}
	const groupParam = (key: GroupKey): string => (key === null ? "none" : String(key));
	const group = $derived<CensusTile | null>(
		groupKey === undefined
			? null
			: (groupsQuery.current?.groups.find((g) => g.groupId === groupKey) ?? {
					groupId: groupKey,
					kind: null,
					label: "",
					levels: [],
					stage: null,
					total: 0,
					withPhoto: 0,
				}),
	);
	let currentId = $state<number | null>(null);
	let photoVersion = $state(0);
	let quickAdd = $state(false);
	let quickFirst = $state("");
	let quickLast = $state("");
	let quickErrors = $state<string[]>([]);
	let quickLevel = $state("");
	let capture = $state<PatronPhotoPanel>();

	const listQuery = $derived(
		listKey !== undefined
			? getCensusList({ list: listKey })
			: groupKey === undefined
				? null
				: getCensusList({ group: groupKey }),
	);
	const list = $derived(listQuery?.current ?? []);
	const current = $derived(list.find((p) => p.id === currentId) ?? null);
	const withPhoto = $derived(list.filter((p) => p.hasPhoto).length);
	// the demo's sample pictures, with the demo data loaded, while a photo is missing (Q109)
	const samples = $derived(Boolean(data.demo) && withPhoto < list.length);

	type CensusTile = NonNullable<typeof groupsQuery.current>["groups"][number];
	// only the sets where someone still has no photo are offered (Q108)
	const missing = (s: { total: number; withPhoto: number }): boolean => s.withPhoto < s.total;
	const lists = $derived((groupsQuery.current?.lists ?? []).filter(missing));
	// a school of several stages shows its classes stage by stage (12.9)
	const sections = $derived(
		stageSections(
			(groupsQuery.current?.groups ?? []).filter(missing),
			groupsQuery.current?.options.stages ?? [],
			i18n.t("patrons.census.stageOthers"),
		),
	);

	function groupLabel(g: { kind: string | null; label: string }): string {
		return g.kind === null ? i18n.t("patrons.census.noGroup") : g.label;
	}

	const testidOf = (g: { kind: string | null; label: string }): string =>
		g.kind === "teachers" ? "teachers" : g.kind === null ? "none" : g.label.replaceAll(" ", "");

	function pick(key: GroupKey): void {
		currentId = null;
		quickAdd = false;
		quickLevel = "";
		void goto(resolve(`census?group=${groupParam(key)}`));
	}

	function pickList(id: number): void {
		currentId = null;
		quickAdd = false;
		void goto(resolve(`census?list=${id}`));
	}

	function nextWithoutPhoto(after: number | null): number | null {
		const candidates = list.filter((p) => !p.hasPhoto && p.id !== after);
		return candidates[0]?.id ?? null;
	}

	function start(id: number): void {
		currentId = id;
		capture?.reset();
	}

	async function onPhotoSaved(): Promise<void> {
		const saved = current;
		photoVersion += 1;
		await Promise.all([listQuery?.refresh(), groupsQuery.refresh()]);
		toaster.success({
			title: i18n.t("patrons.census.saved", {
				name: saved ? patronSortName(saved) : "",
			}),
		});
		const next = nextWithoutPhoto(currentId);
		currentId = next;
		capture?.reset();
	}

	async function createAndShoot(): Promise<void> {
		if (group?.groupId === null || group?.groupId === undefined) {
			return;
		}
		quickErrors = [];
		const result = await quickAddPatron({
			firstName: quickFirst,
			lastName: quickLast,
			patronType: group.kind === "teachers" ? "teacher" : "student",
			groupId: group.groupId,
			// a pluriclasse asks the level, a class of one level gives it
			levelCode: group.levels.length === 1 ? (group.levels[0] ?? "") : quickLevel,
		});
		if (!result.ok) {
			quickErrors = result.messages;
			return;
		}
		quickFirst = "";
		quickLast = "";
		quickAdd = false;
		await listQuery?.refresh();
		start(result.id);
	}
</script>

{#snippet choice(c: {
	onclick: () => void;
	testid: string;
	title: string;
	done: number;
	total: number;
	list: boolean;
})}
	{@const complete = c.done === c.total}
	<button
		type="button"
		class="flex items-center gap-3 card p-4 text-left hover:bg-primary-50"
		onclick={c.onclick}
		data-testid={c.testid}
	>
		<IconTile
			class={c.list
				? "bg-secondary-100 text-secondary-800"
				: complete
					? "bg-success-100 text-success-800"
					: "bg-primary-100 text-primary-700"}
		>
			{#if c.list}<ListIcon
					size={ICON_SIZE.xl}
					aria-hidden="true"
				/>{:else if complete}<CheckIcon
					size={ICON_SIZE.xl}
					aria-hidden="true"
				/>{:else}<CameraIcon size={ICON_SIZE.xl} aria-hidden="true" />{/if}
		</IconTile>
		<span class="min-w-0">
			<span class="title-lg block truncate">{c.title}</span>
			<Hint as="span" class="block"
				>{i18n.t("patrons.census.progress", { done: c.done, total: c.total })}</Hint
			>
		</span>
	</button>
{/snippet}

{#snippet tile(g: CensusTile)}
	{@render choice({
		onclick: () => pick(g.groupId),
		testid: `census-group-${testidOf(g)}`,
		title: groupLabel(g),
		done: g.withPhoto,
		total: g.total,
		list: false,
	})}
{/snippet}

<Page width="2xl">
	<PageHeader
		title={i18n.t("patrons.census.title")}
		icon="camera"
		backHref={chosen ? "/census" : undefined}
		backLabel={chosen ? i18n.t("patrons.census.back") : undefined}
	>
		{#snippet views()}
			<AreaTabs area="patrons" current="census" />
		{/snippet}
	</PageHeader>

	{#if !chosen}
		<QueryState query={groupsQuery}>
			<div class="max-w-md">
				<PatronPicker
					search={quickFindPatrons}
					label={i18n.t("patrons.census.findPerson")}
					testid="census-patron"
					onpick={(p) => {
						pick(p.groupId);
						start(p.id);
					}}
				/>
			</div>
			<h2 class="h4">{i18n.t("patrons.census.pickTarget")}</h2>
			<Hint>{i18n.t("patrons.census.onlyMissing")}</Hint>
			{#if sections.length === 0 && lists.length === 0}
				<EmptyState title={i18n.t("patrons.census.nothingMissing")} icon="available" />
			{/if}
			<!-- the lists first, then the classes (owner) -->
			<div class="space-y-4" data-testid="census-groups">
				{#if lists.length > 0}
					<h3 class="title-lg">{i18n.t("patrons.census.listsTitle")}</h3>
					<Grid from="sm" lg3 gap="3" class="grid-cols-2" data-testid="census-lists">
						{#each lists as l (l.listId)}
							{@render choice({
								onclick: () => pickList(l.listId),
								testid: `census-list-${l.listId}`,
								title: l.name,
								done: l.withPhoto,
								total: l.total,
								list: true,
							})}
						{/each}
					</Grid>
				{/if}
				{#each sections as section (section.key)}
					{#if section.title}<h3 class="title-lg">{section.title}</h3>
					{:else if lists.length > 0}<h3 class="title-lg">
							{i18n.t("patrons.census.classesTitle")}
						</h3>{/if}
					<Grid from="sm" lg3 gap="3" class="grid-cols-2">
						{#each section.groups as g (g.groupId ?? "none")}
							{@render tile(g)}
						{/each}
					</Grid>
				{/each}
			</div>
		</QueryState>
	{:else}
		<!-- the class in the page, not as a subtitle that moves the page (9.13, round 19) -->
		<Hint tone="primary">
			<strong data-testid="census-class"
				>{listKey !== undefined
					? (listTile?.name ?? "")
					: group
						? groupLabel(group)
						: ""}</strong
			>
			·
			<span data-testid="census-progress"
				>{i18n.t("patrons.census.progress", { done: withPhoto, total: list.length })}</span
			>
		</Hint>

		{#if current}
			<CameraStage data-testid="census-stage">
				<Row wrap={false} align="center" justify="between">
					<h2 class="h4" data-testid="census-current">
						{patronSortName(current)}
					</h2>
					<Row wrap={false}>
						<Button
							size="sm"
							onclick={() => (currentId = nextWithoutPhoto(currentId))}
							data-testid="census-skip">{i18n.t("patrons.census.skip")}</Button
						>
						<Button
							size="sm"
							onclick={() => (currentId = null)}
							data-testid="census-done">{i18n.t("patrons.census.done")}</Button
						>
					</Row>
				</Row>
				<PatronPhotoPanel
					bind:this={capture}
					patronId={current.id}
					autostart
					onsaved={onPhotoSaved}
					errorTestid="census-error"
				/>
			</CameraStage>
		{/if}

		<h2 class="h4">{i18n.t("patrons.census.byCamera")}</h2>
		{#if list.length === 0 && listQuery?.ready}
			<EmptyState title={i18n.t("patrons.list.empty")} icon="patrons" />
		{:else}
			<Grid from="sm" lg3 gap="2" as="ul" data-testid="census-list">
				{#each list as p (p.id)}
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-3 card p-2 text-left hover:bg-primary-50 {p.id ===
							currentId
								? 'ring-2 ring-primary-500'
								: ''}"
							onclick={() => start(p.id)}
							data-testid="census-patron-{p.id}"
							data-has-photo={p.hasPhoto}
						>
							<img
								src="/media/patrons/{p.id}/thumb?v={photoVersion}"
								alt=""
								width="48"
								height="64"
								class="h-16 w-12 shrink-0 rounded-base object-cover ring-1 ring-surface-200"
							/>
							<span class="min-w-0 grow">
								<span class="block truncate font-semibold">{patronSortName(p)}</span
								>
							</span>
							<CameraIcon
								size={ICON_SIZE.md}
								class="shrink-0 opacity-50"
								aria-hidden="true"
							/>
						</button>
					</li>
				{/each}
			</Grid>
			{#if withPhoto === list.length && list.length > 0}
				<p
					class="rounded-base bg-success-100 px-3 py-2 text-sm text-success-900"
					data-testid="census-all-done"
				>
					{i18n.t("patrons.census.allDone")}
				</p>
			{/if}
		{/if}

		{#if listKey === undefined && group && group.groupId !== null}<Card gap="3" as="section">
				{#if !quickAdd}
					<Button
						icon={AddIcon}
						onclick={() => (quickAdd = true)}
						data-testid="census-quick-add">{i18n.t("patrons.census.quickAdd")}</Button
					>
				{:else}
					<h2 class="h4">{i18n.t("patrons.census.quickAdd")}</h2>
					<Hint>
						{i18n.t("patrons.census.quickAddHint", { group: groupLabel(group) })}
					</Hint>
					<Grid
						from="sm"
						gap="3"
						as="form"
						onsubmit={(e) => {
							e.preventDefault();
							void createAndShoot();
						}}
					>
						<Field label={i18n.t("patrons.fields.lastName")}
							><Input
								type="text"
								bind:value={quickLast}
								required
								autocomplete="off"
								data-testid="quick-last"
							/></Field
						>
						<Field label={i18n.t("patrons.fields.firstName")}
							><Input
								type="text"
								bind:value={quickFirst}
								required
								autocomplete="off"
								data-testid="quick-first"
							/></Field
						>
						{#if group && group.levels.length > 1}
							<Field label={i18n.t("patrons.fields.levelCode")}
								><Select bind:value={quickLevel} required data-testid="quick-level">
									<option value=""></option>
									{#each groupsQuery.current?.options.levels.filter( (l) => group.levels.includes(l.code) ) ?? [] as l (l.code)}<option
											value={l.code}>{l.name}</option
										>{/each}
								</Select></Field
							>
						{/if}
						{#each quickErrors as message (message)}
							<p class="text-sm text-error-700 sm:col-span-2" role="alert">
								{message}
							</p>
						{/each}
						<Row wrap={false} class="sm:col-span-2">
							<Button variant="primary" type="submit" data-testid="quick-create"
								>{i18n.t("patrons.census.create")}</Button
							>
							<Button onclick={() => (quickAdd = false)}
								>{i18n.t("common.actions.cancel")}</Button
							>
						</Row>
					</Grid>
				{/if}
			</Card>{/if}

		{#if listKey !== undefined}
			<ClassSheets set={{ list: listKey }} maxPixels={data.sheetMaxPixels} {samples} />
		{:else if groupKey !== undefined && groupKey !== null}
			<ClassSheets set={{ group: groupKey }} maxPixels={data.sheetMaxPixels} {samples} />
		{/if}
	{/if}
</Page>
