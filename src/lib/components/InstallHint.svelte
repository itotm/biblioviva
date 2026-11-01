<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The "add to the Home screen" hint of the dashboard (step 9.9): phones only, while Chromium
     offers the installation; "Installa" opens the browser's dialog, "Non ora" hides it for good in
     this browser. Firefox for Android installs from its menu: the hint says where. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { installPrompt } from "#lib/ui/install-prompt.svelte.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";

	const i18n = useI18n();
	const InstallIcon = icons.install;
</script>

{#if installPrompt.available}
	<Card gap="3" as="section" class="md:hidden" data-testid="install-hint">
		<Row as="h2" align="center" gap="2" wrap={false} class="font-semibold">
			<InstallIcon size={ICON_SIZE.md} aria-hidden="true" />
			{i18n.t("dashboard.install.title")}
		</Row>
		<Hint tone="soft">{i18n.t("dashboard.install.hint")}</Hint>
		{#if installPrompt.fromMenu}
			<p data-testid="install-from-menu">{i18n.t("dashboard.install.fromMenu")}</p>
		{/if}
		<Row>
			{#if !installPrompt.fromMenu}
				<Button
					variant="primary"
					icon={InstallIcon}
					onclick={() => installPrompt.install()}
					data-testid="install-app">{i18n.t("dashboard.install.install")}</Button
				>
			{/if}
			<Button onclick={() => installPrompt.dismiss()} data-testid="install-later"
				>{i18n.t("dashboard.install.later")}</Button
			>
		</Row>
	</Card>
{/if}
