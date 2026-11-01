<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The states of a query, the same on every page: failed (an error alert, or for a record page
     an empty state with the way back to the list), loading (the one wait, or the caller's own),
     empty (when the caller says what empty is), then the content with the loaded value. -->
<script lang="ts" generics="T">
	import type { Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import Alert from "./Alert.svelte";
	import Button from "./Button.svelte";
	import EmptyState from "./EmptyState.svelte";
	import type { Href } from "./href.js";
	import Loading from "./Loading.svelte";

	type Failure =
		| {
				/** `error` (default): an alert in place of the content. */
				mode?: "error";
				/** The alert's text (default: the generic "Si è verificato un errore"). */
				errorText?: string;
				back?: never;
		  }
		| {
				/** `notFound`: the record does not exist (a detail page). */
				mode: "notFound";
				/** The list the page belongs to: the way back when the record is not found. */
				back: Href;
				errorText?: never;
		  };

	type Props = Failure & {
		query: { error: unknown } & ({ ready: false } | { ready: true; current: T });
		/** The size of the wait (`Loading`). */
		size?: "sm" | "md" | "page";
		/** A wait of the caller's own in place of `Loading`. */
		loading?: Snippet;
		/** Whether the loaded value counts as empty; `empty` is then rendered in place of the content. */
		isEmpty?: (value: T) => boolean;
		empty?: Snippet;
		children: Snippet<[T]>;
	};

	const {
		query,
		mode = "error",
		back,
		errorText,
		size = "page",
		loading,
		isEmpty,
		empty,
		children,
	}: Props = $props();
	const i18n = useI18n();
</script>

<!-- `error` first: a failed refresh leaves the query ready with its last value. Readiness is
     `ready`, never `current`: `current` is undefined exactly until the first value arrives (and on
     the server), but only `ready` says so for any value and is the flag SvelteKit sets. -->
{#if query.error}
	{#if mode === "notFound"}
		<EmptyState title={i18n.t("errors.notFound")} icon="empty">
			{#snippet action()}<Button href={back}>{i18n.t("common.actions.back")}</Button
				>{/snippet}
		</EmptyState>
	{:else}
		<Alert>{errorText ?? i18n.t("common.status.error")}</Alert>
	{/if}
{:else if !query.ready}
	{#if loading}{@render loading()}{:else}<Loading {size} />{/if}
{:else if empty && isEmpty?.(query.current)}
	{@render empty()}
{:else}
	{@render children(query.current)}
{/if}
