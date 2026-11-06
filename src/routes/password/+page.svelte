<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- One's own password (step 9.51): from the account menu, or before anything else when an
     administrator gave the password ("Da cambiare al primo accesso"). The current password, the
     new one typed twice; the other sessions of the account close, this one stays. -->
<script lang="ts">
	import { goto, refreshAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import { changeOwnPassword } from "#lib/remote/password.remote.js";
	import { logout } from "#lib/remote/auth.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import EntryScreen from "#lib/ui/EntryScreen.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import PasswordInput from "#lib/ui/PasswordInput.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import { holdWait } from "#lib/ui/waits.svelte.js";

	const { data } = $props();
	const i18n = useI18n();
	const SaveIcon = icons.save;

	let current = $state("");
	let password = $state("");
	let repeat = $state("");
	let pending = $state(false);
	let problem = $state<string | null>(null);

	const tooShort = $derived(password !== "" && password.length < data.minPassword);
	const mismatch = $derived(repeat !== "" && repeat !== password);
	const ready = $derived(
		current !== "" && password.length >= data.minPassword && repeat === password,
	);

	async function save(): Promise<void> {
		pending = true;
		problem = null;
		const release = holdWait();
		try {
			const result = await changeOwnPassword({ current, password });
			if (!result.ok) {
				problem = i18n.t(`auth.change.errors.${result.code}`, { min: data.minPassword });
				return;
			}
			toaster.success({ title: i18n.t("auth.change.saved") });
			await refreshAll();
			await goto(resolve(""));
		} finally {
			release();
			pending = false;
		}
	}

	async function onLogout(): Promise<void> {
		await logout();
		await goto(resolve("login"));
	}
</script>

<svelte:head><title>{i18n.t("auth.change.title")} · {i18n.t("common.app.name")}</title></svelte:head
>

<EntryScreen>
	<section
		class="w-full max-w-sm space-y-5 card p-6 shadow-[var(--bv-shadow-raised)]"
		data-testid="password-page"
	>
		<header class="space-y-1">
			<h1 class="h3">{i18n.t("auth.change.title")}</h1>
			<Hint>{data.displayName}</Hint>
		</header>
		{#if data.forced}
			<Alert tone="warning" data-testid="password-forced"
				>{i18n.t("auth.change.forced")}</Alert
			>
		{/if}
		{#if data.demoPublic}
			<Alert tone="warning">{i18n.t("auth.change.demo")}</Alert>
		{/if}
		<form
			class="space-y-4"
			onsubmit={(e) => {
				e.preventDefault();
				if (ready && !pending) {
					void save();
				}
			}}
		>
			<Field label={i18n.t("auth.change.current")}
				><PasswordInput
					label={i18n.t("auth.change.current")}
					bind:value={current}
					autocomplete="current-password"
					data-testid="password-current"
				/></Field
			>
			<Field
				label={i18n.t("auth.change.new", { min: data.minPassword })}
				errors={tooShort
					? [i18n.t("auth.change.errors.passwordTooShort", { min: data.minPassword })]
					: []}
				><PasswordInput
					label={i18n.t("auth.change.new", { min: data.minPassword })}
					bind:value={password}
					autocomplete="new-password"
					data-testid="password-new"
				/></Field
			>
			<Field
				label={i18n.t("auth.change.repeat")}
				errors={mismatch ? [i18n.t("auth.change.errors.mismatch")] : []}
				><PasswordInput
					label={i18n.t("auth.change.repeat")}
					bind:value={repeat}
					autocomplete="new-password"
					data-testid="password-repeat"
				/></Field
			>
			<Hint tone="faint">{i18n.t("auth.change.hint")}</Hint>
			{#if problem}
				<Alert data-testid="password-problem">{problem}</Alert>
			{/if}
			<Row justify="end">
				{#if data.forced}
					<Button onclick={onLogout} disabled={pending}>{i18n.t("auth.logout")}</Button>
				{:else}
					<Button href="/" disabled={pending}>{i18n.t("common.actions.cancel")}</Button>
				{/if}
				<Button
					variant="primary"
					type="submit"
					icon={SaveIcon}
					disabled={!ready || pending || data.demoPublic}
					data-testid="password-save">{i18n.t("auth.change.save")}</Button
				>
			</Row>
		</form>
	</section>
</EntryScreen>
