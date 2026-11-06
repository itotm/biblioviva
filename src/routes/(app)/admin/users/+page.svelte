<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Staff accounts (step 1.8, edited here since step 11.7): the accounts of the configuration with
     "Nuovo account", "Modifica", "Nuova password" and "Elimina" for inactive ones; the roles over
     the fixed permissions; how people sign in; the hash helper for whoever edits the files. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import {
		generatePasswordHash,
		getAccounts,
		removeStaffAccount,
	} from "#lib/remote/accounts.remote.js";
	import { reloadConfiguration } from "#lib/remote/config.remote.js";
	import { issueLines } from "#lib/shared/config-issues.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import { copyText } from "#lib/ui/clipboard.js";
	import { toaster } from "#lib/ui/toaster.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import FormErrors from "#lib/components/FormErrors.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Field from "#lib/ui/Field.svelte";
	import AccountDialog from "#lib/components/config/AccountDialog.svelte";
	import RolesEditor from "#lib/components/config/RolesEditor.svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import Disclosure from "#lib/ui/Disclosure.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const fmt = useFormat();
	const MIN = 8;
	const ActiveIcon = icons.available;
	const InactiveIcon = icons.inactive;
	const WarnIcon = icons.damaged;
	const ReloadIcon = icons.renew;
	const KeyIcon = icons.card;
	const AddIcon = icons.add;
	const EditIcon = icons.edit;
	const RemoveIcon = icons.delete;

	type Account = NonNullable<typeof accounts.current>["accounts"][number];
	let dialogOpen = $state(false);
	let dialogMode = $state<"new" | "edit" | "password">("new");
	let dialogAccount = $state<Account | null>(null);
	let removeOpen = $state(false);
	let removing = $state<Account | null>(null);

	function openDialog(mode: "new" | "edit" | "password", account: Account | null): void {
		dialogMode = mode;
		dialogAccount = account;
		dialogOpen = true;
	}

	async function remove(): Promise<void> {
		if (!removing) {
			return;
		}
		const result = await removeStaffAccount({ username: removing.username });
		if (result.ok) {
			toaster.success({ title: i18n.t("admin.users.dialog.removed") });
		} else {
			toaster.error({
				title: i18n.t(`admin.users.errors.${result.code}`, {
					details: result.details.join(", "),
				}),
			});
		}
	}
	const permissionName = (p: string): string =>
		i18n.t(`admin.users.permissionNames.${p.replace(".", "_")}`);

	let password = $state("");
	let hash = $state("");
	let hashing = $state(false);
	let reloading = $state(false);
	let reloadErrors = $state<string[]>([]);
	const accounts = getAccounts();

	async function onGenerate(): Promise<void> {
		if (password.length < MIN) {
			toaster.error({ title: i18n.t("admin.users.hash.tooShort", { min: MIN }) });
			return;
		}
		hashing = true;
		try {
			hash = (await generatePasswordHash({ password })).hash;
			password = "";
		} finally {
			hashing = false;
		}
	}

	async function copyHash(): Promise<void> {
		if (await copyText(hash)) {
			toaster.success({ title: i18n.t("admin.users.hash.copied") });
		} else {
			toaster.error({ title: i18n.t("common.clipboard.failed") });
		}
	}

	async function onReload(): Promise<void> {
		reloading = true;
		reloadErrors = [];
		try {
			const result = await reloadConfiguration().updates(accounts);
			if (result.ok) {
				toaster.success({
					title:
						result.warnings.length > 0
							? i18n.t("admin.users.reload.successWithWarnings", {
									count: result.warnings.length,
								})
							: i18n.t("admin.users.reload.success"),
					description: result.warnings.join(" · "),
				});
			} else {
				reloadErrors = issueLines(result.issues);
				toaster.error({ title: i18n.t("admin.users.reload.failed") });
			}
		} finally {
			reloading = false;
		}
	}
</script>

<Page width="xl" gap="8">
	<PageHeader
		title={i18n.t("admin.users.title")}
		icon="patrons"
		backHref="/admin"
		backLabel={i18n.t("common.actions.back")}
	>
		{#snippet actions()}
			<Button
				variant="primary"
				icon={AddIcon}
				onclick={() => openDialog("new", null)}
				disabled={!accounts.current}
				data-testid="account-new">{i18n.t("admin.users.new")}</Button
			>
			<Button onclick={onReload} disabled={reloading} data-testid="reload-config"
				><ReloadIcon
					size={ICON_SIZE.md}
					aria-hidden="true"
					class={reloading ? "animate-spin" : ""}
				/>
				<span>{i18n.t("admin.users.reload.button")}</span></Button
			>
		{/snippet}
	</PageHeader>

	<FormErrors
		issues={null}
		message={reloadErrors.length ? reloadErrors.join(" · ") : undefined}
	/>

	<QueryState query={accounts}>
		{#snippet children(view)}
			{#if view.configSource === "example"}
				<Alert tone="warning" role="alert">
					{i18n.t("admin.users.reload.exampleSource")}
				</Alert>
			{/if}
			<Grid gap="3" as="ul" data-testid="accounts-list">
				{#each view.accounts as account (account.id)}
					<Card
						variant="outlined"
						gap="2"
						as="li"
						data-testid="account-{account.username}"
					>
						<Row wrap={false} align="start" justify="between">
							<div>
								<p class="font-semibold">
									{account.displayName ?? account.username}
								</p>
								<Hint>{account.username}</Hint>
							</div>
							{#if account.active}
								<Badge tone="success" filled icon={ActiveIcon}
									>{i18n.t("admin.users.status.active")}</Badge
								>
							{:else}
								<Badge tone="neutral" filled icon={InactiveIcon}
									>{i18n.t("admin.users.status.inactive")}</Badge
								>
							{/if}
						</Row>
						<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
							<dt class="opacity-70">{i18n.t("admin.users.fields.roles")}</dt>
							<dd>{account.roles.join(", ")}</dd>
							<dt class="opacity-70">{i18n.t("admin.users.fields.permissions")}</dt>
							<dd>{account.permissions.map(permissionName).join(", ")}</dd>
							<dt class="opacity-70">{i18n.t("admin.users.fields.lastLogin")}</dt>
							<dd>
								{account.lastLoginAt
									? fmt.dateTime(account.lastLoginAt)
									: i18n.t("admin.users.fields.never")}
							</dd>
						</dl>
						{#if account.plainPassword || !account.inConfig}
							<Alert
								tone="warning"
								class="flex items-center gap-2 py-1.5"
								data-testid="account-warning"
							>
								<WarnIcon size={ICON_SIZE.sm} aria-hidden="true" />
								{account.plainPassword
									? i18n.t("admin.users.status.plainPassword")
									: i18n.t("admin.users.status.notInConfig")}
							</Alert>
						{/if}
						{#if account.mustChangePassword}
							<Hint tone="primary" data-testid="account-must-change"
								>{i18n.t("admin.users.status.mustChange")}</Hint
							>
						{/if}
						{#if account.inConfig}
							<Row gap="2" class="mt-auto">
								<Button
									size="sm"
									icon={EditIcon}
									onclick={() => openDialog("edit", account)}
									data-testid="account-edit"
									>{i18n.t("common.actions.edit")}</Button
								>
								<Button
									size="sm"
									icon={KeyIcon}
									onclick={() => openDialog("password", account)}
									data-testid="account-password-button"
									>{i18n.t("admin.users.newPassword")}</Button
								>
								{#if !account.active}
									<Button
										size="sm"
										variant="error-outlined"
										icon={RemoveIcon}
										onclick={() => {
											removing = account;
											removeOpen = true;
										}}
										data-testid="account-remove"
										>{i18n.t("common.actions.delete")}</Button
									>
								{/if}
							</Row>
						{/if}
					</Card>
				{/each}
			</Grid>

			<RolesEditor roles={view.roleGrants} permissions={view.permissions} />

			<Card variant="outlined" gap="2" as="section" data-testid="auth-mode">
				<h2 class="title-lg">{i18n.t("admin.users.auth.title")}</h2>
				<p>{i18n.t(`admin.users.auth.${view.authMode}`)}</p>
				<Hint tone="faint">{i18n.t("admin.users.auth.personal")}</Hint>
			</Card>

			<Disclosure
				summary={i18n.t("admin.users.hash.disclosure")}
				data-testid="hash-disclosure"
			>
				<Card
					variant="outlined"
					gap="3"
					as="form"
					onsubmit={(e) => {
						e.preventDefault();
						void onGenerate();
					}}
					data-testid="hash-helper"
				>
					<h2 class="flex items-center gap-2 h4">
						<KeyIcon size={ICON_SIZE.md} aria-hidden="true" />
						{i18n.t("admin.users.hash.title")}
					</h2>
					<Hint>{i18n.t("admin.users.hash.description")}</Hint>
					<Field label={i18n.t("admin.users.hash.password", { min: MIN })}
						><Input
							type="text"
							autocomplete="off"
							spellcheck={false}
							bind:value={password}
							minlength={MIN}
							required
						/></Field
					>
					<Button variant="primary" type="submit" disabled={hashing}
						>{hashing
							? i18n.t("common.status.loading")
							: i18n.t("admin.users.hash.generate")}</Button
					>
					{#if hash}
						<Field label={i18n.t("admin.users.hash.result")}
							><textarea
								class="textarea font-mono text-xs"
								rows="3"
								readonly
								value={hash}
								data-testid="hash-output"></textarea></Field
						>
						<Button onclick={copyHash}>{i18n.t("admin.users.hash.copy")}</Button>
					{/if}
				</Card>
			</Disclosure>
			<AccountDialog
				bind:open={dialogOpen}
				mode={dialogMode}
				account={dialogAccount}
				roles={view.roles}
				minPassword={view.minPassword}
			/>
		{/snippet}
	</QueryState>
</Page>

<ConfirmDialog
	bind:open={removeOpen}
	title={i18n.t("admin.users.dialog.removeTitle", { name: removing?.username ?? "" })}
	description={i18n.t("admin.users.dialog.removeHint")}
	tone="error"
	confirmLabel={i18n.t("common.actions.delete")}
	onconfirm={remove}
/>
