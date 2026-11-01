<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
	import "../app.css";
	import ToastStack from "#lib/ui/ToastStack.svelte";
	import WaitOverlay from "#lib/ui/WaitOverlay.svelte";
	import { desktopToaster, phoneToaster, toaster } from "#lib/ui/toaster.js";
	import { provideI18n } from "#lib/i18n/context.js";
	import { createFormat, provideFormat } from "#lib/ui/format.js";
	import { provideCodeTable } from "#lib/scanner/context.js";
	import { buildCodeTable } from "#lib/shared/barcodes/table.js";
	import { installPrompt } from "#lib/ui/install-prompt.svelte.js";
	import { onMount } from "svelte";
	import { afterNavigate, beforeNavigate } from "$app/navigation";
	import { debugReport } from "#lib/debug.js";
	import { updated } from "$app/state";
	import { DEMO_REPLACED_HEADER } from "#lib/shared/demo.js";

	const { data, children } = $props();
	// Marks the document once the client has hydrated (e2e tests wait for it before typing).
	onMount(() => {
		document.documentElement.dataset.hydrated = "true";
	});
	// After an update of the server, a phone that kept the app open would go on with the old
	// code (the previous scanner, for example): the next navigation loads the page afresh, which
	// brings the new build (9.13, round 9). SvelteKit notices the new version on the next server
	// answer, when the tab becomes visible again and every hour.
	beforeNavigate(({ willUnload, to }) => {
		if (updated.current && !willUnload && to?.url) {
			location.href = to.url.href;
		}
	});
	// diagnostic log (9.13, round 12): every page opened and every script error of the browser
	afterNavigate(({ from, to, type }) => {
		debugReport("nav", type, {
			from: from?.url.pathname ?? null,
			to: to?.url.pathname ?? null,
		});
	});
	onMount(() => {
		const onError = (e: ErrorEvent): void =>
			debugReport("error", "script", {
				message: e.message,
				source: `${e.filename}:${String(e.lineno)}:${String(e.colno)}`,
			});
		const onRejection = (e: PromiseRejectionEvent): void => {
			// what the public demo refuses is said, not lost (9.17)
			const body = (e.reason as { body?: { message?: string; demo?: boolean } } | null)?.body;
			if (body?.demo && body.message) {
				toaster.warning({ title: body.message });
				e.preventDefault();
				return;
			}
			debugReport("error", "promise", {
				message: e.reason instanceof Error ? e.reason.message : String(e.reason),
			});
		};
		window.addEventListener("error", onError);
		window.addEventListener("unhandledrejection", onRejection);
		return () => {
			window.removeEventListener("error", onError);
			window.removeEventListener("unhandledrejection", onRejection);
		};
	});
	// the public demo replaces what a visitor sends with an example (Q121): an answer that says
	// so becomes a notification, at most once every few seconds
	onMount(() => {
		if (!data.demoPublic) {
			return;
		}
		// the root layout lives as long as the page: the wrapper is never taken off
		const original = window.fetch.bind(window);
		let last = 0;
		window.fetch = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
			const response = await original(...args);
			if (response.headers.has(DEMO_REPLACED_HEADER) && Date.now() - last > 5000) {
				last = Date.now();
				toaster.info({ title: data.i18n.t("common.demoPublic.replaced") });
			}
			return response;
		}) as typeof fetch;
	});
	// the installation offer comes once, when the page loads (step 9.9)
	onMount(() => installPrompt.listen());
	// The instance is created once per request/session by +layout.ts; context is set at init on purpose.
	// svelte-ignore state_referenced_locally
	provideI18n(data.i18n);
	// dates and numbers in the installation's language and the library's zone, read from the data at every call
	provideFormat(createFormat(() => data));
	// svelte-ignore state_referenced_locally
	provideCodeTable(buildCodeTable(data.codeFormats));
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon.png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content={data.themeColor} />
</svelte:head>

{@render children()}

<!-- "Caricamento…" over the whole screen while the next page loads or a wait is held (login too) -->
<WaitOverlay />

<!-- Desktop: bottom right; phones: top centre (the bottom holds the navigation bar). -->
<ToastStack toaster={desktopToaster} closeLabel={data.i18n.t("common.actions.close")} />
<ToastStack toaster={phoneToaster} closeLabel={data.i18n.t("common.actions.close")} />
