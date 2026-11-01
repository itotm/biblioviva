<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The calendar editor on the "Calendario" settings page (step 11.5): weekly closing days, the
     months of a school year where a click closes or reopens a day, closed ranges with their reason,
     and the national holidays added as dates in one click (for when the automatic ones are off).
     Drawn with the same rules the due dates use (`calendar-core`), from the draft. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import {
		getCalendarEditor,
		saveCalendarChange,
	} from "#lib/remote/circulation-config.remote.js";
	import DraftActions from "#lib/components/config/DraftActions.svelte";
	import { DraftEditor } from "#lib/components/config/draft-editor.svelte.js";
	import {
		closedReason,
		italianHolidays,
		weekOrder,
		weekPosition,
		type CalendarRules,
		type ClosedReason,
	} from "#lib/shared/calendar-core.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import Table from "#lib/ui/Table.svelte";
	import { icons } from "#lib/ui/icons.js";
	import Loading from "#lib/ui/Loading.svelte";

	interface Props {
		/** `calendar.autoItalianHolidays` as the form above holds it. */
		autoHolidays: boolean;
		dirty?: boolean;
	}

	let { autoHolidays, dirty = $bindable(false) }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const data = getCalendarEditor();
	const AddIcon = icons.add;
	const RemoveIcon = icons.delete;
	const BackIcon = icons.back;
	const NextIcon = icons.more;

	interface RangeRow {
		key: number;
		from: string;
		to: string;
		reason: string;
	}
	let weekly = $state<number[]>([]);
	let holidays = $state<string[]>([]);
	let ranges = $state<RangeRow[]>([]);
	// the school year shown: the current one, moved by the arrows
	let shift = $state(0);
	const year = $derived((data.current?.currentYear ?? 2000) + shift);
	let nextKey = 0;

	const draft = $derived({
		weeklyClosedDays: [...weekly].sort((a, b) => a - b),
		holidays: [...holidays].sort(),
		closedRanges: ranges.map((r) => ({ from: r.from, to: r.to, reason: r.reason.trim() })),
	});
	const editor = new DraftEditor(() => draft);

	function load(): void {
		const current = data.current;
		if (!current) {
			return;
		}
		weekly = [...current.draft.weeklyClosedDays];
		holidays = [...current.draft.holidays];
		ranges = current.draft.closedRanges.map((r) => ({ key: nextKey++, ...r }));
		editor.mark();
	}
	editor.loadWhenReady(() => data.current !== undefined, load);
	$effect(() => {
		dirty = editor.dirty;
	});

	const rules = $derived<CalendarRules>({
		weeklyClosedDays: weekly,
		autoItalianHolidays: autoHolidays,
		holidays,
		closedRanges: draft.closedRanges,
	});
	const badRanges = $derived(ranges.some((r) => !r.from || !r.to || r.from > r.to));

	// the twelve months of the school year from its first month
	const months = $derived.by(() => {
		const start = Number((data.current?.schoolYearStart ?? "09-01").slice(0, 2));
		return Array.from({ length: 12 }, (_, i) => {
			const m = ((start - 1 + i) % 12) + 1;
			const y = year + Math.floor((start - 1 + i) / 12);
			return { y, m };
		});
	});
	const pad = (n: number): string => String(n).padStart(2, "0");
	function weeksOf(y: number, m: number): (string | null)[][] {
		const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
		const first = `${y}-${pad(m)}-01`;
		// the configured first day of the week (9.13, round 17)
		const offset = weekPosition(first, weekStart);
		const cells: (string | null)[] = [
			...Array.from({ length: offset }, () => null),
			...Array.from({ length: days }, (_, d) => `${y}-${pad(m)}-${pad(d + 1)}`),
		];
		const weeks: (string | null)[][] = [];
		for (let i = 0; i < cells.length; i += 7) {
			weeks.push(cells.slice(i, i + 7));
		}
		return weeks;
	}
	const monthName = (y: number, m: number): string =>
		fmt.day(`${y}-${String(m).padStart(2, "0")}-15`, {
			month: "long",
			year: "numeric",
		});
	// the week in the configured order, as JavaScript weekdays (0 = Sunday)
	const weekStart = $derived(data.current?.weekStart ?? "monday");
	const WEEK = $derived(weekOrder(weekStart));
	const dayName = (d: number, style: "narrow" | "short" | "long"): string =>
		// 2026-09-20 is a Sunday
		fmt.day(`2026-09-${20 + d}`, { weekday: style });
	const longDate = (iso: string): string => fmt.day(iso, "long");

	function describe(reason: ClosedReason | null): string {
		if (!reason) {
			return i18n.t("config.blocks.calendar.open");
		}
		switch (reason.kind) {
			case "national":
				return i18n.t(`circulation.calendar.national.${reason.name}`);
			case "range":
				return reason.reason || i18n.t("circulation.calendar.kinds.range");
			case "weekly":
			case "holiday":
				return i18n.t(`circulation.calendar.kinds.${reason.kind}`);
		}
	}
	const TONE: Record<ClosedReason["kind"] | "open", string> = {
		open: "bg-white hover:bg-primary-50 hover:ring-2 hover:ring-primary-300",
		weekly: "bg-surface-200 text-surface-600",
		national: "bg-error-100 text-error-900 line-through",
		holiday:
			"bg-error-200 text-error-950 font-bold line-through hover:ring-2 hover:ring-error-400",
		range: "bg-warning-100 text-warning-950 line-through",
	};

	function toggle(iso: string): void {
		holidays = holidays.includes(iso) ? holidays.filter((d) => d !== iso) : [...holidays, iso];
	}

	function toggleWeekly(d: number): void {
		weekly = weekly.includes(d) ? weekly.filter((x) => x !== d) : [...weekly, d];
	}

	function addNational(): void {
		const first = `${months[0]?.y}-${pad(months[0]?.m ?? 9)}-01`;
		const last = `${months[11]?.y ?? year}-${pad(months[11]?.m ?? 8)}-31`;
		const found = [year, year + 1].flatMap((y) => [...italianHolidays(y).keys()]);
		holidays = [...new Set([...holidays, ...found.filter((d) => d >= first && d <= last)])];
	}

	function addRange(): void {
		const today = data.current?.today ?? `${year}-09-01`;
		ranges = [...ranges, { key: nextKey++, from: today, to: today, reason: "" }];
	}

	function save(): Promise<void> {
		return editor.save(() => saveCalendarChange(draft), i18n.t("config.blocks.calendar.saved"));
	}
</script>

{#snippet month(y: number, m: number)}
	<figure class="space-y-1" data-testid="calendar-month">
		<figcaption class="font-semibold capitalize">{monthName(y, m)}</figcaption>
		<table class="w-full table-fixed text-center text-sm">
			<thead>
				<tr>
					{#each WEEK as d (d)}
						<th class="font-normal opacity-70" scope="col">{dayName(d, "narrow")}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each weeksOf(y, m) as week, w (w)}
					<tr>
						{#each week as iso, i (i)}
							<td class="p-0.5">
								{#if iso}
									{@const reason = closedReason(iso, rules)}
									{@const clickable =
										reason === null || reason.kind === "holiday"}
									<button
										type="button"
										class="w-full rounded-base py-1 {TONE[
											reason?.kind ?? 'open'
										]} {iso === data.current?.today
											? 'outline-2 outline-primary-500'
											: ''} {clickable ? 'cursor-pointer' : 'cursor-default'}"
										disabled={!clickable}
										aria-pressed={reason?.kind === "holiday"}
										aria-label="{longDate(iso)}: {describe(reason)}"
										title={describe(reason)}
										onclick={() => toggle(iso)}
										data-day={iso}>{Number(iso.slice(8))}</button
									>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</figure>
{/snippet}

<Card variant="outlined" gap="4" id="calendar" data-testid="block-calendar">
	<h2 class="title-lg">{i18n.t("config.blocks.calendar.title")}</h2>
	{#if data.current}
		<fieldset class="space-y-2">
			<legend class="label-text">{i18n.t("config.blocks.calendar.weekly")}</legend>
			<SegmentedGroup role="group">
				{#each WEEK as d (d)}
					<!-- the short name on a phone is for the eye; the full one is the button's name
					     everywhere, so what is read contains what is seen (WCAG 2.5.3) -->
					<button
						type="button"
						class="btn flex-1 px-1 sm:flex-none sm:px-4 {weekly.includes(d)
							? 'preset-filled-primary-500'
							: 'hover:preset-tonal'}"
						aria-pressed={weekly.includes(d)}
						onclick={() => toggleWeekly(d)}
						data-testid="weekly-{d}"
						><span class="sm:hidden" aria-hidden="true">{dayName(d, "short")}</span
						><span class="sr-only sm:not-sr-only">{dayName(d, "long")}</span></button
					>
				{/each}
			</SegmentedGroup>
			<Hint tone="faint">{i18n.t("config.blocks.calendar.weeklyHint")}</Hint>
		</fieldset>

		<Row align="center" justify="between">
			<Row align="center" gap="2">
				<IconButton
					icon={BackIcon}
					label={i18n.t("config.blocks.calendar.previous")}
					onclick={() => (shift -= 1)}
					data-testid="calendar-year-prev"
				/>
				<span class="font-semibold" data-testid="calendar-year">{year}/{year + 1}</span>
				<IconButton
					icon={NextIcon}
					label={i18n.t("config.blocks.calendar.next")}
					class="[&>svg]:-rotate-90"
					onclick={() => (shift += 1)}
					data-testid="calendar-year-next"
				/>
			</Row>
			<Button
				icon={AddIcon}
				onclick={addNational}
				disabled={autoHolidays}
				class="h-auto whitespace-normal max-sm:w-full"
				data-testid="calendar-add-national"
				>{i18n.t("config.blocks.calendar.addNational", {
					year: `${year}/${year + 1}`,
				})}</Button
			>
		</Row>
		<Hint tone="faint">
			{autoHolidays
				? i18n.t("config.blocks.calendar.autoOn")
				: i18n.t("config.blocks.calendar.clickHint")}
		</Hint>
		<Grid cols="3" gap="4" class="2xl:grid-cols-4">
			{#each months as mm (`${mm.y}-${mm.m}`)}
				{@render month(mm.y, mm.m)}
			{/each}
		</Grid>
		<Row gap="4" class="text-sm">
			{#each ["open", "weekly", "national", "holiday", "range"] as const as kind (kind)}
				<Row align="center" gap="1" as="span">
					<span
						class="inline-block size-4 rounded-sm border border-surface-300 {TONE[
							kind
						]}"
					></span>
					{i18n.t(`config.blocks.calendar.legend.${kind}`)}
				</Row>
			{/each}
		</Row>

		<h3 class="font-semibold">{i18n.t("config.blocks.calendar.ranges")}</h3>
		{#if ranges.length > 0}
			<div class="overflow-x-auto">
				<Table form>
					<thead>
						<tr>
							<th>{i18n.t("config.blocks.calendar.from")}</th>
							<th>{i18n.t("config.blocks.calendar.to")}</th>
							<th>{i18n.t("config.blocks.calendar.reason")}</th>
							<th><span class="sr-only">{i18n.t("common.actions.delete")}</span></th>
						</tr>
					</thead>
					<tbody>
						{#each ranges as r (r.key)}
							{@const source =
								data.current.sources.ranges[`${r.from}|${r.to}|${r.reason}`]}
							<tr data-testid="range-row">
								<td>
									<Input
										type="date"
										bind:value={r.from}
										aria-label={i18n.t("config.blocks.calendar.from")}
										data-testid="range-from"
									/>
								</td>
								<td>
									<Input
										type="date"
										bind:value={r.to}
										aria-label={i18n.t("config.blocks.calendar.to")}
										data-testid="range-to"
									/>
									{#if r.from && r.to && r.from > r.to}
										<Hint tone="error"
											>{i18n.t("config.blocks.calendar.badRange")}</Hint
										>
									{/if}
								</td>
								<td>
									<Input
										bind:value={r.reason}
										maxlength={200}
										aria-label={i18n.t("config.blocks.calendar.reason")}
										data-testid="range-reason"
									/>
									{#if source && source !== "config.json"}
										<Hint tone="faint" mono>{source}</Hint>
									{/if}
								</td>
								<td>
									<IconButton
										icon={RemoveIcon}
										label={i18n.t("common.actions.delete")}
										variant="error"
										size="sm"
										onclick={() =>
											(ranges = ranges.filter((x) => x.key !== r.key))}
									/>
								</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			</div>
		{/if}
		<Button icon={AddIcon} onclick={addRange} data-testid="range-add"
			>{i18n.t("config.blocks.calendar.addRange")}</Button
		>
		{#if editor.problem}
			<Alert>{editor.problem}</Alert>
		{/if}
		<Row justify="end">
			<DraftActions
				{dirty}
				saving={editor.saving}
				invalid={badRanges}
				onsave={save}
				onundo={load}
				testid="calendar-save"
			/>
		</Row>
	{:else}
		<Loading />
	{/if}
</Card>
