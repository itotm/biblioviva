<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- One key of a generated settings form (step 11.2): the input its type calls for (text, number,
     yes/no, a choice, several choices, a list, a date, a fixed value), its label and explanation,
     the key itself for whoever edits the files, the default and "Torna al predefinito". -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import Button from "#lib/ui/Button.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { fieldProblem, sameValue, type SettingField } from "./settings-form.js";

	interface Props {
		field: SettingField;
		value: unknown;
		/** Marked to go back to its default on save. */
		resetting: boolean;
		/** Problems the server reported for this key. */
		errors?: string[];
		onchange: (value: unknown) => void;
		onreset: (on: boolean) => void;
		/** Shown under the input with the value being edited (the sound's "Ascolta"). */
		extra?: Snippet<[unknown]>;
	}

	const { field, value, resetting, errors = [], onchange, onreset, extra }: Props = $props();
	const i18n = useI18n();
	const ResetIcon = icons.undo;
	const id = $derived(`setting-${field.path}`);
	const label = $derived(i18n.t(`config.fields.${field.path}.label`));
	const option = (v: string): string =>
		field.optionLabels?.[v] ?? i18n.t(`config.options.${field.path}.${v}`);
	/** A configuration value as text (strings, numbers and flags as they are, the rest as JSON). */
	const text = (v: unknown): string =>
		typeof v === "string"
			? v
			: typeof v === "number" || typeof v === "boolean"
				? String(v)
				: JSON.stringify(v);
	const problem = $derived(resetting ? null : fieldProblem(field, value));
	const messages = $derived([
		...(problem
			? [
					problem === "range"
						? field.min !== undefined && field.max !== undefined
							? i18n.t("config.section.range", { min: field.min, max: field.max })
							: field.min !== undefined
								? i18n.t("config.section.min", { min: field.min })
								: i18n.t("config.section.max", { max: field.max ?? "" })
						: i18n.t(
								problem === "number"
									? "config.section.numberError"
									: problem === "pattern"
										? "config.section.patternError"
										: "config.section.required",
							),
				]
			: []),
		...errors,
	]);

	/** The saved value is not the default: worth telling it, and going back to it. */
	const custom = $derived(
		field.optional &&
			field.kind !== "fixed" &&
			field.defined &&
			!sameValue(field.value, field.default ?? null),
	);

	function show(v: unknown): string {
		if (v === null || v === undefined) {
			return field.nullable && ["integer", "number", "boolean"].includes(field.kind)
				? i18n.t("config.section.defaultAuto")
				: i18n.t("config.section.defaultNone");
		}
		if (typeof v === "boolean") {
			return i18n.t("config.section.default", {
				value: i18n.t(v ? "config.section.yes" : "config.section.no"),
			});
		}
		if (Array.isArray(v)) {
			return i18n.t("config.section.default", {
				value:
					field.kind === "choices"
						? v.map((x) => option(text(x))).join(", ")
						: v.join(", "),
			});
		}
		return i18n.t("config.section.default", {
			value: field.kind === "choice" ? option(text(v)) : text(v),
		});
	}

	const number = (raw: string): number | null => (raw.trim() === "" ? null : Number(raw));

	const lines = (raw: string): string[] =>
		raw
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
</script>

{#snippet control()}
	{#if field.kind === "fixed"}
		<p class="font-mono" data-testid={id}>
			{text(field.fixed)}
			<Hint as="span">({i18n.t("config.section.fixed")})</Hint>
		</p>
	{:else if field.kind === "boolean" && field.nullable}
		<Select
			value={value === null || value === undefined ? "" : text(value)}
			onchange={(e) =>
				onchange(e.currentTarget.value === "" ? null : e.currentTarget.value === "true")}
			disabled={resetting}
			data-testid={id}
		>
			<option value="">{i18n.t("config.section.auto")}</option>
			<option value="true">{i18n.t("config.section.yes")}</option>
			<option value="false">{i18n.t("config.section.no")}</option>
		</Select>
	{:else if field.kind === "choice"}
		<Select
			value={text(value ?? "")}
			onchange={(e) => onchange(e.currentTarget.value)}
			disabled={resetting}
			data-testid={id}
		>
			{#each field.options ?? [] as o (o)}
				<option value={o}>{option(o)}</option>
			{/each}
		</Select>
	{:else if field.kind === "choices"}
		{@const chosen = Array.isArray(value) ? value.map(String) : []}
		<Row gap="4" data-testid={id}>
			{#each field.options ?? [] as o (o)}
				<Checkbox
					checked={chosen.includes(o)}
					onchange={(e) =>
						onchange(
							e.currentTarget.checked
								? (field.options ?? []).filter((x) => x === o || chosen.includes(x))
								: chosen.filter((x) => x !== o),
						)}
					disabled={resetting}>{option(o)}</Checkbox
				>
			{/each}
		</Row>
	{:else if field.kind === "lines"}
		<textarea
			class="textarea font-mono"
			rows="4"
			value={Array.isArray(value) ? value.join("\n") : ""}
			oninput={(e) => onchange(lines(e.currentTarget.value))}
			disabled={resetting}
			data-testid={id}></textarea>
	{:else if field.kind === "integer" || field.kind === "number"}
		<Input
			type="number"
			class="max-w-60"
			value={typeof value === "number" ? value : ""}
			min={field.min}
			max={field.max}
			step={field.kind === "integer" ? 1 : "any"}
			placeholder={field.nullable ? i18n.t("config.section.auto") : undefined}
			oninput={(e) => onchange(number(e.currentTarget.value))}
			disabled={resetting}
			data-testid={id}
		/>
	{:else if field.kind === "date"}
		<Row align="center" gap="3">
			<Input
				type="date"
				class="max-w-60"
				value={typeof value === "string" ? value : ""}
				oninput={(e) => onchange(e.currentTarget.value || null)}
				disabled={resetting || value === null}
				aria-label={label}
				data-testid={id}
			/>
			{#if field.nullable}
				<Checkbox
					checked={value === null}
					onchange={(e) => onchange(e.currentTarget.checked ? null : "")}
					disabled={resetting}>{i18n.t("config.section.none")}</Checkbox
				>
			{/if}
		</Row>
	{:else}
		<Input
			type={field.kind === "email"
				? "email"
				: field.path.endsWith("ApiKey")
					? "password"
					: "text"}
			mono={field.pattern !== undefined}
			value={typeof value === "string" ? value : ""}
			maxlength={field.maxLength}
			placeholder={field.nullable ? i18n.t("config.section.auto") : undefined}
			oninput={(e) =>
				onchange(
					e.currentTarget.value === "" && field.nullable ? null : e.currentTarget.value,
				)}
			autocomplete="off"
			disabled={resetting}
			data-testid={id}
		/>
	{/if}
{/snippet}

<div class="space-y-1" data-testid="setting-row-{field.path}">
	{#if field.kind === "boolean" && !field.nullable}
		<Checkbox
			checked={value === true}
			onchange={(e) => onchange(e.currentTarget.checked)}
			disabled={resetting}
			data-testid={id}><span class="label-text">{label}</span></Checkbox
		>
	{:else if field.kind === "choices" || field.kind === "date" || field.kind === "fixed"}
		<fieldset class="space-y-1">
			<legend class="label-text">{label}</legend>
			{@render control()}
		</fieldset>
	{:else}
		<label class="label">
			<span class="label-text">{label}</span>
			{@render control()}
		</label>
	{/if}
	{@render extra?.(value)}
	<Hint as="span" class="block">{i18n.t(`config.fields.${field.path}.hint`)}</Hint>
	<Row align="center" gap="2" class="text-sm">
		<Hint as="span" mono>{field.path}</Hint>
		{#if custom}
			<Hint as="span">· {show(field.default ?? null)}</Hint>
		{/if}
	</Row>
	{#if resetting}
		<Row align="center" gap="2">
			<Hint as="span" tone="primary">{i18n.t("config.section.willReset")}</Hint>
			<Button size="sm" onclick={() => onreset(false)}
				>{i18n.t("common.actions.cancel")}</Button
			>
		</Row>
	{:else if custom}
		<Button
			size="sm"
			icon={ResetIcon}
			onclick={() => onreset(true)}
			data-testid="reset-{field.path}">{i18n.t("config.section.reset")}</Button
		>
	{/if}
	{#each messages as message (message)}
		<Hint as="span" tone="error" class="block" data-testid="field-error-{field.path}"
			>{message}</Hint
		>
	{/each}
</div>
