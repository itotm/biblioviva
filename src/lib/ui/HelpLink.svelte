<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A small help icon beside a heading or a field that is trickier than the rest of its page (step
     9.5b): it opens, in a new tab, the section of the documentation that explains it, in the
     installation's language. Quiet on purpose: the secondary tone, the help icon of the top bar,
     no text; the name and the tooltip say "Guida: <topic>". On a touch screen the tap area is
     44 px without the icon growing. The target is one entry of `HELP_SPOTS` (`help-spots.ts`). -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { docsBase, helpHref } from "#lib/ui/help-links.js";
	import { HELP_SPOTS, type HelpSpot } from "#lib/ui/help-spots.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";

	interface Props {
		/** What the icon opens: a key of `HELP_SPOTS`. */
		spot: HelpSpot;
		/** What it explains, as the heading or the field beside it names it. */
		topic: string;
		class?: string;
	}

	const { spot, topic, class: className = "" }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const Icon = icons.help;
	const href = $derived(helpHref(docsBase(fmt.locale), HELP_SPOTS[spot]));
	const label = $derived(i18n.t("common.help.link", { topic }));
	const classes = $derived(
		[
			"relative inline-flex size-6 shrink-0 items-center justify-center rounded-full text-surface-600 transition-colors hover:bg-surface-200 hover:text-primary-700 pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']",
			className,
		].join(" "),
	);
</script>

<a
	{href}
	target="_blank"
	rel="external noopener"
	class={classes}
	aria-label={label}
	title={label}
	data-testid="help-spot"
	data-spot={spot}
>
	<Icon size={ICON_SIZE.sm} aria-hidden="true" />
</a>
