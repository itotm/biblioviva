<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Create/edit form of a patron (step 2.1), driven by a remote `form` (createPatron / updatePatron). -->
<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import { useI18n } from "#lib/i18n/context.js";
	import type { PatronFormInput } from "#lib/shared/patron-schema.js";
	import FormLayout from "#lib/ui/FormLayout.svelte";
	import FormSection from "#lib/ui/FormSection.svelte";
	import FormErrors from "#lib/components/FormErrors.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Field from "#lib/ui/Field.svelte";

	interface FieldApi {
		as: (type: string, value?: string) => Record<string, unknown>;
		issues: () => { message: string }[] | undefined;
		value: () => unknown;
	}
	interface FormApi {
		fields: Record<keyof PatronFormInput | "id", FieldApi> & {
			set: (values: Partial<PatronFormInput>) => unknown;
			allIssues: () => { path: (string | number)[]; message: string }[] | undefined;
		};
		pending: number;
	}

	interface Props {
		/** A remote `form` (createPatron, or updatePatron.for(id)); typed loosely so both fit. */
		form: object;
		/** The levels of the school and the active classes (Phase 12, `classOptions`). */
		rules: {
			levels: { code: string; label: string; name: string }[];
			groups: {
				id: number;
				kind: "students" | "teachers";
				name: string;
				label: string;
				levels: string[];
			}[];
			groupWord: string;
		};
		submitLabel: string;
		cancelHref: ResolvedPathname;
		/** Initial values (edit). */
		initial?: Partial<PatronFormInput>;
		/** Hidden id for the edit form. */
		id?: number;
	}

	const { form, rules, submitLabel, cancelHref, initial, id }: Props = $props();
	const i18n = useI18n();
	const api = $derived(form as unknown as FormApi);
	const fields = $derived(api.fields);

	// svelte-ignore state_referenced_locally
	let patronType = $state<string>(initial?.patronType ?? "student");
	const isStudent = $derived(patronType === "student");
	// the sections offered: the classes hosting the chosen level, or the teachers groups
	const level = $derived(
		(() => {
			const value: unknown = fields.levelCode.value();
			return typeof value === "string" ? value : "";
		})(),
	);
	const groupChoices = $derived(
		rules.groups.filter((g) =>
			isStudent
				? g.kind === "students" && (level === "" || g.levels.includes(level))
				: g.kind === "teachers",
		),
	);

	// Prefill once from the record being edited (the form state lives on the client).
	$effect(() => {
		if (initial) {
			api.fields.set({ ...initial });
		}
	});

	const labels = $derived({
		patronType: i18n.t("patrons.fields.patronType"),
		firstName: i18n.t("patrons.fields.firstName"),
		lastName: i18n.t("patrons.fields.lastName"),
		levelCode: i18n.t("patrons.fields.levelCode"),
		teacherGroup: i18n.t("patrons.fields.teacherGroup"),
		cardNumber: i18n.t("patrons.fields.cardNumber"),
		externalId: i18n.t("patrons.fields.externalId"),
		email: i18n.t("patrons.fields.email"),
		circulationNote: i18n.t("patrons.fields.circulationNote"),
		notes: i18n.t("patrons.fields.notes"),
	});

	function issuesOf(field: keyof PatronFormInput): string[] {
		return fields[field].issues()?.map((i) => i.message) ?? [];
	}
</script>

{#snippet fieldError(field: keyof PatronFormInput)}
	{#each issuesOf(field) as message (message)}
		<Hint tone="error" as="span" data-testid="field-error-{field}">{message}</Hint>
	{/each}
{/snippet}

<div class="space-y-6" data-testid="patron-form">
	{#if id !== undefined}<input {...fields.id.as("hidden", String(id))} />{/if}
	<FormErrors issues={api.fields.allIssues()?.filter((i) => i.path.length === 0)} />
	<FormLayout {...form as Record<string, unknown>}>
		<FormSection title={i18n.t("patrons.form.identity")}>
			<fieldset class="space-y-1">
				<legend class="label-text">{labels.patronType}</legend>
				<Row wrap={false} gap="4" role="radiogroup">
					{#each ["student", "teacher"] as t (t)}
						<Row wrap={false} align="center" as="label">
							<input
								{...fields.patronType.as("radio", t)}
								class="radio"
								checked={patronType === t}
								onchange={() => (patronType = t)}
							/>
							<span>{i18n.t(`patrons.types.${t}`)}</span>
						</Row>
					{/each}
				</Row>
			</fieldset>
			<Grid>
				<div>
					<Field label={labels.lastName}
						><Input
							{...fields.lastName.as("text")}
							required
							autocomplete="off"
						/></Field
					>
					{@render fieldError("lastName")}
				</div>
				<div>
					<Field label={labels.firstName}
						><Input
							{...fields.firstName.as("text")}
							required
							autocomplete="off"
						/></Field
					>
					{@render fieldError("firstName")}
				</div>
			</Grid>
		</FormSection>

		<FormSection title={i18n.t("patrons.form.school")}>
			<Grid>
				<div>
					<Field label={labels.levelCode}
						><Select {...fields.levelCode.as("select")} disabled={!isStudent}>
							<option value=""
								>{isStudent
									? i18n.t("patrons.form.classSelect")
									: i18n.t("patrons.fields.none")}</option
							>
							{#each rules.levels as l (l.code)}<option value={l.code}
									>{l.name}</option
								>{/each}
						</Select></Field
					>
					{@render fieldError("levelCode")}
				</div>
				<div>
					<Field label={isStudent ? rules.groupWord : labels.teacherGroup}
						><Select {...fields.groupId.as("select")}>
							<option value=""
								>{isStudent
									? i18n.t("patrons.form.classSelect")
									: i18n.t("patrons.form.defaultTeacherGroup")}</option
							>
							<!-- once the year is chosen a class of that year only is its section (`B`) -->
							{#each groupChoices as g (g.id)}<option value={String(g.id)}
									>{level !== "" && g.levels.length === 1
										? g.name
										: g.label}</option
								>{/each}
						</Select></Field
					>
					{@render fieldError("groupId")}
				</div>
			</Grid>
			<Grid>
				<div>
					<label class="label">
						<span class="label-text">{labels.cardNumber}</span>
						<Input mono {...fields.cardNumber.as("text")} autocomplete="off" />
						<Hint as="span">{i18n.t("patrons.fields.cardNumberHint")}</Hint>
					</label>
					{@render fieldError("cardNumber")}
				</div>
				<div>
					<Field label={labels.externalId}
						><Input {...fields.externalId.as("text")} autocomplete="off" /></Field
					>
					{@render fieldError("externalId")}
				</div>
			</Grid>
		</FormSection>

		<FormSection
			title={i18n.t("patrons.form.contacts")}
			collapsible
			open={Boolean(initial?.email)}
		>
			<Grid>
				<div>
					<Field label={labels.email} hint={i18n.t("patrons.fields.emailHint")}
						><Input {...fields.email.as("email")} autocomplete="off" /></Field
					>
					{@render fieldError("email")}
				</div>
			</Grid>
		</FormSection>

		<FormSection
			title={i18n.t("patrons.form.notes")}
			collapsible
			open={Boolean(initial?.circulationNote || initial?.notes)}
		>
			<div>
				<label class="label">
					<span class="label-text">{labels.circulationNote}</span>
					<Input {...fields.circulationNote.as("text")} />
					<Hint as="span">{i18n.t("patrons.fields.circulationNoteHint")}</Hint>
				</label>
				{@render fieldError("circulationNote")}
			</div>
			<div>
				<Field label={labels.notes}
					><textarea {...fields.notes.as("text")} class="textarea" rows="3"
					></textarea></Field
				>
				{@render fieldError("notes")}
			</div>
		</FormSection>

		{#snippet actions()}
			<Button href={cancelHref}>{i18n.t("common.actions.cancel")}</Button>
			<Button
				variant="primary"
				type="submit"
				disabled={api.pending > 0}
				data-testid="patron-submit"
				>{api.pending > 0 ? i18n.t("common.status.loading") : submitLabel}</Button
			>
		{/snippet}
	</FormLayout>
</div>
