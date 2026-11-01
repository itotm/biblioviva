<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A configuration section as JSON (step 11.2): the text as its file writes it, checked while
     typing with the same schema the loader uses (the whole folder, so a problem anywhere shows),
     saved as one configuration change. For what the forms do not cover yet. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { checkConfigSectionJson, saveConfigSectionJson } from "#lib/remote/config.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import InUseList from "./InUseList.svelte";

	type Issue = Awaited<ReturnType<typeof checkConfigSectionJson>>[number];
	type Problem = Extract<
		Awaited<ReturnType<typeof saveConfigSectionJson>>,
		{ ok: false }
	>["inUse"][number];

	interface Props {
		section: string;
		file: string;
		raw: Record<string, unknown>;
		/** The text differs from the saved section (for the leave guard). */
		dirty?: boolean;
		onsaved: () => void | Promise<void>;
	}

	let { section, file, raw, dirty = $bindable(false), onsaved }: Props = $props();
	const i18n = useI18n();
	const SaveIcon = icons.save;
	const UndoIcon = icons.undo;

	const format = (value: unknown): string => `${JSON.stringify(value, null, "\t")}\n`;
	// svelte-ignore state_referenced_locally
	let text = $state(format(raw));
	// svelte-ignore state_referenced_locally
	let saved = $state(format(raw));
	let issues = $state<Issue[] | null>(null);
	let inUse = $state<Problem[]>([]);
	let saving = $state(false);
	let sequence = 0;

	const parsed = $derived.by((): { value: Record<string, unknown> } | { error: string } => {
		try {
			const value: unknown = JSON.parse(text);
			return typeof value === "object" && value !== null && !Array.isArray(value)
				? { value: value as Record<string, unknown> }
				: { error: i18n.t("config.section.json.notObject") };
		} catch (e) {
			return {
				error: i18n.t("config.section.json.parseError", { message: (e as Error).message }),
			};
		}
	});
	$effect(() => {
		dirty = text !== saved;
	});

	// checked a moment after typing stops
	$effect(() => {
		const current = parsed;
		const mine = ++sequence;
		issues = null;
		if (!("value" in current)) {
			return;
		}
		const timer = setTimeout(() => {
			checkConfigSectionJson({ section, value: current.value })
				.then((found) => {
					if (mine === sequence) {
						issues = found;
					}
				})
				.catch(() => {
					if (mine === sequence) {
						issues = [];
					}
				});
		}, 400);
		return () => clearTimeout(timer);
	});

	const errors = $derived(issues?.filter((i) => i.level === "error") ?? []);

	async function save(): Promise<void> {
		if (!("value" in parsed)) {
			return;
		}
		saving = true;
		inUse = [];
		try {
			const result = await saveConfigSectionJson({ section, value: parsed.value });
			if (result.ok) {
				saved = text;
				toaster.success({ title: i18n.t("config.section.saved") });
				await onsaved();
			} else {
				issues = result.issues;
				inUse = result.inUse;
			}
		} finally {
			saving = false;
		}
	}
</script>

<div class="space-y-3" data-testid="section-json">
	<Hint>{i18n.t("config.section.json.hint", { file })}</Hint>
	<textarea
		class="textarea min-h-[50vh] font-mono text-sm"
		spellcheck="false"
		bind:value={text}
		aria-label={i18n.t("config.section.json.label")}
		data-testid="section-json-text"></textarea>
	{#if "error" in parsed}
		<Alert data-testid="section-json-parse-error">{parsed.error}</Alert>
	{:else if issues === null}
		<Hint tone="faint">{i18n.t("config.section.json.checking")}</Hint>
	{:else if errors.length > 0}
		<Alert as="div" data-testid="section-json-issues">
			<p class="font-semibold">{i18n.t("config.section.json.issues")}</p>
			<BulletList>
				{#each errors as issue, i (i)}
					<li><code>{issue.path}</code>: {issue.message}</li>
				{/each}
			</BulletList>
		</Alert>
	{:else}
		<Hint tone="primary" data-testid="section-json-valid"
			>{i18n.t("config.section.json.valid")}</Hint
		>
	{/if}
	{#if inUse.length > 0}
		<InUseList problems={inUse} />
	{/if}
	<Row justify="end">
		<Button
			icon={UndoIcon}
			onclick={() => (text = saved)}
			disabled={!dirty || saving}
			data-testid="section-json-discard">{i18n.t("config.section.discard")}</Button
		>
		<Button
			variant="primary"
			icon={SaveIcon}
			onclick={save}
			disabled={!dirty || saving || "error" in parsed || errors.length > 0}
			data-testid="section-json-save">{i18n.t("config.section.save")}</Button
		>
	</Row>
</div>
