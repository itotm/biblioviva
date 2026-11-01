<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Fast add, the metadata lookup (step 3.6, 9.14): the providers asked and how each answered, the
     records they found (the most complete first) to pick from, and the ways on: by hand, by title,
     again, another book. -->
<script lang="ts">
	import type { lookupMetadata } from "#lib/remote/cataloging.remote.js";
	import type { BiblioDraft } from "#lib/server/metadata/types.js";
	import { formatSeries } from "#lib/shared/series.js";
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Spinner from "#lib/ui/Spinner.svelte";

	interface Props {
		lookup: ReturnType<typeof lookupMetadata>;
		/** The lookup was by ISBN: a search by title is offered too. */
		byIsbn: boolean;
		/** The providers being asked, for the progress line. */
		searchingOn: string;
		providerName: (id: string) => string;
		onpick: (record: BiblioDraft) => void;
		onmanual: () => void;
		onsearch: () => void;
		onretry: () => void;
		onback: () => void;
	}

	const {
		lookup,
		byIsbn,
		searchingOn,
		providerName,
		onpick,
		onmanual,
		onsearch,
		onretry,
		onback,
	}: Props = $props();
	const i18n = useI18n();
	const SearchIcon = icons.search;
	const EditIcon = icons.edit;
	const BackIcon = icons.back;
	const RetryIcon = icons.renew;
	const CheckIcon = icons.available;
	const ErrorIcon = icons.damaged;
</script>

<section class="space-y-4" data-testid="stage-lookup">
	<QueryState query={lookup}>
		{#snippet loading()}
			<Card class="flex items-center gap-3" aria-live="polite" data-testid="lookup-progress">
				<Spinner size="lg" />
				<span>{i18n.t("catalog.fastAdd.lookup.searching", { providers: searchingOn })}</span
				>
			</Card>
		{/snippet}
		{#snippet children(found)}
			<Row as="ul" class="text-sm" data-testid="provider-status">
				{#each found.providers as p (p.provider)}
					<Badge
						as="li"
						tone={p.error ? "error" : "success"}
						title={p.error ? i18n.t(`catalog.lookup.errors.${p.error}`) : undefined}
						data-testid="provider-{p.provider}"
					>
						{#if p.error}
							<ErrorIcon size={ICON_SIZE.sm} aria-hidden="true" />
						{:else}
							<CheckIcon size={ICON_SIZE.sm} aria-hidden="true" />
						{/if}
						<span
							>{p.name}: {p.error
								? i18n.t("catalog.fastAdd.lookup.failed")
								: i18n.t("catalog.fastAdd.lookup.providerOk", {
										count: p.count,
									})}{p.cached
								? ` (${i18n.t("catalog.fastAdd.lookup.providerCached")})`
								: ""}</span
						>
					</Badge>
				{/each}
			</Row>
			{#each found.providers.filter((p) => p.error) as p (p.provider)}
				<p class="card preset-tonal-error px-4 py-2 text-sm" role="alert">
					<strong>{p.name}:</strong>
					{i18n.t(`catalog.lookup.errors.${p.error}`)}
				</p>
			{/each}
			{#if found.candidates.length === 0}
				<div class="card">
					<EmptyState title={i18n.t("catalog.fastAdd.lookup.none")} icon="book" />
				</div>
			{:else}
				<h2 class="h4">{i18n.t("catalog.fastAdd.lookup.heading")}</h2>
				<Grid gap="3" as="ul" data-testid="candidates">
					{#each found.candidates as c, i (`${c.source}:${c.sourceId ?? i}`)}
						<Card as="li" class="flex flex-col gap-2" data-testid="candidate">
							<Row wrap={false} align="start" justify="between">
								<p class="text-lg leading-tight font-semibold">
									{c.title}{c.subtitle ? ` : ${c.subtitle}` : ""}
								</p>
								<Badge
									tone="secondary"
									class="shrink-0"
									data-testid="candidate-source"
								>
									{providerName(c.source)}
								</Badge>
							</Row>
							{#if c.originalTitle}
								<p
									class="text-sm italic opacity-70"
									data-testid="candidate-original"
								>
									{i18n.t("catalog.fields.originalTitle")}: {c.originalTitle}
								</p>
							{/if}
							<p class="opacity-80">{c.author}</p>
							{#if i === 0 && found.candidates.length > 1}
								<Badge
									tone="success"
									class="self-start"
									data-testid="candidate-best"
									>{i18n.t("catalog.fastAdd.lookup.best")}</Badge
								>
							{/if}
							{#if c.series}
								<Hint data-testid="candidate-series"
									>{formatSeries(c.series, c.seriesNumber)}</Hint
								>
							{/if}
							<Hint>
								{[c.publicationPlace, c.publisher]
									.filter(Boolean)
									.join(" : ")}{c.publicationYear ? `, ${c.publicationYear}` : ""}
							</Hint>
							{#if c.physicalDescription || c.isbn}
								<Hint>
									{[c.physicalDescription, c.isbn ? `ISBN ${c.isbn}` : null]
										.filter(Boolean)
										.join(" · ")}
								</Hint>
							{/if}
							<div class="mt-auto pt-2">
								<Button
									variant="primary"
									full
									icon={CheckIcon}
									onclick={() => onpick(c)}
									autofocus={i === 0}
									data-testid="pick-candidate"
									>{i18n.t("catalog.fastAdd.lookup.pick")}</Button
								>
							</div>
						</Card>
					{/each}
				</Grid>
			{/if}
		{/snippet}
	</QueryState>
	<Row>
		<Button icon={EditIcon} onclick={onmanual} data-testid="lookup-manual"
			>{i18n.t("catalog.fastAdd.lookup.manual")}</Button
		>
		{#if byIsbn}
			<Button icon={SearchIcon} onclick={onsearch}
				>{i18n.t("catalog.fastAdd.lookup.bySearch")}</Button
			>
		{/if}
		{#if lookup.current?.providers.some((p) => p.error)}
			<Button icon={RetryIcon} onclick={onretry} data-testid="lookup-retry"
				>{i18n.t("catalog.fastAdd.lookup.retry")}</Button
			>
		{/if}
		<Button icon={BackIcon} onclick={onback} data-testid="lookup-back"
			>{i18n.t("catalog.fastAdd.lookup.another")}</Button
		>
	</Row>
</section>
