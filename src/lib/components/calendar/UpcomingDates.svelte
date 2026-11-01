<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Prossime date" on the dashboard (step 9.25): the notable dates still running or coming in the
     next days, the nearest first, with the way to the calendar. -->
<script lang="ts">
	import DatedRow from "#lib/components/DatedRow.svelte";
	import type { CalendarEventRow } from "#lib/server/services/calendar-events.js";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { UPCOMING_DAYS } from "#lib/shared/calendar-events.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import DividedList from "#lib/ui/DividedList.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";

	interface Props {
		upcoming: { events: CalendarEventRow[]; total: number };
	}

	const { upcoming }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const DateIcon = icons.calendarDate;
	const CalendarIcon = icons.calendar;
	const day = (iso: string): string =>
		fmt.day(iso, { weekday: "short", day: "numeric", month: "short" });
	const when = (e: CalendarEventRow): string =>
		e.endsOn
			? i18n.t("circulation.calendar.period", { from: day(e.startsOn), to: day(e.endsOn) })
			: day(e.startsOn);
</script>

<Card gap="3" as="section" data-testid="upcoming-dates">
	<Row as="h2" align="center" gap="2" class="font-semibold">
		<DateIcon size={ICON_SIZE.md} aria-hidden="true" />
		{i18n.t("dashboard.upcoming.title")}
	</Row>
	{#if upcoming.events.length === 0}
		<Hint>{i18n.t("dashboard.upcoming.none", { days: UPCOMING_DAYS })}</Hint>
	{:else}
		<DividedList>
			{#each upcoming.events as e (e.id)}
				<DatedRow title={e.title} hint={e.notes ?? ""} when={when(e)} />
			{/each}
		</DividedList>
		{#if upcoming.total > upcoming.events.length}
			<Hint
				>{i18n.t("dashboard.upcoming.more", {
					count: upcoming.total - upcoming.events.length,
				})}</Hint
			>
		{/if}
	{/if}
	<Row>
		<Button icon={CalendarIcon} href="/calendar" data-testid="upcoming-open"
			>{i18n.t("dashboard.upcoming.open")}</Button
		>
	</Row>
</Card>
