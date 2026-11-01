<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Summary of remote-form validation issues (SvelteKit `RemoteFormIssue[]`), announced to screen readers. -->
<script lang="ts">
	import type { RemoteFormIssue } from "$app/server";
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import BulletList from "#lib/ui/BulletList.svelte";

	interface Props {
		issues: RemoteFormIssue[] | undefined | null;
		/** Optional map from field path (`a.b`) to a human label. */
		labels?: Record<string, string>;
		/** Free-form message shown alone (e.g. a server error). */
		message?: string;
		class?: string;
	}

	const { issues, labels = {}, message, class: className = "" }: Props = $props();
	const i18n = useI18n();
	const Icon = icons.damaged;
	const list = $derived(issues ?? []);

	function fieldLabel(path: (string | number)[]): string | null {
		if (path.length === 0) {
			return null;
		}
		const key = path.join(".");
		return labels[key] ?? i18n.t("common.form.field", { field: key });
	}
</script>

{#if list.length > 0 || message}
	<div
		class="flex gap-3 rounded-base bg-error-100 px-3 py-2 text-sm text-error-900 {className}"
		role="alert"
		data-testid="form-errors"
	>
		<Icon size={ICON_SIZE.md} class="mt-0.5 shrink-0" aria-hidden="true" />
		<div class="space-y-1">
			{#if message}<p>{message}</p>{/if}
			{#if list.length > 0}
				<p class="font-semibold">{i18n.t("common.form.errorsTitle")}</p>
				<BulletList>
					{#each list as issue, i (i)}
						{@const label = fieldLabel(issue.path)}
						<li>{label ? `${label}: ` : ""}{issue.message}</li>
					{/each}
				</BulletList>
			{/if}
		</div>
	</div>
{/if}
