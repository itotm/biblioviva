<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Why a configuration change was refused (Phase 11): what it would take away while books, copies
     or students still use it — a code with its books, an item type with its copies, a section or a
     class with its students. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import Alert from "#lib/ui/Alert.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";

	interface Props {
		problems: {
			kind: "classification" | "itemType" | "level" | "readingLevel";
			code: string;
			count: number;
		}[];
	}

	const { problems }: Props = $props();
	const i18n = useI18n();
</script>

<Alert as="div" data-testid="config-in-use">
	<p class="font-semibold">{i18n.t("config.section.inUse")}</p>
	<BulletList>
		{#each problems as p (`${p.kind}:${p.code}`)}
			<li>
				{i18n.t(`config.section.inUseKinds.${p.kind}`, { code: p.code, count: p.count })}
			</li>
		{/each}
	</BulletList>
</Alert>
