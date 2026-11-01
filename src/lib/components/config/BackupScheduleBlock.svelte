<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- When the next backups happen (step 11.8): the next three runs of the cron expression typed in
     the form above, in the library's time zone, or why the expression is not understood. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { nextCronRuns } from "#lib/shared/cron.js";
	import { useFormat } from "#lib/ui/format.js";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";

	interface Props {
		cron: string;
	}

	const { cron }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const runs = $derived(nextCronRuns(cron, new Date(), fmt.timezone, 3));
	const format = (d: Date): string =>
		fmt.date(d, {
			weekday: "long",
			day: "numeric",
			month: "long",
			hour: "2-digit",
			minute: "2-digit",
		});
</script>

<Card variant="outlined" gap="2" data-testid="block-backupSchedule">
	<h2 class="title-lg">{i18n.t("config.blocks.backupSchedule.title")}</h2>
	{#if runs === null}
		<Hint tone="error" data-testid="backup-next-invalid"
			>{i18n.t("config.blocks.backupSchedule.invalid")}</Hint
		>
	{:else if runs.length === 0}
		<Hint>{i18n.t("config.blocks.backupSchedule.never")}</Hint>
	{:else}
		<ol class="list-inside list-decimal" data-testid="backup-next">
			{#each runs as r (r.getTime())}
				<li>{format(r)}</li>
			{/each}
		</ol>
	{/if}
	<Hint tone="faint"
		>{i18n.t("config.blocks.backupSchedule.hint", { timezone: fmt.timezone })}</Hint
	>
</Card>
