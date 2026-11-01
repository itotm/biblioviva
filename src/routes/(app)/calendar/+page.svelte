<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The library calendar (steps 4.1, 9.25): each month of the school year with its open and closed
     days and the notable dates; every closure (days in a row for one reason on one line) and every
     date is listed under its month (colour is never the only cue). The accounts with `loans` add and
     edit the dates; the closures are edited in Administration, on the "Calendario" settings page
     (step 11.5; no link from here, 9.13 round 25). -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import CalendarEventDialog from "#lib/components/calendar/CalendarEventDialog.svelte";
	import {
		closureRuns,
		weekOrder,
		weekPosition,
		type ClosedReason,
		type ClosureRun,
	} from "#lib/shared/calendar-core.js";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { getCalendarEvents } from "#lib/remote/calendar.remote.js";
	import type { CalendarEventRow } from "#lib/server/services/calendar-events.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const BackIcon = icons.back;
	const AddIcon = icons.add;
	const DateIcon = icons.calendarDate;
	/** A notable date: the day's number extra bold, coloured and underlined, over the closure tints
	 *  (9.13, round 24: the owner's choice among the marks drawn). */
	const DATE_MARK =
		"font-extrabold text-tertiary-700 underline decoration-tertiary-500 decoration-2 underline-offset-2";
	const t = (key: string, params?: Record<string, unknown>): string =>
		i18n.t(`circulation.calendar.${key}`, params);

	const events = $derived(getCalendarEvents(data.range));
	const dates = $derived(events.current ?? []);
	let dialog = $state(false);
	let edited = $state<CalendarEventRow | null>(null);

	/** The dates touching a month (`YYYY-MM`), a period in every month it crosses. */
	const datesOf = (month: string): CalendarEventRow[] =>
		dates.filter(
			(e) => e.startsOn.slice(0, 7) <= month && (e.endsOn ?? e.startsOn).slice(0, 7) >= month,
		);
	/** The closures of the year (weekly ones left out), days in a row for one reason joined. */
	const runs = $derived(closureRuns(data.months.flatMap((m) => m.days)));
	/** The closures touching a month, a run in every month it crosses. */
	const closuresOf = (month: string): ClosureRun[] =>
		runs.filter((r) => r.from.slice(0, 7) <= month && r.to.slice(0, 7) >= month);
	const hasDate = (iso: string): boolean =>
		dates.some((e) => e.startsOn <= iso && (e.endsOn ?? e.startsOn) >= iso);

	const monthName = (month: string): string =>
		fmt.day(`${month}-15`, { month: "long", year: "numeric" });
	/** 0 = Sunday … 6 = Saturday (7 is Sunday too, for the ISO numbers of the settings). */
	const dayName = (jsWeekday: number): string =>
		// 2026-09-20 is a Sunday
		fmt.day(`2026-09-${20 + (jsWeekday % 7)}`, { weekday: "narrow" });
	const longDate = (iso: string): string =>
		fmt.day(iso, { weekday: "short", day: "numeric", month: "short" });
	const span = (from: string, to: string | null): string =>
		to && to !== from
			? t("period", { from: longDate(from), to: longDate(to) })
			: longDate(from);
	const when = (e: CalendarEventRow): string => span(e.startsOn, e.endsOn);
	const reasonText = (r: ClosedReason): string =>
		r.kind === "national"
			? i18n.t(`circulation.calendar.national.${r.name}`)
			: r.kind === "range"
				? r.reason || i18n.t("circulation.calendar.kinds.range")
				: i18n.t(`circulation.calendar.kinds.${r.kind}`);
	const TONE: Record<ClosedReason["kind"], string> = {
		weekly: "bg-surface-200 text-surface-700",
		national: "bg-error-100 text-error-900",
		holiday: "bg-error-100 text-error-900",
		range: "bg-warning-100 text-warning-900",
	};
	/** The closures' tints and the mark of the dates (a sample number), each with its name. */
	const legend = $derived([
		...(["weekly", "national", "range"] as const).map((k) => ({
			look: TONE[k],
			label: i18n.t(`circulation.calendar.kinds.${k}`),
			sample: "",
		})),
		{ look: DATE_MARK, label: t("legendDate"), sample: "3" },
	]);
	// the configured first day of the week (9.13, round 17)
	const weekdays = $derived(weekOrder(data.weekStart));
	const weeklyNames = $derived(
		data.settings.weeklyClosedDays.map((d) => dayName(d === 0 ? 7 : d)).join(", "),
	);
	/** A new date starts today when today is in the year shown, else on its first day. */
	const newDay = $derived(
		data.today >= data.range.from && data.today <= data.range.to ? data.today : data.range.from,
	);

	function open(e: CalendarEventRow | null): void {
		edited = e;
		dialog = true;
	}
</script>

<Page width="2xl">
	<PageHeader title={t("title")} icon="calendar">
		{#snippet actions()}
			{#if data.canWrite}
				<Button
					variant="primary"
					icon={AddIcon}
					onclick={() => open(null)}
					data-testid="calendar-new">{t("newDate")}</Button
				>
			{/if}
		{/snippet}
		{#snippet views()}
			{#if data.canWrite}
				<AreaTabs area="circulation" current="calendar" />
			{/if}
		{/snippet}
	</PageHeader>
	<Card gap="2" as="section" data-testid="calendar-settings">
		<!-- the year is chosen in the page, the header keeps the action (9.13, round 16) -->
		<Row align="center" justify="between">
			<Button
				size="sm"
				icon={BackIcon}
				href={resolve(`calendar?year=${data.prev.year}`)}
				data-testid="calendar-prev">{data.prev.label}</Button
			>
			<h2 class="title-lg" data-testid="calendar-year">
				{i18n.t("circulation.calendar.schoolYear", { year: data.label })}
			</h2>
			<Button
				size="sm"
				href={resolve(`calendar?year=${data.next.year}`)}
				data-testid="calendar-next">{data.next.label}</Button
			>
		</Row>
		<Hint>
			{i18n.t("circulation.calendar.settings", {
				weekly: weeklyNames,
				national: i18n.t(
					data.settings.autoItalianHolidays
						? "circulation.calendar.yes"
						: "circulation.calendar.no",
				),
				mode: i18n.t(`circulation.calendar.modes.${data.settings.dueDateMode}`),
			})}
			{#if data.settings.hardDueDate}
				{i18n.t("circulation.calendar.hardDueDate", {
					date: longDate(data.settings.hardDueDate),
				})}
			{/if}
			{t("hint")}
		</Hint>
		<Row gap="3" as="ul" class="text-sm" aria-label={i18n.t("circulation.calendar.legend")}>
			{#each legend as l (l.label)}
				<li class="flex items-center gap-1">
					<span
						class="inline-flex size-4 items-center justify-center rounded text-xs {l.look}"
						aria-hidden="true">{l.sample}</span
					>
					{l.label}
				</li>
			{/each}
		</Row>
	</Card>
	<Grid cols="3" from="md" gap="4">
		{#each data.months as m (m.month)}
			{@const lead = m.days[0] ? weekPosition(m.days[0].date, data.weekStart) : 0}
			{@const monthDates = datesOf(m.month)}
			<Card gap="2" as="section" data-testid="month-{m.month}">
				<Row justify="between" align="center" as="h2" class="font-semibold capitalize">
					<span>{monthName(m.month)}</span>
					<Hint as="span"
						>{i18n.t("circulation.calendar.openDays", { count: m.openDays })}</Hint
					>
				</Row>
				<div class="grid grid-cols-7 gap-0.5 text-center text-xs">
					{#each weekdays as w (w)}
						<span class="py-1 font-semibold opacity-60" data-testid="weekday-header"
							>{dayName(w)}</span
						>
					{/each}
					{#each Array.from({ length: lead }) as _, i (i)}
						<span></span>
					{/each}
					{#each m.days as d (d.date)}
						{@const marked = hasDate(d.date)}
						<span
							class="rounded py-1 {d.closed ? TONE[d.closed.kind] : ''} {marked
								? DATE_MARK
								: ''} {d.date === data.today
								? `ring-2 ring-primary-500 ${marked ? '' : 'font-bold'}`
								: ''}"
							title={d.closed ? reasonText(d.closed) : undefined}
							data-date={d.date}
							data-closed={d.closed?.kind ?? "open"}
							data-marked={marked ? "date" : undefined}
							>{Number(d.date.slice(8))}</span
						>
					{/each}
				</div>
				{@const closures = closuresOf(m.month)}
				{#if closures.length > 0}
					<ul class="space-y-0.5 text-xs" data-testid="closures-{m.month}">
						{#each closures as r (r.from)}
							<li>
								<span class="font-semibold">{span(r.from, r.to)}</span> · {reasonText(
									r.closed,
								)}
							</li>
						{/each}
					</ul>
				{/if}
				{#if monthDates.length > 0}
					<ul class="space-y-1 text-sm" data-testid="dates-{m.month}">
						{#each monthDates as e (e.id)}
							<li class="flex items-start gap-1.5">
								<DateIcon
									size={ICON_SIZE.sm}
									class="mt-0.5 shrink-0 text-tertiary-700"
									aria-hidden="true"
								/>
								<div class="min-w-0">
									{#if data.canWrite}
										<button
											type="button"
											class="text-left font-semibold hover:underline"
											aria-label={t("edit", { title: e.title })}
											onclick={() => open(e)}
											data-testid="calendar-date">{e.title}</button
										>
									{:else}
										<span class="font-semibold" data-testid="calendar-date"
											>{e.title}</span
										>
									{/if}
									<Hint as="span" class="block">{when(e)}</Hint>
									{#if e.notes}
										<p class="whitespace-pre-line opacity-80">{e.notes}</p>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</Card>
		{/each}
	</Grid>
</Page>

{#if data.canWrite}
	<CalendarEventDialog
		bind:open={dialog}
		{edited}
		day={newDay}
		onsaved={() => void events.refresh()}
	/>
{/if}
