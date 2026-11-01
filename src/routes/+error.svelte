<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
	import { page } from "$app/state";
	import { useI18n } from "#lib/i18n/context.js";
	import Button from "#lib/ui/Button.svelte";

	const i18n = useI18n();
	const message = $derived.by(() => {
		// what the public demo refused (9.17) is said as it is, never as an error number
		if (page.error?.demo) {
			return page.error.message;
		}
		switch (page.status) {
			case 404:
				return i18n.t("errors.notFound");
			case 403:
				return i18n.t("errors.forbidden");
			case 401:
				return i18n.t("errors.unauthorized");
			default:
				return i18n.t("errors.generic", { status: page.status });
		}
	});
</script>

<svelte:head><title>{message} · {i18n.t("common.app.name")}</title></svelte:head>

<main class="mx-auto max-w-xl space-y-4 p-8 text-center">
	<h1 class="h2">{message}</h1>
	<Button variant="primary" href="/">{i18n.t("errors.backHome")}</Button>
</main>
