<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Test harness of `src/lib/ui/page-title.test.ts`: a `PageHeader` inside the app shell (the bar's store
     provided, as the app layout does) or outside it (the style guide). -->
<script lang="ts">
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import { providePageHeader } from "#lib/ui/page-header.svelte.js";

	interface Props {
		shell: boolean;
		title: string;
		docTitle?: string;
	}

	const { shell, title, docTitle }: Props = $props();
	// svelte-ignore state_referenced_locally
	if (shell) {
		providePageHeader();
	}
</script>

<svelte:head><title>Layout</title></svelte:head>
<PageHeader {title} {docTitle} />
