<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The mark of an approximate search result (step 9.24): icon and "Simile", with the reason in the
     tooltip, so colour is never the only cue. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import Badge from "#lib/ui/Badge.svelte";
	import { icons } from "#lib/ui/icons.js";

	const i18n = useI18n();
	const SimilarIcon = icons.similar;
</script>

<Badge
	tone="warning"
	icon={SimilarIcon}
	class="shrink-0"
	title={i18n.t("common.similar.hint")}
	data-testid="similar-badge">{i18n.t("common.similar.label")}</Badge
>
