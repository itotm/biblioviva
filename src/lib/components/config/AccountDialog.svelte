<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A staff account created or edited, or given a new password (step 11.7): username, name shown,
     roles, active; the password typed twice and sent once, written as a hash by the server, and
     to change at the first login when the account is a person's (9.51, on by default). -->
<script lang="ts">
	import PasswordInput from "#lib/ui/PasswordInput.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { saveStaffAccount } from "#lib/remote/accounts.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";

	interface AccountRow {
		username: string;
		displayName: string | null;
		roles: string[];
		active: boolean;
	}

	interface Props {
		open?: boolean;
		/** `new`: a new account; `edit`: name, roles, active; `password`: only a new password. */
		mode: "new" | "edit" | "password";
		account: AccountRow | null;
		roles: string[];
		minPassword: number;
	}

	let { open = $bindable(false), mode, account, roles, minPassword }: Props = $props();
	const i18n = useI18n();
	const SaveIcon = icons.save;
	const USERNAME = /^[a-z0-9._-]{2,32}$/;

	let username = $state("");
	let displayName = $state("");
	let chosen = $state<string[]>([]);
	let active = $state(true);
	let password = $state("");
	let repeat = $state("");
	let mustChange = $state(true);
	let pending = $state(false);
	let problem = $state<string | null>(null);

	$effect(() => {
		if (open) {
			username = account?.username ?? "";
			displayName = account?.displayName ?? "";
			chosen = [...(account?.roles ?? [])];
			active = account?.active ?? true;
			password = "";
			repeat = "";
			mustChange = true;
			problem = null;
		}
	});

	const askPassword = $derived(mode !== "edit");
	const usernameProblem = $derived(
		mode !== "password" && username && !USERNAME.test(username)
			? i18n.t("admin.users.dialog.badUsername")
			: null,
	);
	const passwordProblem = $derived(
		!askPassword || !password
			? null
			: password.length < minPassword
				? i18n.t("admin.users.hash.tooShort", { min: minPassword })
				: repeat && repeat !== password
					? i18n.t("admin.users.dialog.mismatch")
					: null,
	);
	const ready = $derived(
		USERNAME.test(username) &&
			chosen.length > 0 &&
			(!askPassword ||
				(password.length >= minPassword && repeat === password && password !== "")),
	);

	async function save(): Promise<void> {
		pending = true;
		problem = null;
		try {
			const result = await saveStaffAccount({
				originalUsername: mode === "new" ? null : (account?.username ?? null),
				username,
				displayName,
				roles: chosen,
				active,
				...(askPassword ? { password, mustChangePassword: mustChange } : {}),
			});
			if (result.ok) {
				open = false;
				toaster.success({ title: i18n.t(`admin.users.dialog.saved.${mode}`) });
			} else {
				problem = i18n.t(`admin.users.errors.${result.code}`, {
					details: result.details.join(", "),
				});
			}
		} finally {
			pending = false;
		}
	}
</script>

<Modal
	bind:open
	title={i18n.t(`admin.users.dialog.title.${mode}`, {
		name: account?.username ?? "",
	})}
	animated
	data-testid="account-dialog"
>
	<form
		class="space-y-3"
		onsubmit={(e) => {
			e.preventDefault();
			if (ready && !pending) {
				void save();
			}
		}}
	>
		{#if mode !== "password"}
			<Field
				label={i18n.t("admin.users.dialog.username")}
				hint={i18n.t("admin.users.dialog.usernameHint")}
				errors={usernameProblem ? [usernameProblem] : []}
			>
				<Input
					mono
					bind:value={username}
					maxlength={32}
					autocomplete="off"
					data-testid="account-username"
				/>
			</Field>
			<Field label={i18n.t("admin.users.dialog.displayName")}>
				<Input
					bind:value={displayName}
					maxlength={120}
					data-testid="account-display-name"
				/>
			</Field>
			<fieldset class="space-y-1">
				<legend class="label-text">{i18n.t("admin.users.fields.roles")}</legend>
				<Row gap="4">
					{#each roles as r (r)}
						<Checkbox
							checked={chosen.includes(r)}
							onchange={(e) =>
								(chosen = e.currentTarget.checked
									? [...chosen, r]
									: chosen.filter((x) => x !== r))}
							data-testid="account-role-{r}">{r}</Checkbox
						>
					{/each}
				</Row>
				{#if chosen.length === 0}
					<Hint tone="error">{i18n.t("admin.users.errors.noRoles")}</Hint>
				{/if}
			</fieldset>
			<Checkbox bind:checked={active} data-testid="account-active"
				>{i18n.t("admin.users.dialog.active")}</Checkbox
			>
		{/if}
		{#if askPassword}
			<Field
				label={i18n.t("admin.users.dialog.password", { min: minPassword })}
				errors={passwordProblem ? [passwordProblem] : []}
			>
				<PasswordInput
					label={i18n.t("admin.users.dialog.password", { min: minPassword })}
					bind:value={password}
					autocomplete="new-password"
					data-testid="account-password"
				/>
			</Field>
			<Field label={i18n.t("admin.users.dialog.repeat")}>
				<PasswordInput
					label={i18n.t("admin.users.dialog.repeat")}
					bind:value={repeat}
					autocomplete="new-password"
					data-testid="account-password-repeat"
				/>
			</Field>
			<Hint tone="faint">{i18n.t("admin.users.dialog.passwordHint")}</Hint>
			<div class="space-y-1">
				<Checkbox bind:checked={mustChange} data-testid="account-must-change-box"
					>{i18n.t("admin.users.dialog.mustChange")}</Checkbox
				>
				<Hint tone="faint">{i18n.t("admin.users.dialog.mustChangeHint")}</Hint>
			</div>
		{/if}
		{#if problem}
			<Alert data-testid="account-problem">{problem}</Alert>
		{/if}
		<Row justify="end" as="footer">
			<Button onclick={() => (open = false)} disabled={pending}
				>{i18n.t("common.actions.cancel")}</Button
			>
			<Button
				variant="primary"
				type="submit"
				icon={SaveIcon}
				disabled={!ready || pending}
				data-testid="account-save">{i18n.t("config.section.save")}</Button
			>
		</Row>
	</form>
</Modal>
