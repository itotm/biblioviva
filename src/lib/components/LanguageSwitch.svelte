<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The language switch of the public demo (Q120, ADR-047): the globe, then a toggle for each
     language (IT · EN, as on the home page and the documentation of biblioviva.org). A choice is kept
     in the cookie `bv_lang`, shared with those two sites, and the page opens again in that language.
     An installation at a school has none: one language for every device. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { localeDisplayName } from "#lib/i18n/index.js";
	import { languageCookie } from "#lib/shared/demo-language.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import ToggleButton from "#lib/ui/ToggleButton.svelte";

	interface Props {
		/** The languages a visitor can pick, the installation's first. */
		languages: readonly string[];
		current: string;
		class?: string;
	}

	const { languages, current, class: className = "" }: Props = $props();
	const i18n = useI18n();
	const LanguageIcon = icons.language;

	function choose(code: string): void {
		if (code === current) {
			return;
		}
		document.cookie = languageCookie(code, location.hostname, location.protocol === "https:");
		location.reload();
	}
</script>

<SegmentedGroup
	fit
	radio
	class="items-center {className}"
	aria-label={i18n.t("common.demoPublic.language")}
	data-testid="language-switch"
>
	<LanguageIcon size={ICON_SIZE.sm} class="mx-1 shrink-0 text-surface-600" aria-hidden="true" />
	{#each languages as code (code)}
		<ToggleButton
			role="radio"
			pressed={code === current}
			lang={code}
			title={localeDisplayName(code)}
			aria-label={localeDisplayName(code)}
			onclick={() => choose(code)}
			data-testid="language-{code}">{code.toUpperCase()}</ToggleButton
		>
	{/each}
</SegmentedGroup>
