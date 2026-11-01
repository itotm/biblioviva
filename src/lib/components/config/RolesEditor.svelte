<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Roles over the fixed permission list (step 11.7): one row per role with a checkbox per
     permission ("Tutto" grants every permission, present and future), the accounts holding it; a
     renamed role is followed by its accounts, a role in use cannot be removed; saved as one change
     that must leave an active account with the `admin` permission. -->
<script lang="ts">
	import { untrack } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { saveStaffRoles } from "#lib/remote/accounts.remote.js";
	import type { Permission, RoleGrant } from "#lib/shared/permissions.js";
	import { ENTRY_ID } from "#lib/shared/input-schemas.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Table from "#lib/ui/Table.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";

	interface RoleView {
		name: string;
		grants: RoleGrant[];
		usedBy: string[];
	}

	interface Props {
		roles: RoleView[];
		permissions: readonly Permission[];
	}

	const { roles, permissions }: Props = $props();
	const i18n = useI18n();
	const SaveIcon = icons.save;
	const UndoIcon = icons.undo;
	const AddIcon = icons.add;
	const RemoveIcon = icons.delete;

	interface Draft {
		key: number;
		originalName: string | null;
		name: string;
		grants: RoleGrant[];
		usedBy: string[];
	}
	let rows = $state<Draft[]>([]);
	let saved = $state("");
	let pending = $state(false);
	let problem = $state<string | null>(null);
	let nextKey = 0;
	const draft = $derived(
		rows.map((r) => ({ originalName: r.originalName, name: r.name.trim(), grants: r.grants })),
	);

	function load(): void {
		rows = roles.map((r) => ({
			key: nextKey++,
			originalName: r.name,
			name: r.name,
			grants: [...r.grants],
			usedBy: r.usedBy,
		}));
		saved = JSON.stringify(draft);
	}
	// again from the server after every save (the query refreshes the props)
	$effect(() => {
		if (roles.length > 0) {
			untrack(load);
		}
	});
	const dirty = $derived(JSON.stringify(draft) !== saved);
	const nameProblem = (r: Draft): string | null =>
		!ENTRY_ID.test(r.name.trim())
			? i18n.t("admin.users.roles.badName")
			: rows.some((o) => o !== r && o.name.trim() === r.name.trim())
				? i18n.t("admin.users.errors.roleTaken", { details: r.name })
				: null;
	const invalid = $derived(rows.some((r) => nameProblem(r) !== null));

	function toggle(r: Draft, p: RoleGrant, on: boolean): void {
		if (p === "*") {
			r.grants = on ? ["*"] : [];
		} else {
			r.grants = on
				? [...r.grants.filter((g) => g !== "*"), p]
				: r.grants.filter((g) => g !== p);
		}
	}

	function add(): void {
		let name = "nuovo-ruolo";
		for (let i = 2; rows.some((r) => r.name === name); i++) {
			name = `nuovo-ruolo-${i}`;
		}
		rows = [...rows, { key: nextKey++, originalName: null, name, grants: [], usedBy: [] }];
	}

	async function save(): Promise<void> {
		pending = true;
		problem = null;
		try {
			const result = await saveStaffRoles({ roles: draft });
			if (result.ok) {
				toaster.success({ title: i18n.t("admin.users.roles.saved") });
			} else {
				problem = i18n.t(`admin.users.errors.${result.code}`, {
					details: result.details.join(", "),
				});
			}
		} finally {
			pending = false;
		}
	}

	const GRANTS = $derived<RoleGrant[]>(["*", ...permissions]);
	const permissionName = (p: RoleGrant): string =>
		i18n.t(`admin.users.permissionNames.${p === "*" ? "all" : p.replace(".", "_")}`);
</script>

<Card variant="outlined" gap="3" as="section" data-testid="roles-editor">
	<h2 class="title-lg">{i18n.t("admin.users.roles.title")}</h2>
	<Hint>{i18n.t("admin.users.roles.hint")}</Hint>
	<div class="overflow-x-auto">
		<Table form>
			<thead>
				<tr>
					<th>{i18n.t("admin.users.roles.name")}</th>
					{#each GRANTS as p (p)}
						<th class="text-center">{permissionName(p)}</th>
					{/each}
					<th><span class="sr-only">{i18n.t("common.actions.delete")}</span></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.key)}
					{@const problemText = nameProblem(r)}
					<tr data-testid="role-row" data-role={r.originalName ?? ""}>
						<td>
							<Input
								mono
								class="w-40"
								bind:value={r.name}
								maxlength={32}
								aria-label={i18n.t("admin.users.roles.name")}
								aria-invalid={problemText ? "true" : undefined}
								data-testid="role-name"
							/>
							{#if problemText}<Hint tone="error">{problemText}</Hint>{/if}
							<Hint tone="faint" class="block"
								>{r.usedBy.length > 0
									? r.usedBy.join(", ")
									: i18n.t("admin.users.roles.unused")}</Hint
							>
						</td>
						{#each GRANTS as p (p)}
							<td class="text-center">
								<input
									type="checkbox"
									class="mt-2 checkbox"
									checked={r.grants.includes(p) ||
										(p !== "*" && r.grants.includes("*"))}
									disabled={p !== "*" && r.grants.includes("*")}
									onchange={(e) => toggle(r, p, e.currentTarget.checked)}
									aria-label="{r.name}: {permissionName(p)}"
									data-testid="role-grant-{p}"
								/>
							</td>
						{/each}
						<td>
							<IconButton
								icon={RemoveIcon}
								label={i18n.t("common.actions.delete")}
								variant="error"
								size="sm"
								disabled={r.usedBy.length > 0}
								onclick={() => (rows = rows.filter((x) => x.key !== r.key))}
								data-testid="role-remove"
							/>
						</td>
					</tr>
				{/each}
			</tbody>
		</Table>
	</div>
	{#if problem}<Alert data-testid="roles-problem">{problem}</Alert>{/if}
	<Row justify="between" align="center">
		<Button icon={AddIcon} onclick={add} data-testid="role-add"
			>{i18n.t("admin.users.roles.add")}</Button
		>
		<Row>
			<Button icon={UndoIcon} onclick={load} disabled={!dirty || pending}
				>{i18n.t("config.section.discard")}</Button
			>
			<Button
				variant="primary"
				icon={SaveIcon}
				onclick={save}
				disabled={!dirty || invalid || pending}
				data-testid="roles-save">{i18n.t("config.section.save")}</Button
			>
		</Row>
	</Row>
</Card>
